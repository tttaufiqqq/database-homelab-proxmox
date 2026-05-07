# Database Homelab

This repository documents a PostgreSQL-focused homelab running on a Proxmox VM. It is structured as a multi-domain database learning hub: DBA first, then database programming, database engineering, data warehousing, business intelligence, and real application integration.

The homelab is also paired with `TemplateHub`, a real application project used to simulate how PostgreSQL is operated inside an industry-style workflow.

## What this repo is

This is not a traditional application repository. It is a:

- lab notebook
- operations workbook
- database learning knowledge base
- reference set for future database experiments

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

### Current access model

- SSH key authentication
- SSH password login disabled
- Tailscale for remote access
- firewall restricted access
- PostgreSQL reachable on the server's Tailscale IP over `5432`
- pgAdmin currently connects directly to `100.75.213.36:5432`
- `taufiq_dba` is used as the daily remote admin login for PostgreSQL

### Associated application

- app name: `TemplateHub`
- purpose: simulate a real production-style application using PostgreSQL
- local app codebase: `C:\Users\taufi\Documents\Dev\templatehub`
- planning/docs reference in this repo: [TemplateHub docs](/C:/Users/taufi/Documents/Dev/database/docs/05-app-integration/templatehub/index.md)
- GitHub repository: [tttaufiqqq/templatehub](https://github.com/tttaufiqqq/templatehub)

## Documentation map

- [Foundation](/C:/Users/taufi/Documents/Dev/database/docs/01-foundation/index.md)
  Architecture, hardening, connectivity, and baseline homelab setup.
- [DBA Track](/C:/Users/taufi/Documents/Dev/database/docs/02-dba/index.md)
  The current deepest track: instance management, storage, roles, locking, maintenance, performance, backups, recovery, and data movement.
- [Database Programming](/C:/Users/taufi/Documents/Dev/database/docs/03-database-programming/index.md)
  Reserved for SQL, PL/pgSQL, triggers, procedures, and transaction logic.
- [Database Engineering](/C:/Users/taufi/Documents/Dev/database/docs/04-database-engineering/index.md)
  Reserved for schema design, indexing, migrations, query tuning, reliability, and production-style data architecture.
- [App Integration](/C:/Users/taufi/Documents/Dev/database/docs/05-app-integration/index.md)
  Application-facing database usage, currently centered on `TemplateHub`.
- [Sessions](/C:/Users/taufi/Documents/Dev/database/docs/06-sessions/index.md)
  Dated work logs and environment snapshots.
- [Data Warehousing](/C:/Users/taufi/Documents/Dev/database/docs/07-data-warehousing/index.md)
  Reserved for dimensional modeling, ETL/ELT, analytical storage patterns, and warehouse-oriented performance.
- [Business Intelligence](/C:/Users/taufi/Documents/Dev/database/docs/08-business-intelligence/index.md)
  Reserved for metrics, dashboards, reporting models, analytical SQL, and decision-support thinking.

## Current learning focus

The lab is currently focused most heavily on DBA work:

- PostgreSQL internals and operations
- Oracle concept mapping for learning
- server hardening
- security and access control
- storage structures
- logging and observability
- locking and concurrency behavior
- backup, recovery, and performance drills

Planned expansion areas:

- database programming patterns in PostgreSQL
- deeper database engineering and schema evolution
- data warehousing design and ETL/ELT workflows
- business intelligence modeling, metrics, and reporting
- monitoring stack and replication
- failover exercises
- operating `TemplateHub` through least-privilege database roles

## Recommended reading order

If you are starting fresh in this repo, read in this order:

1. [Homelab Architecture](/C:/Users/taufi/Documents/Dev/database/docs/01-foundation/homelab-architecture.md)
2. [Server Hardening](/C:/Users/taufi/Documents/Dev/database/docs/01-foundation/server-hardening.md)
3. [Initial Lab Session](/C:/Users/taufi/Documents/Dev/database/docs/06-sessions/2026-05-02-initial-lab-session.md)
4. [DBA Track Index](/C:/Users/taufi/Documents/Dev/database/docs/02-dba/index.md)
5. [TemplateHub Integration](/C:/Users/taufi/Documents/Dev/database/docs/05-app-integration/templatehub/index.md)

That gives you:

- the target design
- the security baseline
- the current environment state
- the hands-on DBA path
- the real application context

## Philosophy

This homelab is intentionally built to go deep on one database stack first.

The approach is:

- learn one system well
- document everything important
- verify behavior with live commands
- practice recovery, not just setup
- expand from DBA fundamentals into programming, engineering, warehousing, BI, and app integration

## Near-term roadmap

The next strong milestones for this repo are:

1. Add more index pages for new learning domains as they become active.
2. Continue backup and restore verification with clearer runbooks.
3. Add monitoring setup for PostgreSQL metrics and dashboards.
4. Start the data warehousing and BI sections with core modeling notes and example exercises.
5. Add replica and failover documentation.
6. Harden and document `TemplateHub` integration against a least-privilege PostgreSQL role.

## Notes

- This is a single-node Proxmox homelab, so any HA built here is educational rather than true hardware-level HA.
- The goal is operational understanding, not premature complexity.
- PostgreSQL is the primary platform because it offers the best learning depth for this stage.
