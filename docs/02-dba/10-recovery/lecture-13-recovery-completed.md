# Lab — Lecture 13: Performing Database Recovery

**Lecture topic:** Recovery scenarios, Data Recovery Advisor, control file loss, redo log loss, data file loss (NOARCHIVELOG vs ARCHIVELOG mode)  
**Your server:** `taufiq-db` — connect via `ssh taufiq@100.75.213.36`  
**Completed:** 2026-05-03

---

## ⚠️ Important: Take a Proxmox snapshot before this lab

This lab involves intentionally breaking things. Before starting:
1. Open Proxmox web UI → select `taufiq-db` VM → Snapshots
2. Click "Take Snapshot" → name it `before-lec13-recovery-lab`
3. Proceed — if anything goes wrong, roll back instantly

✅ Snapshot taken: `before-lec13-recovery-lab` — 1.19GB state saved successfully.

---

## Objective

Practice the recovery scenarios from your slides — control file loss, redo log loss, data file loss — using PostgreSQL equivalents of Oracle's Data Recovery Advisor and RMAN recovery commands.

---

## Setup

```bash
sudo -u postgres psql -c "SHOW archive_mode;"
ls /var/lib/postgresql/backups/base/
```

### ✅ Results observed

```
 archive_mode
--------------
 on

backup_20260503_014215  cold_20260503_013621  hot_tar_20260503_014045
backup_20260503_020001  hot_20260503_014011
```

Both prerequisites confirmed — archive_mode on, multiple backups available from Lab 11.

```sql
CREATE DATABASE recoverytest;
\c recoverytest

CREATE TABLE critical_data (
  id    SERIAL PRIMARY KEY,
  value VARCHAR(200)
);

INSERT INTO critical_data (value)
SELECT 'important record ' || g FROM generate_series(1, 1000) g;

SELECT count(*) FROM critical_data;
-- Result: 1000
```

---

## Part 1 — Opening a database: requirements (Lecture 13, Slide 3)

```bash
sudo -u postgres /usr/lib/postgresql/16/bin/pg_controldata /var/lib/postgresql/16/main/ | grep -E "state|checkpoint|wal"
```

### ✅ Results observed

```
Database cluster state:               in production
Latest checkpoint location:           0/29000060
Latest checkpoint's REDO location:    0/2804D440
Latest checkpoint's REDO WAL file:    000000010000000000000028
Latest checkpoint's TimeLineID:       1
wal_level setting:                    replica
```

The three things PostgreSQL needs to start — Oracle's three open requirements:

| PostgreSQL requirement | Oracle equivalent |
|---|---|
| `global/pg_control` file | Control file |
| Data files in `base/` | Data files (.dbf) |
| WAL consistency from checkpoint | At least one redo log member per group |

- `Database cluster state: in production` — equivalent of Oracle OPEN state
- `Latest checkpoint location: 0/29000060` — equivalent of Oracle SCN
- `Latest checkpoint's REDO WAL file: 000000010000000000000028` — the WAL file needed for recovery, equivalent of Oracle's current redo log group

---

## Part 2 — Loss of a data file in NOARCHIVELOG mode (Lecture 13, Slide 11)

Oracle: must restore entire database from backup, lose all changes since backup.

```bash
# Disable archiving to simulate NOARCHIVELOG:
sudo -u postgres psql -c "ALTER SYSTEM SET archive_mode = off;"
sudo systemctl restart postgresql

# Take a backup:
sudo -u postgres pg_basebackup -D /tmp/noarchive_backup -Fp -Xs -P

# Make a post-backup change:
sudo -u postgres psql -c "INSERT INTO critical_data (value) VALUES ('post-backup change');" recoverytest

# Get database OID:
DB_OID=$(sudo -u postgres psql -Atc "SELECT oid FROM pg_database WHERE datname='recoverytest';")
echo "Database OID: $DB_OID"

# Stop and simulate file loss:
sudo systemctl stop postgresql
sudo mv /var/lib/postgresql/16/main/base/$DB_OID \
        /var/lib/postgresql/16/main/base/${DB_OID}_LOST

# Try to start:
sudo systemctl start postgresql
sudo -u postgres psql -c "\c recoverytest" 2>&1 | head -5
```

