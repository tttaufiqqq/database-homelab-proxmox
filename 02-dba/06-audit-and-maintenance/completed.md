# Lab — Lecture 9: Database Auditing & Maintenance

**Lecture topic:** Auditing (9a) — DBA security, audit options, audit trail. Maintenance (9b) — optimizer stats, AWR, ADDM, alerts, automated tasks  
**Your server:** `taufiq-db` — connect via `ssh taufiq@100.75.213.36`  
**Completed:** 2026-05-03

---

## Part A — Database Auditing (Lecture 9a)

### Objective
Enable auditing on your PostgreSQL server to replicate Oracle's standard auditing and audit trail concepts.

---

### A1 — Enable pgaudit (equivalent of Oracle standard auditing)

Oracle enables auditing via `AUDIT_TRAIL` parameter. PostgreSQL uses the `pgaudit` extension.

```bash
sudo apt install postgresql-16-pgaudit -y
```

pgaudit must be loaded via `shared_preload_libraries` before the extension can be created. It cannot be loaded with just `CREATE EXTENSION` alone.

```bash
sudo -u postgres psql -c "ALTER SYSTEM SET shared_preload_libraries = 'pgaudit, pg_stat_statements';"
sudo pg_ctlcluster 16 main start
```

**Critical notes from this lab:**
- `shared_preload_libraries` values must be separated by `, ` (comma + space) — no space causes PostgreSQL to treat the entire string as one library name and fail to start.
- Do not wrap the value in extra double quotes — `'"pgaudit"'` will fail. Use single quotes only: `'pgaudit'`.
- After editing `postgresql.auto.conf` manually, always verify with `sudo cat` before restarting.

```sql
CREATE EXTENSION pgaudit;

ALTER SYSTEM SET pgaudit.log = 'all';
ALTER SYSTEM SET pgaudit.log_catalog = off;
SELECT pg_reload_conf();

SHOW pgaudit.log;
```

**Note:** `pgaudit.log` requires a restart to take effect, not just a reload. Valid value confirmed: `'all'`. The value `'write,ddl,role,connection'` with or without spaces was rejected — use `'all'` for full auditing or check pgaudit documentation for supported category names on your version.

### ✅ Results observed

```
 pgaudit.log
-------------
 all
```

Also fixed a leftover issue from Lab 6: `ALTER DATABASE postgres SET default_tablespace = ts_app` was stored at the database level (not config file level) and caused a warning on every connection after `ts_app` was dropped. Fixed with:

```sql
ALTER DATABASE postgres RESET default_tablespace;
```

---

### A2 — Generate audit events (Lecture 9a, Slide 7)

```sql
CREATE DATABASE auditlab;
\c auditlab

CREATE TABLE sensitive_data (
  id      SERIAL PRIMARY KEY,
  secret  VARCHAR(200)
);

INSERT INTO sensitive_data (secret) VALUES ('confidential record 1');
INSERT INTO sensitive_data (secret) VALUES ('confidential record 2');
UPDATE sensitive_data SET secret = 'modified record' WHERE id = 1;
DELETE FROM sensitive_data WHERE id = 2;
```

---

### A3 — Review the audit trail (equivalent of DBA_AUDIT_TRAIL)

```bash
sudo grep "AUDIT" /var/log/postgresql/postgresql-16-main.log | tail -20
```

### ✅ Results observed

```
2026-05-03 07:46:42.852 +08 [13181] postgres@postgres LOG:  AUDIT: SESSION,1,1,DDL,CREATE DATABASE,,,CREATE DATABASE auditlab;,<not logged>
2026-05-03 07:46:55.973 +08 [13186] postgres@auditlab LOG:  AUDIT: SESSION,1,1,DDL,CREATE TABLE,,,"CREATE TABLE sensitive_data (...
2026-05-03 07:47:00.817 +08 [13186] postgres@auditlab LOG:  AUDIT: SESSION,2,1,WRITE,INSERT,,,INSERT INTO sensitive_data (secret) VALUES ('confidential record 1');,<not logged>
2026-05-03 07:47:00.826 +08 [13186] postgres@auditlab LOG:  AUDIT: SESSION,3,1,WRITE,INSERT,,,INSERT INTO sensitive_data (secret) VALUES ('confidential record 2');,<not logged>
2026-05-03 07:47:00.828 +08 [13186] postgres@auditlab LOG:  AUDIT: SESSION,4,1,WRITE,UPDATE,,,UPDATE sensitive_data SET secret = 'modified record' WHERE id = 1;,<not logged>
2026-05-03 07:47:00.829 +08 [13186] postgres@auditlab LOG:  AUDIT: SESSION,5,1,WRITE,DELETE,,,DELETE FROM sensitive_data WHERE id = 2;,<not logged>
```

