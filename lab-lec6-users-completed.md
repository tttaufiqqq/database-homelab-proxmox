# Lab — Lecture 6: Administering User Security

**Lecture topic:** User accounts, authentication, privileges, roles, profiles, password policies  
**Your server:** Proxmox VM `db-server` — guest hostname `taufiq-db` — connect via `ssh taufiq@100.75.213.36`  
**Completed:** 2026-05-02

---

## Objective

Replicate Oracle's user security model — accounts, authentication, default tablespaces, privilege grants, roles, and profiles — using PostgreSQL on your live server.

---

## Part 1 — Observe existing users (Lecture 6, Slide 3 & 5)

Oracle has predefined admin accounts: SYS, SYSTEM, DBSNMP. PostgreSQL has equivalents.

```sql
sudo -u postgres psql

SELECT rolname, rolsuper, rolcreatedb, rolcreaterole,
       rolcanlogin, rolconnlimit, rolvaliduntil
FROM pg_roles
ORDER BY rolname;
```

| PostgreSQL role | Oracle equivalent |
|---|---|
| `postgres` (superuser) | SYS account |
| roles with `rolsuper=true` | Granted DBA role with ADMIN OPTION |

### ✅ Results observed

```
 rolname                     | rolsuper | rolcreatedb | rolcreaterole | rolcanlogin | rolconnlimit | rolvaliduntil
-----------------------------+----------+-------------+---------------+-------------+--------------+---------------
 pg_checkpoint               | f        | f           | f             | f           |           -1 |
 pg_create_subscription      | f        | f           | f             | f           |           -1 |
 pg_database_owner           | f        | f           | f             | f           |           -1 |
 pg_execute_server_program   | f        | f           | f             | f           |           -1 |
 pg_monitor                  | f        | f           | f             | f           |           -1 |
 pg_read_all_data            | f        | f           | f             | f           |           -1 |
 pg_read_all_settings        | f        | f           | f             | f           |           -1 |
 pg_read_all_stats           | f        | f           | f             | f           |           -1 |
 pg_read_server_files        | f        | f           | f             | f           |           -1 |
 pg_signal_backend           | f        | f           | f             | f           |           -1 |
 pg_stat_scan_tables         | f        | f           | f             | f           |           -1 |
 pg_use_reserved_connections | f        | f           | f             | f           |           -1 |
 pg_write_all_data           | f        | f           | f             | f           |           -1 |
 pg_write_server_files       | f        | f           | f             | f           |           -1 |
 postgres                    | t        | t           | t             | t           |           -1 |
 taufiq_dba                  | f        | f           | f             | t           |           -1 |
```

Key observations:
- `postgres` is the only superuser — all four privilege flags true. Oracle SYS equivalent.
- `taufiq_dba` — login role created previously, no elevated privileges.
- All `pg_*` entries are built-in predefined roles added in PostgreSQL 14+. They cannot login (`rolcanlogin = f`). They exist to be granted to users for specific limited purposes — e.g. `pg_read_all_data` lets a user read any table without being superuser. Oracle equivalent: predefined system roles like `SELECT_CATALOG_ROLE`.
- `rolconnlimit = -1` means no connection limit for all entries.
- No `rolvaliduntil` set — accounts never expire by default.

---

## Part 2 — Create users with different privilege levels (Lecture 6, Slide 6)

```sql
CREATE USER app_user WITH
  PASSWORD 'AppPass123!'
  CONNECTION LIMIT 10;

CREATE USER analyst WITH
  PASSWORD 'ReadOnly456!'
  CONNECTION LIMIT 5
  VALID UNTIL '2027-01-01';

CREATE USER junior_dba WITH
  PASSWORD 'DbaPass789!'
  CREATEROLE;

SELECT rolname, rolcanlogin, rolconnlimit, rolvaliduntil
FROM pg_roles
WHERE rolname IN ('app_user', 'analyst', 'junior_dba');
```

### ✅ Results observed

```
 rolname    | rolcanlogin | rolconnlimit |     rolvaliduntil
------------+-------------+--------------+------------------------
 app_user   | t           |           10 |
 analyst    | t           |            5 | 2027-01-01 00:00:00+00
 junior_dba | t           |           -1 |
```

- `app_user` — login enabled, capped at 10 connections, no expiry
- `analyst` — login enabled, capped at 5 connections, expires 2027-01-01
- `junior_dba` — login enabled, unlimited connections, CREATEROLE privilege granted (visible via `rolcreaterole` column)

---

## Part 3 — Assign default tablespace (Lecture 6, Slide 3)

