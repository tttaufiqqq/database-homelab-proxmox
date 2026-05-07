# Lab — Lecture 13: Performing Database Recovery

**Lecture topic:** Recovery scenarios, Data Recovery Advisor, control file loss, redo log loss, data file loss (NOARCHIVELOG vs ARCHIVELOG mode)  
**Your server:** `taufiq-db` — connect via `ssh taufiq@100.75.213.36`

---

## ⚠️ Important: Take a Proxmox snapshot before this lab

This lab involves intentionally breaking things. Before starting:
1. Open Proxmox web UI → select `taufiq-db` VM → Snapshots
2. Click "Take Snapshot" → name it `before-lec13-recovery-lab`
3. Proceed — if anything goes wrong, roll back instantly

---

## Objective

Practice the recovery scenarios from your slides — control file loss, redo log loss, data file loss — using PostgreSQL equivalents of Oracle's Data Recovery Advisor and RMAN recovery commands.

---

## Setup

```bash
ssh taufiq@100.75.213.36

# Verify WAL archiving is on (required for ARCHIVELOG mode recovery):
sudo -u postgres psql -c "SHOW archive_mode;"
# Must show: on (complete Lecture 11 lab first if not)

# Verify you have a backup:
ls /var/lib/postgresql/backups/base/
```

```sql
sudo -u postgres psql
CREATE DATABASE recoverytest;
\c recoverytest

CREATE TABLE critical_data (
  id    SERIAL PRIMARY KEY,
  value VARCHAR(200)
);

INSERT INTO critical_data (value)
SELECT 'important record ' || g FROM generate_series(1, 1000) g;

-- Confirm data exists:
SELECT count(*) FROM critical_data;
```

---

## Part 1 — Opening a database: requirements (Lecture 13, Slide 3)

Your slides show that Oracle needs: control files, data files, and at least one redo log member per group to OPEN.

```bash
# PostgreSQL equivalent: what must exist to start:
sudo -u postgres /usr/lib/postgresql/16/bin/pg_controldata /var/lib/postgresql/16/main/ | grep -E "state|checkpoint|wal"

# 3 things PostgreSQL needs (equivalent of Oracle's 3 requirements):
# 1. pg_control file (equivalent of control file)
# 2. Data files in base/ (equivalent of data files)
# 3. WAL consistency (equivalent of redo log group)
```

---

## Part 2 — Loss of a data file in NOARCHIVELOG mode (Lecture 13, Slide 11)

Oracle: must restore entire database from backup, lose all changes since backup.

Simulate this (PostgreSQL with archiving OFF):

```bash
# Temporarily disable archiving to simulate NOARCHIVELOG:
sudo -u postgres psql -c "ALTER SYSTEM SET archive_mode = off;"
sudo systemctl restart postgresql

# Take a backup:
sudo -u postgres pg_basebackup -D /tmp/noarchive_backup -Fp -Xs -P

# Make some changes:
sudo -u postgres psql -c "\c recoverytest; INSERT INTO critical_data (value) VALUES ('post-backup change');"

# Simulate data file loss (remove a database file):
# First find the OID of recoverytest:
DB_OID=$(sudo -u postgres psql -Atc "SELECT oid FROM pg_database WHERE datname='recoverytest';")
echo "Database OID: $DB_OID"

sudo systemctl stop postgresql

# Simulate file corruption (rename the db directory):
sudo mv /var/lib/postgresql/16/main/base/$DB_OID \
        /var/lib/postgresql/16/main/base/${DB_OID}_LOST

# Try to start -- it will fail:
sudo systemctl start postgresql
sudo -u postgres psql -c "\c recoverytest" 2>&1 | head -5

# RECOVERY: restore from backup (lose the post-backup changes):
sudo systemctl stop postgresql
sudo rm -rf /var/lib/postgresql/16/main/base/$DB_OID
sudo mv /var/lib/postgresql/16/main/base/${DB_OID}_LOST \
        /var/lib/postgresql/16/main/base/$DB_OID
sudo systemctl start postgresql

# Re-enable archiving:
sudo -u postgres psql -c "ALTER SYSTEM SET archive_mode = on;"
sudo systemctl restart postgresql
```

