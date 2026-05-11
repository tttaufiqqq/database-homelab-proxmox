# Homelab Roadmap

**Hardware:** Proxmox VE — i5-6600T, 7.65 GiB RAM, 225 GiB storage
**Domain:** `tttaufiqqq.com` — routed via Cloudflare Tunnel
**Last updated:** 2026-05-11

---

## Current State

| VM / Container | Role | RAM | Status |
|---|---|---|---|
| taufiq-app-server | Docker host, Cloudflare Tunnel | 2 GiB | ✅ Running |
| taufiq-db | PostgreSQL 16 primary | 2 GiB | ✅ Running |
| templatehub container | Customer storefront — port 3000 | — | ✅ Live |
| admin-templatehub container | Admin workspace — port 3001 | — | ✅ Live |
| watchtower | Auto-deploy on image push | — | ✅ Running |

Both apps live at `templatehub.tttaufiqqq.com` and `admin.tttaufiqqq.com`.

---

## Full Infrastructure Target

```mermaid
graph TD
    Internet --> CF[Cloudflare Edge]
    CF -->|tunnel| App[taufiq-app-server\n100.97.172.9]

    App -->|Tailscale| DB[taufiq-db\nPostgreSQL primary\n100.75.213.36]
    App -->|Tailscale - Phase 1| Replica[taufiq-db-replica\nStreaming replica]
    App -->|Tailscale - Phase 2| Vault[taufiq-vault\nHashiCorp Vault]
    App -->|Tailscale - Phase 3| Mon[taufiq-monitoring\nPrometheus + Grafana + Loki]

    DB -->|WAL streaming| Replica
    DB -->|pg_dump - Phase 4| Backup[taufiq-backup\nBackup pipeline]
    Replica -->|PITR source| Backup

    style DB fill:#2d6a4f,color:#fff
    style App fill:#1d3557,color:#fff
    style Replica fill:#457b9d,color:#fff
    style Vault fill:#6d4c41,color:#fff
    style Mon fill:#6a0572,color:#fff
    style Backup fill:#b5451b,color:#fff
```

---

## Resource Allocation Plan

| VM / LXC | Type | RAM | CPU | Storage | Notes |
|---|---|---|---|---|---|
| taufiq-app-server | VM | 1 GiB | 1 core | 10 GiB | Resize from 2 GiB |
| taufiq-db | VM | 1 GiB | 1 core | 20 GiB | Resize from 2 GiB |
| taufiq-db-replica | VM | 1 GiB | 1 core | 20 GiB | New — Phase 1 |
| taufiq-vault | VM | 512 MB | 1 core | 8 GiB | New — Phase 2 |
| taufiq-monitoring | LXC | 512 MB | 1 core | 10 GiB | New — Phase 3 |
| taufiq-backup | LXC | 128 MB | 1 core | 5 GiB | New — Phase 4 |
| Proxmox host overhead | — | ~800 MB | — | — | — |
| **Total** | | **~5 GiB / 7.6 GiB** | | **~73 GiB** | 2.6 GiB free |

Enable **memory ballooning** on all VMs — idle VMs release RAM back to the host. Ubuntu/Debian have `virtio-balloon` built in.

**VM vs LXC reasoning:**
- DB replica and Vault → full VMs (data integrity, security isolation)
- Monitoring and Backup → LXC (single-purpose, lightweight, non-sensitive)

---

## Pre-work (before adding new VMs)

- [ ] Resize taufiq-app-server RAM: 2 GiB → 1 GiB (Proxmox Hardware tab, requires shutdown)
- [ ] Resize taufiq-db RAM: 2 GiB → 1 GiB (requires shutdown)
- [ ] Verify both VMs healthy after resize

---

## Phase 1 — PostgreSQL Replication

**Goal:** Real-time streaming replica of the primary. Directly supports TemplateHub HA + DBA curriculum.
**New VM:** `taufiq-db-replica` — 1 GiB RAM, 1 core, 20 GiB, Ubuntu 24.04

```
taufiq-db (primary)
    │  WAL stream
    ▼
taufiq-db-replica (replica — read-only mirror)
```

**Benefits for TemplateHub:**
- Promote replica if primary crashes (high availability)
- Read-only queries (product catalog, order history) hit replica instead of primary
- Dump backups from replica — zero impact on live app

**Checklist:**
- [ ] Create taufiq-db-replica VM
- [ ] Install Ubuntu 24.04 + Tailscale
- [ ] Install PostgreSQL 16
- [ ] Create replication role on primary
- [ ] Configure `pg_hba.conf` on primary to allow replica connection
- [ ] Configure `postgresql.conf` on primary (`wal_level`, `max_wal_senders`)
- [ ] Run `pg_basebackup` to initialise replica
- [ ] Start replica and verify WAL streaming
- [ ] Confirm replica is syncing (`pg_stat_replication`)
- [ ] Test read-only query on replica
- [ ] Test failover — promote replica to primary
- [ ] Rebuild old primary as new replica (optional)

**Skills learned:** Streaming replication, WAL, pg_basebackup, failover promotion, read/write splitting

---

## Phase 2 — HashiCorp Vault (Secrets Management)

**Goal:** Replace `.env` files on app-server with runtime secret fetching. Every secret access is logged.
**New VM:** `taufiq-vault` — 512 MB RAM, 1 core, 8 GiB, Ubuntu 24.04
**URL:** `vault.tttaufiqqq.com` (add to Cloudflare tunnel ingress)

