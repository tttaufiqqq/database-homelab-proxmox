# Lab — Lecture 12: Performing Database Backups

**Lecture topic:** RMAN, backup types (full/incremental/consistent), image copies vs backup sets, scheduling backups, fast recovery area monitoring  
**Your server:** `taufiq-db` — connect via `ssh taufiq@100.75.213.36`

---

## Objective

Implement Oracle's backup strategy concepts — consistent/inconsistent backups, full/incremental, online/offline — using PostgreSQL's `pg_basebackup`, WAL archiving, and shell scripts as the RMAN equivalent.

---

## Terminology mapping (Lecture 12, Slide 6)

| Oracle term | PostgreSQL equivalent |
|---|---|
| RMAN | `pg_basebackup` + WAL archiving |
| Consistent (cold/offline) backup | Backup taken while PostgreSQL is stopped |
| Inconsistent (hot/online) backup | `pg_basebackup` while PostgreSQL is running |
| Full backup | `pg_basebackup` — copies all data files |
| Incremental backup | WAL segments since last base backup |
| Image copy | File-level copy of data directory |
| Backup set | `pg_basebackup` tar format output |
| Fast recovery area | Your `/var/lib/postgresql/fra/` directory |

---

## Setup

```bash
# Ensure WAL archiving is enabled from Lecture 11:
sudo -u postgres psql -c "SHOW archive_mode;"
# Should show: on

# Create backup storage directories:
sudo mkdir -p /var/lib/postgresql/backups/base
sudo mkdir -p /var/lib/postgresql/backups/scripts
sudo chown -R postgres:postgres /var/lib/postgresql/backups
```

---

## Part 1 — Consistent (offline) backup (Lecture 12, Slide 6)

Oracle's consistent backup requires the database to be shut down cleanly. PostgreSQL equivalent:

```bash
# Stop the database (equivalent of SHUTDOWN IMMEDIATE):
sudo systemctl stop postgresql

# Copy the entire data directory (equivalent of RMAN BACKUP DATABASE in cold mode):
sudo -u postgres cp -r /var/lib/postgresql/16/main \
  /var/lib/postgresql/backups/base/cold_backup_$(date +%Y%m%d_%H%M%S)

# Restart the database:
sudo systemctl start postgresql

# Verify backup exists:
ls -lh /var/lib/postgresql/backups/base/
```

---

## Part 2 — Inconsistent (online/hot) backup with pg_basebackup (Lecture 12, Slide 6)

Oracle's hot backup uses RMAN while the database is open. PostgreSQL uses `pg_basebackup`:

```bash
# Online backup -- database stays running (equivalent of RMAN BACKUP DATABASE):
sudo -u postgres pg_basebackup \
  -D /var/lib/postgresql/backups/base/hot_$(date +%Y%m%d_%H%M%S) \
  -Fp \          # Format: plain (equivalent of image copy)
  -Xs \          # Include WAL via streaming
  -P \           # Show progress
  -v             # Verbose

# Tar format (equivalent of RMAN backup set):
sudo -u postgres pg_basebackup \
  -D /var/lib/postgresql/backups/base/hot_tar_$(date +%Y%m%d) \
  -Ft \          # Format: tar (compressed, like RMAN backup pieces)
  -z \           # Compress with gzip
  -Xs \
  -P

# Verify backup:
ls -lh /var/lib/postgresql/backups/base/
```

---

## Part 3 — Incremental backup (Lecture 12, Slide 6)

Oracle's incremental backup captures only changed blocks. PostgreSQL achieves this through WAL archiving — every change since the last base backup is captured in WAL files.

```bash
# WAL files ARE your incremental backup.
# After a base backup, all subsequent WAL files = cumulative incremental

# View WAL files accumulated since last backup:
ls -lh /var/lib/postgresql/wal_archive/

# Each 16MB WAL file contains all changes since the previous file
# To restore to any point in time: base backup + WAL files up to that moment

# Check WAL accumulation rate:
sudo -u postgres psql -c "
SELECT count(*) as wal_files,
       pg_size_pretty(sum(size)) as total_size
FROM pg_ls_waldir();"
```

---

## Part 4 — Automate backups (Lecture 12, Slides 11-15)

Oracle schedules backups through Enterprise Manager. On your server, use cron:

```bash
# Create a backup script:
sudo nano /var/lib/postgresql/backups/scripts/daily_backup.sh
```