---

## Part 3 — Loss of a noncritical data file in ARCHIVELOG mode (Lecture 13, Slide 12)

Oracle: restore just the lost file and recover using archived logs — database stays open for other users.

```bash
# First take a fresh base backup:
sudo -u postgres pg_basebackup \
  -D /var/lib/postgresql/backups/base/recovery_demo \
  -Fp -Xs -P

# Record the current WAL position (backup label):
sudo -u postgres psql -c "SELECT pg_current_wal_lsn();"

# Make some changes after the backup:
sudo -u postgres psql -c "
  \c recoverytest
  INSERT INTO critical_data (value) SELECT 'after backup ' || g FROM generate_series(1,100) g;
"

# Get WAL LSN after changes:
sudo -u postgres psql -c "SELECT pg_current_wal_lsn() AS post_change_lsn;"

# Simulate data file loss:
DB_OID=$(sudo -u postgres psql -Atc "SELECT oid FROM pg_database WHERE datname='recoverytest';")
sudo systemctl stop postgresql
sudo mv /var/lib/postgresql/16/main/base/$DB_OID \
        /var/lib/postgresql/16/main/base/${DB_OID}_LOST
```

Now perform Point-In-Time Recovery (PITR) — equivalent of ARCHIVELOG recovery:

```bash
# Create recovery target directory:
sudo mkdir -p /var/lib/postgresql/pitr_recovery
sudo chown postgres:postgres /var/lib/postgresql/pitr_recovery

# Copy base backup to recovery location:
sudo -u postgres cp -r /var/lib/postgresql/backups/base/recovery_demo/* \
  /var/lib/postgresql/pitr_recovery/

# Create recovery signal file (tells PostgreSQL to enter recovery mode):
sudo -u postgres touch /var/lib/postgresql/pitr_recovery/recovery.signal

# Configure recovery settings:
sudo -u postgres nano /var/lib/postgresql/pitr_recovery/postgresql.conf
```

Add at the end:
```
restore_command = 'cp /var/lib/postgresql/wal_archive/%f %p'
recovery_target = 'immediate'   # Recover to consistent state
```

```bash
# Start PostgreSQL from the recovery directory:
sudo -u postgres /usr/lib/postgresql/16/bin/pg_ctl \
  -D /var/lib/postgresql/pitr_recovery \
  -l /var/lib/postgresql/pitr_recovery/recovery.log \
  start

# Check recovery log:
cat /var/lib/postgresql/pitr_recovery/recovery.log

# Verify data recovered:
sudo -u postgres psql -h /var/run/postgresql -p 5433 recoverytest -c \
  "SELECT count(*) FROM critical_data;"

# Restore original database directory:
sudo -u postgres /usr/lib/postgresql/16/bin/pg_ctl \
  -D /var/lib/postgresql/pitr_recovery stop

sudo mv /var/lib/postgresql/16/main/base/${DB_OID}_LOST \
        /var/lib/postgresql/16/main/base/$DB_OID
sudo systemctl start postgresql
```

---

## Part 4 — Loss of a control file (Lecture 13, Slide 8)

Oracle: copy existing control file to replace lost one. PostgreSQL equivalent — restore `pg_control`:

```bash
# Backup the pg_control file (do this NOW while DB is healthy):
sudo cp /var/lib/postgresql/16/main/global/pg_control \
        /var/lib/postgresql/backups/pg_control_$(date +%Y%m%d).bak

# If pg_control is ever lost or corrupted:
# Option 1: Restore from backup copy
sudo cp /var/lib/postgresql/backups/pg_control_YYYYMMDD.bak \
        /var/lib/postgresql/16/main/global/pg_control

# Option 2: Reset control file (last resort -- equivalent of RESETLOGS):
# sudo -u postgres /usr/lib/postgresql/16/bin/pg_resetwal \
#   /var/lib/postgresql/16/main/

# Note: pg_resetwal = Oracle's "ALTER DATABASE OPEN RESETLOGS"
# Use ONLY as last resort -- it discards unwritten WAL
```

