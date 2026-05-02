# Lab — Lecture 7: Managing Data Concurrency (Locking)

**Lecture topic:** Locking mechanism, row-level locks, DML locks, lock conflicts, deadlocks  
**Your server:** Proxmox VM `db-server` — guest hostname `taufiq-db` — connect via `ssh taufiq@100.75.213.36`  
**Requires:** 2 SSH terminal sessions open simultaneously  
**Completed:** 2026-05-02

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
-- This will HANG/BLOCK
```

**Terminal 1** — commit and watch Terminal 2 unblock:
```sql
COMMIT;
```

### ✅ Results observed

Terminal 1 showed `UPDATE 1` and the `*` in `locklab=*#` confirmed an open transaction holding the lock. Terminal 2 hung immediately on the same row. The moment Terminal 1 ran `COMMIT`, Terminal 2 showed `UPDATE 1` instantly without any further input — lock queue released automatically.

**Key observation:** The `*` in the psql prompt means you are inside an open transaction. Any locks acquired in that transaction are held until COMMIT or ROLLBACK.

---

## Part 2 — Detect lock conflicts (Lecture 7, Slide 10)

While Terminal 2 is blocked, run in Terminal 3:

```sql
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

### ✅ Results observed

```
 blocked_pid |                           blocked_query                           | blocking_pid |                           blocking_query                           | waiting_duration
-------------+-------------------------------------------------------------------+--------------+--------------------------------------------------------------------+------------------
        3776 | UPDATE employees SET salary = salary + 100 WHERE employee_id = 1; |         3770 | UPDATE employees SET salary = salary * 1.1 WHERE employee_id = 1; | 00:00:57.743626
```

PID `3770` (Terminal 1) blocking PID `3776` (Terminal 2) for 57 seconds. Identical to Oracle Enterprise Manager's blocking session view from Slide 10.

---

## Part 3 — DML lock types (Lecture 7, Slide 6)

```sql
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

### ✅ Results observed

```
  pid  | locktype |   table_name   |       mode       | granted
-------+----------+----------------+------------------+---------
  3770 | relation | employees_pkey | RowExclusiveLock | t
  3770 | relation | employees      | RowExclusiveLock | t
  3776 | relation | employees_pkey | RowExclusiveLock | t
  3776 | relation | employees      | RowExclusiveLock | t
  3776 | tuple    | employees      | ExclusiveLock    | t
  3799 | relation | pg_locks       | AccessShareLock  | t
```

| Lock entry | Meaning |
|---|---|
| PID 3770 — `RowExclusiveLock` on employees and pkey, `granted = t` | Blocker holds the table-level DML lock. Oracle RX mode. |
| PID 3776 — `RowExclusiveLock` on employees and pkey, `granted = t` | Blocked session also holds table-level lock — this is fine |
| PID 3776 — `tuple | ExclusiveLock | t` | This is the physical row-level lock — Terminal 2 is stuck here waiting for the specific row that Terminal 1 owns |
| PID 3799 — `AccessShareLock` on pg_locks | The observation session's SELECT query acquiring a read lock |

Both sessions hold the table-level `RowExclusiveLock`, but Terminal 2 cannot proceed past the tuple lock because Terminal 1 owns that specific row.

---

## Part 4 — Kill a blocking session (Lecture 7, Slide 12)

Oracle uses: `ALTER SYSTEM KILL SESSION 'sid,serial#' IMMEDIATE`

```sql
-- Find all sessions including idle ones:
SELECT pid, query, state, wait_event_type
FROM pg_stat_activity
WHERE datname = 'locklab';

-- Cancel the current query (gentle — keeps connection alive):
SELECT pg_cancel_backend(<blocking_pid>);

-- Terminate the session fully (equivalent of ALTER SYSTEM KILL SESSION):
SELECT pg_terminate_backend(<blocking_pid>);
```

### ✅ Results observed

```
  pid  |                               query                               |        state        | wait_event_type
-------+-------------------------------------------------------------------+---------------------+-----------------
  3776 | UPDATE employees SET salary = salary + 100 WHERE employee_id = 1; | active              | Lock
  3799 | SELECT pid, query, state, wait_event_type ...                     | active              |
  3770 | UPDATE employees SET salary = salary * 1.1 WHERE employee_id = 1; | idle in transaction | Client
```

- PID `3770` shows `idle in transaction` — the blocker is holding an open transaction but not actively running a query. `state = 'active'` filter misses this — always use `WHERE datname = 'locklab'` to see all sessions.
- After `SELECT pg_terminate_backend(3770)` returned `t`, Terminal 1 received `FATAL: terminating connection due to administrator command` and psql automatically reconnected. Terminal 2 immediately showed `UPDATE 1`.

**Important:** When `pg_terminate_backend` is called, the session's open transaction is automatically rolled back and all its locks released. The killed session sees a FATAL error and psql reconnects automatically.

---

## Part 5 — Deadlock (Lecture 7, Slide 13)

**Terminal 1:**
```sql
BEGIN;
UPDATE employees SET salary = salary * 1.1 WHERE employee_id = 1;
-- Holds lock on row 1
```

**Terminal 2:**
```sql
BEGIN;
UPDATE employees SET salary = salary * 1.1 WHERE employee_id = 2;
-- Holds lock on row 2
```

**Terminal 1** — try to lock row 2 (held by Terminal 2):
```sql
UPDATE employees SET salary = salary + 500 WHERE employee_id = 2;
-- Hangs waiting for Terminal 2
```

**Terminal 2** — try to lock row 1 (held by Terminal 1):
```sql
UPDATE employees SET salary = salary + 500 WHERE employee_id = 1;
-- PostgreSQL detects deadlock immediately
```

