# Lab — Lecture 7: Managing Data Concurrency (Locking)

**Lecture topic:** Locking mechanism, row-level locks, DML locks, lock conflicts, deadlocks  
**Your server:** Proxmox VM `db-server` — guest hostname `taufiq-db` — connect via `ssh taufiq@100.75.213.36`  
**Requires:** 2 SSH terminal sessions open simultaneously

---

## Objective

Reproduce the exact locking scenarios from your lecture slides — blocked transactions, lock conflict detection, deadlocks — on your live PostgreSQL server.

---

## Setup — open two terminals

```bash
# Terminal 1:
ssh taufiq@100.75.213.36
sudo -u postgres psql

# Terminal 2 (open a second SSH session):
ssh taufiq@100.75.213.36
sudo -u postgres psql
```

Create a shared test table first (run in Terminal 1):

```sql
CREATE DATABASE locklab;
\c locklab

CREATE TABLE employees (
  employee_id SERIAL PRIMARY KEY,
  name        VARCHAR(100),
  salary      NUMERIC(10,2),
  dept        VARCHAR(50)
);

INSERT INTO employees (name, salary, dept) VALUES
  ('Ahmad Razif',  5500.00, 'Engineering'),
  ('Siti Nora',    4800.00, 'Finance'),
  ('Hafiz Malik',  6200.00, 'Engineering'),
  ('Nurul Ain',    5100.00, 'HR');
```

---

## Part 1 — Row-level locks (Lecture 7, Slide 3 & 4)

Your slides show Transaction 1 updating employee_id=100 while Transaction 2 tries the same row.

**Terminal 1** — start a transaction, do NOT commit:
```sql
\c locklab
BEGIN;
UPDATE employees SET salary = salary * 1.1 WHERE employee_id = 1;
-- DO NOT TYPE COMMIT YET
```

**Terminal 2** — try to update the same row:
```sql
\c locklab
BEGIN;
UPDATE employees SET salary = salary + 100 WHERE employee_id = 1;
-- This will HANG/BLOCK -- exactly what slide 3 shows
```

**Terminal 1** — now commit and watch Terminal 2 unblock:
```sql
COMMIT;
```

**Terminal 2** will immediately complete its update. This is Oracle's automatic lock queue management from Slide 4.

---

## Part 2 — Detect lock conflicts (Lecture 7, Slide 10)

While Terminal 2 is still blocked (repeat Part 1), open a third observation query.

**In any psql session:**
```sql
\c locklab

-- Equivalent of Oracle's "Select Blocking Sessions" (Slide 10):
SELECT
  blocked.pid          AS blocked_pid,
  blocked.query        AS blocked_query,
  blocking.pid         AS blocking_pid,
  blocking.query       AS blocking_query,
  now() - blocked.query_start AS waiting_duration
FROM pg_stat_activity AS blocked
JOIN pg_stat_activity AS blocking
  ON blocking.pid = ANY(pg_blocking_pids(blocked.pid))
WHERE cardinality(pg_blocking_pids(blocked.pid)) > 0;
```

This shows you exactly which session is blocking which — the same information Oracle's Enterprise Manager shows on the Performance page (Slide 10).

---

## Part 3 — DML lock types (Lecture 7, Slide 6)

```sql
\c locklab

-- See all current locks in the system (equivalent of V$LOCK):
SELECT
  pid,
  locktype,
  relation::regclass AS table_name,
  mode,
  granted
FROM pg_locks
WHERE relation IS NOT NULL
ORDER BY pid;
```

Look for:
- `RowExclusiveLock` — Oracle's ROW EXCLUSIVE (RX) mode, acquired on every DML
- `ShareLock` — Oracle's share lock, used for FK constraint checks

---

## Part 4 — Kill a blocking session (Lecture 7, Slide 12)

Oracle uses: `ALTER SYSTEM KILL SESSION 'sid,serial#' IMMEDIATE`

PostgreSQL equivalent:

```sql
-- Find the blocking PID first:
SELECT pid, query, state
FROM pg_stat_activity
WHERE state = 'active';

-- Terminate a session (equivalent of ALTER SYSTEM KILL SESSION):
SELECT pg_terminate_backend(<blocking_pid>);

-- Or just cancel its current query (gentler):
SELECT pg_cancel_backend(<blocking_pid>);
```

---

## Part 5 — Deadlock (Lecture 7, Slide 13)

Your slides show Transaction 1 and Transaction 2 locking rows in opposite order, causing a deadlock. Reproduce it:

**Terminal 1:**
```sql
\c locklab
BEGIN;
UPDATE employees SET salary = salary * 1.1 WHERE employee_id = 1;
-- Hold this lock, don't commit
```

**Terminal 2:**
```sql
\c locklab
BEGIN;
UPDATE employees SET salary = salary * 1.1 WHERE employee_id = 2;
-- Hold this lock, don't commit
```

**Terminal 1** — now try to lock the row Terminal 2 holds:
```sql
UPDATE employees SET salary = salary + 500 WHERE employee_id = 2;
-- This will block waiting for Terminal 2
```

**Terminal 2** — now try to lock the row Terminal 1 holds:
```sql
UPDATE employees SET salary = salary + 500 WHERE employee_id = 1;
-- PostgreSQL detects the deadlock and throws:
-- ERROR: deadlock detected
-- DETAIL: Process X waits for ShareLock on transaction Y
```

PostgreSQL automatically resolves it by aborting one transaction — same as Oracle's ORA-00060 error from Slide 13.

Check the log to see the deadlock recorded:
```bash
sudo tail -30 /var/log/postgresql/postgresql-16-main.log | grep -i deadlock
```

---

## Part 6 — Common causes and prevention (Lecture 7, Slide 9)

```sql
\c locklab

-- Find long-running transactions (cause of Slide 9's "long-running transactions"):
SELECT pid, now() - xact_start AS duration, state, query
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
ORDER BY duration DESC;

-- Find uncommitted transactions older than 5 minutes:
SELECT pid, usename, now() - xact_start AS age, state
FROM pg_stat_activity
WHERE xact_start < now() - interval '5 minutes'
AND state != 'idle';
```

---

## Checklist

- [ ] Reproduced a blocked row-level lock across 2 terminals
- [ ] Observed the block release when Transaction 1 committed
- [ ] Used `pg_blocking_pids` to identify blocking sessions
- [ ] Queried `pg_locks` to see lock types (RowExclusiveLock, ShareLock)
- [ ] Used `pg_terminate_backend` to kill a blocking session
- [ ] Reproduced a deadlock and saw PostgreSQL auto-resolve it
- [ ] Checked the log for deadlock entries
- [ ] Found long-running transactions

---

## Key takeaway

Oracle's locking is row-level by default, locks are held until COMMIT/ROLLBACK, reads never block writes — PostgreSQL behaves identically. The monitoring views (`pg_locks`, `pg_stat_activity`, `pg_blocking_pids`) give you the same visibility as Oracle's V$LOCK and V$SESSION views shown in your slides.
