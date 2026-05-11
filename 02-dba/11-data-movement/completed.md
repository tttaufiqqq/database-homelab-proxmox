# Lab — Lecture 14: Moving Data

**Lecture topic:** Oracle Data Pump (expdp/impdp), SQL*Loader, external tables, directory objects, data movement methods  
**Your server:** `taufiq-db` — connect via `ssh taufiq@100.75.213.36`  
**Completed:** 2026-05-03

---

## Objective

Replicate Oracle's data movement tools — Data Pump export/import, SQL*Loader, external tables — using PostgreSQL's `pg_dump`, `pg_restore`, `COPY`, and foreign data wrappers.

---

## Tool mapping (Lecture 14, Slide 3)

| Oracle tool | PostgreSQL equivalent |
|---|---|
| `expdp` (Data Pump Export) | `pg_dump` |
| `impdp` (Data Pump Import) | `pg_restore` / `psql` |
| `sqlldr` (SQL*Loader) | `COPY` command / `\copy` in psql |
| External Tables (ORACLE_LOADER) | Foreign Data Wrapper (`file_fdw`) |
| External Tables (ORACLE_DATAPUMP) | `COPY TO` / `pg_dump` |
| Directory objects | OS directories + PostgreSQL permissions |
| DBMS_DATAPUMP | `pg_dump` API / libpq |

---

## Setup

```sql
CREATE DATABASE movingdata;
\c movingdata

CREATE TABLE employees (
  employee_id   SERIAL PRIMARY KEY,
  first_name    VARCHAR(50),
  last_name     VARCHAR(50),
  email         VARCHAR(100) UNIQUE,
  hire_date     DATE,
  job_title     VARCHAR(100),
  salary        NUMERIC(10,2),
  department_id INT
);

CREATE TABLE departments (
  department_id   SERIAL PRIMARY KEY,
  department_name VARCHAR(100),
  location        VARCHAR(100)
);

INSERT INTO departments (department_name, location) VALUES
  ('Engineering', 'Cyberjaya'),
  ('Finance', 'KL'),
  ('HR', 'Putrajaya');

INSERT INTO employees (first_name, last_name, email, hire_date, job_title, salary, department_id)
VALUES
  ('Ahmad', 'Razif', 'ahmad@company.com', '2022-03-15', 'Senior Developer', 8500, 1),
  ('Siti', 'Nora', 'siti@company.com', '2021-07-01', 'Finance Analyst', 6200, 2),
  ('Hafiz', 'Malik', 'hafiz@company.com', '2023-01-10', 'DevOps Engineer', 7800, 1),
  ('Nurul', 'Ain', 'nurul@company.com', '2020-11-20', 'HR Manager', 9100, 3);
```

---

## Part 1 — Directory objects (Lecture 14, Slides 7-8)

Oracle uses `CREATE DIRECTORY` to define server-side paths for Data Pump. PostgreSQL uses OS directories with appropriate permissions.

```bash
sudo mkdir -p /var/lib/postgresql/datapump/export
sudo mkdir -p /var/lib/postgresql/datapump/import
sudo mkdir -p /var/lib/postgresql/datapump/external
sudo chown -R postgres:postgres /var/lib/postgresql/datapump
```

```sql
SELECT pg_ls_dir('/var/lib/postgresql/datapump/export');
```

### ✅ Results observed

```
 pg_ls_dir
-----------
(0 rows)
```

Empty directory confirmed — exists and PostgreSQL can read it. Equivalent of Oracle's `CREATE DIRECTORY` object — a server-side path with appropriate permissions.

---

## Part 2 — Data Pump Export: expdp equivalent (Lecture 14, Slides 9-17)

**Important:** Shell redirection `>` runs as the `taufiq` user which has no write permission to the datapump directory. Always wrap pg_dump in `sudo -u postgres bash -c "..."` for SQL format exports.

```bash
# Full database export (expdp FULL=Y equivalent):
sudo -u postgres bash -c "pg_dump movingdata > /var/lib/postgresql/datapump/export/movingdata_full_$(date +%Y%m%d).sql"

# Schema-only (expdp CONTENT=METADATA_ONLY equivalent):
sudo -u postgres bash -c "pg_dump movingdata --schema-only > /var/lib/postgresql/datapump/export/movingdata_schema.sql"

# Data-only (expdp CONTENT=DATA_ONLY equivalent):
sudo -u postgres bash -c "pg_dump movingdata --data-only > /var/lib/postgresql/datapump/export/movingdata_data.sql"

# Single table (expdp TABLES=employees equivalent):
sudo -u postgres bash -c "pg_dump movingdata --table=employees > /var/lib/postgresql/datapump/export/employees_only.sql"

# Binary format (faster restore, equivalent of RMAN backup set):
sudo -u postgres pg_dump movingdata \
  -Fc \
  -f /var/lib/postgresql/datapump/export/movingdata.dump
```

