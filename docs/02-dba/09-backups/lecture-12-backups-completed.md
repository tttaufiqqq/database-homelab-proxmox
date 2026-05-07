# Lab — Lecture 12: Performing Database Backups

**Lecture topic:** RMAN, backup types (full/incremental/consistent), image copies vs backup sets, scheduling backups, fast recovery area monitoring  
**Your server:** `taufiq-db` — connect via `ssh taufiq@100.75.213.36`  
**Completed:** 2026-05-03

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
| Image copy | `pg_basebackup -Fp` (plain format) |
| Backup set | `pg_basebackup -Ft -z` (tar + compressed) |
| Fast recovery area | `/var/lib/postgresql/wal_archive/` + `/var/lib/postgresql/backups/` |

---

## Setup

```bash
sudo mkdir -p /var/lib/postgresql/backups/base
sudo mkdir -p /var/lib/postgresql/backups/logs
sudo mkdir -p /var/lib/postgresql/backups/scripts
sudo chown -R postgres:postgres /var/lib/postgresql/backups
```

### ✅ Result
```
total 12K
drwxr-xr-x 2 postgres postgres 4.0K May  3 01:35 base
drwxr-xr-x 2 postgres postgres 4.0K May  3 01:35 logs
drwxr-xr-x 2 postgres postgres 4.0K May  3 01:35 scripts
```

**Note:** The `ts_app` tablespace from Lecture 5 lab needed to be dropped before backups could run — `pg_basebackup` backs up all tablespaces and fails if any non-default tablespace directories have content:
```bash
sudo -u postgres psql -c "DROP TABLESPACE IF EXISTS ts_app;"
sudo rm -rf /mnt/pg_tablespaces/ts_app/PG_16_202307071
```

---

## Part 1 — Cold (consistent/offline) backup (Lecture 12, Slide 6)

Oracle's consistent backup requires the database to be shut down cleanly first.

```bash
sudo systemctl stop postgresql

sudo -u postgres cp -r /var/lib/postgresql/16/main \
  /var/lib/postgresql/backups/base/cold_$(date +%Y%m%d_%H%M%S)

sudo systemctl start postgresql

sudo du -sh /var/lib/postgresql/backups/base/cold_*
sudo ls /var/lib/postgresql/backups/base/cold_20260503_013621/ | head -10
```

### ✅ Results observed

```
129M    /var/lib/postgresql/backups/base/cold_20260503_013621

base
global
pg_commit_ts
pg_dynshmem
pg_logical
pg_multixact
pg_notify
pg_replslot
pg_serial
pg_snapshots
```

Complete copy of all data directory folders. 129MB — includes WAL archive directory. Database was down for the duration of the copy, equivalent to Oracle's cold backup window.

---

## Part 2 — Hot (inconsistent/online) backup — plain format (Lecture 12, Slide 6)

Oracle's hot backup uses RMAN while the database stays open. PostgreSQL uses `pg_basebackup`.

```bash
sudo -u postgres pg_basebackup \
  -D /var/lib/postgresql/backups/base/hot_$(date +%Y%m%d_%H%M%S) \
  -Fp \
  -Xs \
  -P \
  -v
```

### ✅ Results observed

```
pg_basebackup: initiating base backup, waiting for checkpoint to complete
pg_basebackup: checkpoint completed
pg_basebackup: write-ahead log start point: 0/E000028 on timeline 1
pg_basebackup: starting background WAL receiver
pg_basebackup: created temporary replication slot "pg_basebackup_9150"
82480/82480 kB (100%), 1/1 tablespace
pg_basebackup: write-ahead log end point: 0/E000100
pg_basebackup: waiting for background process to finish streaming ...
pg_basebackup: syncing data to disk ...
pg_basebackup: renaming backup_manifest.tmp to backup_manifest
pg_basebackup: base backup completed
```

