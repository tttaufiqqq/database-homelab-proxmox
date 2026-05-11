# Lab — Lecture 10: Performance Management

**Lecture topic:** Monitoring performance, Automatic Memory Management (AMM), Memory Advisors, dynamic performance views, invalid/unusable objects  
**Your server:** `taufiq-db` — connect via `ssh taufiq@100.75.213.36`  
**Completed:** 2026-05-02

---

## Objective

Replicate Oracle's performance monitoring toolkit — Enterprise Manager Performance page, AMM, V$ views for wait events and system stats — using PostgreSQL's built-in statistics infrastructure on your live server.

---

## Setup

```sql
sudo -u postgres psql
CREATE DATABASE perflab;
\c perflab

CREATE TABLE orders (
  order_id    SERIAL PRIMARY KEY,
  customer    VARCHAR(100),
  amount      NUMERIC(12,2),
  status      VARCHAR(20),
  created_at  TIMESTAMP DEFAULT now()
);

INSERT INTO orders (customer, amount, status)
SELECT
  'Customer ' || (random() * 1000)::int,
  (random() * 5000)::numeric(12,2),
  (ARRAY['pending','completed','cancelled'])[ceil(random()*3)]
FROM generate_series(1, 100000);
```

### ✅ Result
```
INSERT 0 100000
```

---

## Part 1 — Memory Management (Lecture 10, Slide 9)

```sql
SELECT name, setting,
  CASE unit
    WHEN '8kB' THEN (setting::bigint * 8192 / 1024 / 1024) || ' MB'
    WHEN 'kB'  THEN (setting::bigint / 1024) || ' MB'
    ELSE setting || ' ' || COALESCE(unit, '')
  END AS human_readable
FROM pg_settings
WHERE name IN (
  'shared_buffers',
  'wal_buffers',
  'work_mem',
  'maintenance_work_mem',
  'effective_cache_size'
);
```

### ✅ Results observed

```
         name         | setting | human_readable
----------------------+---------+----------------
 effective_cache_size | 524288  | 4096 MB
 maintenance_work_mem | 65536   | 64 MB
 shared_buffers       | 16384   | 128 MB
 wal_buffers          | 512     | 4 MB
 work_mem             | 8192    | 8 MB
```

| Parameter | Value | Oracle equivalent | Assessment |
|---|---|---|---|
| `shared_buffers` | 128 MB | DB Buffer Cache (SGA) | Default — low for 7.65 GB RAM. Oracle AMM would auto-tune to ~1.5 GB (20% of RAM) |
| `wal_buffers` | 4 MB | Redo Log Buffer (SGA) | Fine for current workload |
| `work_mem` | 8 MB | PGA sort area per query | Previously tuned from 4 MB using ALTER SYSTEM ✅ |
| `maintenance_work_mem` | 64 MB | Large Pool | Good for VACUUM and index builds |
| `effective_cache_size` | 4096 MB | AMM total memory hint | Optimizer hint only — not actual allocation |

**Key observation:** `shared_buffers` at 128 MB is the PostgreSQL default. Oracle's AMM would have auto-tuned this upward. The Memory Advisor only recommends increasing it when the cache hit ratio drops below 95% — confirmed in the next query.

### Cache hit ratio check

```sql
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
```

### ✅ Results observed

```
 datname | blks_hit | blks_read | cache_hit_pct
---------+----------+-----------+---------------
 perflab |   407704 |         1 |        100.00
```

100% cache hit ratio. The single `blks_read` was the initial load when data first came off disk. Everything since has been served from memory. No tuning required — Oracle's Memory Advisor would reach the same conclusion.

---

## Part 2 — Wait Events (Lecture 10, Slides 3-5)

### Baseline — no contention

```sql
SELECT wait_event_type, wait_event, count(*) AS sessions_waiting
FROM pg_stat_activity
WHERE wait_event IS NOT NULL
GROUP BY wait_event_type, wait_event
ORDER BY sessions_waiting DESC;
```

### ✅ Baseline results

```
 wait_event_type |      wait_event      | sessions_waiting
-----------------+----------------------+------------------
 Activity        | BgWriterHibernate    |                1
 Timeout         | CheckpointWriteDelay |                1
 Activity        | WalWriterMain        |                1
 Activity        | LogicalLauncherMain  |                1
 Activity        | AutoVacuumMain       |                1
```

