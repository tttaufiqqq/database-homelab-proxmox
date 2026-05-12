# Networking Track

**Goal:** Learn networking concepts deeply, then apply them directly to this Proxmox homelab.

Each module pairs theory with a concrete task on the lab. Concepts first, then hands-on implementation.

---

## Curriculum Map

| Module | Topic | Status |
|---|---|---|
| 01 | IP Addressing & Subnetting | ✅ Concepts done — not yet applied in Proxmox |
| 02 | Proxmox Networking Internals | ✅ Complete |
| 03 | VLANs & Network Segmentation | ✅ Complete |
| 04 | Linux Routing & Firewalling (on Proxmox host) | ✅ Complete |
| 05 | DNS — Internal Name Resolution | Planned |
| 06 | Reverse Proxy — Nginx | Planned |
| 07 | Load Balancing — HAProxy | Planned |

---

## Module 01 — IP Addressing & Subnetting

**Concepts**
- Binary and dotted-decimal notation
- Subnet masks and CIDR notation
- Network address, broadcast address, host range
- VLSM — fitting subnets to actual host counts
- Private IP ranges (10.x, 172.16-31.x, 192.168.x)

**Designed subnet scheme for this homelab:**

| Subnet | CIDR | Purpose |
|---|---|---|
| Management | 10.0.10.0/24 | Proxmox host, admin access |
| App tier | 10.0.20.0/24 | taufiq-app-server, containers |
| Data tier | 10.0.30.0/24 | taufiq-db, future DB VMs |
| Services tier | 10.0.40.0/24 | Vault, monitoring, backup VMs |
| Reserved | 10.0.50.0/24 | Future expansion |

**Status:** Scheme designed on paper. Not yet applied to Proxmox VM network interfaces.

**Apply:**
- [ ] Audit current VM interfaces (what IPs are actually assigned, what bridge)
- [ ] Document current state before changing anything
- [ ] Plan migration to 10.0.x.x scheme alongside pfSense setup (Module 04)

---

## Module 02 — Proxmox Networking Internals

**Concepts**
- What a Linux bridge is and how Proxmox uses it
- vmbr0 — the default bridge, how VMs attach to it
- Bridged vs NAT vs routed networking in Proxmox
- How VMs get addresses: DHCP vs static
- How Tailscale sits on top of existing interfaces

**Apply:**
- [ ] Read current network config on Proxmox host (`/etc/network/interfaces`)
- [ ] Document the actual bridge config for vmbr0
- [ ] Diagram how taufiq-db and taufiq-app-server currently reach each other
- [ ] Understand what happens when a VM is shut down vs network changes

**Worksheets:** [worksheet.md](02-proxmox-networking/worksheet.md) | [completed.md](02-proxmox-networking/completed.md)

---

## Module 03 — VLANs & Network Segmentation

**Concepts**
- What a VLAN is: logical separation on a physical network
- 802.1Q tagging — how switches mark frames per VLAN
- Proxmox VLAN-aware Linux bridge vs Open vSwitch (OVS)
- Trunk ports vs access ports
- Why segment app tier from data tier (blast radius, least privilege)

**Homelab VLAN design:**

| VLAN ID | Name | Maps to subnet | Members |
|---|---|---|---|
| 10 | mgmt | 10.0.10.0/24 | Proxmox host |
| 20 | app | 10.0.20.0/24 | taufiq-app-server |
| 30 | data | 10.0.30.0/24 | taufiq-db |
| 40 | services | 10.0.40.0/24 | taufiq-vault, taufiq-monitoring, taufiq-backup |

**Apply:**
- [ ] Enable VLAN-aware mode on vmbr0 in Proxmox
- [ ] Assign VLAN tags to each VM's network interface
- [ ] Verify VMs in the same VLAN can still reach each other
- [ ] Verify VMs in different VLANs cannot reach each other without a router

**Worksheets:** [worksheet.md](03-vlans/worksheet.md) | [completed.md](03-vlans/completed.md)

---

## Module 04 — Linux Routing & Firewalling

**Concepts**
- The Proxmox host is already a Linux machine — it can act as a router
- VLAN sub-interfaces: `vmbr0.20`, `vmbr0.30` — one per subnet, each gets a gateway IP
- IP forwarding — what it means to route packets between interfaces
- NAT (masquerade) — how VMs on 10.0.x.x reach the internet via the host
- nftables/iptables firewall rules — allow specific cross-VLAN traffic, deny the rest

**Homelab topology with Linux routing:**

