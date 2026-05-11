# Lab — Lecture 10: Performance Management

**Lecture topic:** Monitoring performance, Automatic Memory Management (AMM), Memory Advisors, dynamic performance views, invalid/unusable objects  
**Your server:** `taufiq-db` — connect via `ssh taufiq@100.75.213.36`

---

## Objective

Replicate Oracle's performance monitoring toolkit — Enterprise Manager Performance page, AMM, V$ views for wait events and system stats — using PostgreSQL's built-in statistics infrastructure on your live server.

---

## Setup

```sql
sudo -u postgres psql
CREATE DATABASE perflab;
\c perflab

-- Create a sample workload table:
CREATE TABLE orders (
  order_id    SERIAL PRIMARY KEY,
  customer    VARCHAR(100),
  amount      NUMERIC(12,2),
  status      VARCHAR(20),
  created_at  TIMESTAMP DEFAULT now()
);

-- Load 100,000 rows for realistic performance testing:
INSERT INTO orders (customer, amount, status)
SELECT
  'Customer ' || (random() * 1000)::int,
  (random() * 5000)::numeric(12,2),
  (ARRAY['pending','completed','cancelled'])[ceil(random()*3)]
FROM generate_series(1, 100000);
```

---

## Part 1 — Memory Management (Lecture 10, Slide 9)

Oracle's AMM lets you set `MEMORY_TARGET` and Oracle distributes memory between SGA and PGA automatically. PostgreSQL manages memory through individual parameters.

```sql
\c perflab

-- View current memory allocation (equivalent of Oracle's AMM overview):
SELECT name, setting,
  CASE unit
    WHEN '8kB' THEN (setting::bigint * 8192 / 1024 / 1024) || ' MB'
    WHEN 'kB'  THEN (setting::bigint / 1024) || ' MB'
    ELSE setting || ' ' || COALESCE(unit, '')
  END AS human_readable
FROM pg_settings
WHERE name IN (
  'shared_buffers',       -- Oracle: DB_CACHE_SIZE (SGA Buffer Cache)
  'wal_buffers',          -- Oracle: LOG_BUFFER (SGA Redo Buffer)
  'work_mem',             -- Oracle: PGA_AGGREGATE_TARGET per sort
  'maintenance_work_mem', -- Oracle: Large Pool
  'effective_cache_size'  -- Oracle: AMM total memory hint
);
```

### Tune memory like Oracle's Memory Advisor

```bash
# View total RAM available on your server:
free -h

# Current PostgreSQL memory footprint:
ps aux | grep postgres | awk '{sum += $6} END {print sum/1024 " MB total RSS"}'
```

```sql
-- Simulate Oracle's Memory Advisor recommendation:
-- If your buffer cache hit ratio is low, increase shared_buffers

SELECT
  datname,
  blks_hit,
  blks_read,
  CASE WHEN (blks_hit + blks_read) > 0
    THEN round(blks_hit * 100.0 / (blks_hit + blks_read), 2)
    ELSE 0
  END AS cache_hit_pct
FROM pg_stat_database
WHERE datname = 'perflab';

-- If cache_hit_pct < 95%, increase shared_buffers:
-- ALTER SYSTEM SET shared_buffers = '256MB';
-- SELECT pg_reload_conf();
```

---

## Part 2 — Performance Monitoring: Wait Events (Lecture 10, Slide 3-5)

Oracle's Enterprise Manager Performance page shows the top wait events. PostgreSQL exposes these through `pg_stat_activity`.

```sql
-- Equivalent of Oracle's "Top Wait Events" (EM Performance page):
SELECT wait_event_type, wait_event, count(*) AS sessions_waiting
FROM pg_stat_activity
WHERE wait_event IS NOT NULL
GROUP BY wait_event_type, wait_event
ORDER BY sessions_waiting DESC;

-- Equivalent of V$SYSTEM_EVENT (Slide 13):
SELECT event,
       waits,
       round(time_ms) AS time_ms,
       round(time_ms / NULLIF(waits, 0), 2) AS avg_ms
FROM pg_wait_sampling_profile  -- requires pg_wait_sampling extension
LIMIT 20;
-- If extension not available, use this instead:
SELECT wait_event_type, wait_event, state, count(*)
FROM pg_stat_activity
GROUP BY wait_event_type, wait_event, state
ORDER BY count(*) DESC;
```

### Generate waits to observe (simulate lock wait):

Open a second terminal and run:

**Terminal 1:**
```sql
\c perflab
BEGIN;
UPDATE orders SET status = 'processing' WHERE order_id = 1;
-- Hold this, don't commit
```

**Terminal 2:**
```sql
\c perflab
-- This will show as a Lock wait:
SELECT wait_event_type, wait_event, state, query
FROM pg_stat_activity
WHERE wait_event IS NOT NULL;
```

---

## Part 3 — Top Sessions and Throughput (Lecture 10, Slide 7-8)

