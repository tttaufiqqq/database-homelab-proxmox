# Lab — Lecture 11: Backup and Recovery Concepts

**Lecture topic:** Failure categories, instance recovery, CKPT/LGWR processes, redo logs, ARCHIVELOG mode, fast recovery area  
**Your server:** `taufiq-db` — connect via `ssh taufiq@100.75.213.36`  
**Completed:** 2026-05-02

---

## Objective

Map Oracle's failure categories, recovery architecture (CKPT, LGWR, ARCn), and ARCHIVELOG mode to PostgreSQL equivalents — then configure the server for maximum recoverability.

---

## Part 1 — Enable ARCHIVELOG mode (WAL archiving)

### Baseline check

```sql
SELECT name, setting FROM pg_settings
WHERE name IN (
  'wal_level', 'archive_mode', 'archive_command',
  'archive_timeout', 'checkpoint_timeout', 'checkpoint_completion_target'
)
ORDER BY name;
```

### ✅ Baseline results

```
 name                         |  setting
------------------------------+------------
 archive_command              | (disabled)
 archive_mode                 | off
 archive_timeout              | 0
 checkpoint_completion_target | 0.9
 checkpoint_timeout           | 300
 wal_level                    | replica
```

| Parameter | Status | Note |
|---|---|---|
| `wal_level = replica` | ✅ Already correct | Set previously during pg_stat_statements restart |
| `archive_mode = off` | ❌ Needed enabling | |
| `archive_command = (disabled)` | ❌ Needed setting | |
| `checkpoint_timeout = 300` | ✅ Already correct | |
| `checkpoint_completion_target = 0.9` | ✅ Already correct | |

### Enable archiving

```bash
sudo mkdir -p /var/lib/postgresql/wal_archive
sudo chown postgres:postgres /var/lib/postgresql/wal_archive

sudo -u postgres psql -c "ALTER SYSTEM SET archive_mode = on;"
sudo -u postgres psql -c "ALTER SYSTEM SET archive_command = 'test ! -f /var/lib/postgresql/wal_archive/%f && cp %p /var/lib/postgresql/wal_archive/%f';"
sudo -u postgres psql -c "ALTER SYSTEM SET archive_timeout = 300;"
sudo systemctl restart postgresql
```

### ✅ Verified results

```
 name            |                                         setting
-----------------+------------------------------------------------------------------------------------------
 archive_command | test ! -f /var/lib/postgresql/wal_archive/%f && cp %p /var/lib/postgresql/wal_archive/%f
 archive_mode    | on
 archive_timeout | 300
 wal_level       | replica
```

### Test archiving with a WAL switch

```bash
sudo -u postgres psql -c "SELECT pg_switch_wal();"
sleep 3
ls -lh /var/lib/postgresql/wal_archive/
```

### ✅ Archive test results

```
 pg_switch_wal
---------------
 0/3D92660

total 16M
-rw------- 1 postgres postgres 16M May  2 18:44 000000010000000000000003
```

First WAL segment (16MB) archived successfully. Equivalent of Oracle's ARCn process writing the first archived redo log to the archive destination.

| Oracle concept | PostgreSQL equivalent |
|---|---|
| `ALTER DATABASE ARCHIVELOG` | `archive_mode = on` |
| ARCn process | `archive_command` shell script |
| Archive destination | `/var/lib/postgresql/wal_archive/` |
| Archived redo log | 16MB WAL segment file |
| `ARCHIVE LOG LIST` | Query `pg_settings` for archive parameters |

---

## Part 2 — Checkpoint Process (Lecture 11, Slide 11)

```sql
SELECT checkpoints_timed, checkpoints_req,
       checkpoint_write_time, checkpoint_sync_time,
       buffers_checkpoint, buffers_clean, buffers_backend
FROM pg_stat_bgwriter;
```

```bash
sudo -u postgres psql -c "CHECKPOINT;"
sudo tail -20 /var/log/postgresql/postgresql-16-main.log | grep -i checkpoint
```

### ✅ Results observed

```
2026-05-02 18:42:22 LOG:  checkpoint starting: time
2026-05-02 18:42:22 LOG:  checkpoint complete: wrote 4 buffers (0.0%); 0 WAL file(s) added, 0 removed, 0 recycled; write=0.106 s, sync=0.014 s, total=0.139 s; distance=0 kB; lsn=0/3D92598, redo lsn=0/3D92560

2026-05-02 18:45:12 LOG:  checkpoint starting: immediate force wait
2026-05-02 18:45:12 LOG:  checkpoint complete: wrote 0 buffers (0.0%); 0 WAL file(s) added, 0 removed, 1 recycled; write=0.001 s, sync=0.001 s, total=0.014 s; distance=2486 kB; lsn=0/4000098, redo lsn=0/4000060
```

