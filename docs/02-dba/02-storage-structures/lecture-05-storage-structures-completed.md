# Lab — Lecture 5: Managing Database Storage Structures

**Lecture topic:** Block/extent/segment/tablespace hierarchy, creating tablespaces, obtaining tablespace information  
**Your server:** Proxmox VM `db-server` — guest hostname `taufiq-db` — connect via `ssh taufiq@100.75.213.36`  
**Completed:** 2026-05-02

---

## Objective

Observe and create the Oracle storage hierarchy (block → extent → segment → tablespace) using PostgreSQL and your server's real disk layout.

---

## Part 1 — Confirm the block size (Lecture 5, Slide 4)

Oracle's default block size is 8KB. PostgreSQL also uses 8KB.

```sql
sudo -u postgres psql

-- Confirm block size:
SHOW block_size;
-- Expected: 8192 (bytes = 8KB)

-- See how many blocks are in each relation (table):
SELECT relname, relpages, relpages * 8 AS size_kb
FROM pg_class
WHERE relkind = 'r'
AND relpages > 0
ORDER BY relpages DESC
LIMIT 10;
```

`relpages` is the number of 8KB blocks allocated to each table — this is the block layer of your lecture's storage hierarchy.

### ✅ Results observed

```
 relname        | relpages | size_kb
----------------+----------+---------
 pg_proc        |       98 |     784
 pg_attribute   |       57 |     456
 pg_description |       45 |     360
 pg_statistic   |       19 |     152
 pg_type        |       15 |     120
 pg_collation   |       15 |     120
 pg_class       |       14 |     112
 pg_operator    |       14 |     112
 pg_rewrite     |       13 |     104
 pg_depend      |       13 |     104
```

Block size confirmed at 8192 bytes (8KB). All entries are system catalog tables — no user tables exist yet at this point. `pg_proc` is the largest at 98 blocks × 8KB = 784KB. Formula: `relpages × 8KB = total table size on disk`.

---

## Part 2 — Explore existing tablespaces

```sql
-- List tablespaces with sizes (equivalent of Oracle's DBA_TABLESPACES):
SELECT
  spcname AS tablespace,
  pg_size_pretty(pg_tablespace_size(spcname)) AS size,
  pg_tablespace_location(oid) AS location
FROM pg_tablespace;
```

### ✅ Results observed

```
 tablespace |  size  | location
------------+--------+----------
 pg_default | 29 MB  |
 pg_global  | 589 kB |
```

| Tablespace | Stores | Physical path | Oracle equivalent |
|---|---|---|---|
| `pg_default` | User databases and their objects | `base/` directory | USERS tablespace |
| `pg_global` | Shared system catalogs visible across all databases | `global/` directory | SYSTEM tablespace |

Empty `location` column for both — these are built-in and PostgreSQL manages their paths internally. Custom tablespaces show an explicit path.

---

## Part 3 — Create a new tablespace (Lecture 5, Slide 6)

Oracle's CREATE TABLESPACE creates a new storage container with a datafile. In PostgreSQL, a tablespace is a directory on disk.

```bash
# First create the directory on the OS:
sudo mkdir -p /mnt/pg_tablespaces/ts_lab
sudo chown postgres:postgres /mnt/pg_tablespaces/ts_lab
```

```sql
sudo -u postgres psql

-- Create the tablespace (equivalent of Oracle's CREATE TABLESPACE):
CREATE TABLESPACE ts_lab LOCATION '/mnt/pg_tablespaces/ts_lab';

-- Verify it was created:
SELECT spcname, pg_tablespace_location(oid)
FROM pg_tablespace;
```

### ✅ Results observed

```
  spcname   |   pg_tablespace_location
------------+----------------------------
 pg_default |
 pg_global  |
 ts_lab     | /mnt/pg_tablespaces/ts_lab
```

`ts_lab` is live and pointing to the real directory. PostgreSQL equivalent of Oracle's `CREATE TABLESPACE ts_lab DATAFILE '/path/ts_lab01.dbf' SIZE 100M` — except PostgreSQL manages the files inside automatically rather than requiring pre-allocated datafiles.

---

## Part 4 — Create objects in the tablespace