| Wait event | Oracle equivalent | Meaning |
|---|---|---|
| `BgWriterHibernate` | DBWn idle | Background writer sleeping — no dirty buffers to write |
| `CheckpointWriteDelay` | CKPT pacing | Checkpointer throttling I/O to avoid a spike |
| `WalWriterMain` | LGWR idle | WAL writer sleeping — no redo to flush |
| `LogicalLauncherMain` | ARCn idle | Replication launcher idle |
| `AutoVacuumMain` | SMON idle | Autovacuum sleeping |

### Under lock contention (2 terminals)

**Terminal 1:**
```sql
BEGIN;
UPDATE orders SET status = 'processing' WHERE order_id = 1;
-- Hold open, do not commit
```

**Terminal 2:**
```sql
sudo -u postgres psql -d perflab
UPDATE orders SET status = 'done' WHERE order_id = 1;
-- Hangs immediately
```

**Terminal 3 — wait events during contention:**
```
 wait_event_type |      wait_event      | sessions_waiting
-----------------+----------------------+------------------
 Activity        | BgWriterHibernate    |                1
 Timeout         | CheckpointWriteDelay |                1
 Activity        | WalWriterMain        |                1
 Activity        | LogicalLauncherMain  |                1
 Client          | ClientRead           |                1
 Activity        | AutoVacuumMain       |                1
 Lock            | transactionid        |                1
```

**Two new entries appeared under contention:**

| New wait event | Type | What it means |
|---|---|---|
| `ClientRead` | Client | Terminal 1 sitting idle in `perflab=*#` — session is holding an open transaction waiting for client input |
| `transactionid` | **Lock** | Terminal 2 blocked waiting for Terminal 1's transaction ID to release — equivalent of Oracle's enqueue wait from Slide 4 |

The `Lock / transactionid` entry is exactly what Oracle Enterprise Manager shows as a lock wait on the Performance page. Terminal 2 unblocked instantly the moment Terminal 1 ran `COMMIT`.

---

## Part 3 — Top Sessions and Throughput (Lecture 10, Slides 6-8)

```sql
-- Top sessions:
SELECT
  pid, usename, application_name, state,
  wait_event_type, wait_event,
  round(extract(epoch from (now() - query_start))::numeric, 1) AS query_seconds,
  left(query, 80) AS current_query
FROM pg_stat_activity
WHERE state != 'idle'
AND pid != pg_backend_pid()
ORDER BY query_seconds DESC NULLS LAST;
```

### ✅ Results observed

```
 pid | usename | application_name | state | wait_event_type | wait_event | query_seconds | current_query
-----+---------+------------------+-------+-----------------+------------+---------------+---------------
(0 rows)
```

Empty — all sessions idle between queries. In a production environment during business hours this would show multiple active sessions with their queries and wait states, equivalent to Oracle's EM Top Sessions page.

```sql
-- Throughput:
SELECT datname, xact_commit, xact_rollback,
       tup_inserted, tup_updated, tup_deleted, tup_fetched
FROM pg_stat_database
WHERE datname = 'perflab';
```

### ✅ Results observed

```
 datname | commits_total | rollbacks_total | rows_inserted | rows_updated | rows_deleted | rows_fetched
---------+---------------+-----------------+---------------+--------------+--------------+--------------
 perflab |            37 |               0 |        100046 |            5 |            0 |         2742
```

| Metric | Value | Explanation |
|---|---|---|
| `commits_total` | 37 | Every query, connection, and setup step |
| `rollbacks_total` | 0 | Clean — no aborted transactions |
| `rows_inserted` | 100,046 | 100,000 initial load + 46 setup rows |
| `rows_updated` | 5 | UPDATE exercises from Parts 1 and 2 |
| `rows_deleted` | 0 | Nothing deleted |
| `rows_fetched` | 2,742 | All SELECT queries run during the lab |

Maps directly to Oracle's EM Throughput page (Slide 6) — same counters, just cumulative since database creation rather than per interval.

---

## Part 4 — Dynamic Performance Views (Lecture 10, Slides 13-15)

```sql
-- V$FILESTAT equivalent:
SELECT relname, heap_blks_read, heap_blks_hit, idx_blks_read, idx_blks_hit
FROM pg_statio_user_tables
ORDER BY heap_blks_read DESC;
```

### ✅ Results observed