Audit trail format: `AUDIT: SESSION, statement_number, substatement, category, command, object_type, object_name, full_sql`

Every operation captured — DDL, INSERT, UPDATE, DELETE — with timestamp, user, database, and the exact SQL including actual values. Even earlier `ALTER SYSTEM` and `ALTER DATABASE` commands were captured. This is Oracle's `DBA_AUDIT_TRAIL` equivalent — same fields, same granularity.

---

### A4 — Audit specific objects (Fine-Grained Auditing equivalent)

```sql
CREATE TABLE audit_log (
  audit_id    SERIAL PRIMARY KEY,
  table_name  VARCHAR(100),
  action      VARCHAR(10),
  old_data    JSONB,
  new_data    JSONB,
  changed_by  VARCHAR(100),
  changed_at  TIMESTAMP DEFAULT now()
);

CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, 'DELETE', row_to_json(OLD)::jsonb, current_user);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, 'UPDATE', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, current_user);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, action, new_data, changed_by)
    VALUES (TG_TABLE_NAME, 'INSERT', row_to_json(NEW)::jsonb, current_user);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sensitive_data_audit
AFTER INSERT OR UPDATE OR DELETE ON sensitive_data
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

INSERT INTO sensitive_data (secret) VALUES ('new secret');
UPDATE sensitive_data SET secret = 'changed' WHERE id = 1;
DELETE FROM sensitive_data WHERE id = 3;

SELECT * FROM audit_log ORDER BY changed_at DESC;
```

### ✅ Results observed

```
 audit_id |   table_name   | action |                old_data                |             new_data              | changed_by |         changed_at
----------+----------------+--------+----------------------------------------+-----------------------------------+------------+----------------------------
        3 | sensitive_data | DELETE | {"id": 3, "secret": "new secret"}      |                                   | postgres   | 2026-05-03 07:48:37.939461
        2 | sensitive_data | UPDATE | {"id": 1, "secret": "modified record"} | {"id": 1, "secret": "changed"}    | postgres   | 2026-05-03 07:48:37.937706
        1 | sensitive_data | INSERT |                                        | {"id": 3, "secret": "new secret"} | postgres   | 2026-05-03 07:48:37.935025
```

Row-level before and after values captured in JSONB. You can see exactly what the data looked like before and after every change, who made it, and when. This is Oracle's Fine-Grained Auditing equivalent.

**Two-layer auditing:**
- pgaudit log → captures the SQL statement
- Trigger audit table → captures the actual data values before and after

Together they give complete auditability: what was run AND what changed.

---

### A5 — Separation of responsibilities (Lecture 9a, Slide 3)

```bash
grep "PermitRootLogin" /etc/ssh/sshd_config
ps aux | grep postgres | grep -v grep
```

### ✅ Results observed

```
PermitRootLogin prohibit-password

postgres   13151  0.0  2.1 222908 31820 ?  Ss  /usr/lib/postgresql/16/bin/postgres ...
postgres   13152  0.0  0.4 223044  6576 ?  Ss  postgres: 16/main: checkpointer
postgres   13153  0.0  0.5 223064  8124 ?  Ss  postgres: 16/main: background writer
postgres   13155  0.0  0.7 222908 10680 ?  Ss  postgres: 16/main: walwriter
postgres   13156  0.0  0.6 224508  9216 ?  Ss  postgres: 16/main: autovacuum launcher
postgres   13157  0.0  0.4 223028  6480 ?  Ss  postgres: 16/main: archiver
postgres   13158  0.0  0.5 224492  8376 ?  Ss  postgres: 16/main: logical replication launcher
```

- Root login disabled — enforces account separation at OS level
- All PostgreSQL processes run as `postgres` OS user — separate from `taufiq` admin account
- OS administration and database administration are two different identities — Lecture 9a Slide 3 separation of responsibilities implemented
- New `archiver` process visible — appeared because `archive_mode = on` was set in a previous lab

---

## Part B — Database Maintenance (Lecture 9b)

---

### B1 — Optimizer statistics (Lecture 9b)

```sql
SELECT relname, last_analyze, last_autoanalyze, n_live_tup, n_dead_tup
FROM pg_stat_user_tables;

ANALYZE VERBOSE sensitive_data;

SELECT attname, n_distinct, correlation
FROM pg_stats
WHERE tablename = 'sensitive_data';
```

### ✅ Results observed

```
    relname     | last_analyze | last_autoanalyze | n_live_tup | n_dead_tup
----------------+--------------+------------------+------------+------------
 sensitive_data |              |                  |          1 |          4
 audit_log      |              |                  |          3 |          0
```

```
INFO:  "sensitive_data": scanned 1 of 1 pages, containing 1 live rows and 4 dead rows; 1 rows in sample, 1 estimated total rows
```

