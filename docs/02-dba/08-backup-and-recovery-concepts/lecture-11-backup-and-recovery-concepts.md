# Lab — Lecture 11: Backup and Recovery Concepts

**Lecture topic:** Failure categories, instance recovery, CKPT/LGWR processes, redo logs, ARCHIVELOG mode, fast recovery area  
**Your server:** `taufiq-db` — connect via `ssh taufiq@100.75.213.36`

---

## Objective

Map Oracle's failure categories, recovery architecture (CKPT, LGWR, ARCn), and ARCHIVELOG mode to PostgreSQL equivalents — then configure your server for maximum recoverability.

---

## Part 1 — Categories of Failure (Lecture 11, Slide 4)

Your slides list 6 failure types. Here's how each maps to your PostgreSQL server:

| Oracle failure type | What it means on your server | PostgreSQL response |
|---|---|---|
| Statement failure | Bad SQL, constraint violation | Transaction rolled back automatically |
| User process failure | SSH session dies mid-transaction | `postgres` background process rolls back via PMON equivalent |
| Network failure | Tailscale drops, SSH disconnects | `tcp_keepalives_idle` setting handles this |
| User error | You DROP a table by mistake | Point-in-time recovery from WAL archive |
| Instance failure | Server loses power / kernel panic | WAL-based crash recovery on next startup |
| Media failure | Disk fails, VM storage corrupts | Restore from `pg_basebackup` + WAL replay |

### Simulate statement failure (Slide 5):

```sql
sudo -u postgres psql
CREATE DATABASE recoverylab;
\c recoverylab

CREATE TABLE employees (
  id     SERIAL PRIMARY KEY,
  name   VARCHAR(100) NOT NULL,
  salary NUMERIC CHECK (salary > 0)
);

INSERT INTO employees (name, salary) VALUES ('Ahmad', 5000);

-- Statement failure: violate constraint (auto-rolled back):
INSERT INTO employees (name, salary) VALUES ('Siti', -100);
-- ERROR: new row violates check constraint

-- Statement failure: insufficient privileges (test with a restricted user):
CREATE USER readonly_user WITH PASSWORD 'test123';
-- Then try: GRANT nothing, attempt INSERT as readonly_user
```

---

## Part 2 — Checkpoint Process (Lecture 11, Slide 11)

CKPT writes checkpoint info to data file headers and control files, signals DBWn. In PostgreSQL, `checkpointer` does the same.

```sql
\c recoverylab

-- See checkpoint activity (equivalent of V$INSTANCE checkpoint info):
SELECT checkpoints_timed, checkpoints_req,
       checkpoint_write_time, checkpoint_sync_time,
       buffers_checkpoint, buffers_clean, buffers_backend
FROM pg_stat_bgwriter;

-- Force a manual checkpoint (equivalent of ALTER SYSTEM CHECKPOINT):
CHECKPOINT;

-- Verify it ran (timestamp should update):
SELECT now() AS checkpoint_time;

-- Configure checkpoint frequency (equivalent of tuning MTTR Advisor, Slide 16):
SHOW checkpoint_completion_target;
SHOW checkpoint_timeout;
```

```bash
# Watch checkpoint events in the alert log equivalent:
sudo tail -20 /var/log/postgresql/postgresql-16-main.log | grep -i checkpoint
```

---

## Part 3 — Redo Log Files and LGWR (Lecture 11, Slide 12)

Oracle's redo logs are written by LGWR. PostgreSQL uses WAL (Write-Ahead Log) written by `walwriter`.

```sql
-- See current WAL position (equivalent of current redo log sequence):
SELECT pg_current_wal_lsn() AS current_wal_lsn,
       pg_walfile_name(pg_current_wal_lsn()) AS current_wal_file;

-- See WAL writer stats:
SELECT * FROM pg_stat_wal;

-- Force a WAL switch (equivalent of Oracle ALTER SYSTEM SWITCH LOGFILE):
SELECT pg_switch_wal();

-- See WAL files on disk (equivalent of Oracle's redo log groups):
```

```bash
sudo ls -lh /var/lib/postgresql/16/main/pg_wal/
# Each file = 16MB WAL segment (equivalent of Oracle redo log member)
```

### Equivalent of multiplexing redo logs (Slide 21):

PostgreSQL achieves redo log protection through WAL archiving and streaming replication rather than file multiplexing. Configure WAL archiving:

```bash
sudo nano /etc/postgresql/16/main/postgresql.conf
```

Set these parameters:
```
wal_level = replica          # Minimum for archiving (Oracle: ARCHIVELOG mode)
archive_mode = on            # Enable archiving (Oracle: ALTER DATABASE ARCHIVELOG)
archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f'
```

---

## Part 4 — Configure ARCHIVELOG Mode (Lecture 11, Slide 23-26)

Oracle's ARCHIVELOG mode preserves redo logs for point-in-time recovery. PostgreSQL equivalent is WAL archiving.