### ✅ Results observed

```
total 28K
-rw-rw-r-- 1 postgres postgres 2.9K May  3 20:31 employees_only.sql
-rw-rw-r-- 1 postgres postgres 5.8K May  3 20:30 movingdata.dump
-rw-rw-r-- 1 postgres postgres 1.8K May  3 20:31 movingdata_data.sql
-rw-rw-r-- 1 postgres postgres 4.5K May  3 20:31 movingdata_full_20260503.sql
-rw-rw-r-- 1 postgres postgres 3.5K May  3 20:31 movingdata_schema.sql
```

| File | Oracle equivalent |
|---|---|
| `movingdata_full_20260503.sql` | `expdp FULL=Y` |
| `movingdata_schema.sql` | `expdp CONTENT=METADATA_ONLY` |
| `movingdata_data.sql` | `expdp CONTENT=DATA_ONLY` |
| `employees_only.sql` | `expdp TABLES=employees` |
| `movingdata.dump` | Binary format — parallel restore capable |

---

## Part 3 — Data Pump Import: impdp equivalent (Lecture 14, Slide 18)

```bash
sudo -u postgres psql -c "CREATE DATABASE movingdata_restored;"

# SQL import (impdp FULL=Y equivalent):
sudo -u postgres bash -c "psql movingdata_restored < /var/lib/postgresql/datapump/export/movingdata_full_20260503.sql"

# Binary import (faster):
sudo -u postgres pg_restore \
  -d movingdata_restored \
  /var/lib/postgresql/datapump/export/movingdata.dump

sudo -u postgres psql movingdata_restored -c "SELECT count(*) FROM employees;"
```

### ✅ Results observed

SQL import succeeded with full DDL and data. Binary `pg_restore` into the same database produced expected errors — `relation already exists`, `duplicate key` — because the tables were already created by the SQL import. This is equivalent to Oracle's `impdp` hitting existing objects.

**Key lesson:** Use `pg_restore --clean` to drop existing objects before restoring, or always restore into a fresh empty database to avoid conflicts.

Count confirmed: 4 rows.

**Table remap (impdp REMAP_TABLE equivalent, Slide 19):**

```bash
sudo -u postgres psql movingdata_restored -c \
  "ALTER TABLE employees RENAME TO emp;"

sudo -u postgres psql movingdata_restored -c \
  "SELECT count(*) FROM emp;"
# Result: 4
```

---

## Part 4 — SQL*Loader equivalent: COPY command (Lecture 14, Slides 21-26)

```bash
cat > /tmp/new_employees.csv << 'EOF'
Zara,Hassan,zara@company.com,2024-01-15,Data Engineer,7200,1
Farid,Ismail,farid@company.com,2024-02-01,Business Analyst,6800,2
Lina,Osman,lina@company.com,2024-03-10,DevOps Engineer,8100,1
EOF

sudo cp /tmp/new_employees.csv /var/lib/postgresql/datapump/import/new_employees.csv
sudo chown postgres:postgres /var/lib/postgresql/datapump/import/new_employees.csv
```

```sql
-- Conventional load (SQL*Loader conventional path equivalent, Slide 26):
COPY employees (first_name, last_name, email, hire_date, job_title, salary, department_id)
FROM '/var/lib/postgresql/datapump/import/new_employees.csv'
DELIMITER ','
CSV;
```

### ✅ Results observed

```
 employee_id | first_name | last_name |       email        | hire_date  |    job_title     | salary  | department_id
-------------+------------+-----------+--------------------+------------+------------------+---------+---------------
           7 | Lina       | Osman     | lina@company.com   | 2024-03-10 | DevOps Engineer  | 8100.00 |             1
           6 | Farid      | Ismail    | farid@company.com  | 2024-02-01 | Business Analyst | 6800.00 |             2
           5 | Zara       | Hassan    | zara@company.com   | 2024-01-15 | Data Engineer    | 7200.00 |             1
```

