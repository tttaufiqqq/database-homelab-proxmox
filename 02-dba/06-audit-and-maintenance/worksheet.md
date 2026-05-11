# Lab — Lecture 9: Database Auditing & Maintenance

**Lecture topic:** Auditing (9a) — DBA security, audit options, audit trail. Maintenance (9b) — optimizer stats, AWR, ADDM, alerts, automated tasks  
**Your server:** `taufiq-db` — connect via `ssh taufiq@100.75.213.36`

---

## Part A — Database Auditing (Lecture 9a)

### Objective
Enable auditing on your PostgreSQL server to replicate Oracle's standard auditing and audit trail concepts.

---

### A1 — Enable pgaudit (equivalent of Oracle standard auditing)

Oracle enables auditing via `AUDIT_TRAIL` parameter. PostgreSQL uses the `pgaudit` extension.

```bash
# Install pgaudit:
sudo apt install postgresql-16-pgaudit -y
```

```sql
sudo -u postgres psql

-- Enable the extension:
CREATE EXTENSION pgaudit;

-- Configure what to audit (equivalent of Oracle's AUDIT statement):
ALTER SYSTEM SET pgaudit.log = 'write, ddl, role, connection';
ALTER SYSTEM SET pgaudit.log_catalog = off;
SELECT pg_reload_conf();

-- Verify it's enabled:
SHOW pgaudit.log;
```

---

### A2 — Generate audit events (Lecture 9a, Slide 7)

```sql
-- Create a test database:
CREATE DATABASE auditlab;
\c auditlab

CREATE TABLE sensitive_data (
  id      SERIAL PRIMARY KEY,
  secret  VARCHAR(200)
);

-- These operations will be audited:
INSERT INTO sensitive_data (secret) VALUES ('confidential record 1');
INSERT INTO sensitive_data (secret) VALUES ('confidential record 2');
UPDATE sensitive_data SET secret = 'modified record' WHERE id = 1;
DELETE FROM sensitive_data WHERE id = 2;
```

---

### A3 — Review the audit trail (equivalent of DBA_AUDIT_TRAIL)

```bash
# View audit entries in the PostgreSQL log:
sudo grep "AUDIT" /var/log/postgresql/postgresql-16-main.log | tail -20
```

Each line will show: timestamp, user, database, object, action — the same fields in Oracle's `DBA_AUDIT_TRAIL`.

```sql
-- In PostgreSQL, you can also use pg_audit log table if configured,
-- or query the log file via file_fdw. Basic equivalent of DBA_AUDIT_TRAIL:
SELECT datname, usename, application_name, client_addr,
       backend_start, state
FROM pg_stat_activity;
```

---

### A4 — Audit specific objects (Fine-Grained Auditing equivalent)

Oracle's FGA audits specific columns or conditions. PostgreSQL equivalent uses event triggers:

```sql
\c auditlab

-- Create an audit log table:
CREATE TABLE audit_log (
  audit_id    SERIAL PRIMARY KEY,
  table_name  VARCHAR(100),
  action      VARCHAR(10),
  old_data    JSONB,
  new_data    JSONB,
  changed_by  VARCHAR(100),
  changed_at  TIMESTAMP DEFAULT now()
);

-- Create audit trigger function:
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

-- Attach trigger to your table:
CREATE TRIGGER sensitive_data_audit
AFTER INSERT OR UPDATE OR DELETE ON sensitive_data
FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

-- Test it:
INSERT INTO sensitive_data (secret) VALUES ('new secret');
UPDATE sensitive_data SET secret = 'changed' WHERE id = 1;
DELETE FROM sensitive_data WHERE id = 3;

-- Review your audit trail (equivalent of DBA_AUDIT_TRAIL):
SELECT * FROM audit_log ORDER BY changed_at DESC;
```

---

### A5 — Separation of responsibilities (Lecture 9a, Slide 3)

Your hardening doc already implements this:
- OS admin (`taufiq`) ≠ DB admin (`postgres`) — two different accounts
- SSH access restricted via Tailscale — the DBA and sysadmin are separated at the network layer
- Root login disabled on SSH — enforces account separation

```bash
# Verify the separation is in place:
grep "PermitRootLogin" /etc/ssh/sshd_config
# Should show: PermitRootLogin prohibit-password

# DB runs as its own OS user:
ps aux | grep postgres
# Shows: postgres <pid> ...
```

---

## Part B — Database Maintenance (Lecture 9b)

### Objective
Replicate Oracle's AWR, ADDM, optimizer statistics, server alerts, and automated tasks using PostgreSQL tools.

---

### B1 — Optimizer statistics (Lecture 9b, Slide objectives)

Oracle uses `DBMS_STATS.GATHER_TABLE_STATS`. PostgreSQL uses `ANALYZE`.

```sql
\c auditlab

-- See current statistics state (equivalent of DBA_TAB_STATISTICS):
SELECT relname, last_analyze, last_autoanalyze, n_live_tup, n_dead_tup
FROM pg_stat_user_tables;

-- Manually gather stats (equivalent of DBMS_STATS.GATHER_TABLE_STATS):
ANALYZE VERBOSE sensitive_data;

-- See what the optimizer knows about your table:
SELECT attname, n_distinct, correlation
FROM pg_stats
WHERE tablename = 'sensitive_data';
```