| Log field | Oracle equivalent | Meaning |
|---|---|---|
| `checkpoint starting: time` | Automatic checkpoint | Triggered by `checkpoint_timeout = 300s` |
| `checkpoint starting: immediate force wait` | `ALTER SYSTEM CHECKPOINT` | Manual checkpoint command |
| `wrote 4 buffers` | DBWn write activity | Dirty buffers flushed to disk by background writer |
| `lsn=0/3D92598` | Checkpoint SCN | Current WAL position at checkpoint time |
| `redo lsn=0/3D92560` | Redo start SCN | How far back WAL must replay on crash recovery |
| `1 recycled` | Redo log group reuse | WAL segment reused after archiving — equivalent of Oracle reusing a redo log group after ARCn archived it |

**Key observation:** The small gap between `lsn` and `redo lsn` means crash recovery would need to replay very little WAL — this is Oracle's MTTR concept from Slide 16. A recent checkpoint = faster instance recovery.

---

## Part 3 — WAL Files and Log Switches (Lecture 11, Slide 12)

```sql
SELECT pg_current_wal_lsn() AS current_lsn,
       pg_walfile_name(pg_current_wal_lsn()) AS current_wal_file;
```

```bash
sudo ls -lh /var/lib/postgresql/16/main/pg_wal/
```

### ✅ Results observed

```
 current_lsn |     current_wal_file
-------------+--------------------------
 0/4000148   | 000000010000000000000004

total 33M
-rw------- 1 postgres postgres  16M May  2 18:45 000000010000000000000004
-rw------- 1 postgres postgres  16M May  2 18:44 000000010000000000000005
drwx------ 2 postgres postgres 4.0K May  2 18:45 archive_status
```

| File | Oracle equivalent | Status |
|---|---|---|
| `...000000004` | Current active redo log group | Being written to by walwriter |
| `...000000005` | Next redo log group | Pre-allocated, waiting |
| `archive_status/` | — | Tracks which WAL files have been successfully archived |
| `...000000003` (in archive) | Archived redo log | Already archived, removed from pg_wal/ |

### Force a second WAL switch

```bash
sudo -u postgres psql -c "SELECT pg_switch_wal();"
sleep 3
sudo ls -lh /var/lib/postgresql/16/main/pg_wal/
ls -lh /var/lib/postgresql/wal_archive/
```

### ✅ Results after second switch

```
=== pg_wal directory ===
total 33M
-rw------- 1 postgres postgres  16M May  2 18:46 000000010000000000000004
-rw------- 1 postgres postgres  16M May  2 18:44 000000010000000000000005

=== archive directory ===
total 32M
-rw------- 1 postgres postgres 16M May  2 18:44 000000010000000000000003
-rw------- 1 postgres postgres 16M May  2 18:46 000000010000000000000004
```

File `000000000004` moved from active to archived the moment the WAL switch made it inactive. This is Oracle's redo log cycle from Slide 12: **active → inactive → archived → reusable**. File 5 remains pre-allocated in `pg_wal/` — PostgreSQL keeps one segment ahead so walwriter never waits for disk allocation.

---

## Part 4 — Crash Recovery (Lecture 11, Slides 13-15)

### Setup — open uncommitted transaction

```sql
sudo -u postgres psql -d perflab
BEGIN;
INSERT INTO orders (customer, amount, status) VALUES ('Crash Test', 9999.00, 'pending');
SELECT count(*) FROM orders;
```

### ✅ Pre-crash count

```
 count
--------
 100001
```

Row 100,001 exists in the session but is NOT committed.

### Simulate ungraceful shutdown (power outage equivalent)

```bash
sudo systemctl kill -s SIGKILL postgresql
sudo systemctl start postgresql
```

### ✅ Crash recovery result

```bash
sudo -u postgres /usr/lib/postgresql/16/bin/pg_controldata /var/lib/postgresql/16/main/ | grep -E "state|checkpoint|Prior"
```

```
Database cluster state:               in production
Latest checkpoint location:           0/5000098
Latest checkpoint's REDO location:    0/5000060
Latest checkpoint's REDO WAL file:    000000010000000000000005
Latest checkpoint's NextXID:          0:801
Latest checkpoint's oldestActiveXID:  801
```

```bash
sudo -u postgres psql -d perflab -c "SELECT count(*) FROM orders;"
```

```
 count
--------
 100000
```

**The uncommitted row is gone.** Recovery completed in milliseconds with zero DBA intervention.

### Oracle crash recovery phases — observed on your server (Slides 13-15)

| Phase | Oracle term | What PostgreSQL did |
|---|---|---|
| 1 | Roll Forward | Replayed WAL from `redo lsn=0/5000060` forward — reconstructed all committed changes |
| 2 | Roll Back | Found XID 801 (`INSERT INTO orders`) was uncommitted — reversed it using WAL record |
| Complete | Database OPEN | `cluster state = in production` — identical to Oracle's OPEN state |

**Key observation:** `Database cluster state: in production` in `pg_controldata` is the equivalent of Oracle's database being in OPEN state. If crash recovery had failed or was incomplete this would show `in crash recovery` — the DBA would then need to intervene, exactly as Oracle's Slide 15 describes.