```
 relname | heap_blks_read | heap_blks_hit | idx_blks_read | idx_blks_hit
---------+----------------+---------------+---------------+--------------
 orders  |              0 |        104666 |             1 |       199877
```

Zero disk reads for table data — 100% served from buffer cache. One index block read from disk on first access, everything after from memory. Confirms the cache hit ratio from Part 1.

```sql
-- V$LOCK equivalent:
SELECT locktype, relation::regclass, mode, granted, pid
FROM pg_locks WHERE relation IS NOT NULL;
```

### ✅ Results observed

```
 locktype | relation |      mode       | granted | pid
----------+----------+-----------------+---------+------
 relation | pg_locks | AccessShareLock | t       | 5454
```

Only the observation query's own `AccessShareLock` on `pg_locks`. Clean lock state — no contention. During Part 2's lock exercise this view would have shown `RowExclusiveLock` and `transactionid` entries identical to Lec 7 Part 3.

---

## Part 5 — Invalid and Unusable Objects (Lecture 10, Slide 16)

```sql
SELECT schemaname, tablename, indexname FROM pg_indexes WHERE schemaname = 'public';

SELECT relname, last_analyze, last_autoanalyze FROM pg_stat_user_tables;
```

### ✅ Results observed

```
 schemaname | tablename |  indexname
------------+-----------+-------------
 public     | orders    | orders_pkey

 relname | last_analyze |       last_autoanalyze
---------+--------------+-------------------------------
 orders  |              | 2026-05-02 18:11:19.580776+08
```

Only the primary key index exists — no indexes on `status`, `amount`, or `customer` yet. `last_analyze` is null (never manually run) but `last_autoanalyze` ran automatically at 18:11 — autovacuum handled optimizer statistics without any DBA intervention. This is Oracle's automated maintenance from Lecture 9b working in the background.

---

## Part 6 — Query Performance: Index vs Full Table Scan

### Without index (full table scan):

```sql
EXPLAIN ANALYZE SELECT * FROM orders WHERE status = 'pending';
```

### ✅ Results observed

```
 Seq Scan on orders  (cost=0.00..2150.00 rows=33417 width=39) (actual time=0.014..9.135 rows=33227 loops=1)
   Filter: ((status)::text = 'pending'::text)
   Rows Removed by Filter: 66773
 Planning Time: 0.065 ms
 Execution Time: 10.111 ms
```

### After adding index:

```sql
CREATE INDEX idx_orders_status ON orders(status);
EXPLAIN ANALYZE SELECT * FROM orders WHERE status = 'pending';
```

### ✅ Results observed

```
 Bitmap Heap Scan on orders  (cost=379.27..1696.99 rows=33417 width=39) (actual time=1.239..5.108 rows=33227 loops=1)
   Recheck Cond: ((status)::text = 'pending'::text)
   Heap Blocks: exact=900
   ->  Bitmap Index Scan on idx_orders_status  (cost=0.00..370.92 rows=33417 width=0) (actual time=1.150..1.151 rows=33227 loops=1)
         Index Cond: ((status)::text = 'pending'::text)
 Planning Time: 0.243 ms
 Execution Time: 6.151 ms
```

| | Before index | After index |
|---|---|---|
| Scan type | `Seq Scan` (TABLE ACCESS FULL) | `Bitmap Index Scan` (INDEX RANGE SCAN) |
| Rows examined | 100,000 | 33,227 |
| Rows filtered out | 66,773 | 0 |
| Execution time | **10.111 ms** | **6.151 ms** |
| Planning time | 0.065 ms | 0.243 ms |

`Seq Scan` = Oracle's `TABLE ACCESS FULL`. `Bitmap Index Scan` = Oracle's `INDEX RANGE SCAN`. Planning time increased slightly — the optimizer now evaluates whether to use the index, same as Oracle's query optimizer from Lecture 9b. Improvement modest here because all data is in memory — on a production database with disk I/O, this difference would be orders of magnitude larger.

---

## Part 6b — Top SQL (AWR equivalent)

```bash
# Enable pg_stat_statements (requires restart):
sudo -u postgres psql -c "ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';"
sudo systemctl restart postgresql
sudo -u postgres psql -d perflab -c "CREATE EXTENSION pg_stat_statements;"
```

