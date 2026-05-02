# Lab Session — 2026-05-02
**Proxmox VM:** `db-server` — guest hostname `taufiq-db` — Ubuntu 24.04.4 LTS  
**Tailscale IP:** `100.75.213.36`  
**Topic:** Lecture 3 — Oracle Database Architecture (live PostgreSQL mapping)

---

## What We Did Today

### 1. Discovered installed databases

Ran service and port checks to find what was already installed:

```bash
systemctl list-units --type=service --state=running | grep -E "sql|mongo|redis|oracle|maria|db"
ss -tlnp | grep -E "5432|3306|27017|6379|1521|5984"
```

**Found:**
- PostgreSQL 16.13 — port 5432, bound to `127.0.0.1` ✅
- MySQL Community Server — port 3306, bound to `0.0.0.0` ⚠️

---

### 2. Fixed MySQL network exposure

MySQL was listening on all interfaces (`0.0.0.0:3306`), making it reachable from the local network.

**Fix:** edited `/etc/mysql/mysql.conf.d/mysqld.cnf`:
```
bind-address = 127.0.0.1
mysqlx-bind-address = 127.0.0.1
```

Restarted and verified:
```bash
sudo systemctl restart mysql
ss -tlnp | grep 3306
# Result: 127.0.0.1:3306 ✅
```

---

### 3. Lecture 3 Lab — Oracle Architecture mapped to PostgreSQL

#### 3a. Memory structures (SGA equivalent)

```sql
SELECT name, setting, unit
FROM pg_settings
WHERE name IN (
  'shared_buffers',
  'wal_buffers',
  'work_mem',
  'maintenance_work_mem'
);
```

| PostgreSQL parameter | Value | Oracle equivalent |
|---|---|---|
| `shared_buffers` | 128 MB (16384 × 8kB) | Database Buffer Cache |
| `wal_buffers` | 4 MB (512 × 8kB) | Redo Log Buffer |
| `work_mem` | 4 MB | PGA sort/hash area |
| `maintenance_work_mem` | 64 MB | Large Pool |

#### 3b. Background processes (Oracle process equivalents)

```sql
SELECT pid, backend_type, state, wait_event
FROM pg_stat_activity;
```

| PostgreSQL process | Oracle equivalent | Role |
|---|---|---|
| `background writer` | DBWn | Writes dirty buffers to disk |
| `walwriter` | LGWR | Writes WAL buffer to redo log files |
| `checkpointer` | CKPT | Records checkpoint, syncs data files |
| `autovacuum launcher` | SMON | Cleans dead rows, reclaims space |
| `logical replication launcher` | ARCn | Handles replication/log shipping |
| `client backend` | Server process | One per connected user session |

#### 3c. Tablespaces (logical storage)

```sql
SELECT spcname FROM pg_tablespace;
```

| PostgreSQL tablespace | Oracle equivalent |
|---|---|
| `pg_default` | USERS tablespace |
| `pg_global` | SYSTEM tablespace (data dictionary) |

#### 3d. Physical file structure

```bash
sudo ls /var/lib/postgresql/16/main/
sudo ls /var/lib/postgresql/16/main/base/
sudo -u postgres psql -c "SELECT oid, datname FROM pg_database;"
```

| PostgreSQL path | Oracle equivalent |
|---|---|
| `base/` | Data files (.dbf) |
| `pg_wal/` | Online redo log files |
| `pg_xact/` | Undo tablespace |
| `global/` | SYSTEM tablespace files |
| `pg_stat/` | AWR / V$ views data |
| `pg_snapshots/` | Undo snapshots |
| `postgresql.auto.conf` | SPFILE |
| `postmaster.pid` | Instance identifier |

**Database OID mapping** (each folder in `base/` is a database):
```
base/1     → template1
base/4     → template0
base/5     → postgres
base/24576 → (user-created database)
```

Storage hierarchy observed (Lecture 3, Slide 35):
```
Tablespace (pg_default)
  └── Database (OID folder in base/)
        └── Table/Index (numbered file)
              └── 8KB blocks  ← Oracle "data blocks"
```

---

## Security Status After Today

| Layer | Detail | Status |
|---|---|---|
| SSH key auth | Ed25519 | ✅ |
| SSH password login | Disabled | ✅ |
| Tailscale VPN | Active | ✅ |
| UFW firewall | SSH via tailscale0 only | ✅ |
| PostgreSQL binding | 127.0.0.1 only | ✅ |
| MySQL binding | Fixed to 127.0.0.1 | ✅ |

---

## Next Steps

See individual lecture lab files for hands-on exercises:
- `lab-lec4-instance.md`
- `lab-lec5-storage.md`
- `lab-lec6-users.md`
- `lab-lec7-locking.md`
- `lab-lec8-undo.md`
- `lab-lec9-audit-maintenance.md`