```sql
-- Create a database using the new tablespace:
CREATE DATABASE labdb TABLESPACE ts_lab;

-- Connect to it:
\c labdb

-- Create a table in the tablespace:
CREATE TABLE employees (
  emp_id    SERIAL PRIMARY KEY,
  name      VARCHAR(100),
  salary    NUMERIC(10,2),
  dept      VARCHAR(50)
) TABLESPACE ts_lab;

-- Insert some rows:
INSERT INTO employees (name, salary, dept) VALUES
  ('Ahmad Razif', 5500.00, 'Engineering'),
  ('Siti Nora', 4800.00, 'Finance'),
  ('Hafiz Malik', 6200.00, 'Engineering'),
  ('Nurul Ain', 5100.00, 'HR');

-- Check the physical size of your table:
SELECT pg_size_pretty(pg_total_relation_size('employees')) AS total_size,
       pg_size_pretty(pg_relation_size('employees')) AS table_size;
```

### ✅ Results observed

```
 total_size | table_size
------------+------------
 24 kB      | 8192 bytes
```

- `table_size: 8192 bytes` — exactly 1 block. Four rows fit in a single 8KB block — this is the minimum allocation unit, same as Oracle.
- `total_size: 24 kB` — 3 blocks total: 1 for the table data, 1 for the primary key index root page, 1 for the index leaf page. The `SERIAL PRIMARY KEY` automatically created the index.

---

## Part 5 — Observe the physical file created

```bash
# See what PostgreSQL created in the tablespace directory:
sudo ls -lh /mnt/pg_tablespaces/ts_lab/
# Shows: PG_16_202307071  (version + catalog version subdirectory)

sudo ls -lh /mnt/pg_tablespaces/ts_lab/PG_16_202307071/
# Shows: 32769  (labdb OID — each database gets its own folder)

sudo ls -lh /mnt/pg_tablespaces/ts_lab/PG_16_202307071/32769/
# Shows all segment files
```

To map filenames to table names:

```sql
SELECT relname, relfilenode
FROM pg_class
WHERE relname IN ('employees', 'employees_pkey', 'employees_emp_id_seq');
```

### ✅ Results observed

```
       relname        | relfilenode
----------------------+-------------
 employees_emp_id_seq |       32770
 employees            |       32771
 employees_pkey       |       32775
```

```bash
sudo ls -lh /mnt/pg_tablespaces/ts_lab/PG_16_202307071/32769/32770 \
            /mnt/pg_tablespaces/ts_lab/PG_16_202307071/32769/32771 \
            /mnt/pg_tablespaces/ts_lab/PG_16_202307071/32769/32775
```

```
-rw------- 1 postgres postgres 8.0K May  2 06:04 32770  ← employees_emp_id_seq (1 block)
-rw------- 1 postgres postgres 8.0K May  2 06:04 32771  ← employees table (1 block)
-rw------- 1 postgres postgres  16K May  2 06:04 32775  ← employees_pkey index (2 blocks)
```

Full hierarchy traced end to end:

```
Tablespace: ts_lab         (/mnt/pg_tablespaces/ts_lab/)
  └── PG_16_202307071/     (PostgreSQL version + catalog version)
        └── 32769/          (labdb OID)
              ├── 32771     (employees table — 1 × 8KB block)
              ├── 32775     (employees_pkey index — 2 × 8KB blocks)
              └── 32770     (employees_emp_id_seq — 1 × 8KB block)
```

This is identical to Oracle's structure: tablespace → datafile → segment → blocks. PostgreSQL names things differently and manages datafiles automatically.

---

## Part 6 — Tablespace information queries (equivalent of Oracle's DBA_ views)

```sql
\c labdb

-- Which tables are in which tablespace (equivalent of DBA_SEGMENTS):
SELECT tablename, tablespace
FROM pg_tables
WHERE schemaname = 'public';

-- Space used per tablespace (equivalent of DBA_TABLESPACE_USAGE_METRICS):
SELECT
  spcname,
  pg_size_pretty(pg_tablespace_size(spcname)) AS used
FROM pg_tablespace;

-- Free space in data pages (equivalent of checking block free space):
-- Note: use relid not oid in pg_stat_user_tables
SELECT relname,
  n_live_tup AS live_rows,
  n_dead_tup AS dead_rows,
  pg_size_pretty(pg_relation_size(relid)) AS size
FROM pg_stat_user_tables;
```

### ✅ Results observed

```
 tablename | tablespace
-----------+------------
 employees |
```

`tablespace` is NULL — not missing data. When a table inherits the database's default tablespace, PostgreSQL stores NULL rather than repeating the name. Confirmed with:

```sql
SELECT spcname FROM pg_tablespace
WHERE oid = (SELECT dattablespace FROM pg_database WHERE datname = 'labdb');
-- Result: ts_lab ✅
```

```
  spcname   |  used
------------+---------
 pg_default | 29 MB
 pg_global  | 589 kB
 ts_lab     | 7643 kB
```

`ts_lab` at 7643KB includes all system catalog tables PostgreSQL copied from the template database when `labdb` was created — not just the employees table.

```
 relname   | live_rows | dead_rows |    size
-----------+-----------+-----------+------------
 employees |         4 |         0 | 8192 bytes
```

4 live rows, 0 dead rows, 1 block. Clean with no fragmentation.

---

## Part 7 — Clean up

```sql
\c postgres
DROP DATABASE labdb;
DROP TABLESPACE ts_lab;
```

```bash
sudo rm -rf /mnt/pg_tablespaces/ts_lab
sudo ls /mnt/pg_tablespaces/
sudo -u postgres psql -c "SELECT spcname FROM pg_tablespace;"
```

### ✅ Results observed

```
  spcname
------------
 pg_default
 pg_global
```

Directory and tablespace both removed. Back to default state.

**Note:** Do not run `\c` and the next SQL command on the same line in psql — psql will try to parse the database name as a port number and throw `invalid integer value for connection option "port"`. Always wait for the prompt to change after `\c` before typing the next command.

---

## Checklist

- [x] Confirmed 8KB block size
- [x] Queried existing tablespaces and their sizes
- [x] Created a new tablespace backed by a real directory
- [x] Created a table inside that tablespace
- [x] Observed the physical files on disk and mapped filenames to table names via `relfilenode`
- [x] Traced the full hierarchy: tablespace → database → table → blocks
- [x] Queried tablespace usage information
- [x] Cleaned up successfully

---

## Key takeaway

Oracle's tablespace = PostgreSQL's tablespace (both are just named storage containers pointing to disk locations). The block size, hierarchy, and physical file layout are nearly identical. The main difference is Oracle uses explicit datafiles (.dbf) while PostgreSQL manages files automatically within the tablespace directory.

---

## Verification — Scenario: "The server disk is at 85% and we need to find what PostgreSQL is consuming"

**Step 1 — Check tablespace sizes first**

```sql
SELECT spcname,
       pg_size_pretty(pg_tablespace_size(spcname)) AS used
FROM pg_tablespace;
```

This tells you immediately whether the problem is in a custom tablespace on a separate disk or in the main `pg_default` storage. Start here before drilling into databases.

**Step 2 — Find the largest databases**

```sql
SELECT datname,
       pg_size_pretty(pg_database_size(datname)) AS size
FROM pg_database
ORDER BY pg_database_size(datname) DESC;
```

**Step 3 — Connect to the largest database and find the biggest tables**

```sql
SELECT relname,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
       pg_size_pretty(pg_relation_size(relid)) AS table_size,
       n_live_tup AS live_rows,
       n_dead_tup AS dead_rows
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

`pg_total_relation_size` includes the table, all its indexes, and TOAST data. `pg_relation_size` is the table data only. A large gap between the two means indexes or TOAST are the main consumer.

**Step 4 — Check for dead row bloat**

If `dead_rows` is high relative to `live_rows`, the table is bloated. Autovacuum should have cleaned it — if it has not, run:

```sql
VACUUM (VERBOSE, ANALYZE) tablename;
```

If the table is severely bloated and you need to reclaim disk space immediately:

```sql
VACUUM FULL tablename;  -- rewrites the table, reclaims space to OS, requires exclusive lock
```

**Step 5 — Decide action based on findings**

| Finding | Action |
|---|---|
| High dead rows | `VACUUM` or `VACUUM FULL` |
| Large indexes relative to table | `REINDEX` to rebuild bloated indexes |
| Unused tables | Drop them after confirming with the team |
| Old data inflating size | Archive to a separate tablespace on cheaper disk |
| TOAST data unexpectedly large | Investigate which column stores large values (JSON, text, bytea) |

**Key concepts behind this**

Dead rows accumulate because PostgreSQL uses MVCC (Multi-Version Concurrency Control) — when a row is updated or deleted, the old version is kept on disk so concurrent transactions that started before the change can still see the old data. Once no transaction needs the old version, autovacuum marks those blocks as reusable. `n_dead_tup` in `pg_stat_user_tables` shows how many dead rows are waiting to be cleaned up.
