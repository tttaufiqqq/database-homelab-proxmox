# Lab — Lecture 6: Administering User Security

**Lecture topic:** User accounts, authentication, privileges, roles, profiles, password policies  
**Your server:** Proxmox VM `db-server` — guest hostname `taufiq-db` — connect via `ssh taufiq@100.75.213.36`

---

## Objective

Replicate Oracle's user security model — accounts, authentication, default tablespaces, privilege grants, roles, and profiles — using PostgreSQL on your live server.

---

## Part 1 — Observe existing users (Lecture 6, Slide 3 & 5)

Oracle has predefined admin accounts: SYS, SYSTEM, DBSNMP. PostgreSQL has equivalents.

```sql
sudo -u postgres psql

-- List all database users (equivalent of DBA_USERS):
SELECT usename, usesuper, usecreatedb, usecreaterole, valuntil
FROM pg_user
ORDER BY usename;

-- More detailed view including connection limits:
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole,
       rolcanlogin, rolconnlimit, rolvaliduntil
FROM pg_roles
ORDER BY rolname;
```

| PostgreSQL role | Oracle equivalent |
|---|---|
| `postgres` (superuser) | SYS account |
| roles with `rolsuper=true` | Granted DBA role with ADMIN OPTION |

---

## Part 2 — Create users with different privilege levels (Lecture 6, Slide 6)

```sql
-- Create an application user (limited privileges):
CREATE USER app_user WITH
  PASSWORD 'AppPass123!'
  CONNECTION LIMIT 10;

-- Create a read-only analyst:
CREATE USER analyst WITH
  PASSWORD 'ReadOnly456!'
  CONNECTION LIMIT 5
  VALID UNTIL '2027-01-01';

-- Create a junior DBA:
CREATE USER junior_dba WITH
  PASSWORD 'DbaPass789!'
  CREATEROLE;

-- Verify users were created:
SELECT rolname, rolcanlogin, rolconnlimit, rolvaliduntil
FROM pg_roles
WHERE rolname IN ('app_user', 'analyst', 'junior_dba');
```

---

## Part 3 — Assign default tablespace (Lecture 6, Slide 3)

In Oracle, each user has a default tablespace. PostgreSQL achieves this differently — you set the default tablespace for the session or database.

```sql
-- Create a dedicated tablespace for app_user's objects:
-- (First create the directory in your SSH terminal)
-- sudo mkdir -p /mnt/pg_tablespaces/ts_app
-- sudo chown postgres:postgres /mnt/pg_tablespaces/ts_app

CREATE TABLESPACE ts_app LOCATION '/mnt/pg_tablespaces/ts_app';

-- Set default tablespace for a database:
ALTER DATABASE postgres SET default_tablespace = ts_app;

-- Or set per session:
SET default_tablespace = ts_app;
```

---

## Part 4 — Grant and revoke privileges (Lecture 6, Slide objectives)

```sql
-- First create a test database and table:
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

-- Grant SELECT only to analyst (Oracle: GRANT SELECT ON table TO user):
GRANT CONNECT ON DATABASE securitylab TO analyst;
GRANT USAGE ON SCHEMA public TO analyst;
GRANT SELECT ON accounts TO analyst;

-- Grant full DML to app_user:
GRANT CONNECT ON DATABASE securitylab TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON accounts TO app_user;
GRANT USAGE ON SEQUENCE accounts_id_seq TO app_user;

-- Verify grants (equivalent of DBA_TAB_PRIVS):
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'accounts';

-- Test: revoke a privilege (Oracle: REVOKE privilege FROM user):
REVOKE DELETE ON accounts FROM app_user;
```

---

## Part 5 — Create and manage roles (Lecture 6, Slide objectives)

Oracle uses roles to group privileges. PostgreSQL roles work the same way.

```sql
\c securitylab

-- Create roles (equivalent of Oracle's CREATE ROLE):
CREATE ROLE read_role;
CREATE ROLE write_role;
CREATE ROLE admin_role;

-- Grant privileges TO the role:
GRANT SELECT ON ALL TABLES IN SCHEMA public TO read_role;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO write_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin_role;

-- Assign roles to users (equivalent of Oracle's GRANT role TO user):
GRANT read_role TO analyst;
GRANT write_role TO app_user;
GRANT admin_role TO junior_dba;

-- Verify role assignments (equivalent of DBA_ROLE_PRIVS):
SELECT r.rolname AS role, m.rolname AS member
FROM pg_roles r
JOIN pg_auth_members am ON r.oid = am.roleid
JOIN pg_roles m ON am.member = m.oid
WHERE r.rolname IN ('read_role', 'write_role', 'admin_role');
```

---

## Part 6 — Password policies / profiles (Lecture 6, Slide objectives)

Oracle uses CREATE PROFILE to enforce password rules. PostgreSQL handles this differently — use the `passwordcheck` extension or set expiry.

```sql
-- Set password expiry (equivalent of Oracle profile PASSWORD_LIFE_TIME):
ALTER USER analyst VALID UNTIL '2026-12-31';
ALTER USER app_user VALID UNTIL '2027-06-30';

-- Lock an account (equivalent of Oracle ALTER USER ... ACCOUNT LOCK):
ALTER USER analyst NOLOGIN;

-- Unlock it:
ALTER USER analyst LOGIN;

-- Force connection limits (equivalent of Oracle SESSIONS_PER_USER):
ALTER USER app_user CONNECTION LIMIT 5;

-- Verify all user settings:
SELECT rolname, rolcanlogin, rolconnlimit, rolvaliduntil
FROM pg_roles
WHERE rolname IN ('app_user', 'analyst', 'junior_dba');
```

---

## Part 7 — Test your security setup

Open a second SSH terminal and test access:

```bash
# Test analyst can connect but not write:
psql -h 127.0.0.1 -U analyst -d securitylab -c "SELECT * FROM accounts;"
# Should succeed

psql -h 127.0.0.1 -U analyst -d securitylab -c "DELETE FROM accounts WHERE id=1;"
# Should fail: permission denied
```

---

## Checklist

- [ ] Viewed existing users and their attributes
- [ ] Created users: `app_user`, `analyst`, `junior_dba`
- [ ] Granted different privilege levels to each user
- [ ] Created `read_role`, `write_role`, `admin_role` and assigned them
- [ ] Set password expiry and connection limits
- [ ] Locked and unlocked an account
- [ ] Tested privilege enforcement from a second session
- [ ] Used `REVOKE` to remove a privilege

---

## Key takeaway

Oracle's user model (username + auth + default tablespace + profile + privileges) maps directly to PostgreSQL's role system. The main difference: in PostgreSQL, users and roles are the same thing (`pg_roles`) — a role with `LOGIN` privilege is a user. Everything else — grants, revokes, role assignment, connection limits — works almost identically.
