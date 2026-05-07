# Lab — Lecture 14: Moving Data

**Lecture topic:** Oracle Data Pump (expdp/impdp), SQL*Loader, external tables, directory objects, data movement methods  
**Your server:** `taufiq-db` — connect via `ssh taufiq@100.75.213.36`

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
sudo -u postgres psql

CREATE DATABASE movingdata;
\c movingdata

-- Source schema (equivalent of Oracle's HR schema used in slides):
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
# Create export/import directories (equivalent of Oracle directory objects):
sudo mkdir -p /var/lib/postgresql/datapump/export
sudo mkdir -p /var/lib/postgresql/datapump/import
sudo mkdir -p /var/lib/postgresql/datapump/external
sudo chown -R postgres:postgres /var/lib/postgresql/datapump
```

```sql
\c movingdata

-- PostgreSQL equivalent of CREATE DIRECTORY:
-- Grant file access to postgres user at OS level (done above)
-- Then use pg_read_file / COPY for directory operations

-- Verify directory is accessible:
SELECT pg_ls_dir('/var/lib/postgresql/datapump/export');
-- Returns empty set -- directory exists and is readable
```

---

## Part 2 — Data Pump Export: expdp equivalent (Lecture 14, Slides 9-17)

Oracle's `expdp` exports schemas, tables, or full databases. PostgreSQL uses `pg_dump`.

```bash
# Full database export (equivalent of expdp FULL=Y):
sudo -u postgres pg_dump movingdata \
  > /var/lib/postgresql/datapump/export/movingdata_full_$(date +%Y%m%d).sql

# Schema-only export (equivalent of expdp CONTENT=METADATA_ONLY):
sudo -u postgres pg_dump movingdata \
  --schema-only \
  > /var/lib/postgresql/datapump/export/movingdata_schema.sql

# Data-only export (equivalent of expdp CONTENT=DATA_ONLY):
sudo -u postgres pg_dump movingdata \
  --data-only \
  > /var/lib/postgresql/datapump/export/movingdata_data.sql

# Specific table export (equivalent of expdp TABLES=employees):
sudo -u postgres pg_dump movingdata \
  --table=employees \
  > /var/lib/postgresql/datapump/export/employees_only.sql

# Binary format (equivalent of RMAN backup set -- faster restore):
sudo -u postgres pg_dump movingdata \
  -Fc \
  -f /var/lib/postgresql/datapump/export/movingdata.dump

# Parallel export (equivalent of expdp PARALLEL=4):
sudo -u postgres pg_dump movingdata \
  -Fd \                # Directory format (supports parallel)
  -j 2 \              # 2 parallel workers
  -f /var/lib/postgresql/datapump/export/movingdata_parallel/

# View export log (equivalent of expdp log file):
ls -lh /var/lib/postgresql/datapump/export/
```

---

## Part 3 — Data Pump Import: impdp equivalent (Lecture 14, Slide 18)

Oracle's `impdp` imports with remapping options. PostgreSQL uses `pg_restore` or `psql`.

```bash
# Create a target database for import:
sudo -u postgres psql -c "CREATE DATABASE movingdata_restored;"

# Full import from SQL dump (equivalent of impdp FULL=Y):
sudo -u postgres psql movingdata_restored \
  < /var/lib/postgresql/datapump/export/movingdata_full_$(date +%Y%m%d).sql

# Import from binary format (faster):
sudo -u postgres pg_restore \
  -d movingdata_restored \
  /var/lib/postgresql/datapump/export/movingdata.dump

# Schema remap (equivalent of impdp REMAP_SCHEMA=hr:newhr):
# PostgreSQL: dump with --schema=public, restore into different schema
sudo -u postgres pg_dump movingdata --schema=public \
  | sudo -u postgres psql -d movingdata_restored \
    -c "CREATE SCHEMA newpublic;" \
    -c "SET search_path TO newpublic;" -f -

# Table remap (equivalent of impdp REMAP_TABLE=EMPLOYEES:EMP, Slide 19):
sudo -u postgres psql movingdata_restored -c \
  "ALTER TABLE employees RENAME TO emp;"

# Verify import:
sudo -u postgres psql movingdata_restored -c \
  "SELECT count(*) FROM emp;"
```

---

## Part 4 — SQL*Loader equivalent: COPY command (Lecture 14, Slides 21-26)

Oracle's `sqlldr` loads data from flat files. PostgreSQL uses the `COPY` command.

```bash
# Create a CSV file (equivalent of SQL*Loader input data file):
cat > /var/lib/postgresql/datapump/import/new_employees.csv << 'EOF'
Zara,Hassan,zara@company.com,2024-01-15,Data Engineer,7200,1
Farid,Ismail,farid@company.com,2024-02-01,Business Analyst,6800,2
Lina,Osman,lina@company.com,2024-03-10,DevOps Engineer,8100,1
EOF

sudo chown postgres:postgres /var/lib/postgresql/datapump/import/new_employees.csv
```

```sql
\c movingdata

-- Conventional load (equivalent of SQL*Loader conventional path, Slide 26):
COPY employees (first_name, last_name, email, hire_date, job_title, salary, department_id)
FROM '/var/lib/postgresql/datapump/import/new_employees.csv'
DELIMITER ','
CSV;

-- Verify loaded:
SELECT * FROM employees ORDER BY employee_id DESC LIMIT 5;

-- COPY with error handling (equivalent of SQL*Loader bad file):
-- PostgreSQL: use a staging table to filter bad rows
CREATE TEMP TABLE staging_employees (
  first_name    VARCHAR(50),
  last_name     VARCHAR(50),
  email         VARCHAR(100),
  hire_date     TEXT,          -- TEXT to catch format errors
  job_title     VARCHAR(100),
  salary        TEXT,          -- TEXT to catch non-numeric
  department_id TEXT
);

-- Load into staging first:
COPY staging_employees
FROM '/var/lib/postgresql/datapump/import/new_employees.csv'
DELIMITER ',' CSV;

-- Then move valid rows (equivalent of record selection, Slide 21):
INSERT INTO employees (first_name, last_name, email, hire_date, job_title, salary, department_id)
SELECT
  first_name, last_name, email,
  hire_date::date,
  job_title,
  salary::numeric,
  department_id::int
FROM staging_employees
WHERE salary ~ '^[0-9.]+$'          -- valid numeric
AND hire_date ~ '^\d{4}-\d{2}-\d{2}$';  -- valid date format

-- Export to CSV (equivalent of SQL*Loader reverse / unload):
COPY employees TO '/var/lib/postgresql/datapump/export/employees_export.csv'
DELIMITER ',' CSV HEADER;
```

---

## Part 5 — External Tables (Lecture 14, Slides 27-31)

Oracle external tables read OS files as if they were database tables. PostgreSQL uses `file_fdw`.

```bash
# Install file_fdw (comes with PostgreSQL):
sudo -u postgres psql movingdata -c "CREATE EXTENSION file_fdw;"
```

```sql
\c movingdata

-- Create the foreign data wrapper server (equivalent of CREATE DIRECTORY, Slide 7):
CREATE SERVER ext_file_server FOREIGN DATA WRAPPER file_fdw;

-- Create external table from the CSV (equivalent of ORGANIZATION EXTERNAL, Slide 29):
CREATE FOREIGN TABLE ext_employees (
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

-- Query the external table (equivalent of Slide 31):
SELECT * FROM ext_employees;

-- Join external table with internal table (equivalent of Slide 31, slide 28 "join directly"):
SELECT e.first_name, e.last_name, d.department_name
FROM ext_employees e
JOIN departments d ON e.department_id = d.department_id;

-- Load from external table into internal table (equivalent of Slide 31 INSERT):
INSERT INTO employees (first_name, last_name, email, hire_date, job_title, salary, department_id)
SELECT * FROM ext_employees
WHERE first_name NOT IN (SELECT first_name FROM employees);
```

---

## Part 6 — Moving data between databases (Lecture 14, Slide 10 — Network mode)

Oracle's Data Pump network mode moves data between Oracle instances using a database link. PostgreSQL uses `dblink` or `postgres_fdw`.

```bash
# Install postgres_fdw:
sudo -u postgres psql movingdata_restored -c "CREATE EXTENSION postgres_fdw;"
```

```sql
\c movingdata_restored

-- Create connection to source database (equivalent of Oracle database link):
CREATE SERVER source_db
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (host 'localhost', dbname 'movingdata', port '5432');

CREATE USER MAPPING FOR postgres
  SERVER source_db
  OPTIONS (user 'postgres', password '');

-- Import table from source (equivalent of impdp NETWORK_LINK mode):
IMPORT FOREIGN SCHEMA public
  LIMIT TO (employees, departments)
  FROM SERVER source_db
  INTO public;

-- Query across databases (equivalent of Oracle distributed query):
SELECT e.first_name, d.department_name
FROM employees e
JOIN departments d ON e.department_id = d.department_id;
```

---

## Checklist

- [ ] Created directory structure (equivalent of Oracle directory objects)
- [ ] Exported full database with `pg_dump` (SQL and binary formats)
- [ ] Exported schema-only and data-only
- [ ] Exported single table
- [ ] Imported into a new database with `pg_restore`
- [ ] Remapped a table name on import
- [ ] Used `COPY` to load CSV data (conventional path equivalent)
- [ ] Used staging table for error handling (bad file equivalent)
- [ ] Exported data to CSV with `COPY TO`
- [ ] Created external table with `file_fdw`
- [ ] Queried and joined external table with internal table
- [ ] Set up cross-database access with `postgres_fdw` (network mode equivalent)

---

## Key takeaway

Oracle Data Pump (`expdp`/`impdp`) = PostgreSQL `pg_dump`/`pg_restore`. Oracle SQL*Loader = PostgreSQL `COPY` command. Oracle external tables = PostgreSQL `file_fdw`. Oracle database links = PostgreSQL `postgres_fdw`. Your server with both PostgreSQL and MySQL installed is actually a great environment to practice cross-database data movement — you could use MySQL's CSV export and load it into PostgreSQL with `COPY`, simulating a real heterogeneous migration scenario that DBAs encounter in the industry.