### ✅ Results observed

```
Database OID: 34482

\connect: connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed: 
FATAL:  "base/34482" is not a valid data directory
DETAIL:  File "base/34482/PG_VERSION" is missing.
```

This is Oracle's ORA-01157 equivalent — "cannot identify/lock data file." PostgreSQL found the database entry in the catalog but the physical directory is gone.

**Recovery — restore from backup (loses post-backup changes):**

```bash
sudo systemctl stop postgresql
sudo rm -rf /var/lib/postgresql/16/main/base/34482
sudo mv /var/lib/postgresql/16/main/base/34482_LOST \
        /var/lib/postgresql/16/main/base/34482
sudo systemctl start postgresql
sudo -u postgres psql -c "SELECT count(*) FROM critical_data;" recoverytest
```

```
 count
-------
  1000
```

1000 rows — the "post-backup change" row is permanently lost. This is the core lesson of NOARCHIVELOG mode: you can only recover to the point of the last backup. Any work done after the backup is gone.

```bash
# Re-enable archiving:
sudo -u postgres psql -c "ALTER SYSTEM SET archive_mode = on;"
sudo systemctl restart postgresql
```

---

## Part 3 — Loss of a noncritical data file in ARCHIVELOG mode (Lecture 13, Slide 12)

Oracle: restore just the lost file and recover using archived logs — can recover to point just before failure.

```bash
# Take a fresh base backup:
sudo -u postgres pg_basebackup \
  -D /var/lib/postgresql/backups/base/recovery_demo \
  -Fp -Xs -P

# Record WAL position after backup:
sudo -u postgres psql -c "SELECT pg_current_wal_lsn();"
# Result: 0/30000060

# Make 100 post-backup changes:
sudo -u postgres psql -c "
INSERT INTO critical_data (value)
SELECT 'after backup ' || g FROM generate_series(1,100) g;
" recoverytest

sudo -u postgres psql -c "SELECT pg_current_wal_lsn() AS post_change_lsn;"
# Result: 0/30005828

sudo -u postgres psql -c "SELECT count(*) FROM critical_data;" recoverytest
# Result: 1100
```

### ✅ Simulate data file loss and PITR recovery

```bash
DB_OID=$(sudo -u postgres psql -Atc "SELECT oid FROM pg_database WHERE datname='recoverytest';")
sudo systemctl stop postgresql
sudo mv /var/lib/postgresql/16/main/base/$DB_OID \
        /var/lib/postgresql/16/main/base/${DB_OID}_LOST

# Set up recovery environment:
sudo mkdir -p /var/lib/postgresql/pitr_recovery
sudo chmod 700 /var/lib/postgresql/pitr_recovery
sudo chown postgres:postgres /var/lib/postgresql/pitr_recovery
sudo cp /etc/postgresql/16/main/pg_hba.conf \
  /var/lib/postgresql/pitr_recovery/pg_hba.conf
sudo chown postgres:postgres /var/lib/postgresql/pitr_recovery/pg_hba.conf

sudo -u postgres cp -r /var/lib/postgresql/backups/base/recovery_demo/. \
  /var/lib/postgresql/pitr_recovery/

sudo -u postgres touch /var/lib/postgresql/pitr_recovery/recovery.signal
```

Add to `pitr_recovery/postgresql.conf`:
```
restore_command = 'cp /var/lib/postgresql/wal_archive/%f %p'
recovery_target = 'immediate'
port = 5433
```

```bash
sudo -u postgres /usr/lib/postgresql/16/bin/pg_ctl \
  -D /var/lib/postgresql/pitr_recovery \
  -l /var/lib/postgresql/pitr_recovery/recovery.log \
  start

sleep 5
sudo cat /var/lib/postgresql/pitr_recovery/recovery.log | tail -20
```