```sql
-- Equivalent of EM "Top Sessions" (Slide 7):
SELECT
  pid,
  usename,
  application_name,
  state,
  wait_event_type,
  wait_event,
  round(extract(epoch from (now() - query_start))::numeric, 1) AS query_seconds,
  left(query, 80) AS current_query
FROM pg_stat_activity
WHERE state != 'idle'
AND pid != pg_backend_pid()
ORDER BY query_seconds DESC NULLS LAST;

-- Equivalent of EM "Throughput" page (Slide 6):
SELECT
  datname,
  xact_commit    AS commits_total,
  xact_rollback  AS rollbacks_total,
  tup_inserted   AS rows_inserted,
  tup_updated    AS rows_updated,
  tup_deleted    AS rows_deleted,
  tup_fetched    AS rows_fetched
FROM pg_stat_database
WHERE datname = 'perflab';
```

---

## Part 4 — Dynamic Performance Views (Lecture 10, Slide 13-15)

Your slides show 5 categories of V$ views. Here are the PostgreSQL equivalents for each:

```sql
-- V$SYSSTAT equivalent (cumulative stats):
SELECT datname, xact_commit, xact_rollback, blks_read, blks_hit
FROM pg_stat_database WHERE datname = 'perflab';

-- V$SESSION_EVENT equivalent (per-session waits):
SELECT pid, wait_event_type, wait_event, state
FROM pg_stat_activity WHERE pid != pg_backend_pid();

-- V$LOCK equivalent (contention):
SELECT locktype, relation::regclass, mode, granted, pid
FROM pg_locks WHERE relation IS NOT NULL;

-- V$BUFFER_POOL_STATISTICS equivalent (memory):
SELECT * FROM pg_buffercache_summary();
-- Requires: CREATE EXTENSION pg_buffercache;

-- V$DATAFILE / V$FILESTAT equivalent (disk I/O):
SELECT relname,
  heap_blks_read,
  heap_blks_hit,
  idx_blks_read,
  idx_blks_hit
FROM pg_statio_user_tables
ORDER BY heap_blks_read DESC;
```

---

## Part 5 — Invalid and Unusable Objects (Lecture 10, Slide 16)

Oracle flags PL/SQL objects as INVALID when dependencies change. PostgreSQL handles this differently — let's find broken objects.

```sql
\c perflab

-- Create a view that depends on the orders table:
CREATE VIEW pending_orders AS
SELECT * FROM orders WHERE status = 'pending';

-- Drop a column that the view depends on (simulates invalid object):
-- (In PostgreSQL this would fail with CASCADE warning)

-- Find potentially broken views:
SELECT schemaname, viewname, definition
FROM pg_views
WHERE schemaname = 'public';

-- Check for invalid indexes (unusable in Oracle terms):
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public';

-- Rebuild an index (equivalent of Oracle REBUILD UNUSABLE):
REINDEX INDEX orders_pkey;

-- Rebuild all indexes on a table:
REINDEX TABLE orders;

-- Find tables with bloated/outdated statistics (need ANALYZE):
SELECT relname, last_analyze, last_autoanalyze,
  CASE WHEN last_analyze IS NULL THEN 'NEVER ANALYZED'
       WHEN last_analyze < now() - interval '7 days' THEN 'STALE'
       ELSE 'OK'
  END AS stats_status
FROM pg_stat_user_tables;
```

---

## Part 6 — Generate and analyse a real workload

```sql
\c perflab

-- Enable query statistics:
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Run queries without an index (slow):
EXPLAIN ANALYZE SELECT * FROM orders WHERE status = 'pending';

-- Note the execution time, then add an index:
CREATE INDEX idx_orders_status ON orders(status);

-- Run again and compare:
EXPLAIN ANALYZE SELECT * FROM orders WHERE status = 'pending';

-- See which queries use the most time (Oracle: Top SQL in AWR):
SELECT left(query, 100) AS query,
       calls,
       round(total_exec_time::numeric, 2) AS total_ms,
       round(mean_exec_time::numeric, 2) AS avg_ms,
       rows
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_%'
ORDER BY total_exec_time DESC
LIMIT 10;
```

---

## Checklist

- [ ] Observed memory allocation (shared_buffers, wal_buffers, work_mem)
- [ ] Calculated buffer cache hit ratio and assessed if tuning needed
- [ ] Observed wait events in `pg_stat_activity`
- [ ] Simulated a lock wait and saw it appear as a wait event
- [ ] Queried top sessions and throughput statistics
- [ ] Mapped all 5 V$ view categories to PostgreSQL equivalents
- [ ] Found and rebuilt indexes (equivalent of Oracle REBUILD UNUSABLE)
- [ ] Used EXPLAIN ANALYZE to compare query plans before/after index
- [ ] Used `pg_stat_statements` to find top SQL by execution time

---

## Key takeaway

Oracle's Enterprise Manager Performance page = PostgreSQL's `pg_stat_activity` + `pg_stat_database` + `pg_stat_statements` + `EXPLAIN ANALYZE`. The data is identical — wait events, top sessions, buffer hit ratios, throughput counters. PostgreSQL just exposes it through SQL views instead of a GUI. Oracle's AMM auto-tunes memory; PostgreSQL requires you to set `shared_buffers` and `work_mem` manually — but the Memory Advisor concept maps to checking your cache hit ratio and adjusting accordingly.