---

### B2 — AWR equivalent — collect a performance snapshot (Lecture 9b, Slide objectives)

Oracle's AWR takes automatic snapshots every hour. PostgreSQL's `pg_stat_*` views are always live. Simulate a snapshot:

```sql
\c postgres

-- Take a "before" snapshot (equivalent of DBMS_WORKLOAD_REPOSITORY.CREATE_SNAPSHOT):
SELECT
  datname,
  numbackends,
  xact_commit,
  xact_rollback,
  blks_read,
  blks_hit,
  tup_inserted,
  tup_updated,
  tup_deleted,
  now() AS snapshot_time
FROM pg_stat_database
WHERE datname NOT IN ('template0', 'template1');

-- Run some workload:
\c auditlab
INSERT INTO sensitive_data (secret)
SELECT 'record ' || g FROM generate_series(1, 1000) g;

-- Take an "after" snapshot and compare:
\c postgres
SELECT datname, tup_inserted, xact_commit
FROM pg_stat_database
WHERE datname = 'auditlab';
```

---

### B3 — ADDM equivalent — identify top issues (Lecture 9b, Slide objectives)

Oracle's ADDM automatically diagnoses performance issues. PostgreSQL equivalent is `pg_stat_statements`.

```bash
# Enable pg_stat_statements:
sudo -u postgres psql -c "
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
"
sudo systemctl restart postgresql
sudo -u postgres psql -c "CREATE EXTENSION pg_stat_statements;"
```

```sql
-- Top slowest queries (equivalent of ADDM's top SQL findings):
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

---

### B4 — Alert thresholds and server-generated alerts (Lecture 9b, Slide objectives)

Oracle generates alerts when metrics cross thresholds (e.g. tablespace > 85% full). Set up equivalent monitoring:

```sql
-- Check tablespace usage alert (equivalent of Oracle's space alert):
SELECT
  spcname AS tablespace,
  pg_size_pretty(pg_tablespace_size(spcname)) AS used,
  CASE
    WHEN pg_tablespace_size(spcname) > 10 * 1024^3 THEN 'ALERT: over 10GB'
    WHEN pg_tablespace_size(spcname) > 5 * 1024^3  THEN 'WARNING: over 5GB'
    ELSE 'OK'
  END AS status
FROM pg_tablespace
WHERE spcname != 'pg_global';

-- Check for long-running queries (equivalent of Oracle alert on long operations):
SELECT pid, now() - query_start AS duration, state, query
FROM pg_stat_activity
WHERE query_start < now() - interval '5 minutes'
AND state = 'active';

-- Check for bloat alert (dead tuples > 20% of live):
SELECT relname,
  n_live_tup,
  n_dead_tup,
  CASE
    WHEN n_live_tup > 0 AND
         n_dead_tup::float / n_live_tup > 0.2 THEN 'ALERT: needs VACUUM'
    ELSE 'OK'
  END AS bloat_status
FROM pg_stat_user_tables
WHERE n_live_tup > 0;
```

---

### B5 — Automated tasks (Lecture 9b, Slide objectives)

Oracle has automated maintenance windows for stats gathering, segment advisor, etc. PostgreSQL's autovacuum handles this.

```sql
-- See autovacuum configuration (equivalent of automated maintenance tasks):
SELECT name, setting
FROM pg_settings
WHERE name LIKE 'autovacuum%'
ORDER BY name;

-- See autovacuum activity per table:
SELECT relname, last_vacuum, last_autovacuum,
       last_analyze, last_autoanalyze,
       vacuum_count, autovacuum_count
FROM pg_stat_user_tables
ORDER BY last_autovacuum DESC NULLS LAST;
```

```bash
# Set up a cron job for a daily maintenance script (equivalent of Oracle maintenance window):
crontab -e

# Add this line (runs at 2am daily):
# 0 2 * * * psql -U postgres -c "VACUUM ANALYZE;" >> /var/log/pg_maintenance.log 2>&1
```

---

## Checklist

**Auditing (9a):**
- [ ] Installed and enabled pgaudit
- [ ] Configured audit log categories (write, ddl, role, connection)
- [ ] Generated auditable events and reviewed the audit log
- [ ] Built a custom audit trigger for fine-grained auditing
- [ ] Verified OS/DB user separation aligns with Lecture 9a, Slide 3

**Maintenance (9b):**
- [ ] Ran `ANALYZE` to gather optimizer statistics
- [ ] Queried `pg_stats` to see what the optimizer knows
- [ ] Took before/after performance snapshots using `pg_stat_database`
- [ ] Enabled `pg_stat_statements` and identified slow queries
- [ ] Built tablespace and bloat alert queries
- [ ] Reviewed autovacuum configuration and activity
- [ ] (Optional) Set up a cron maintenance job

---

## Key takeaway

Oracle's auditing (DBA_AUDIT_TRAIL, FGA) maps to pgaudit + custom triggers. Oracle's AWR/ADDM maps to `pg_stat_database` + `pg_stat_statements`. Both systems have automated maintenance (Oracle maintenance windows = PostgreSQL autovacuum). Your existing server hardening (SSH keys, Tailscale, UFW) already implements the "separation of responsibilities" that Lecture 9a, Slide 3 discusses as a security requirement.