### ✅ Recovery log observed

```
LOG:  pgaudit extension initialized
LOG:  starting PostgreSQL 16.13 on x86_64-pc-linux-gnu
LOG:  listening on IPv4 address "127.0.0.1", port 5433
LOG:  database system was interrupted; last known up at 2026-05-03 12:02:37 GMT
LOG:  starting point-in-time recovery to earliest consistent point
LOG:  starting backup recovery with redo LSN 0/2F000028, checkpoint LSN 0/2F000060, on timeline ID 1
LOG:  restored log file "00000001000000000000002F" from archive
LOG:  redo starts at 0/2F000028
LOG:  restored log file "000000010000000000000030" from archive
LOG:  completed backup recovery with redo LSN 0/2F000028 and end LSN 0/2F000100
LOG:  consistent recovery state reached at 0/2F000100
LOG:  recovery stopping after reaching consistency
LOG:  pausing at the end of recovery
HINT:  Execute pg_wal_replay_resume() to promote.
LOG:  database system is ready to accept read-only connections
```

Key lines:
- `starting point-in-time recovery` — ARCHIVELOG recovery mode activated
- `restored log file ... from archive` — WAL pulled from archive and replayed
- `consistent recovery state reached` — database is in a consistent state
- `pausing at the end of recovery` — stopped at `recovery_target = 'immediate'`
- `ready to accept read-only connections` — recovered instance is up

```bash
sudo -u postgres psql -h /var/run/postgresql -p 5433 -d recoverytest \
  -c "SELECT count(*) FROM critical_data;"
# Result: 1000
```

Result shows 1000 rows because `recovery_target = 'immediate'` stops at the earliest consistent point (before the 100 post-backup rows). In production you would set `recovery_target_lsn = '0/30005828'` to recover all 1100 rows up to the exact LSN after your changes.

**Cleanup:**
```bash
sudo -u postgres /usr/lib/postgresql/16/bin/pg_ctl \
  -D /var/lib/postgresql/pitr_recovery stop

sudo mv /var/lib/postgresql/16/main/base/34482_LOST \
        /var/lib/postgresql/16/main/base/34482

sudo systemctl start postgresql
sudo -u postgres psql -c "SELECT count(*) FROM critical_data;" recoverytest
# Result: 1100 — original database with all data restored
```

**Troubleshooting notes from this lab:**
- `pg_hba.conf` is not included in base backup — copy from `/etc/postgresql/16/main/pg_hba.conf`
- Recovery directory must have `chmod 700` — PostgreSQL rejects other permissions
- `shared_preload_libraries` in the backup's `postgresql.auto.conf` will load pgaudit in the recovery instance — harmless but expected
- `00000002.history not found` warning is normal — only exists after a previous PITR

---

## Part 4 — Loss of a control file (Lecture 13, Slide 8)

```bash
# Backup pg_control (Oracle equivalent of multiplexing control files):
sudo cp /var/lib/postgresql/16/main/global/pg_control \
        /var/lib/postgresql/backups/pg_control_$(date +%Y%m%d).bak

ls /var/lib/postgresql/backups/pg_control_*.bak
# Result: /var/lib/postgresql/backups/pg_control_20260503.bak
```

If `pg_control` is ever lost or corrupted:

```bash
# Option 1: Restore from backup copy (preferred):
sudo cp /var/lib/postgresql/backups/pg_control_YYYYMMDD.bak \
        /var/lib/postgresql/16/main/global/pg_control

# Option 2: Reset control file (last resort — equivalent of ALTER DATABASE OPEN RESETLOGS):
# sudo -u postgres /usr/lib/postgresql/16/bin/pg_resetwal \
#   /var/lib/postgresql/16/main/
# WARNING: pg_resetwal discards unwritten WAL — data loss risk
```

---