| Output line | Oracle RMAN equivalent | Meaning |
|---|---|---|
| `waiting for checkpoint to complete` | Backup start SCN recorded | Forces checkpoint before backup starts |
| `write-ahead log start point: 0/E000028` | Begin SCN | WAL position at backup start |
| `created temporary replication slot` | RMAN channel allocated | Keeps WAL available during backup |
| `82480/82480 kB (100%), 1/1 tablespace` | Backup progress | 82MB copied, 1 tablespace |
| `write-ahead log end point: 0/E000100` | End SCN | Recovery must replay WAL between start and end points |
| `waiting for background process to finish streaming` | ARCn catching up | WAL streamer capturing all changes during backup |
| `base backup completed` | RMAN completed | Equivalent of Oracle "Finished backup" |

Database stayed running throughout — zero downtime.

---

## Part 3 — Hot backup — tar format (RMAN backup set equivalent)

```bash
sudo -u postgres pg_basebackup \
  -D /var/lib/postgresql/backups/base/hot_tar_$(date +%Y%m%d_%H%M%S) \
  -Ft \
  -z \
  -Xs \
  -P
```

### ✅ Backup size comparison

```
129M    /var/lib/postgresql/backups/base/cold_20260503_013621
96M     /var/lib/postgresql/backups/base/hot_20260503_014011
13M     /var/lib/postgresql/backups/base/hot_tar_20260503_014045
```

| Backup type | Size | Compression | Oracle equivalent |
|---|---|---|---|
| Cold (plain) | 129MB | None | Consistent backup / image copy |
| Hot plain (`-Fp`) | 96MB | None | RMAN image copy |
| Hot tar (`-Ft -z`) | **13MB** | gzip | RMAN backup set (compressed) |

The tar backup is 87% smaller than the plain hot backup — same data, same recoverability. In production with hundreds of GB, this directly affects storage costs and transfer time. Oracle's backup sets achieve the same trade-off.

**WAL files = incremental backup:** Every WAL segment in `/var/lib/postgresql/wal_archive/` captures all changes since the last base backup. To restore to any point in time: base backup + WAL files up to that moment. This is Oracle's incremental backup strategy without needing a separate incremental command.

---

## Part 4 — Automated backup script (Lecture 12, Slides 11-15)

```bash
sudo nano /var/lib/postgresql/backups/scripts/daily_backup.sh
```

Content:
```bash
#!/bin/bash
BACKUP_DIR="/var/lib/postgresql/backups/base"
LOG_DIR="/var/lib/postgresql/backups/logs"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

mkdir -p "$LOG_DIR"
echo "[$DATE] Starting backup..." >> "$LOG_DIR/backup.log"

pg_basebackup \
  -D "$BACKUP_DIR/backup_$DATE" \
  -Ft -z -Xs -P \
  >> "$LOG_DIR/backup.log" 2>&1

if [ $? -eq 0 ]; then
  echo "[$DATE] Backup completed successfully" >> "$LOG_DIR/backup.log"
else
  echo "[$DATE] BACKUP FAILED" >> "$LOG_DIR/backup.log"
fi

find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +$RETENTION_DAYS -exec rm -rf {} \;
echo "[$DATE] Cleanup done" >> "$LOG_DIR/backup.log"
```

```bash
sudo chmod +x /var/lib/postgresql/backups/scripts/daily_backup.sh
sudo chown postgres:postgres /var/lib/postgresql/backups/scripts/daily_backup.sh
sudo -u postgres /var/lib/postgresql/backups/scripts/daily_backup.sh
cat /var/lib/postgresql/backups/logs/backup.log
```

### ✅ Results observed

```
[20260503_014215] Starting backup...
waiting for checkpoint
   78/82470 kB (0%), 0/1 tablespace
44702/82470 kB (54%), 0/1 tablespace
82481/82481 kB (100%), 0/1 tablespace
82481/82481 kB (100%), 1/1 tablespace
[20260503_014215] Backup completed successfully
[20260503_014215] Cleanup done
```

Note: `find: Failed to restore initial working directory: /home/taufiq: Permission denied` warning is harmless — `find` can't return to the taufiq home directory after switching to postgres user. Backup completed successfully.

### Schedule with cron (equivalent of Oracle EM backup schedule, Slide 14):