Paste this content:
```bash
#!/bin/bash
# PostgreSQL daily backup script
# Equivalent of Oracle's RMAN scheduled backup job

BACKUP_DIR="/var/lib/postgresql/backups/base"
LOG_DIR="/var/lib/postgresql/backups/logs"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

mkdir -p "$LOG_DIR"

echo "[$DATE] Starting backup..." >> "$LOG_DIR/backup.log"

# Full base backup (equivalent of RMAN BACKUP DATABASE PLUS ARCHIVELOG):
pg_basebackup \
  -D "$BACKUP_DIR/backup_$DATE" \
  -Ft -z -Xs -P \
  >> "$LOG_DIR/backup.log" 2>&1

if [ $? -eq 0 ]; then
  echo "[$DATE] Backup completed successfully" >> "$LOG_DIR/backup.log"
else
  echo "[$DATE] BACKUP FAILED" >> "$LOG_DIR/backup.log"
fi

# Cleanup old backups (equivalent of RMAN DELETE OBSOLETE):
find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +$RETENTION_DAYS -exec rm -rf {} \;
echo "[$DATE] Old backups cleaned up" >> "$LOG_DIR/backup.log"
```

```bash
# Make it executable:
sudo chmod +x /var/lib/postgresql/backups/scripts/daily_backup.sh
sudo chown postgres:postgres /var/lib/postgresql/backups/scripts/daily_backup.sh

# Test it:
sudo -u postgres /var/lib/postgresql/backups/scripts/daily_backup.sh

# Schedule with cron (equivalent of Oracle EM backup schedule, Slide 14):
sudo -u postgres crontab -e
```

Add this line for nightly 2am backup:
```
0 2 * * * /var/lib/postgresql/backups/scripts/daily_backup.sh
```

---

## Part 5 — Backup of control file to trace (Lecture 12, Slide 16)

Oracle backs up the control file to a trace file for disaster recovery. PostgreSQL equivalent:

```bash
# Backup pg_controldata output (equivalent of control file trace backup):
sudo -u postgres /usr/lib/postgresql/16/bin/pg_controldata \
  /var/lib/postgresql/16/main/ \
  > /var/lib/postgresql/backups/pg_controldata_$(date +%Y%m%d).txt

cat /var/lib/postgresql/backups/pg_controldata_$(date +%Y%m%d).txt
```

---

## Part 6 — View backup reports (Lecture 12, Slides 17-18)

Oracle shows backup reports in Enterprise Manager. View yours:

```bash
# View backup history:
ls -lht /var/lib/postgresql/backups/base/

# View backup log:
cat /var/lib/postgresql/backups/logs/backup.log

# Check backup sizes:
du -sh /var/lib/postgresql/backups/base/*
```

```sql
-- Database-level backup reporting (equivalent of V$BACKUP_SET):
sudo -u postgres psql -c "
SELECT
  datname,
  pg_size_pretty(pg_database_size(datname)) AS db_size
FROM pg_database
WHERE datname NOT IN ('template0','template1');"
```

---

## Part 7 — Monitor the fast recovery area (Lecture 12, Slide 19)

```bash
# Monitor WAL archive (your FRA equivalent):
echo "=== WAL Archive Status ==="
ls -lh /var/lib/postgresql/wal_archive/ | tail -5
echo ""
echo "=== Archive Total Size ==="
du -sh /var/lib/postgresql/wal_archive/
echo ""
echo "=== Backup Storage Used ==="
du -sh /var/lib/postgresql/backups/

# Alert if archive is getting large (equivalent of FRA space alert):
ARCHIVE_SIZE=$(du -sb /var/lib/postgresql/wal_archive/ | cut -f1)
MAX_SIZE=$((10 * 1024 * 1024 * 1024))  # 10GB limit
if [ $ARCHIVE_SIZE -gt $MAX_SIZE ]; then
  echo "ALERT: WAL archive exceeds 10GB!"
fi
```

---

## Checklist

- [ ] Created cold (offline/consistent) backup
- [ ] Created hot (online/inconsistent) backup with `pg_basebackup` in plain format
- [ ] Created hot backup in tar format (equivalent of backup set)
- [ ] Understood WAL files as the incremental backup mechanism
- [ ] Created and tested the automated backup script
- [ ] Scheduled the backup with cron
- [ ] Saved pg_controldata output as control file trace equivalent
- [ ] Monitored backup storage sizes and WAL archive usage

---

## Key takeaway

Oracle's RMAN = PostgreSQL's `pg_basebackup` + WAL archiving. RMAN's image copies = `pg_basebackup -Fp`. RMAN's backup sets = `pg_basebackup -Ft -z`. RMAN's incremental backups = WAL segments. RMAN's DELETE OBSOLETE = `find ... -mtime +7 -exec rm`. The concepts are identical — PostgreSQL just uses different command names. Your Proxmox snapshots add a third layer of protection (hypervisor level) that Oracle environments typically don't have for free.
