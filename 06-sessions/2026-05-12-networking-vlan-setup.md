# 2026-05-12 — Networking: VLAN Setup & Linux Routing

---

## What I did

Set up real network segmentation on the Proxmox homelab. Both VMs are now on isolated VLAN subnets, routed through the Proxmox host acting as a Linux router.

---

## Why I did it

The homelab previously had both VMs sitting on the same flat 192.168.0.x home network — the same network as every other device in the house. There was no separation between the app tier (taufiq-app-server) and the data tier (taufiq-db). Any VM could reach any other device. That is not how production infrastructure works.

The goal was to make the network reflect real-world architecture: the database lives in a separate network tier, and the app can only reach it on the specific port it needs (5432). Nothing else crosses the boundary unless explicitly allowed.

---

## What I learned

### VLANs

A VLAN logically separates traffic on the same physical network. Without VLANs, everything on the bridge can talk to everything else. With VLANs, traffic tagged for VLAN 20 is invisible to VLAN 30 unless a router passes it through.

The key insight: a VLAN by itself only separates. It does not route. You need a router (in this case, the Proxmox host itself) to allow controlled traffic between tiers.

### VLAN-aware bridge

Proxmox's Linux bridge (vmbr0) has a VLAN-aware mode. When enabled, the bridge reads the VLAN tag on each frame and only delivers it to interfaces configured for that VLAN. Enabling it takes one checkbox in the Proxmox UI — the complexity is in what you do with it after.

### VLAN sub-interfaces

`vmbr0.20` and `vmbr0.30` are sub-interfaces of the main bridge. Each one only sees traffic tagged for its VLAN. Assigning an IP to a sub-interface makes it the default gateway for that VLAN subnet — VMs send their traffic there, and the host decides where to forward it.

### IP forwarding

By default, Linux drops packets that arrive on one interface and need to leave via another. This one sysctl setting (`net.ipv4.ip_forward=1`) turns the Proxmox host into a router. Without it, VMs on different VLANs are completely isolated — even with the sub-interfaces set up.

### NAT (masquerade)

VMs on 10.0.x.x are on private subnets the home router has never heard of. NAT rewrites the source IP of packets leaving the Proxmox host to `192.168.0.10` — the address the home router does know. Replies come back to the host, which rewrites them back to the original VM IP. One iptables rule handles all of this for the entire 10.0.0.0/8 range.

### Why we skipped pfSense

pfSense is a dedicated router/firewall VM. It is commonly recommended in homelab guides because it is what enterprise environments use. But for this lab it adds a full VM (RAM, disk, FreeBSD) just to do what Linux already does natively. The Proxmox host is already a Linux machine. VLAN sub-interfaces, IP forwarding, and iptables rules teach the same networking concepts without the overhead of an extra VM.

Understanding Linux routing first also makes tools like pfSense easier to understand later — because you already know what they are doing underneath.

### PostgreSQL listen_addresses

PostgreSQL does not automatically listen on new IP addresses. It needs to be told explicitly. `listen_addresses = '*'` tells it to accept connections on all interfaces. `pg_hba.conf` controls which clients are actually allowed to connect.

### ufw interface-specific rules

The existing ufw rules on taufiq-db only allowed port 5432 on the `tailscale0` interface. When the VM moved to 10.0.30.x, traffic came in on `ens18` instead. ufw dropped it silently. The fix: add an explicit allow rule for the new source subnet.

---

## What I gained

- Network segmentation is now real on this homelab, not just conceptual
- The app tier and data tier are on separate subnets with controlled routing between them
- PostgreSQL is reachable from the app server on port 5432 across VLANs
- TemplateHub still works end to end — 200 on localhost:3000
- Tailscale reconnected automatically through NAT — no manual intervention needed
- Internet works from both VMs through the host's NAT

---

## Current network state

| VM | Interface | IP | VLAN | Gateway |
|---|---|---|---|---|
| taufiq-app-server | ens18 | 10.0.20.102/24 | 20 | 10.0.20.1 |
| taufiq-db | ens18 | 10.0.30.20/24 | 30 | 10.0.30.1 |
| Proxmox host | vmbr0 | 192.168.0.10/24 | — | 192.168.0.1 |
| Proxmox host | vmbr0.20 | 10.0.20.1/24 | 20 | — |
| Proxmox host | vmbr0.30 | 10.0.30.1/24 | 30 | — |

---

## Module 04 — Firewall rules (completed same session)

With routing in place, all cross-VLAN traffic was open by default. Module 04 locked it down with iptables FORWARD rules on the Proxmox host.

### What was applied

```bash
# Stateful — allow reply packets for established connections
iptables -A FORWARD -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow app-server -> db on PostgreSQL only
iptables -A FORWARD -s 10.0.20.102 -d 10.0.30.20 -p tcp --dport 5432 -j ACCEPT

# Block app-server from SSHing into db
iptables -A FORWARD -s 10.0.20.102 -d 10.0.30.20 -p tcp --dport 22 -j DROP

# Block db from initiating any connection to app-server
iptables -A FORWARD -s 10.0.30.20 -d 10.0.20.102 -j DROP

# Catch-all drops for both VLAN directions
iptables -A FORWARD -s 10.0.20.0/24 -d 10.0.30.0/24 -j DROP
iptables -A FORWARD -s 10.0.30.0/24 -d 10.0.20.0/24 -j DROP

# Persist
iptables-save > /etc/iptables/rules.v4
```

Note: default FORWARD policy left as ACCEPT — scoped DROP rules used instead to avoid breaking Tailscale's ts-forward chain.

### Tests

| Test | Command | Result |
|------|---------|--------|
| app -> db:5432 | `nc -zv 10.0.30.20 5432` | ✅ Connected |
| app -> db:22 | `nc -zv -w 3 10.0.30.20 22` | ✅ Timeout (blocked) |
| db -> app:80 | `nc -zv -w 3 10.0.20.102 80` | ✅ Timeout (blocked) |

---

## Module 05 — DNS Internal Name Resolution (completed same session)

bind9 installed on taufiq-db as authoritative nameserver for `homelab.lab`. Both VMs configured to use it via systemd-resolved.

### Zone records

| Hostname | IP |
|----------|----|
| taufiq-db.homelab.lab | 10.0.30.20 |
| taufiq-app-server.homelab.lab | 10.0.20.102 |
| proxmox.homelab.lab | 192.168.0.10 |

### Additional firewall rules required

Two layers opened for DNS (port 53 UDP+TCP):
- iptables FORWARD on Proxmox host — inserted before catch-all DROP
- UFW on taufiq-db — allow from 10.0.20.0/24

### Tests

```bash
# From taufiq-app-server:
dig taufiq-db.homelab.lab +short        # 10.0.30.20  ✅
dig taufiq-app-server.homelab.lab +short # 10.0.20.102 ✅
dig proxmox.homelab.lab +short          # 192.168.0.10 ✅
dig google.com +short                   # 172.217.x.x  ✅ (forwarding works)

# From taufiq-db:
dig taufiq-app-server.homelab.lab +short # 10.0.20.102 ✅
```

---

## What is still not done (next sessions)

### Module 06 — Reverse proxy
Nginx as internal reverse proxy for Vault UI, Grafana, pgAdmin — accessible by subdomain without going through Cloudflare.