```bash
sudo -u postgres crontab -e
```

Added:
```
0 2 * * * /var/lib/postgresql/backups/scripts/daily_backup.sh
```

Runs nightly at 2am — equivalent of Oracle's automated maintenance window backup job.

---

## Part 5 — Control file backup (Lecture 12, Slide 16)

```bash
sudo -u postgres bash -c "/usr/lib/postgresql/16/bin/pg_controldata \
  /var/lib/postgresql/16/main/ \
  > /var/lib/postgresql/backups/pg_controldata_$(date +%Y%m%d).txt"

ls -lh /var/lib/postgresql/backups/pg_controldata_*.txt
```

### ✅ Results observed

```
-rw-rw-r-- 1 postgres postgres 2.3K May  3 01:47 /var/lib/postgresql/backups/pg_controldata_20260503.txt
```

2.3KB control file snapshot saved. Equivalent of Oracle's `ALTER DATABASE BACKUP CONTROLFILE TO TRACE` — if `pg_control` is ever lost or corrupted, this file contains all the information needed to rebuild it or guide recovery.

**Note on redirect syntax:** Must use `sudo -u postgres bash -c "... > file"` not `sudo -u postgres command > file` — the redirect runs as the calling user (`taufiq`), not as postgres, causing permission denied on postgres-owned directories.

---

## Part 6 — Final storage summary

```bash
echo "=== Backups ===" && sudo du -sh /var/lib/postgresql/backups/base/*
echo "=== WAL Archive ===" && du -sh /var/lib/postgresql/wal_archive/
echo "=== Control file backup ===" && ls -lh /var/lib/postgresql/backups/pg_controldata_*.txt
```

### ✅ Results observed

```
=== Backups ===
13M     /var/lib/postgresql/backups/base/backup_20260503_014215
129M    /var/lib/postgresql/backups/base/cold_20260503_013621
96M     /var/lib/postgresql/backups/base/hot_20260503_014011
13M     /var/lib/postgresql/backups/base/hot_tar_20260503_014045

=== WAL Archive ===
257M    /var/lib/postgresql/wal_archive/

=== Control file backup ===
-rw-rw-r-- 1 postgres postgres 2.3K May  3 01:47 /var/lib/postgresql/backups/pg_controldata_20260503.txt
```

**Total recovery infrastructure on disk:**

| Location | Size | Purpose |
|---|---|---|
| `/backups/base/` | ~251MB | 4 base backups (3 manual + 1 scripted) |
| `/wal_archive/` | 257MB | All WAL since archiving enabled — incremental changes |
| `pg_controldata.txt` | 2.3KB | Control file snapshot |

With this setup, recovery to any point in time since archiving was enabled is possible using any base backup + WAL files up to the target time.

---

## Checklist

- [x] Dropped leftover `ts_app` tablespace to allow clean backups
- [x] Created cold (offline/consistent) backup — 129MB
- [x] Created hot (online) backup in plain format (`-Fp`) — 96MB
- [x] Created hot backup in tar+gzip format (`-Ft -z`) — 13MB
- [x] Compared sizes: tar backup 87% smaller than plain
- [x] Understood WAL segments as the incremental backup mechanism
- [x] Created and tested automated backup script
- [x] Scheduled nightly backup with cron at 2am
- [x] Saved pg_controldata output as control file trace equivalent
- [x] Confirmed WAL archive at 257MB — full history since Lec 11

---

## Key takeaway

Oracle's RMAN = PostgreSQL's `pg_basebackup` + WAL archiving. RMAN image copies = `pg_basebackup -Fp`. RMAN backup sets = `pg_basebackup -Ft -z` (87% smaller in this lab). RMAN incremental backups = WAL segments in `/wal_archive/`. RMAN DELETE OBSOLETE = `find ... -mtime +7 -exec rm`. Oracle's Enterprise Manager backup scheduler = cron. The concepts are identical — PostgreSQL just uses different command names. The Proxmox snapshot capability adds a third layer of protection (hypervisor-level) that Oracle environments typically don't get for free.