In Oracle, each user has a default tablespace. PostgreSQL achieves this at the database or session level.

```bash
sudo mkdir -p /mnt/pg_tablespaces/ts_app
sudo chown postgres:postgres /mnt/pg_tablespaces/ts_app
```

```sql
CREATE TABLESPACE ts_app LOCATION '/mnt/pg_tablespaces/ts_app';
ALTER DATABASE postgres SET default_tablespace = ts_app;
```

### ✅ Results observed

```
  spcname   |   pg_tablespace_location
------------+----------------------------
 pg_default |
 pg_global  |
 ts_app     | /mnt/pg_tablespaces/ts_app
```

`ts_app` created and set as default tablespace for the postgres database.

**Important distinction:** Tablespaces are for placing objects on disk, not for user access control. Do not create a tablespace just because a new user exists — only create one when you need to place objects on a specific disk location.

---

## Part 4 — Grant and revoke privileges (Lecture 6, Slide objectives)

```sql
CREATE DATABASE securitylab;
\c securitylab

CREATE TABLE accounts (
  id      SERIAL PRIMARY KEY,
  owner   VARCHAR(100),
  balance NUMERIC(12,2)
);

INSERT INTO accounts (owner, balance) VALUES
  ('Ahmad', 10000.00),
  ('Siti', 25000.00),
  ('Hafiz', 8500.00);

-- Three-layer grant required for each user:
GRANT CONNECT ON DATABASE securitylab TO analyst;
GRANT USAGE ON SCHEMA public TO analyst;
GRANT SELECT ON accounts TO analyst;

GRANT CONNECT ON DATABASE securitylab TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON accounts TO app_user;
GRANT USAGE ON SEQUENCE accounts_id_seq TO app_user;

SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'accounts';

REVOKE DELETE ON accounts FROM app_user;
```

### ✅ Results observed

Before REVOKE:
```
 grantee  | table_name | privilege_type
----------+------------+----------------
 postgres | accounts   | INSERT
 postgres | accounts   | SELECT
 postgres | accounts   | UPDATE
 postgres | accounts   | DELETE
 postgres | accounts   | TRUNCATE
 postgres | accounts   | REFERENCES
 postgres | accounts   | TRIGGER
 analyst  | accounts   | SELECT
 app_user | accounts   | INSERT
 app_user | accounts   | SELECT
 app_user | accounts   | UPDATE
 app_user | accounts   | DELETE
```

After `REVOKE DELETE ON accounts FROM app_user`:
```
 grantee  | table_name | privilege_type
----------+------------+----------------
 postgres | accounts   | INSERT
 postgres | accounts   | SELECT
 ...
 analyst  | accounts   | SELECT
 app_user | accounts   | INSERT
 app_user | accounts   | SELECT
 app_user | accounts   | UPDATE
```

Key observations:
- `postgres` automatically has all 7 privileges as table owner — INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER. Oracle equivalent: table owner always holds all object privileges.
- `analyst` has SELECT only — read-only as intended.
- `app_user` DELETE was revoked surgically — only that privilege removed, all others intact.
- **Three-layer grant is required in PostgreSQL** — CONNECT on database, USAGE on schema, then the table privilege. In Oracle you only grant the object privilege directly. PostgreSQL requires all three because each is a separate security boundary.

---

## Part 5 — Create and manage roles (Lecture 6, Slide objectives)

Oracle uses roles to group privileges. PostgreSQL roles work the same way.

```sql
CREATE ROLE read_role;
CREATE ROLE write_role;
CREATE ROLE admin_role;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO read_role;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO write_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin_role;

GRANT read_role TO analyst;
GRANT write_role TO app_user;
GRANT admin_role TO junior_dba;

SELECT r.rolname AS role, m.rolname AS member
FROM pg_roles r
JOIN pg_auth_members am ON r.oid = am.roleid
JOIN pg_roles m ON am.member = m.oid
WHERE r.rolname IN ('read_role', 'write_role', 'admin_role');
```

### ✅ Results observed

```
   role     |   member
------------+------------
 write_role | app_user
 read_role  | analyst
 admin_role | junior_dba
```

Each user assigned exactly one role matching their access level.

---

## Part 6 — Password policies / profiles (Lecture 6, Slide objectives)

Oracle uses CREATE PROFILE to enforce password rules. PostgreSQL handles this via expiry dates and connection limits.