```
Current (dangerous):
  .env file on disk → DATABASE_URL, TOYYIBPAY_KEY, SESSION_SECRET visible to anyone with server access

With Vault:
  App starts → requests secret from Vault → Vault checks AppRole identity → returns secret
  Every access logged with timestamp + requester
```

**Secret structure:**
```
vault/
├── secret/templatehub/
│     DATABASE_URL, TOYYIBPAY_USER_SECRET_KEY, TOYYIBPAY_CATEGORY_CODE
│     ADMIN_SESSION_SECRET, CUSTOMER_SESSION_SECRET, ADMIN_BOOTSTRAP_PASSWORD
└── secret/admin-templatehub/
      DATABASE_URL, ADMIN_SESSION_SECRET, ADMIN_BOOTSTRAP_PASSWORD
```

**Checklist:**
- [ ] Create taufiq-vault VM
- [ ] Install Ubuntu 24.04 + Tailscale
- [ ] Install and initialise HashiCorp Vault
- [ ] Add `vault.tttaufiqqq.com` to Cloudflare tunnel config
- [ ] Configure KV secret engine
- [ ] Configure AppRole auth for taufiq-app-server
- [ ] Migrate TemplateHub secrets from .env files into Vault
- [ ] Update TemplateHub + admin app to fetch secrets from Vault at startup
- [ ] Verify audit log captures every secret read
- [ ] Remove .env files from app-server

**Skills learned:** Secrets management, AppRole auth, dynamic credentials, audit logging, least privilege

---

## Phase 3 — Observability Stack

**Goal:** Visibility into app behaviour and database health. Essential before handling real traffic at volume.
**New LXC:** `taufiq-monitoring` — 512 MB RAM, 1 core, 10 GiB
**URL:** `monitoring.tttaufiqqq.com` (add to Cloudflare tunnel ingress)
**Stack:** Prometheus + Grafana + Loki

**What to monitor for TemplateHub:**

| Metric | Source |
|---|---|
| Order creation rate | App metrics |
| Payment callback success/failure | App metrics |
| Protected download request volume | App metrics |
| PostgreSQL query performance | postgres_exporter |
| Replication lag (once Phase 1 done) | postgres_exporter |
| App server CPU + memory | Node exporter |
| Cloudflare Tunnel connection health | cloudflared metrics |

**Checklist:**
- [ ] Create taufiq-monitoring LXC
- [ ] Install Tailscale
- [ ] Install Prometheus
- [ ] Install Grafana
- [ ] Install Loki
- [ ] Add postgres_exporter to taufiq-db
- [ ] Add node_exporter to taufiq-app-server and taufiq-db
- [ ] Add `monitoring.tttaufiqqq.com` to Cloudflare tunnel
- [ ] Build Grafana dashboard for TemplateHub metrics
- [ ] Build Grafana dashboard for PostgreSQL health
- [ ] Connect Loki to collect logs from all VMs
- [ ] Set up Alertmanager — notify when services go down

**Skills learned:** Prometheus metrics, Grafana dashboards, Loki log aggregation, alerting, time-series data

---

## Phase 4 — PostgreSQL Backup Pipeline

**Goal:** Automated, verified backups with documented restore procedures. A backup never restored is not a backup.
**New LXC:** `taufiq-backup` — 128 MB RAM, 1 core, 5 GiB

```
Cron (daily 2AM)
    │
    ▼
pg_dump → taufiq-db (via Tailscale)
    │
    ▼
Compress (gzip)
    │
    ▼
Store locally + optional offsite
    │
    ▼
Verify dump integrity
    │
    ▼
Log result → Loki
```

**Backup types:**
- Full backup — complete `pg_dump` daily
- Point-in-time recovery — WAL archiving from replica (Phase 1 required)
- Retention policy — 7 daily, 4 weekly, 3 monthly

**Checklist:**
- [ ] Create taufiq-backup LXC
- [ ] Install Tailscale
- [ ] Write pg_dump backup script
- [ ] Schedule via cron
- [ ] Implement retention policy (7/4/3)
- [ ] Test restore drill — dump into a fresh DB, verify data integrity
- [ ] Document restore runbook clearly
- [ ] Connect backup logs to Loki (Phase 3 required)
- [ ] Set up WAL archiving from replica for PITR

**Skills learned:** pg_dump, WAL archiving, PITR, restore drills, retention policies, cron pipelines

---

## Phase 5+ — Future

| Project | What | Why |
|---|---|---|
| K3s Kubernetes | Replace Docker with lightweight K8s | Most in-demand infra skill, translates to EKS/GKE/AKS |
| Apache Kafka | Message streaming broker | Core data engineering tool |
| k6 Load Testing | Simulate concurrent buyers on TemplateHub | Capacity planning, DB connection pool tuning |
| Gitea + Woodpecker | Self-hosted Git + CI/CD | Learn how CI/CD infrastructure is built |
| Service Mesh (Linkerd) | Mutual TLS, traffic management | Advanced enterprise networking |

---

## Implementation Order Summary

```
Pre-work (now)
  └── Resize VMs: 2 GiB → 1 GiB each

Phase 1 (next)
  └── PostgreSQL streaming replication (taufiq-db-replica)

Phase 2
  └── HashiCorp Vault (taufiq-vault)
  └── Migrate TemplateHub secrets off .env

Phase 3
  └── Observability stack (taufiq-monitoring)
  └── Prometheus + Grafana + Loki

Phase 4
  └── Backup pipeline (taufiq-backup)
  └── Restore drills

Phase 5+
  └── K3s, Kafka, load testing, service mesh
```