```sql
SELECT left(query, 80) AS query,
       calls,
       round(total_exec_time::numeric, 2) AS total_ms,
       round(mean_exec_time::numeric, 2) AS avg_ms,
       rows
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_%'
AND query NOT LIKE '%SET%'
ORDER BY total_exec_time DESC
LIMIT 10;
```

### ✅ Results observed

```
                        query                        | calls | total_ms | avg_ms | rows
-----------------------------------------------------+-------+----------+--------+-------
 SELECT * FROM orders WHERE amount > $1              |     1 |    29.26 |  29.26 | 19816
 SELECT count(*), status FROM orders GROUP BY status |     1 |     9.72 |   9.72 |     4
 SELECT * FROM orders WHERE status = $1 LIMIT $2     |     2 |     0.08 |   0.04 |    20
```

| Query | Finding |
|---|---|
| `WHERE amount > $1` | **Slowest** — no index on `amount`, full table scan. ADDM would flag this as Top SQL |
| `GROUP BY status` | Aggregate scan — acceptable |
| `WHERE status = $1` | **Fastest** — using `idx_orders_status`. Called twice, merged into one entry |

**Key observation:** `pg_stat_statements` automatically normalises queries — `status = 'pending'` and `status = 'completed'` were merged into `status = $1` with `calls = 2`. This is exactly how Oracle's AWR groups queries by SQL ID regardless of bind variable values.

**Actionable finding:** `WHERE amount > $1` at 29.26 ms is the top SQL to fix:
```sql
CREATE INDEX idx_orders_amount ON orders(amount);
```

---

## Checklist

- [x] Observed memory allocation — mapped to Oracle SGA components
- [x] Calculated buffer cache hit ratio — 100%, no tuning required
- [x] Observed baseline wait events — all background process idle states
- [x] Simulated lock wait and saw `Lock / transactionid` appear live
- [x] Queried top sessions and throughput statistics
- [x] Mapped V$FILESTAT to `pg_statio_user_tables`
- [x] Mapped V$LOCK to `pg_locks` — clean state confirmed
- [x] Checked index validity and autoanalyze status
- [x] Used EXPLAIN ANALYZE to compare full scan vs index scan
- [x] Enabled `pg_stat_statements` and identified top SQL by execution time
- [x] Identified actionable finding: missing index on `amount` column

---

## Key takeaway

Oracle's Enterprise Manager Performance page = PostgreSQL's `pg_stat_activity` + `pg_stat_database` + `pg_stat_statements` + `EXPLAIN ANALYZE`. Oracle's AMM auto-tunes memory; PostgreSQL requires manual tuning of `shared_buffers` and `work_mem` — but the Memory Advisor concept maps directly to checking cache hit ratio and adjusting accordingly. Oracle's AWR Top SQL = `pg_stat_statements` with automatic query normalisation by bind variable. The data exposed is identical across both platforms — the difference is Oracle wraps it in a GUI, PostgreSQL exposes it through SQL views.

---

## Scenario: "Users are complaining the application is slow"

**Step 1 — Check if it is a locking issue or a performance issue:**

```sql
SELECT blocked.pid, blocked.query, blocking.pid AS blocker, now() - blocked.query_start AS waiting
FROM pg_stat_activity blocked
JOIN pg_stat_activity blocking ON blocking.pid = ANY(pg_blocking_pids(blocked.pid))
WHERE cardinality(pg_blocking_pids(blocked.pid)) > 0;
```

Empty result → not a locking issue. Continue below.

**Step 2 — Find the slowest queries:**

```sql
SELECT left(query, 100), calls, round(mean_exec_time::numeric, 2) AS avg_ms
FROM pg_stat_statements
ORDER BY total_exec_time DESC LIMIT 10;
```

**Step 3 — Check the query plan for the worst offender:**

```sql
EXPLAIN ANALYZE <the slow query>;
```

Look for `Seq Scan` on large tables — these are missing index candidates.

**Step 4 — Check cache hit ratio:**

```sql
SELECT datname, round(blks_hit * 100.0 / (blks_hit + blks_read), 2) AS hit_pct
FROM pg_stat_database WHERE datname = current_database();
```

Below 95% → increase `shared_buffers`.

**Step 5 — Add missing index and verify improvement:**

```sql
CREATE INDEX idx_tablename_column ON tablename(column);
EXPLAIN ANALYZE <the slow query>;
-- Compare execution time before and after
```