```sql
ALTER USER analyst VALID UNTIL '2026-12-31';
ALTER USER app_user VALID UNTIL '2027-06-30';

-- Lock account (Oracle: ALTER USER ... ACCOUNT LOCK):
ALTER USER analyst NOLOGIN;

-- Unlock account (Oracle: ALTER USER ... ACCOUNT UNLOCK):
ALTER USER analyst LOGIN;

ALTER USER app_user CONNECTION LIMIT 5;

SELECT rolname, rolcanlogin, rolconnlimit, rolvaliduntil
FROM pg_roles
WHERE rolname IN ('app_user', 'analyst', 'junior_dba');
```

### ✅ Results observed

```
 rolname    | rolcanlogin | rolconnlimit |     rolvaliduntil
------------+-------------+--------------+------------------------
 junior_dba | t           |           -1 |
 analyst    | t           |            5 | 2026-12-31 00:00:00+00
 app_user   | t           |            5 | 2027-06-30 00:00:00+00
```

- `analyst` expiry moved to 2026-12-31, login restored after NOLOGIN/LOGIN test
- `app_user` connection limit reduced from 10 to 5, expiry set to 2027-06-30
- NOLOGIN/LOGIN is the PostgreSQL equivalent of Oracle's ACCOUNT LOCK/UNLOCK — no password change needed, just flips the login flag

---

## Part 7 — Test your security setup

```bash
# Test analyst can read:
psql -h 127.0.0.1 -U analyst -d securitylab -c "SELECT * FROM accounts;"

# Test analyst cannot delete:
psql -h 127.0.0.1 -U analyst -d securitylab -c "DELETE FROM accounts WHERE id=1;"
```

### ✅ Results observed

```
 id | owner | balance
----+-------+----------
  1 | Ahmad | 10000.00
  2 | Siti  | 25000.00
  3 | Hafiz |  8500.00
(3 rows)
```

```
ERROR:  permission denied for table accounts
```

Security model confirmed. SELECT succeeded, DELETE blocked.

**Authentication note:** Connecting with `-h 127.0.0.1` forces TCP authentication and prompts for a password. `sudo -u postgres psql` uses peer authentication via Unix socket and never asks for a password. Peer auth is only available locally — TCP auth is what remote applications use.

---

## Checklist

- [x] Viewed existing users and their attributes
- [x] Created users: `app_user`, `analyst`, `junior_dba`
- [x] Granted different privilege levels to each user
- [x] Created `read_role`, `write_role`, `admin_role` and assigned them
- [x] Set password expiry and connection limits
- [x] Locked and unlocked an account
- [x] Tested privilege enforcement from a second session
- [x] Used `REVOKE` to remove a privilege

---

## Key takeaway

Oracle's user model (username + auth + default tablespace + profile + privileges) maps directly to PostgreSQL's role system. The main difference: in PostgreSQL, users and roles are the same thing (`pg_roles`) — a role with `LOGIN` privilege is a user. Everything else — grants, revokes, role assignment, connection limits — works almost identically.

---

## Scenario: "A developer needs read access to the accounts table in securitylab"

**The wrong approach:** Creating a tablespace for the user, granting privileges directly to the user account.

**The right approach:** Check what already exists, reuse roles, grant the minimum required.

**Step 1 — Check if the developer already has a database account**

```sql
SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname = 'dev_username';
```

If the role does not exist, create it:

```sql
CREATE USER dev_username WITH PASSWORD 'somepassword' CONNECTION LIMIT 5;
```

**Step 2 — Check if a suitable role already exists**

```sql
SELECT r.rolname AS role, m.rolname AS member
FROM pg_roles r
JOIN pg_auth_members am ON r.oid = am.roleid
JOIN pg_roles m ON am.member = m.oid
WHERE r.rolname = 'read_role';
```

`read_role` already exists from Part 5 with SELECT on all tables. Do not create a duplicate role.

**Step 3 — Grant the three access layers and assign the existing role**

```sql
GRANT CONNECT ON DATABASE securitylab TO dev_username;
GRANT USAGE ON SCHEMA public TO dev_username;
GRANT read_role TO dev_username;
```

**Step 4 — Verify**

```sql
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'accounts' AND grantee = 'dev_username';
```

**Why roles over direct grants**

Never grant privileges directly to individual users in a team environment. Always grant to a role, then assign the role to users. When the developer leaves, you revoke the role from their account — you do not have to hunt down every individual grant they had across every table. This is the same principle as Oracle's role-based access control.

**Why no tablespace**

Tablespaces are for placing objects on disk — tables, indexes. A user who only needs read access does not create any objects and therefore does not need a tablespace. Creating one just because a new user exists is unnecessary and clutters the storage configuration.
