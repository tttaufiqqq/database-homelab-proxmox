# Lab — Lecture 4: Managing the Database Instance

**Lecture topic:** Starting/stopping Oracle, initialization parameters, alert log, dynamic performance views  
**Your server:** Proxmox VM `db-server` — guest hostname `taufiq-db` — connect via `ssh taufiq@100.75.213.36`

---

## Objective

Map Oracle's instance lifecycle (NOMOUNT → MOUNT → OPEN) and management tools (SQL*Plus, Enterprise Manager, V$ views, init parameters) to PostgreSQL equivalents on your live server.

---

## Part 1 — Instance startup stages

Oracle has 3 startup stages. PostgreSQL has an equivalent for each.

| Oracle stage | What happens | PostgreSQL equivalent |
|---|---|---|
| NOMOUNT | Reads init params, starts SGA | `pg_ctl start` — reads `postgresql.conf` |
| MOUNT | Reads control file, not open to users | Internal — mounts data directory |
| OPEN | Database open, users can connect | Fully started, accepting connections |

### Lab steps

Check your instance is running and see its PID (equivalent of Oracle's instance identifier):

```bash
sudo cat /var/lib/postgresql/16/main/postmaster.pid
```

The first line is the PID. As long as this file exists, the instance is running — when PostgreSQL stops, this file is deleted. This is exactly how Oracle uses its instance identifier.

Simulate a controlled shutdown and restart:

```bash
sudo systemctl stop postgresql
sudo ls /var/lib/postgresql/16/main/postmaster.pid
# File should be gone — instance is down

sudo systemctl start postgresql
sudo cat /var/lib/postgresql/16/main/postmaster.pid
# File is back — instance is up
```

---

## Part 2 — Initialization parameters (equivalent of init.ora / SPFILE)

In Oracle, `init.ora` and SPFILE store instance parameters. PostgreSQL uses `postgresql.conf` and `postgresql.auto.conf` (changed via `ALTER SYSTEM`).

```bash
# View the main config file (equivalent of init.ora):
sudo nano /etc/postgresql/16/main/postgresql.conf
```

Key parameters to find and note down:

```
max_connections        # Oracle: SESSIONS parameter
shared_buffers         # Oracle: DB_CACHE_SIZE
wal_level              # Oracle: LOG_MODE (archivelog/noarchivelog)
archive_mode           # Oracle: ARCHIVE_LOG_START
listen_addresses       # Oracle: LOCAL_LISTENER
```

Query them live (equivalent of Oracle's `SHOW PARAMETER`):

```sql
sudo -u postgres psql -c "
SELECT name, setting, unit, context
FROM pg_settings
WHERE name IN (
  'max_connections',
  'shared_buffers',
  'wal_level',
  'archive_mode',
  'listen_addresses',
  'log_destination'
)
ORDER BY name;"
```

Change a parameter dynamically (equivalent of Oracle's `ALTER SYSTEM`):

```sql
sudo -u postgres psql -c "ALTER SYSTEM SET work_mem = '8MB';"
sudo -u postgres psql -c "SELECT pg_reload_conf();"

-- Verify it changed (written to postgresql.auto.conf):
sudo -u postgres psql -c "SHOW work_mem;"
```

---

## Part 3 — The alert log

Oracle's alert log records all major instance events. PostgreSQL equivalent is in `/var/log/postgresql/`.

```bash
# Find your log file:
ls /var/log/postgresql/

# Tail the log (like Oracle's alert_<SID>.log):
sudo tail -50 /var/log/postgresql/postgresql-16-main.log
```

Look for lines showing:
- Database system was shut down / started up
- Checkpoint activity
- Any errors or warnings

Enable more verbose logging to see more Oracle-like detail:

```bash
sudo -u postgres psql -c "ALTER SYSTEM SET log_checkpoints = on;"
sudo -u postgres psql -c "ALTER SYSTEM SET log_connections = on;"
sudo -u postgres psql -c "ALTER SYSTEM SET log_disconnections = on;"
sudo -u postgres psql -c "SELECT pg_reload_conf();"

# Now restart and watch the log:
sudo systemctl restart postgresql
sudo tail -30 /var/log/postgresql/postgresql-16-main.log
```

---

## Part 4 — Dynamic performance views (V$ equivalent)

Oracle's V$ views expose live instance data. PostgreSQL has `pg_stat_*` views.

```sql
sudo -u postgres psql

-- V$SESSION equivalent:
SELECT pid, usename, application_name, client_addr, state, query
FROM pg_stat_activity;

-- V$SYSSTAT equivalent (database-wide stats):
SELECT datname, numbackends, xact_commit, xact_rollback,
       blks_read, blks_hit, tup_inserted, tup_updated, tup_deleted
FROM pg_stat_database
WHERE datname = 'postgres';

-- V$BGPROCESS equivalent:
SELECT pid, backend_type, wait_event_type, wait_event
FROM pg_stat_activity
WHERE backend_type != 'client backend';

-- Calculate buffer cache hit ratio (key DBA metric):
SELECT
  round(blks_hit * 100.0 / (blks_hit + blks_read), 2) AS cache_hit_ratio
FROM pg_stat_database
WHERE datname = 'postgres';
```

A cache hit ratio above 95% is healthy. Below 90% means `shared_buffers` may need increasing.

---

## Checklist

- [ ] Observed `postmaster.pid` appear and disappear with start/stop
- [ ] Located and read `postgresql.conf` (init.ora equivalent)
- [ ] Used `ALTER SYSTEM` to change a parameter dynamically
- [ ] Found and read the PostgreSQL alert log
- [ ] Queried `pg_stat_activity`, `pg_stat_database`, and `pg_settings`
- [ ] Calculated buffer cache hit ratio

---

## Key takeaway

Oracle Enterprise Manager and SQL*Plus = PostgreSQL's `pg_stat_*` views + `psql` + log files. The data is the same — startup events, session info, parameter values, performance counters. The tools just look different.