---

## Part 5 — Control File (Lecture 11, Slide 8)

```bash
sudo -u postgres /usr/lib/postgresql/16/bin/pg_controldata /var/lib/postgresql/16/main/
```

### ✅ Full output

```
pg_control version number:            1300
Catalog version number:               202307071
Database system identifier:           7634687668071431355
Database cluster state:               in production
pg_control last modified:             Sat 02 May 2026 06:50:12 PM +08
Latest checkpoint location:           0/5000098
Latest checkpoint's REDO location:    0/5000060
Latest checkpoint's REDO WAL file:    000000010000000000000005
Latest checkpoint's TimeLineID:       1
Latest checkpoint's full_page_writes: on
Latest checkpoint's NextXID:          0:801
Latest checkpoint's NextOID:          32845
Latest checkpoint's oldestXID:        722
Latest checkpoint's oldestActiveXID:  801
Minimum recovery ending location:     0/0
Backup start location:                0/0
wal_level setting:                    replica
max_connections setting:              100
Database block size:                  8192
Bytes per WAL segment:                16777216
Data page checksum version:           0
```

| pg_controldata field | Oracle control file equivalent | Meaning |
|---|---|---|
| `Database system identifier` | DB_ID | Unique identifier for this PostgreSQL cluster |
| `Database cluster state` | Mount/Open status | `in production` = OPEN |
| `Latest checkpoint location` | Checkpoint SCN | LSN of most recent checkpoint |
| `Latest checkpoint's REDO location` | Redo start SCN | WAL replay start point for crash recovery |
| `TimeLineID` | Incarnation number | Increments after PITR recovery (like Oracle RESETLOGS) |
| `NextXID` | Next transaction SCN | Next transaction ID to be assigned |
| `Minimum recovery ending location: 0/0` | — | Not in recovery — database is clean |
| `Backup start location: 0/0` | — | No backup currently in progress |
| `Database block size: 8192` | DB_BLOCK_SIZE | 8KB blocks — same as Oracle default |
| `Bytes per WAL segment: 16777216` | Redo log file size | 16MB per WAL segment |

**Oracle multiplexes control files** across multiple locations. PostgreSQL equivalent:
```bash
# Backup pg_control (do this regularly):
sudo cp /var/lib/postgresql/16/main/global/pg_control \
        /var/lib/postgresql/backups/pg_control_$(date +%Y%m%d).bak
```

---

## Checklist

- [x] Checked baseline WAL/archive configuration
- [x] Created WAL archive directory
- [x] Enabled `archive_mode = on` (ARCHIVELOG mode equivalent)
- [x] Set `archive_command` (ARCn equivalent)
- [x] Forced WAL switch and confirmed first archive file created
- [x] Observed checkpoint stats in `pg_stat_bgwriter`
- [x] Forced manual checkpoint and read log entries
- [x] Mapped all checkpoint log fields to Oracle equivalents
- [x] Observed WAL file lifecycle: active → archived → reusable
- [x] Forced second WAL switch and confirmed file 4 archived
- [x] Simulated crash with SIGKILL (power outage equivalent)
- [x] Confirmed uncommitted transaction rolled back (100,000 not 100,001)
- [x] Confirmed `cluster state = in production` after crash recovery
- [x] Read full `pg_controldata` output and mapped all fields to Oracle control file

---

## Key takeaway

Oracle's ARCHIVELOG mode = PostgreSQL `archive_mode = on`. Oracle's redo log groups = PostgreSQL WAL segments in `pg_wal/`. Oracle's CKPT = PostgreSQL `checkpointer`. Oracle's LGWR = PostgreSQL `walwriter`. Oracle's ARCn = PostgreSQL `archive_command`. Oracle's instance recovery phases (Roll Forward + Roll Back from Slides 13-15) happened automatically on your server in milliseconds after SIGKILL — the uncommitted `Crash Test` row was gone and the database was back to a consistent 100,000 rows without any DBA intervention. This is the fundamental guarantee that makes relational databases reliable.

---

## Scenario: "The server lost power — what do I do when it comes back up?"

```bash
# Step 1 — just start PostgreSQL:
sudo systemctl start postgresql

# Step 2 — check recovery completed:
sudo -u postgres /usr/lib/postgresql/16/bin/pg_controldata /var/lib/postgresql/16/main/ | grep "cluster state"
# Must show: in production
# If shows: in crash recovery → check log for errors

# Step 3 — verify archive is intact:
ls -lh /var/lib/postgresql/wal_archive/ | tail -5

# Step 4 — check the log for any errors during recovery:
sudo grep -E "ERROR|FATAL|PANIC" /var/log/postgresql/postgresql-16-main.log | tail -20

# Step 5 — verify data integrity:
sudo -u postgres psql -c "SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database;"
```

If `cluster state` shows anything other than `in production` after startup — do NOT proceed. Open the Proxmox console, check the log carefully, and restore from your last `pg_basebackup` + WAL archive.