```
 attname | n_distinct | correlation
---------+------------+-------------
 id      |         -1 |
 secret  |         -1 |
```

- `last_analyze = NULL` — tables not yet analyzed, optimizer has no statistics. Always run ANALYZE on new tables before production queries.
- `n_distinct = -1` — PostgreSQL's way of saying all values are unique (negative values = fraction of total rows, -1 = 100% distinct). Optimizer uses this to choose between index scan and sequential scan.
- `correlation = NULL` — not enough rows to calculate. With more data this shows how physically ordered the column is on disk, affecting index scan efficiency.

---

### B2 — AWR equivalent — performance snapshots

```sql
-- Before snapshot:
SELECT datname, numbackends, xact_commit, xact_rollback,
       blks_read, blks_hit, tup_inserted, tup_updated, tup_deleted,
       now() AS snapshot_time
FROM pg_stat_database
WHERE datname NOT IN ('template0', 'template1');

-- Run workload:
INSERT INTO sensitive_data (secret)
SELECT 'record ' || g FROM generate_series(1, 1000) g;

-- After snapshot:
SELECT datname, tup_inserted, xact_commit
FROM pg_stat_database
WHERE datname = 'auditlab';
```

### ✅ Results observed

Before snapshot showed multiple databases including project databases (`buzzyhive_pg`, `perflab`, `templatehub`, `templatehub_shadow`) from the Weather Pipeline project alongside lab databases.

After 1000-row INSERT:
```
 datname  | tup_inserted | xact_commit
----------+--------------+-------------
 auditlab |         2110 |          30
```

Delta between snapshots shows exactly what workload ran during the window — `tup_inserted` jumped by 1000, `xact_commit` incremented. This is how you manually replicate Oracle's AWR before/after snapshot comparison.

---

### B3 — ADDM equivalent — pg_stat_statements

```bash
sudo -u postgres psql -c "CREATE EXTENSION pg_stat_statements;"
```

```sql
-- Top slowest queries:
SELECT query, calls, total_exec_time,
       round(mean_exec_time::numeric, 2) AS avg_ms,
       rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- Top queries by I/O:
SELECT query, shared_blks_read, shared_blks_hit,
       round(shared_blks_hit * 100.0 /
         NULLIF(shared_blks_hit + shared_blks_read, 0), 1) AS hit_pct
FROM pg_stat_statements
ORDER BY shared_blks_read DESC
LIMIT 5;
```

### ✅ Results observed

Top I/O query:
```
 query                                  | shared_blks_read | shared_blks_hit | hit_pct
----------------------------------------+------------------+-----------------+---------
 SELECT * FROM orders WHERE amount > $1 |              898 |               2 |     0.2
 CREATE DATABASE templatehub            |              863 |             157 |    15.4
 CREATE DATABASE undolab                |              858 |             159 |    15.6
 CREATE EXTENSION pg_stat_statements    |              152 |            2882 |    95.0
 CREATE DATABASE templatehub_shadow     |              111 |             909 |    89.1
```

**Critical finding:** `SELECT * FROM orders WHERE amount > $1` — 898 block reads, only 2 cache hits, **0.2% hit ratio**. This is a critically cold query going almost entirely to disk. Oracle's ADDM would flag this as a top SQL finding. Investigation needed: check if an index exists on `amount` in `perflab.orders`, and check if `shared_buffers` is large enough for the table.

`CREATE DATABASE` operations have low hit ratios but are one-time operations — not a concern.

---

### B4 — Alert thresholds

```sql
-- Tablespace usage alert:
SELECT spcname AS tablespace,
  pg_size_pretty(pg_tablespace_size(spcname)) AS used,
  CASE
    WHEN pg_tablespace_size(spcname) > 10 * 1024^3 THEN 'ALERT: over 10GB'
    WHEN pg_tablespace_size(spcname) > 5 * 1024^3  THEN 'WARNING: over 5GB'
    ELSE 'OK'
  END AS status
FROM pg_tablespace
WHERE spcname != 'pg_global';

-- Long-running query alert:
SELECT pid, now() - query_start AS duration, state, query
FROM pg_stat_activity
WHERE query_start < now() - interval '5 minutes'
AND state = 'active';

-- Bloat alert:
SELECT relname, n_live_tup, n_dead_tup,
  CASE
    WHEN n_live_tup > 0 AND
         n_dead_tup::float / n_live_tup > 0.2 THEN 'ALERT: needs VACUUM'
    ELSE 'OK'
  END AS bloat_status
FROM pg_stat_user_tables
WHERE n_live_tup > 0;
```

### ✅ Results observed