```
Internet
    |
Home router (192.168.0.1)
    |
Proxmox host (vmbr0: 192.168.0.10)
    ├── vmbr0.20 — 10.0.20.1/24 (app gateway)
    └── vmbr0.30 — 10.0.30.1/24 (data gateway)

VMs:
  taufiq-app-server → VLAN 20 → 10.0.20.102, gateway 10.0.20.1
  taufiq-db         → VLAN 30 → 10.0.30.20,  gateway 10.0.30.1

Routing rules on Proxmox host:
  10.0.20.x → 10.0.30.x: allow TCP 5432 only
  10.0.30.x → 10.0.20.x: deny all
  both → internet: NAT via vmbr0 (192.168.0.10 → 192.168.0.1)
```

**Apply:**
- [x] Create VLAN sub-interfaces on Proxmox host (vmbr0.20, vmbr0.30)
- [x] Enable IP forwarding on Proxmox host
- [x] Add NAT masquerade rule (VMs reach internet via host)
- [x] Tag VM 101 (app-server) → VLAN 20 in Proxmox UI
- [x] Tag VM 100 (db-server) → VLAN 30 in Proxmox UI
- [x] Update taufiq-app-server netplan → 10.0.20.102/24
- [x] Update taufiq-db netplan → 10.0.30.20/24
- [x] Verify internet works from both VMs
- [x] Verify app-server can reach db on 5432
- [x] Verify app-server cannot reach db on port 22
- [x] Verify db cannot initiate connections to app-server

**Worksheets:** [worksheet.md](04-linux-routing/worksheet.md) | [completed.md](04-linux-routing/completed.md)

---

## Module 05 — DNS — Internal Name Resolution

**Concepts**
- How DNS resolution works: recursive resolver, authoritative nameserver
- Forward zones (hostname → IP) and reverse zones (IP → hostname)
- bind9 as an authoritative DNS server
- Why internal DNS matters: readable hostnames, decoupled from Tailscale IPs

**Homelab DNS design:**

| Hostname | IP | Zone |
|---|---|---|
| taufiq-db.lab | 10.0.30.x | homelab.lab |
| taufiq-app-server.lab | 10.0.20.x | homelab.lab |
| taufiq-vault.lab | 10.0.40.x | homelab.lab |
| taufiq-monitoring.lab | 10.0.40.x | homelab.lab |

**Apply:**
- [ ] Install bind9 on a lightweight LXC (or reuse taufiq-db)
- [ ] Create forward zone `homelab.lab`
- [ ] Add A records for all VMs
- [ ] Configure each VM to use the bind9 resolver
- [ ] Verify: `dig taufiq-db.lab` resolves correctly from app-server
- [ ] Replace Tailscale IP references in app configs with `.lab` hostnames

**Worksheets:** [worksheet.md](05-dns/worksheet.md) — *pending*

---

## Module 06 — Reverse Proxy — Nginx

**Concepts**
- Reverse proxy vs forward proxy
- How Nginx routes requests by hostname or path
- SSL termination at the proxy layer
- Upstream blocks — defining backend servers

**Homelab application:**
Internal Nginx proxy for services that don't go through Cloudflare Tunnel — monitoring dashboard, Vault UI, pgAdmin.

**Apply:**
- [ ] Install Nginx on taufiq-monitoring LXC (shared with observability stack)
- [ ] Configure upstream blocks for Grafana (:3000), Vault UI (:8200), pgAdmin (:80)
- [ ] Route by subdomain: `grafana.lab`, `vault.lab`, `pgadmin.lab`
- [ ] Self-signed cert for internal HTTPS (optional at first)
- [ ] Test: access Grafana via `grafana.lab` from admin machine

**Worksheets:** [worksheet.md](06-reverse-proxy/worksheet.md) — *pending*

---

## Module 07 — Load Balancing — HAProxy

**Concepts**
- What a load balancer does: distributes requests across backends
- HAProxy: frontend (accepts connections), backend (pool of servers), ACLs
- Health checks — HAProxy removes dead backends automatically
- Active/active vs active/passive balancing
- Connection persistence (sticky sessions)

**Homelab application:**
HAProxy in front of the app containers — practice config. Not production-critical since there's only one app-server.

**Apply:**
- [ ] Install HAProxy on taufiq-app-server (alongside Docker)
- [ ] Configure frontend on port 80/443 → backend pool (templatehub :3000)
- [ ] Add a second container instance to simulate load distribution
- [ ] Configure health checks
- [ ] Observe HAProxy stats page

**Worksheets:** [worksheet.md](07-load-balancing/worksheet.md) — *pending*

---

## Recommended order

Start here:
1. **Module 02** — audit what's actually running in Proxmox right now
2. **Module 03** — enable VLANs on vmbr0
3. **Module 04** — pfSense as the VLAN router + firewall
4. **Module 01** — apply the 10.0.x.x scheme as part of the pfSense setup
5. **Module 05** — DNS once the network is stable
6. **Module 06 + 07** — reverse proxy and load balancing last

Modules 01 concepts are already done — the apply tasks unlock once pfSense is set up.