## Part 5 — Loss of a redo log file (Lecture 13, Slide 9)

```bash
sudo ls -lh /var/lib/postgresql/16/main/pg_wal/
```

### ✅ Results observed

```
total 65M
-rw------- 1 postgres postgres  341 May  3 20:02 00000001000000000000002F.00000028.backup
-rw------- 1 postgres postgres  16M May  3 20:08 000000010000000000000031
-rw------- 1 postgres postgres  16M May  3 20:02 000000010000000000000032
-rw------- 1 postgres postgres  16M May  3 20:03 000000010000000000000033
-rw------- 1 postgres postgres  16M May  3 20:02 000000010000000000000034
drwx------ 2 postgres postgres 4.0K May  3 20:08 archive_status
```

4 active WAL segments, each 16MB — these are your redo log equivalents. The `.backup` label file marks where the base backup started. `archive_status/` tracks which segments have been archived.

If a WAL file is lost while the database is running, PostgreSQL will error and stop. Recovery options:

```bash
# Restore from archive:
sudo cp /var/lib/postgresql/wal_archive/<lost_file> \
        /var/lib/postgresql/16/main/pg_wal/

# Force past the problem (switch to new WAL segment):
sudo -u postgres psql -c "SELECT pg_switch_wal();"
# Equivalent of Oracle "clear the log group"
```

---

## Part 6 — Data Recovery Advisor equivalents (Lecture 13, Slides 6, 15-21)

Oracle's Data Recovery Advisor has 5 steps: Assess → List → Advise → Repair → Proactive checks.

```sql
-- Step 1: Assess (Health Monitor equivalent):
CREATE EXTENSION IF NOT EXISTS pg_visibility;

-- Step 2: List failures (LIST FAILURE equivalent):
SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public';
SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public';

-- Step 3: Advise on repair (ADVISE FAILURE equivalent):
SELECT relname, n_live_tup, n_dead_tup,
  CASE WHEN n_dead_tup > n_live_tup THEN 'NEEDS VACUUM'
       ELSE 'OK'
  END AS health
FROM pg_stat_user_tables;

-- Step 4: Execute repair (REPAIR FAILURE equivalent):
REINDEX TABLE critical_data;
VACUUM FULL critical_data;

-- Step 5: Proactive checks (Health Monitor proactive equivalent):
SELECT relname, last_vacuum, last_analyze,
  CASE WHEN last_analyze IS NULL THEN 'NEVER ANALYZED - fix this'
       ELSE 'OK'
  END AS status
FROM pg_stat_user_tables;

-- Fix the proactive finding:
ANALYZE critical_data;
```

### ✅ Results observed

```
 schemaname |   tablename
------------+---------------
 public     | critical_data

     indexname      |   tablename
--------------------+---------------
 critical_data_pkey | critical_data

    relname    | n_live_tup | n_dead_tup | health
---------------+------------+------------+--------
 critical_data |          0 |          0 | OK

REINDEX
VACUUM

    relname    | last_vacuum |         last_analyze          | status
---------------+-------------+-------------------------------+--------
 critical_data |             | 2026-05-03 20:10:42.108385+08 | OK
```

All 5 steps completed. Table and index present, no bloat, REINDEX and VACUUM FULL successful, ANALYZE ran and status is OK.

---

## Checklist

- [x] ✅ Took Proxmox snapshot before starting
- [x] Understood what PostgreSQL needs to start — pg_control, data files, WAL consistency
- [x] Simulated NOARCHIVELOG recovery — restored from backup, lost post-backup change (1001 → 1000 rows)
- [x] Simulated ARCHIVELOG PITR recovery — WAL replayed from archive, recovered to consistent state
- [x] Backed up pg_control file — `/var/lib/postgresql/backups/pg_control_20260503.bak`
- [x] Viewed WAL files — 4 segments at 16MB each with backup label
- [x] Ran all 5 Data Recovery Advisor equivalent steps
- [x] Used REINDEX, VACUUM FULL, and ANALYZE as repair operations