```
 tablespace | used  | status
------------+-------+--------
 pg_default | 96 MB | OK

 pid | duration | state | query
-----+----------+-------+-------
(0 rows)

 relname | n_live_tup | n_dead_tup | bloat_status
---------+------------+------------+--------------
(0 rows)
```

All clear. Note: bloat and user table queries return empty when connected to `postgres` database which has no user tables. Run from `auditlab` or `securitylab` to see user table data.

---

### B5 — Automated tasks — autovacuum

```sql
SELECT name, setting
FROM pg_settings
WHERE name LIKE 'autovacuum%'
ORDER BY name;
```

### ✅ Results observed

```
 autovacuum                            | on
 autovacuum_analyze_scale_factor       | 0.1
 autovacuum_analyze_threshold          | 50
 autovacuum_freeze_max_age             | 200000000
 autovacuum_max_workers                | 3
 autovacuum_naptime                    | 60
 autovacuum_vacuum_cost_delay          | 2
 autovacuum_vacuum_cost_limit          | -1
 autovacuum_vacuum_insert_scale_factor | 0.2
 autovacuum_vacuum_insert_threshold    | 1000
 autovacuum_vacuum_scale_factor        | 0.2
 autovacuum_vacuum_threshold           | 50
 autovacuum_work_mem                   | -1
```

| Parameter | Value | Oracle equivalent meaning |
|---|---|---|
| `autovacuum_naptime` | 60s | Checks each database every 60 seconds — Oracle maintenance window check interval |
| `autovacuum_vacuum_scale_factor` | 0.2 | Triggers VACUUM when 20% of rows are dead — Oracle undo space reclamation threshold |
| `autovacuum_analyze_scale_factor` | 0.1 | Triggers ANALYZE when 10% of rows change — Oracle DBMS_STATS auto-gather threshold |
| `autovacuum_max_workers` | 3 | Maximum 3 autovacuum processes simultaneously |
| `autovacuum_vacuum_threshold` | 50 | Minimum 50 dead rows before VACUUM triggers regardless of scale factor |

---

## Checklist

**Auditing (9a):**
- [x] Installed and enabled pgaudit
- [x] Configured audit log categories (`all`)
- [x] Generated auditable events and reviewed the audit log
- [x] Built a custom audit trigger for fine-grained auditing
- [x] Verified OS/DB user separation aligns with Lecture 9a, Slide 3

**Maintenance (9b):**
- [x] Ran `ANALYZE` to gather optimizer statistics
- [x] Queried `pg_stats` to see what the optimizer knows
- [x] Took before/after performance snapshots using `pg_stat_database`
- [x] Enabled `pg_stat_statements` and identified slow queries
- [x] Built tablespace and bloat alert queries
- [x] Reviewed autovacuum configuration and activity

---

## Key takeaway

Oracle's auditing (DBA_AUDIT_TRAIL, FGA) maps to pgaudit + custom triggers. Oracle's AWR/ADDM maps to `pg_stat_database` + `pg_stat_statements`. Both systems have automated maintenance (Oracle maintenance windows = PostgreSQL autovacuum). Your existing server hardening (SSH keys, Tailscale, UFW) already implements the "separation of responsibilities" that Lecture 9a, Slide 3 discusses as a security requirement.

---

## When you will use this

**Auditing** — when someone asks "who changed this record and when?" In any environment handling financial data, personal data, or regulated information this question will come up. You grep the pgaudit log for the timestamp and SQL, and query the audit_log trigger table for the before/after values. Without this setup, the question is unanswerable.

**Maintenance** — for proactive health checks before users complain. The `orders` query at 0.2% cache hit ratio in this lab is exactly the kind of finding that lets you fix a performance problem before it becomes an incident. Run `pg_stat_statements`, the alert queries, and autovacuum activity on a schedule and you have a complete weekly DBA health check.

---

## Troubleshooting notes from this lab

**pgaudit fails with "must be loaded via shared_preload_libraries"**
Add pgaudit to `shared_preload_libraries` in `postgresql.auto.conf` and restart. `CREATE EXTENSION` alone is not enough.

**PostgreSQL fails to start after editing shared_preload_libraries**
Check the log: `sudo tail -20 /var/log/postgresql/postgresql-16-main.log`. Common causes:
- Missing space after comma: `'pgaudit,pg_stat_statements'` → fix to `'pgaudit, pg_stat_statements'`
- Extra double quotes: `'"pgaudit"'` → fix to `'pgaudit'`
- Edit `postgresql.auto.conf` directly if psql is unavailable, then start with `sudo pg_ctlcluster 16 main start`

**Warning: invalid value for parameter "default_tablespace"**
This is stored at the database level, not the config file. Fix with:
```sql
ALTER DATABASE postgres RESET default_tablespace;
```
Not in `postgresql.conf` or `postgresql.auto.conf`.