3 rows loaded. COPY parsed the CSV, cast date and numeric types automatically, inserted in one operation.

**Staging table approach (SQL*Loader bad file equivalent):**

```sql
CREATE TEMP TABLE staging_employees (
  first_name    VARCHAR(50),
  last_name     VARCHAR(50),
  email         VARCHAR(100),
  hire_date     TEXT,
  job_title     VARCHAR(100),
  salary        TEXT,
  department_id TEXT
);

COPY staging_employees
FROM '/var/lib/postgresql/datapump/import/new_employees.csv'
DELIMITER ',' CSV;
```

All values loaded as TEXT — no type casting yet. Validate and move to production table:

```sql
INSERT INTO employees (first_name, last_name, email, hire_date, job_title, salary, department_id)
SELECT first_name, last_name, email,
  hire_date::date,
  job_title,
  salary::numeric,
  department_id::int
FROM staging_employees
WHERE salary ~ '^[0-9.]+$'
AND hire_date ~ '^\d{4}-\d{2}-\d{2}$';
```

**Export to CSV (SQL*Loader reverse / unload equivalent):**

```sql
COPY employees TO '/var/lib/postgresql/datapump/export/employees_export.csv'
DELIMITER ',' CSV HEADER;
```

Output verified:
```
employee_id,first_name,last_name,email,hire_date,job_title,salary,department_id
1,Ahmad,Razif,ahmad@company.com,2022-03-15,Senior Developer,8500.00,1
2,Siti,Nora,siti@company.com,2021-07-01,Finance Analyst,6200.00,2
```

---

## Part 5 — External Tables (Lecture 14, Slides 27-31)

```sql
CREATE EXTENSION file_fdw;

CREATE SERVER ext_file_server FOREIGN DATA WRAPPER file_fdw;

CREATE FOREIGN TABLE ext_employees (
  employee_id   INT,
  first_name    VARCHAR(50),
  last_name     VARCHAR(50),
  email         VARCHAR(100),
  hire_date     DATE,
  job_title     VARCHAR(100),
  salary        NUMERIC(10,2),
  department_id INT
)
SERVER ext_file_server
OPTIONS (
  filename '/var/lib/postgresql/datapump/export/employees_export.csv',
  format 'csv',
  header 'true'
);
```

### ✅ Results observed

```
 employee_id | first_name | last_name |       email        | hire_date  |    job_title     | salary  | department_id
-------------+------------+-----------+--------------------+------------+------------------+---------+---------------
           1 | Ahmad      | Razif     | ahmad@company.com  | 2022-03-15 | Senior Developer | 8500.00 |             1
           2 | Siti       | Nora      | siti@company.com   | 2021-07-01 | Finance Analyst  | 6200.00 |             2
           ...
           7 | Lina       | Osman     | lina@company.com   | 2024-03-10 | DevOps Engineer  | 8100.00 |             1
```

Querying a CSV file as if it were a database table — no data loaded into PostgreSQL, reads the file directly on every query. Oracle's `ORGANIZATION EXTERNAL` equivalent from Slide 29.

**Join with internal table (Slide 31 equivalent):**

```sql
SELECT e.first_name, e.last_name, d.department_name
FROM ext_employees e
JOIN departments d ON e.department_id = d.department_id;
```

```
 first_name | last_name | department_name
------------+-----------+-----------------
 Lina       | Osman     | Engineering
 Zara       | Hassan    | Engineering
 Ahmad      | Razif     | Engineering
 Farid      | Ismail    | Finance
 Siti       | Nora      | Finance
 Nurul      | Ain       | HR
```

External CSV file joined with internal PostgreSQL table in a single query — no import required.

---

## Part 6 — Moving data between databases (Lecture 14, Slide 10 — Network mode)

Oracle's Data Pump network mode uses database links. PostgreSQL uses `postgres_fdw`.

```sql
-- In movingdata_restored:
CREATE EXTENSION postgres_fdw;

-- Use Unix socket instead of TCP to avoid password auth:
CREATE SERVER source_db
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (host '/var/run/postgresql', dbname 'movingdata', port '5432');

CREATE USER MAPPING FOR postgres
  SERVER source_db
  OPTIONS (user 'postgres', password '');

-- Import into a separate schema to avoid conflicts with existing tables:
CREATE SCHEMA foreign_data;

IMPORT FOREIGN SCHEMA public
  LIMIT TO (employees, departments)
  FROM SERVER source_db
  INTO foreign_data;

SELECT e.first_name, d.department_name
FROM foreign_data.employees e
JOIN foreign_data.departments d ON e.department_id = d.department_id;
```

