# Database Homelab

This repository documents a PostgreSQL-focused database infrastructure homelab running on a Proxmox VM. The goal is to learn database operations properly first, then use that foundation to support your own applications.

The lab is built around:

- a hardened Ubuntu server in Proxmox
- PostgreSQL as the main learning platform
- hands-on DBA exercises mapped from Oracle concepts to PostgreSQL
- documentation-first notes with real commands, results, and operational scenarios

---

## What this repo is

This is not a traditional application repository.

It is a:

- lab notebook
- operations workbook
- infrastructure learning record
- reference set for future database experiments

The files here capture what was tested on the real server, what the expected behavior was, and what actually happened.

---

## Current environment

### Host platform

- Proxmox VE
- single physical node
- roughly 4 vCPU, 7.65 GiB RAM, ~225 GiB disk

### Main server

- VM name: `db-server`
- guest hostname: `taufiq-db`
- OS: Ubuntu 24.04.4 LTS
- PostgreSQL: 16.x

### Access model

- SSH key authentication
- SSH password login disabled
- Tailscale for remote access
- firewall restricted access
- PostgreSQL reachable on the server's Tailscale IP over `5432`
- pgAdmin currently connects directly to `100.75.213.36:5432`
- `taufiq_dba` is used as the daily remote admin login for PostgreSQL

---

## Repository structure

### Core infrastructure docs

- [taufiq-db-server-hardening.md](C:/Users/taufi/Documents/Dev/database/taufiq-db-server-hardening.md)  
  SSH hardening, Tailscale setup, and firewall restrictions.

- [database-homelab-architecture.md](C:/Users/taufi/Documents/Dev/database/database-homelab-architecture.md)  
  Recommended target architecture for this hardware, including VM sizing, network layout, and phased build order.

- [connect-pgadmin.md](C:/Users/taufi/Documents/Dev/database/connect-pgadmin.md)  
  How pgAdmin is connected now over Tailscale, plus the SSH tunnel fallback method.

### Session and lab docs

- [lab-session-2026-05-02.md](C:/Users/taufi/Documents/Dev/database/lab-session-2026-05-02.md)  
  Initial environment discovery and Oracle-to-PostgreSQL architecture mapping.

- [lab-lec4-instance.md](C:/Users/taufi/Documents/Dev/database/lab-lec4-instance.md)  
  Lecture 4 lab template for database instance management.

- [lab-lec4-instance-completed.md](C:/Users/taufi/Documents/Dev/database/lab-lec4-instance-completed.md)  
  Completed Lecture 4 lab with observed outputs and notes.

- [lab-lec5-storage.md](C:/Users/taufi/Documents/Dev/database/lab-lec5-storage.md)  
  Lecture 5 lab template for storage structures.

- [lab-lec5-storage-completed.md](C:/Users/taufi/Documents/Dev/database/lab-lec5-storage-completed.md)  
  Completed Lecture 5 lab with storage hierarchy and file mapping.

- [lab-lec6-users.md](C:/Users/taufi/Documents/Dev/database/lab-lec6-users.md)  
  Lecture 6 lab template for users, roles, and privileges.

- [lab-lec6-users-completed.md](C:/Users/taufi/Documents/Dev/database/lab-lec6-users-completed.md)  
  Completed Lecture 6 lab with user security and privilege tests.

- [lab-lec7-locking.md](C:/Users/taufi/Documents/Dev/database/lab-lec7-locking.md)  
  Lecture 7 lab template for concurrency and locking.

- [lab-lec7-locking-completed.md](C:/Users/taufi/Documents/Dev/database/lab-lec7-locking-completed.md)  
  Completed Lecture 7 lab with blocking, deadlocks, and session control.

---

## Learning focus

This homelab is currently focused on:

- PostgreSQL internals and operations
- Oracle concept mapping for learning
- server hardening
- security and access control
- storage structures
- logging and observability
- locking and concurrency behavior

Planned next areas:

- backup and restore drills
- monitoring stack
- streaming replication
- failover exercises
- attaching real applications

---

## Current implemented access model

The current live access model is:

- `22/tcp` allowed on `tailscale0`
- `5432/tcp` allowed on `tailscale0`
- PostgreSQL listening on `127.0.0.1` and `100.75.213.36`
- `pg_hba.conf` allowing Tailscale clients via `scram-sha-256`
- pgAdmin connecting directly to `100.75.213.36:5432`
- `taufiq_dba` used as the daily superuser/admin role

This means the lab has moved from localhost-only PostgreSQL administration to a real private-network database service model inside Tailscale.

---

## Recommended reading order

If you are starting fresh in this repo, read in this order:

1. [database-homelab-architecture.md](C:/Users/taufi/Documents/Dev/database/database-homelab-architecture.md)
2. [taufiq-db-server-hardening.md](C:/Users/taufi/Documents/Dev/database/taufiq-db-server-hardening.md)
3. [lab-session-2026-05-02.md](C:/Users/taufi/Documents/Dev/database/lab-session-2026-05-02.md)
4. the `*-completed.md` lab files in lecture order

That gives you:

- the target design
- the security baseline
- the current environment state
- the completed practical exercises

---

## Philosophy

This homelab is intentionally built to go deep on one database stack first.

The approach is:

- learn one system well
- document everything important
- verify behavior with live commands
- practice recovery, not just setup
- connect real apps only after the database foundation is solid

---

## Near-term roadmap

The next strong milestones for this repo are:

1. Backup and restore guide with tested recovery steps
2. Monitoring setup for PostgreSQL metrics and dashboards
3. Replica VM build and streaming replication notes
4. Failover drill documentation
5. One app integrated against a least-privilege PostgreSQL role

---

## Notes

- This is a single-node Proxmox homelab, so any HA built here is educational rather than true hardware-level HA.
- The goal is operational understanding, not premature complexity.
- PostgreSQL is the primary platform because it offers the best learning depth for this stage.
