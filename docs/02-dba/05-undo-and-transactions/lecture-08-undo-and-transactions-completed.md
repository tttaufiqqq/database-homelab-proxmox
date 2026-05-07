# Lab — Lecture 8: Managing Undo Data

**Lecture topic:** Undo vs redo data, undo segments, UNDO_RETENTION, read consistency, flashback  
**Your server:** `taufiq-db` — connect via `ssh taufiq@100.75.213.36`  
**Requires:** 2 SSH terminal sessions  
**Completed:** 2026-05-02

---

## Objective

Demonstrate Oracle's undo concepts — rollback, read consistency, undo vs redo — using PostgreSQL's MVCC (Multi-Version Concurrency Control) system, which is the direct equivalent.

---

## Background — Undo vs MVCC

| Oracle concept | PostgreSQL equivalent |
|---|---|
| Undo segments | Dead tuple versions stored in heap files |
| UNDO_RETENTION | `old_snapshot_threshold` parameter |
| Undo tablespace | Part of the regular data files (no separate tablespace) |
| Read-consistent queries | MVCC snapshot isolation |
| Oracle Flashback Query | `pg_snapshot` / logical replication (limited) |
| Rollback using undo | `ROLLBACK` reads old tuple versions |

---

## Setup

```sql
sudo -u postgres psql
CREATE DATABASE undolab;
\c undolab

CREATE TABLE accounts (
  id      SERIAL PRIMARY KEY,
  owner   VARCHAR(100),
  balance NUMERIC(12,2)
);

INSERT INTO accounts (owner, balance) VALUES
  ('Ahmad',  10000.00),
  ('Siti',   25000.00),
  ('Hafiz',   8500.00),
  ('Nurul',  15000.00);
```

---

## Part 1 — Rollback using undo (Lecture 8, Slide 3)

Oracle uses undo data to reverse a transaction. PostgreSQL keeps old row versions for the same purpose.

```sql
SELECT * FROM accounts;

BEGIN;
UPDATE accounts SET balance = 0 WHERE owner = 'Ahmad';
DELETE FROM accounts WHERE owner = 'Siti';
SELECT * FROM accounts;
ROLLBACK;
SELECT * FROM accounts;
```

### ✅ Results observed

**Before:**
```
 id | owner | balance
----+-------+----------
  1 | Ahmad | 10000.00
  2 | Siti  | 25000.00
  3 | Hafiz |  8500.00
  4 | Nurul | 15000.00
```

**Mid-transaction:**
```
 id | owner | balance
----+-------+----------
  3 | Hafiz |  8500.00
  4 | Nurul | 15000.00
  1 | Ahmad |     0.00
```
Ahmad zeroed, Siti deleted — but the old row versions were never destroyed. PostgreSQL kept them in the heap, hidden from other transactions.

**After ROLLBACK:**
```
 id | owner | balance
----+-------+----------
  1 | Ahmad | 10000.00
  2 | Siti  | 25000.00
  3 | Hafiz |  8500.00
  4 | Nurul | 15000.00
```
Fully restored. PostgreSQL stopped pointing to the new versions and reverted to the old ones that were kept in the heap the entire time. No data was ever actually destroyed.

---

## Part 2 — Read consistency (Lecture 8, Slide 3 & 6)

### Important: READ COMMITTED vs REPEATABLE READ

PostgreSQL's **default isolation level is `READ COMMITTED`** — each statement inside a transaction sees the latest committed data at the time that statement runs, not a fixed snapshot from when the transaction started. This is different from Oracle's default behavior.

To get Oracle-style read consistency where the entire transaction sees a fixed snapshot, you must explicitly use `REPEATABLE READ` or `SERIALIZABLE`.

**Terminal 1** — start with correct isolation level:
```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT * FROM accounts;
-- Stay in this transaction, do NOT commit
```

**Terminal 2** — make a change and commit:
```sql
BEGIN;
UPDATE accounts SET balance = balance + 99999 WHERE owner = 'Siti';
COMMIT;
SELECT * FROM accounts;
-- Siti's balance is now 124999
```

