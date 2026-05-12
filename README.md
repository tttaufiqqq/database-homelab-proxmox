# Database Homelab

A PostgreSQL + Networking homelab running on Proxmox VE. Structured as a multi-domain learning hub: DBA fundamentals, networking implementation (subnetting, VLANs, pfSense, DNS, reverse proxy), database programming, and real application integration.

Paired with **TemplateHub** — a real Next.js + Prisma application deployed to the homelab app server, used to simulate production-style PostgreSQL operations.

## What this repo is

- lab notebook
- operations workbook
- database learning knowledge base
- reference set for future database experiments

## Infrastructure

| VM | Role | IP (Tailscale) | Status |
|---|---|---|---|
| taufiq-db | PostgreSQL 16 primary | 100.75.213.36 | ✅ Running |
| taufiq-app-server | Docker + TemplateHub containers | 100.97.172.9 | ✅ Running |
| Proxmox host | Hypervisor (i5-6600T, 7.65 GiB) | 100.88.184.21 | ✅ Running |

See [Homelab Architecture](01-foundation/homelab-architecture.md) and [Homelab Roadmap](homelab-roadmap.md) for full detail.

## Documentation map

- [Foundation](01-foundation/index.md) — Architecture, hardening, connectivity, baseline setup
- [DBA Track](02-dba/index.md) — Instance management, storage, roles, locking, maintenance, performance, backups, recovery, data movement *(active)*
- [Database Programming](03-database-programming/index.md) — SQL, PL/pgSQL, triggers, procedures, transactions *(reserved)*
- [Database Engineering](04-database-engineering/index.md) — Schema design, indexing, migrations, query tuning *(reserved)*
- [App Integration](05-app-integration/index.md) — TemplateHub deployed + CI/CD pipeline *(active)*
- [Sessions](06-sessions/index.md) — Dated work logs and environment snapshots *(active)*
- [Data Warehousing](07-data-warehousing/index.md) — Dimensional modeling, ETL/ELT *(reserved)*
- [Business Intelligence](08-business-intelligence/index.md) — Metrics, dashboards, analytical SQL *(reserved)*
- [Networking](09-networking/index.md) — Subnetting, VLANs, pfSense, DNS, reverse proxy, load balancing *(active)*

## Recommended reading order

1. [Homelab Architecture](01-foundation/homelab-architecture.md)
2. [Server Hardening](01-foundation/server-hardening.md)
3. [Initial Lab Session](06-sessions/2026-05-02-initial-lab-session.md)
4. [DBA Track Index](02-dba/index.md)
5. [TemplateHub Integration](05-app-integration/templatehub/index.md)

## Current learning focus

Two tracks running in parallel:

**DBA track:**
- PostgreSQL internals and operations
- Backup, recovery, and performance drills
- Real application integration (TemplateHub on app-server)

**Networking track:**
- Subnetting concepts done — applying the 10.0.x.x scheme to Proxmox
- VLANs, pfSense firewall/router, DNS, reverse proxy

## Near-term roadmap

1. Networking — audit Proxmox interfaces, enable VLANs, pfSense setup
2. HashiCorp Vault for secrets management
3. Observability stack (Prometheus + Grafana + Loki)
4. pg_dump backup pipeline with retention and restore drills

## Philosophy

Learn one system well. Document everything important. Verify behavior with live commands. Practice recovery, not just setup.