### ✅ Results observed

Terminal 2 received:
```
ERROR:  deadlock detected
DETAIL:  Process 3776 waits for ShareLock on transaction 787; blocked by process 3821.
         Process 3821 waits for ShareLock on transaction 788; blocked by process 3776.
HINT:  See server log for query details.
CONTEXT:  while updating tuple (0,6) in relation "employees"
```

Terminal 1 immediately showed:
```
UPDATE 1
locklab=*#
```

PostgreSQL chose Terminal 2 (PID `3776`) as the deadlock victim, aborted its transaction, and released its lock on row 2. Terminal 1's blocked UPDATE immediately completed. This is identical to Oracle's ORA-00060 behavior.

The `!` in `locklab=!#` on Terminal 2 means the transaction was aborted by deadlock resolution — ROLLBACK is still required to clear the error state.

Log entry confirmed:
```
2026-05-02 06:56:19.696 UTC [3776] postgres@locklab ERROR:  deadlock detected
```

---

## Part 6 — Common causes and prevention (Lecture 7, Slide 9)

```sql
-- Find long-running transactions:
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

### ✅ Results observed

```
  pid  | duration | state  | query
-------+----------+--------+------------------
  3821 | 00:00:00 | active | SELECT pid, ...
```

```
 pid | usename | age | state
-----+---------+-----+-------
(0 rows)
```

Only the observation query itself showing — clean state with no stale transactions.

---

## Checklist

- [x] Reproduced a blocked row-level lock across 2 terminals
- [x] Observed the block release when Terminal 1 committed
- [x] Used `pg_blocking_pids` to identify blocking sessions
- [x] Queried `pg_locks` to see lock types — `RowExclusiveLock`, `ExclusiveLock`, `AccessShareLock`
- [x] Used `pg_terminate_backend` to kill a blocking session
- [x] Reproduced a deadlock and saw PostgreSQL auto-resolve it
- [x] Checked the log for deadlock entry
- [x] Found long-running transactions

---

## Key takeaway

Oracle's locking is row-level by default, locks are held until COMMIT/ROLLBACK, reads never block writes — PostgreSQL behaves identically. The monitoring views (`pg_locks`, `pg_stat_activity`, `pg_blocking_pids`) give you the same visibility as Oracle's V$LOCK and V$SESSION views shown in your slides.

---

## Scenario: "The application is hanging, users can't update records"

**The wrong approach:** Immediately running `pg_terminate_backend` on the first PID you find. Terminating the wrong session could roll back an important financial transaction or cause data inconsistency. Always identify before you act.

**Step 1 — Confirm it is a locking issue, not a performance issue**

```sql
SELECT
  blocked.pid AS blocked_pid,
  blocked.query AS blocked_query,
  blocking.pid AS blocking_pid,
  blocking.query AS blocking_query,
  now() - blocked.query_start AS waiting_duration
FROM pg_stat_activity AS blocked
JOIN pg_stat_activity AS blocking
  ON blocking.pid = ANY(pg_blocking_pids(blocked.pid))
WHERE cardinality(pg_blocking_pids(blocked.pid)) > 0;
```

If this returns rows — there is a lock conflict, continue below. If it returns empty — the slowness is a query performance issue, not a locking issue, and you investigate differently (check slow query logs, EXPLAIN ANALYZE).

**Step 2 — Understand what the blocker is doing**

```sql
SELECT pid, usename, state, now() - xact_start AS transaction_age, query
FROM pg_stat_activity
WHERE pid = <blocking_pid>;
```

You are asking: how long has this transaction been open, what was it doing, and who owns it.
- `transaction_age` of 30 seconds → normal, wait a moment and check again
- `transaction_age` of several hours → the application likely crashed and left an orphaned transaction holding locks
- `state = idle in transaction` → the session finished its query but never committed — the application is holding the connection open with an uncommitted transaction

**Step 3 — Try the gentle approach first**

```sql
SELECT pg_cancel_backend(<blocking_pid>);
```

This cancels the current query but keeps the connection alive and rolls back only the current statement. If the blocker is a runaway query, this is enough to release the lock without fully disconnecting the session.

**Step 4 — If cancel does not work, terminate**

```sql
SELECT pg_terminate_backend(<blocking_pid>);
```

This fully disconnects the session, automatically rolls back its entire transaction, and releases all its locks. Use this when the transaction is orphaned or the session has been `idle in transaction` for an unreasonable amount of time.

**Step 5 — Verify the block is cleared**

```sql
SELECT blocked.pid, blocked.query, now() - blocked.query_start AS waiting_duration
FROM pg_stat_activity AS blocked
WHERE cardinality(pg_blocking_pids(blocked.pid)) > 0;
```

Should return empty. The previously blocked sessions should now complete their work.

**Step 6 — Check the log to understand the root cause**

```bash
sudo tail -50 /var/log/postgresql/postgresql-16-main.log
```

Look for deadlock entries, connection drops, or application errors. Fixing the symptom without understanding the cause means it will happen again. Common root causes:
- Application crashed mid-transaction and left an orphaned session
- A deadlock that PostgreSQL resolved but the application did not handle
- A long-running report query holding a lock longer than expected
- Missing COMMIT in application code

**Decision flow summary:**

```
Application hanging
  → Run blocking query detection
      → Empty result → not a locking issue, check query performance
      → Has rows → identify blocker transaction age and state
            → Young transaction → wait, monitor, check again
            → Old / idle in transaction → pg_cancel_backend first
                  → Still blocked → pg_terminate_backend
                        → Verify cleared → check log for root cause
```