**Terminal 1** — re-read while still in the same transaction:
```sql
SELECT * FROM accounts;
-- Siti's balance is STILL 25000 -- snapshot is frozen from transaction start
COMMIT;

-- Now read outside the transaction:
SELECT * FROM accounts;
-- Now you see Siti's new balance of 124999
```

### ✅ Results observed

Terminal 2 after commit showed Siti at 124999. Terminal 1 inside `REPEATABLE READ` transaction still showed Siti at 25000 — snapshot held. After Terminal 1 committed and read again, it saw 124999.

**Key lesson:** With default `READ COMMITTED`, Terminal 1 would see Terminal 2's committed changes mid-transaction — each statement gets a fresh snapshot. Only `REPEATABLE READ` gives Oracle-style read consistency where the snapshot is fixed at transaction start. This is a real behavioral difference that trips people up when migrating from Oracle to PostgreSQL.

---

## Part 3 — Undo vs Redo (Lecture 8, Slide 6)

```sql
SHOW wal_level;
SELECT pg_current_wal_lsn();
UPDATE accounts SET balance = balance * 1.05 WHERE owner = 'Nurul';
SELECT pg_current_wal_lsn();
```

### ✅ Results observed

```
 wal_level
-----------
 replica

 pg_current_wal_lsn
--------------------
 0/1F000000

UPDATE 1

 pg_current_wal_lsn
--------------------
 0/1F000228
```

LSN advanced from `0/1F000000` to `0/1F000228` — 552 bytes of WAL written for a single UPDATE. That is the redo log recording the change for crash recovery.

| | Undo (MVCC) | Redo (WAL) |
|---|---|---|
| Stores | Old row versions in heap files | Change records in `pg_wal/` |
| Used for | ROLLBACK, read consistency | Crash recovery, replication |
| Oracle equivalent | Undo segments | Redo log files |
| Observed in | Parts 1 & 2 — ROLLBACK and snapshot isolation | LSN advancing from `0/1F000000` to `0/1F000228` |

The WAL files in `pg_wal/` are what get replayed during crash recovery — the same `redo starts at` and `redo done at` entries seen in Lab 4's alert log.

---

## Part 4 — UNDO_RETENTION equivalent (Lecture 8, Slide 8)

```sql
SHOW old_snapshot_threshold;

SELECT name, setting, unit
FROM pg_settings
WHERE name IN (
  'autovacuum',
  'autovacuum_vacuum_cost_delay',
  'autovacuum_naptime'
);

SELECT relname, n_live_tup, n_dead_tup,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables
WHERE relname = 'accounts';
```

### ✅ Results observed

```
 old_snapshot_threshold
------------------------
 -1

             name             | setting | unit
------------------------------+---------+------
 autovacuum                   | on      |
 autovacuum_naptime           | 60      | s
 autovacuum_vacuum_cost_delay | 2       | ms

 relname  | n_live_tup | n_dead_tup | total_size
----------+------------+------------+------------
 accounts |          4 |          4 | 24 kB
```

- `old_snapshot_threshold = -1` — disabled. PostgreSQL keeps old row versions as long as any transaction might need them. Oracle equivalent: UNDO_RETENTION set to unlimited.
- `autovacuum = on`, runs every 60 seconds — this is what eventually reclaims dead tuples. Oracle equivalent: undo space reclamation after UNDO_RETENTION expires.
- `n_dead_tup = 4` — old row versions from earlier UPDATEs still sitting in the heap. Autovacuum has not run yet.

---

## Part 5 — Force undo cleanup

```sql
UPDATE accounts SET balance = balance + 1;
UPDATE accounts SET balance = balance + 1;
UPDATE accounts SET balance = balance + 1;

SELECT relname, n_live_tup, n_dead_tup
FROM pg_stat_user_tables
WHERE relname = 'accounts';

VACUUM VERBOSE accounts;

SELECT relname, n_live_tup, n_dead_tup
FROM pg_stat_user_tables
WHERE relname = 'accounts';
```

### ✅ Results observed

Before VACUUM: `n_dead_tup = 8`

VACUUM VERBOSE output:
```
INFO:  vacuuming "undolab.public.accounts"
INFO:  finished vacuuming "undolab.public.accounts": index scans: 0
pages: 0 removed, 1 remain, 1 scanned (100.00% of total)
tuples: 16 removed, 4 remain, 0 are dead but not yet removable
removable cutoff: 1185, which was 0 XIDs old when operation ended
WAL usage: 3 records, 2 full page images, 9592 bytes
```