```bash
# Create the archive directory (equivalent of fast recovery area):
sudo mkdir -p /var/lib/postgresql/wal_archive
sudo chown postgres:postgres /var/lib/postgresql/wal_archive

# Edit postgresql.conf:
sudo -u postgres nano /etc/postgresql/16/main/postgresql.conf
```

Add/edit these lines:
```
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /var/lib/postgresql/wal_archive/%f && cp %p /var/lib/postgresql/wal_archive/%f'
archive_timeout = 300       # Archive every 5 minutes even if WAL not full
```

```bash
# Restart to apply (equivalent of startup mount → alter database archivelog → open):
sudo systemctl restart postgresql

# Verify archiving is active (equivalent of ARCHIVE LOG LIST):
sudo -u postgres psql -c "SELECT name, setting FROM pg_settings WHERE name IN ('archive_mode','wal_level','archive_command');"

# Force a WAL switch to test archiving works:
sudo -u postgres psql -c "SELECT pg_switch_wal();"

# Check archived files exist:
ls -lh /var/lib/postgresql/wal_archive/
```

---

## Part 5 — Fast Recovery Area (Lecture 11, Slide 19)

Oracle's Fast Recovery Area (FRA) is a dedicated storage location for backups, archived logs, and flashback logs. Create a PostgreSQL equivalent:

```bash
# Create the fast recovery area directory:
sudo mkdir -p /var/lib/postgresql/fra
sudo chown postgres:postgres /var/lib/postgresql/fra

# Set a size limit using a monitoring check (PostgreSQL has no built-in FRA size cap):
df -h /var/lib/postgresql/fra
```

```sql
-- Monitor recovery area usage (equivalent of V$RECOVERY_FILE_DEST):
SELECT
  pg_size_pretty(
    (SELECT sum(size) FROM pg_ls_waldir())
  ) AS wal_size,
  pg_size_pretty(
    pg_database_size('recoverylab')
  ) AS database_size;

-- See WAL files available (equivalent of FRA contents):
SELECT name, size, modification
FROM pg_ls_waldir()
ORDER BY modification DESC
LIMIT 10;
```

---

## Part 6 — Instance Recovery Phases (Lecture 11, Slides 13-15)

Oracle's instance recovery: Roll Forward (redo) then Roll Back (undo). Simulate crash recovery:

```bash
# Simulate an ungraceful shutdown (equivalent of power outage):
sudo -u postgres psql -c "
  \c recoverylab
  BEGIN;
  INSERT INTO employees (name, salary) VALUES ('Crash Test', 9999);
  -- DO NOT COMMIT
"
# Kill the process abruptly:
sudo systemctl kill -s SIGKILL postgresql

# Restart -- PostgreSQL performs automatic crash recovery:
sudo systemctl start postgresql

# Watch the recovery in the log:
sudo tail -30 /var/log/postgresql/postgresql-16-main.log
# Look for: "database system was shut down" then "redo starts" then "consistent recovery state reached"
```

The log will show PostgreSQL's crash recovery phases — identical to Oracle's Roll Forward → Roll Back sequence from Slide 14.

---

## Part 7 — Control File equivalent

Oracle multiplexes control files. PostgreSQL uses `pg_control` and `pg_wal` for the same purpose.

```bash
# View the control file (equivalent of Oracle's control file):
sudo -u postgres /usr/lib/postgresql/16/bin/pg_controldata /var/lib/postgresql/16/main/

# Key fields to note:
# "Database cluster state" -- equivalent of Oracle's mount state
# "Latest checkpoint location" -- equivalent of CKPT SCN
# "Prior checkpoint location" -- previous checkpoint
# "Minimum recovery ending location" -- how far WAL must replay
```

---

## Checklist

- [ ] Mapped all 6 failure types to your server context
- [ ] Simulated a statement failure (constraint violation)
- [ ] Observed checkpoint stats in `pg_stat_bgwriter`
- [ ] Forced a manual checkpoint
- [ ] Viewed current WAL position and WAL files on disk
- [ ] Forced a WAL switch and observed new WAL file created
- [ ] Enabled WAL archiving (ARCHIVELOG mode equivalent)
- [ ] Created a fast recovery area directory
- [ ] Simulated crash recovery with SIGKILL and watched log
- [ ] Read `pg_controldata` output and identified key fields

---

## Key takeaway

Oracle's ARCHIVELOG mode = PostgreSQL's `archive_mode = on`. Oracle's redo log groups = PostgreSQL's WAL segments in `pg_wal/`. Oracle's CKPT process = PostgreSQL's `checkpointer`. Oracle's LGWR = PostgreSQL's `walwriter`. Oracle's ARCn = PostgreSQL's `archive_command`. The recovery phases (roll forward, roll back) are identical — PostgreSQL just does it automatically on startup without DBA intervention. This is why your Proxmox snapshot capability is so valuable — it's a layer of protection above and beyond database-level recovery.
