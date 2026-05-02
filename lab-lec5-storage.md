# Lab — Lecture 5: Managing Database Storage Structures

**Lecture topic:** Block/extent/segment/tablespace hierarchy, creating tablespaces, obtaining tablespace information  
**Your server:** Proxmox VM `db-server` — guest hostname `taufiq-db` — connect via `ssh taufiq@100.75.213.36`

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

You should see:
- `pg_global` — no location (stored in global/) → Oracle's SYSTEM tablespace
- `pg_default` — no location (stored in base/) → Oracle's USERS tablespace

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

---

## Part 5 — Observe the physical file created

```bash
# See the physical file created in your tablespace directory:
sudo ls -lh /mnt/pg_tablespaces/ts_lab/PG_16_*/

# The numbered file inside is your table's segment
# Its size = number of 8KB blocks allocated
```

This is the bottom of the Lecture 5 hierarchy you just built end-to-end:
```
Tablespace: ts_lab  (/mnt/pg_tablespaces/ts_lab/)
  └── Database: labdb
        └── Table: employees  (numbered file)
              └── 8KB blocks  (inside the file)
```

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
SELECT relname,
  n_live_tup AS live_rows,
  n_dead_tup AS dead_rows,
  pg_size_pretty(pg_relation_size(oid)) AS size
FROM pg_stat_user_tables;
```

---

## Part 7 — Clean up (optional)

```sql
\c postgres
DROP DATABASE labdb;
DROP TABLESPACE ts_lab;
```

```bash
sudo rm -rf /mnt/pg_tablespaces/ts_lab
```

---

## Checklist

- [ ] Confirmed 8KB block size
- [ ] Queried existing tablespaces and their sizes
- [ ] Created a new tablespace backed by a real directory
- [ ] Created a table inside that tablespace
- [ ] Observed the physical file on disk
- [ ] Traced the full hierarchy: tablespace → database → table → blocks
- [ ] Queried tablespace usage information

---

## Key takeaway

Oracle's tablespace = PostgreSQL's tablespace (both are just named storage containers pointing to disk locations). The block size, hierarchy, and physical file layout are nearly identical. The main difference is Oracle uses explicit datafiles (.dbf) while PostgreSQL manages files automatically within the tablespace directory.
