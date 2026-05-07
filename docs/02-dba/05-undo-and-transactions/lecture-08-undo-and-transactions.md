# Lab — Lecture 8: Managing Undo Data

**Lecture topic:** Undo vs redo data, undo segments, UNDO_RETENTION, read consistency, flashback  
**Your server:** `taufiq-db` — connect via `ssh taufiq@100.75.213.36`  
**Requires:** 2 SSH terminal sessions

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
\c undolab

-- See current state:
SELECT * FROM accounts;

-- Start a transaction and make changes:
BEGIN;
UPDATE accounts SET balance = 0 WHERE owner = 'Ahmad';
DELETE FROM accounts WHERE owner = 'Siti';

-- See the "damaged" state mid-transaction:
SELECT * FROM accounts;

-- ROLLBACK restores using undo (old row versions):
ROLLBACK;

-- Data is restored:
SELECT * FROM accounts;
```

This is exactly Oracle's rollback operation from Slide 3 — "copy of original, premodified data captured for every transaction."

---

## Part 2 — Read consistency (Lecture 8, Slide 3 & 6)

Oracle guarantees that a query sees data as of the moment it started — even if other transactions commit changes mid-query. PostgreSQL's MVCC does the same.

**Terminal 1** — start a long read transaction:
```sql
\c undolab
BEGIN;
-- Take a snapshot of current data:
SELECT * FROM accounts;
-- Stay in this transaction (do NOT commit)
```

**Terminal 2** — make changes and commit:
```sql
\c undolab
BEGIN;
UPDATE accounts SET balance = balance + 99999 WHERE owner = 'Ahmad';
COMMIT;

-- Verify the change is committed:
SELECT * FROM accounts;
-- Ahmad's balance is now huge
```

**Terminal 1** — re-read while still in the same transaction:
```sql
-- Still in your BEGIN from before:
SELECT * FROM accounts;
-- Ahmad's balance is STILL the original value
-- This is read consistency -- your query sees the snapshot from when it started
COMMIT;

-- Now read again outside the transaction:
SELECT * FROM accounts;
-- Now you see Ahmad's new (huge) balance
```

This is Oracle's undo-based read consistency from Slide 6 — "protects against inconsistent reads in multiuser systems."

---

## Part 3 — Undo vs Redo (Lecture 8, Slide 6)

```sql
\c undolab

-- UNDO: how to reverse a change (stored as old row versions in heap):
-- Demonstrated in Part 1 above with ROLLBACK

-- REDO: how to replay a change (stored in WAL files):
-- Check WAL (redo log) location:
SHOW wal_level;

-- See current WAL position (equivalent of checking redo log sequence):
SELECT pg_current_wal_lsn();

-- Make a change and see WAL advance:
UPDATE accounts SET balance = balance * 1.05 WHERE owner = 'Nurul';

SELECT pg_current_wal_lsn();
-- LSN number is higher -- redo (WAL) was written
```

| | Undo (MVCC) | Redo (WAL) |
|---|---|---|
| Stores | Old row versions in heap | Change records in pg_wal/ |
| Used for | ROLLBACK, read consistency | Crash recovery, replication |
| Oracle equivalent | Undo segments | Redo log files |

---

## Part 4 — UNDO_RETENTION equivalent (Lecture 8, Slide 8)

Oracle's `UNDO_RETENTION` controls how long committed undo is kept. PostgreSQL uses autovacuum and `old_snapshot_threshold`.

```sql
-- See current retention settings:
SHOW old_snapshot_threshold;

-- See autovacuum settings (this is what "cleans up" old versions):
SELECT name, setting, unit
FROM pg_settings
WHERE name LIKE '%autovacuum%'
AND name IN (
  'autovacuum',
  'autovacuum_vacuum_cost_delay',
  'autovacuum_naptime'
);

-- See dead tuples (equivalent of used undo space):
SELECT relname, n_live_tup, n_dead_tup,
       pg_size_pretty(pg_total_relation_size(oid)) AS total_size
FROM pg_stat_user_tables
WHERE relname = 'accounts';
```

After running several updates, `n_dead_tup` will increase — these are the old row versions (undo data) still being retained.

---

## Part 5 — Force undo cleanup (equivalent of Oracle Undo Advisor)

```sql
-- Generate some dead tuples:
UPDATE accounts SET balance = balance + 1;
UPDATE accounts SET balance = balance + 1;
UPDATE accounts SET balance = balance + 1;

-- Check dead tuples accumulated:
SELECT relname, n_live_tup, n_dead_tup
FROM pg_stat_user_tables
WHERE relname = 'accounts';

-- Manually trigger cleanup (equivalent of Oracle's undo space reclamation):
VACUUM VERBOSE accounts;

-- Dead tuples should now be 0:
SELECT relname, n_live_tup, n_dead_tup
FROM pg_stat_user_tables
WHERE relname = 'accounts';
```

---

## Part 6 — Transaction assignment (Lecture 8, Slide 4)

Oracle: "each transaction is assigned to only one undo segment."

```sql
-- See current transaction ID (each transaction gets a unique XID):
BEGIN;
SELECT txid_current();
-- Note this number

UPDATE accounts SET balance = 100 WHERE owner = 'Hafiz';
SELECT txid_current();
-- Same number -- same transaction, same undo segment
ROLLBACK;

BEGIN;
SELECT txid_current();
-- Different (higher) number -- new transaction, new undo segment
COMMIT;
```

---

## Checklist

- [ ] Demonstrated ROLLBACK restoring data using old row versions
- [ ] Reproduced read consistency across 2 terminals
- [ ] Observed WAL (redo) LSN advancing after a change
- [ ] Compared undo (MVCC dead tuples) vs redo (WAL files)
- [ ] Checked `old_snapshot_threshold` and autovacuum settings
- [ ] Generated dead tuples and cleaned them with VACUUM
- [ ] Observed transaction IDs (XID) as the equivalent of undo segment assignment

---

## Key takeaway

Oracle's undo tablespace and PostgreSQL's MVCC achieve the same goals — rollback, read consistency, and crash recovery support. The key difference is that Oracle stores undo in a separate tablespace as "before images," while PostgreSQL keeps old row versions (dead tuples) inline in the same heap files until autovacuum reclaims them.