### ✅ Results observed

```
 first_name | department_name
------------+-----------------
 Ahmad      | Engineering
 Siti       | Finance
 Hafiz      | Engineering
 Nurul      | HR
 Zara       | Engineering
 Farid      | Finance
 Lina       | Engineering
```

Querying `movingdata` from inside `movingdata_restored` — two separate databases joined in a single SQL statement. Oracle database link equivalent.

**Troubleshooting notes from this lab:**
- TCP connection with `host 'localhost'` fails with `fe_sendauth: no password supplied` — use Unix socket `host '/var/run/postgresql'` instead for local peer-equivalent connections
- `IMPORT FOREIGN SCHEMA` fails if target schema already has tables with the same name — always import into a dedicated schema like `foreign_data`
- `pg_restore` into a database that already has the same objects from a SQL import will produce errors — use `--clean` flag or restore into a fresh database

---

## Checklist

- [x] Created directory structure — equivalent of Oracle directory objects
- [x] Exported full database, schema-only, data-only, single table, and binary format
- [x] Imported into a new database with both psql and pg_restore
- [x] Remapped a table name on import — `employees` → `emp`
- [x] Used COPY to load CSV data — SQL*Loader conventional path equivalent
- [x] Used staging table for error handling — bad file equivalent
- [x] Exported data to CSV with COPY TO
- [x] Created external table with file_fdw and queried it
- [x] Joined external table with internal table
- [x] Set up cross-database access with postgres_fdw — network mode equivalent

---

## Key takeaway

Oracle Data Pump (`expdp`/`impdp`) = PostgreSQL `pg_dump`/`pg_restore`. Oracle SQL*Loader = PostgreSQL `COPY` command. Oracle external tables = PostgreSQL `file_fdw`. Oracle database links = PostgreSQL `postgres_fdw`.

---

## Scenario: "Migrate HR database with minimal downtime + finance team needs daily CSV queries without manual imports"

**Requirement 1 — Migration with minimal downtime**

Two approaches depending on database size and acceptable downtime:

**Approach A — pg_dump/pg_restore (simpler, requires a downtime window)**

Use when the database is small enough that dump + restore completes in an acceptable window.

```bash
# On old server — dump:
sudo -u postgres pg_dump hr_database -Fc -f /tmp/hr_database.dump

# Transfer to new server:
scp /tmp/hr_database.dump newserver:/tmp/

# On new server — restore:
sudo -u postgres pg_restore -d hr_database /tmp/hr_database.dump
```

Stop writes on old server, take a final dump, restore on new server, point application to new server. Downtime = dump + restore + transfer time.

**Approach B — Logical replication (minimal downtime, production-grade)**

Use when the database is large and downtime must be minimized to minutes.

Set up logical replication between old and new server — the new server continuously receives all changes from the old server while it is still running. Once the new server is fully in sync, schedule a short cutover window (minutes, not hours): stop writes on old server, wait for new server to catch up completely, then point the application to the new server. Downtime is minimal because the heavy lifting — copying all existing data — happens in the background before the switch.

Choose based on:
- Small database + acceptable downtime window → pg_dump/pg_restore from this lab
- Large database + must minimize downtime → logical replication

**Requirement 2 — Finance team querying daily CSV without manual imports**

Use `file_fdw` to create an external table pointing to the CSV location:

```sql
CREATE EXTENSION file_fdw;
CREATE SERVER csv_server FOREIGN DATA WRAPPER file_fdw;

CREATE FOREIGN TABLE daily_finance_report (
  -- columns matching the CSV structure
)
SERVER csv_server
OPTIONS (
  filename '/var/lib/postgresql/datapump/external/daily_report.csv',
  format 'csv',
  header 'true'
);

GRANT SELECT ON daily_finance_report TO analyst;
```

The finance team runs queries directly against `daily_finance_report` — PostgreSQL reads the CSV file on every query. Whoever drops the file each morning just needs to place it at the exact same path with the exact same filename. No import step needed, no manual intervention, queries always read the latest file.

**Two requirements for this to work reliably:**
- The CSV file must always be dropped at the exact configured path with the exact filename — document this for whoever provides the file
- The postgres OS user must have read permission on the file — `sudo chown postgres:postgres /path/to/file` or make the directory group-readable