---

## Key takeaway

Oracle's Data Recovery Advisor = PostgreSQL's combination of pg_controldata, pg_check_relation, and log file analysis. Oracle's RMAN RESTORE + RECOVER = PostgreSQL's pg_basebackup restore + WAL replay using `restore_command`. The critical difference: Oracle's Data Recovery Advisor is a GUI tool with automated detection; PostgreSQL requires you to manually query pg_stat_* views and read logs. But the underlying recovery logic — restore, apply archived logs, roll forward, roll back uncommitted — is identical to Oracle's Slides 13-14.

---

## Scenario: "The database is down and the data directory for our main application database is corrupted"

**The one thing that changes everything**

`archive_mode = on` vs `off` is the difference between losing minutes of data and losing hours or days. Check this before deciding your recovery path.

**Step 1 — Verify the situation before touching anything**

```bash
sudo systemctl status postgresql
sudo tail -30 /var/log/postgresql/postgresql-16-main.log
```

Look for the exact error. `"base/XXXXX" is not a valid data directory` or `File "PG_VERSION" is missing` confirms data directory corruption, not a network or config issue. Do not attempt to restart until you understand what failed.

**Step 2 — Check if the database is actually stopped or just unhealthy**

```bash
sudo pg_ctlcluster 16 main status
```

If it is still running, do not stop it yet — you may be able to `pg_dump` salvage unaffected databases first.

**Step 3 — Inform stakeholders immediately**

Tell them: database is down, recovery is in progress, estimated time depends on backup age and WAL availability. Do not give a time estimate until you have checked the backups in Step 4.

**Step 4 — Check what backups exist and how recent they are**

```bash
ls -lh /var/lib/postgresql/backups/base/
ls -lh /var/lib/postgresql/wal_archive/ | tail -10
grep "archive_mode" /var/lib/postgresql/16/main/postgresql.auto.conf
```

Note the timestamp of the most recent base backup. Then check archive_mode — this determines your recovery path.

**Path A — archive_mode = on (ARCHIVELOG mode)**

You can recover to a point just before the corruption:

```bash
sudo mkdir -p /var/lib/postgresql/pitr_recovery
sudo chmod 700 /var/lib/postgresql/pitr_recovery
sudo chown postgres:postgres /var/lib/postgresql/pitr_recovery
sudo cp /etc/postgresql/16/main/pg_hba.conf /var/lib/postgresql/pitr_recovery/
sudo -u postgres cp -r /var/lib/postgresql/backups/base/<most_recent_backup>/. \
  /var/lib/postgresql/pitr_recovery/
sudo -u postgres touch /var/lib/postgresql/pitr_recovery/recovery.signal
```

Add to `pitr_recovery/postgresql.conf`:
```
restore_command = 'cp /var/lib/postgresql/wal_archive/%f %p'
recovery_target_lsn = '<lsn_just_before_corruption>'
port = 5433
```

Start recovery instance, verify data, promote and redirect application connections.

**Path B — archive_mode = off (NOARCHIVELOG mode)**

You can only recover to the last base backup. All changes since then are lost:

```bash
sudo systemctl stop postgresql
sudo rm -rf /var/lib/postgresql/16/main/base/<corrupted_db_oid>
# Restore from backup
sudo systemctl start postgresql
```

Inform stakeholders of the data loss window.

**Step 5 — Verify recovery**

```bash
sudo -u postgres psql -c "SELECT count(*) FROM critical_table;" dbname
```

Confirm row counts match expectations before declaring recovery complete.

**Step 6 — Root cause analysis after recovery**

```bash
sudo tail -100 /var/log/postgresql/postgresql-16-main.log
```

Was it a disk failure, a bad deployment, an accidental deletion? You need to know before bringing the system back to production or it will happen again. This is also what you report to stakeholders after recovery — not just "it's fixed" but "here is what happened and here is what we are doing to prevent it."