---

## Part 5 — Loss of a redo log file (Lecture 13, Slide 9)

Oracle: if other members of the group exist, operation continues normally.

```bash
# View current WAL files (equivalent of redo log groups):
sudo ls -lh /var/lib/postgresql/16/main/pg_wal/

# If a WAL file is lost but the database is still running:
# PostgreSQL will error and stop -- check the log:
sudo tail -20 /var/log/postgresql/postgresql-16-main.log

# Recovery: restore the WAL file from archive:
# sudo cp /var/lib/postgresql/wal_archive/<lost_file> \
#         /var/lib/postgresql/16/main/pg_wal/

# Equivalent of Oracle "clear the log group":
# sudo -u postgres psql -c "SELECT pg_switch_wal();"
# (Forces a new WAL segment, moves past the problem)
```

---

## Part 6 — Data Recovery Advisor equivalents (Lecture 13, Slides 6, 15-21)

Oracle's Data Recovery Advisor has 5 steps: Assess → List → Advise → Repair → Proactive checks.

```sql
-- Step 1: Assess failures (equivalent of Health Monitor):
sudo -u postgres psql

-- Check for corruption in data pages:
CREATE EXTENSION IF NOT EXISTS pg_visibility;
SELECT * FROM pg_check_relation('critical_data'::regclass);

-- Step 2: List failures (equivalent of LIST FAILURE):
-- Check for invalid/missing objects:
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public';

-- Check indexes are valid:
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public';

-- Step 3: Advise on repair (equivalent of ADVISE FAILURE):
-- Check table health:
SELECT relname, n_live_tup, n_dead_tup,
  CASE WHEN n_dead_tup > n_live_tup THEN 'NEEDS VACUUM'
       ELSE 'OK'
  END AS health
FROM pg_stat_user_tables;

-- Step 4: Execute repair (equivalent of REPAIR FAILURE):
-- Rebuild corrupted index:
REINDEX TABLE critical_data;

-- Repair table bloat:
VACUUM FULL critical_data;

-- Step 5: Proactive checks (equivalent of proactive Health Monitor):
-- Check for tables with no recent vacuum/analyze:
SELECT relname, last_vacuum, last_analyze,
  CASE WHEN last_analyze IS NULL THEN 'NEVER ANALYZED - fix this'
       ELSE 'OK'
  END AS status
FROM pg_stat_user_tables;
```

---

## Checklist

- [ ] ✅ Took Proxmox snapshot before starting
- [ ] Understood what PostgreSQL needs to start (equivalent of Oracle's 3 open requirements)
- [ ] Simulated NOARCHIVELOG recovery (restored entire DB from backup)
- [ ] Simulated ARCHIVELOG recovery using PITR
- [ ] Backed up pg_control file
- [ ] Understood WAL file loss recovery options
- [ ] Ran all 5 Data Recovery Advisor equivalent steps
- [ ] Used REINDEX and VACUUM FULL as repair operations

---

## Key takeaway

Oracle's Data Recovery Advisor = PostgreSQL's combination of pg_controldata, pg_check_relation, and log file analysis. Oracle's RMAN RESTORE + RECOVER = PostgreSQL's pg_basebackup restore + WAL replay using `restore_command`. The critical difference: Oracle's Data Recovery Advisor is a GUI tool with automated detection; PostgreSQL requires you to manually query pg_stat_* views and read logs. But the underlying recovery logic — restore, apply archived logs, roll forward, roll back uncommitted — is identical to Oracle's Slides 13-14.