After VACUUM: `n_dead_tup = 0`

- `16 removed` — all dead row versions reclaimed. Each UPDATE creates a new version and marks the old one dead: multiple UPDATEs × 4 rows = 16 dead versions.
- `0 are dead but not yet removable` — clean, nothing held back by active transactions.
- `9592 bytes of WAL` — even the cleanup operation itself was recorded in WAL.

---

## Part 6 — Transaction assignment (Lecture 8, Slide 4)

Oracle: "each transaction is assigned to only one undo segment."

```sql
BEGIN;
SELECT txid_current();
UPDATE accounts SET balance = 100 WHERE owner = 'Hafiz';
SELECT txid_current();
ROLLBACK;

BEGIN;
SELECT txid_current();
COMMIT;
```

### ✅ Results observed

```
 txid_current
--------------
         1185    ← first transaction

 txid_current
--------------
         1185    ← same transaction, same XID after UPDATE

 txid_current
--------------
         1186    ← new transaction, new higher XID
```

XID `1185` remained the same before and after the UPDATE — one transaction, one undo segment assignment. XID `1186` for the next transaction — XIDs always increment monotonically. PostgreSQL uses XIDs to determine which row versions are visible to which transactions, making MVCC snapshot isolation possible.

---

## Checklist

- [x] Demonstrated ROLLBACK restoring data using old row versions
- [x] Reproduced read consistency — with important note on READ COMMITTED vs REPEATABLE READ
- [x] Observed WAL LSN advancing after a change — `0/1F000000` → `0/1F000228`
- [x] Compared undo (MVCC dead tuples) vs redo (WAL files)
- [x] Checked `old_snapshot_threshold` and autovacuum settings
- [x] Generated dead tuples and cleaned with VACUUM — 16 removed
- [x] Observed transaction IDs — XID 1185 same within transaction, 1186 for next

---

## Key takeaway

Oracle's undo tablespace and PostgreSQL's MVCC achieve the same goals — rollback, read consistency, and crash recovery support. The key difference is that Oracle stores undo in a separate tablespace as "before images," while PostgreSQL keeps old row versions (dead tuples) inline in the same heap files until autovacuum reclaims them.

---

## Scenario: "A developer ran UPDATE without a WHERE clause on 10,000 rows and hasn't committed — what do I do?"

**Immediate instruction to the developer**

Do not commit. Do not close the terminal. Do not disconnect. Stay exactly where you are. Then run:

```sql
ROLLBACK;
```

That is it. All 10,000 rows are fully restored instantly.

**Why it works at the MVCC level**

When the UPDATE ran, PostgreSQL did not destroy the original 10,000 rows. It created 10,000 new row versions with the wrong values and kept the old versions in the heap file, fully intact. Because the transaction was never committed, no other session could see the new versions — they existed only inside that open transaction.

When ROLLBACK is called, PostgreSQL marks all new row versions as aborted and stops pointing to them. The old row versions were never touched — they become the visible versions again instantly. This is exactly how Oracle's undo segments work: the before-image of every row was captured before the change, and ROLLBACK restores it by reading those before-images.

**What would have made it unrecoverable**

If the developer had typed COMMIT, the new (wrong) versions would become permanently visible and the old versions would become dead tuples eligible for autovacuum cleanup. ROLLBACK is no longer possible after a commit — the transaction is closed. Recovery at that point requires a point-in-time restore from a backup, which is a serious and time-consuming operation.

**What if the developer closes the session accidentally**

Closing the session triggers an automatic ROLLBACK — PostgreSQL rolls back all uncommitted transactions when a connection drops. The data would still be restored. However, staying in the session and running ROLLBACK explicitly is the safest path because it is immediate and confirmed.

**The key principle**

An uncommitted transaction in PostgreSQL can always be fully reversed with ROLLBACK regardless of how many rows were affected, because MVCC never destroys old row versions until the transaction commits and autovacuum cleans them up. This is why the first instruction is always: do not commit, do not close the session.
