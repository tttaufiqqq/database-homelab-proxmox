# Module 04 — Completed Notes: Linux Routing & Firewalling

**Date:** 2026-05-12

---

## What was built

The Proxmox host acts as a Linux router between two VLAN subnets. iptables rules on the FORWARD chain enforce strict access control: the app tier can reach the database on port 5432 only — nothing else crosses the boundary in either direction.

---

## Network Topology

```
Internet
    |
Home Router (192.168.0.1)
    |
Proxmox Host (vmbr0: 192.168.0.10)
    |
    +-- vmbr0.20 — 10.0.20.1/24 (VLAN 20 gateway — app tier)
    |       |
    |   taufiq-app-server
    |   ens18: 10.0.20.102/24
    |
    +-- vmbr0.30 — 10.0.30.1/24 (VLAN 30 gateway — data tier)
            |
        taufiq-db
        ens18: 10.0.30.20/24
```

Traffic between the two VMs must pass through the Proxmox host kernel — which is where the firewall sits.

---

## How Packets Flow

```
taufiq-app-server                Proxmox Host                 taufiq-db
  10.0.20.102         vmbr0.20              vmbr0.30           10.0.30.20
       |                  |                    |                    |
       |--- TCP :5432 --->|                    |                    |
       |                  |  iptables FORWARD  |                    |
       |                  |  rule 3: ACCEPT -->|--- TCP :5432 ----->|
       |                  |                    |                    |
       |<-- reply --------|<-- ESTABLISHED ----|<-- reply ----------|
       |                  |  rule 2: ACCEPT    |                    |
```

```
taufiq-app-server                Proxmox Host                 taufiq-db
  10.0.20.102         vmbr0.20              vmbr0.30           10.0.30.20
       |                  |                    |                    |
       |--- TCP :22 ----->|                    |                    |
       |                  |  iptables FORWARD  |                    |
       |                  |  rule 4: DROP      |                    |
       |   (timeout)      |                    |                    |
```

---

## The Three iptables Chains

```
Packet arrives at Proxmox host
           |
           v
    Destined for host itself?
    YES --> INPUT chain
    NO  --> FORWARD chain  <-- this is where our rules live
           |
           v
    Packet leaves Proxmox host?
    YES --> OUTPUT chain
```

FORWARD handles all VM-to-VM traffic because VMs are on separate interfaces. The Proxmox host is not the destination — it is the router.

---

## Rule Set

```
Chain FORWARD (policy ACCEPT)
num   pkts bytes target     prot opt  source               destination
1     251K   25M ts-forward  all  --  0.0.0.0/0            0.0.0.0/0            <- Tailscale (do not touch)
2     1059 72678 ACCEPT     all  --  0.0.0.0/0            0.0.0.0/0            state RELATED,ESTABLISHED
3        0     0 ACCEPT     tcp  --  10.0.20.102          10.0.30.20           tcp dpt:5432
4        0     0 DROP       tcp  --  10.0.20.102          10.0.30.20           tcp dpt:22
5        0     0 DROP       all  --  10.0.30.20           10.0.20.102
6        0     0 DROP       all  --  10.0.20.0/24         10.0.30.0/24
7        0     0 DROP       all  --  10.0.30.0/24         10.0.20.0/24
```

### Why this order matters

iptables processes rules top to bottom. First match wins.

- Rule 2 must come before DROP rules — established reply packets would be dropped otherwise
- Rule 3 must come before rule 6 — the subnet-level DROP would catch port 5432 first if placed earlier
- Rules 6 and 7 are the catch-all — anything not explicitly allowed between the two VLANs is dropped

### Why default policy stays ACCEPT

Setting `iptables -P FORWARD DROP` would break Tailscale. Tailscale adds its own `ts-forward` chain (rule 1) which handles Tailscale traffic internally. A global DROP policy could interfere depending on rule evaluation order.

The safer approach: scope the DROP rules to the VLAN subnets explicitly (rules 5, 6, 7). Tailscale and internet-bound traffic is unaffected.

---

## Commands Run

### View current rules
```bash
iptables -L FORWARD -v -n --line-numbers
```

### Apply rules (run in order)
```bash
# Allow established/related traffic (stateful — must be first)
iptables -A FORWARD -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow app-server to reach db on port 5432
iptables -A FORWARD -s 10.0.20.102 -d 10.0.30.20 -p tcp --dport 5432 -j ACCEPT

# Block app-server from SSHing into db
iptables -A FORWARD -s 10.0.20.102 -d 10.0.30.20 -p tcp --dport 22 -j DROP

# Block db from initiating connections to app-server
iptables -A FORWARD -s 10.0.30.20 -d 10.0.20.102 -j DROP

# Drop any other VLAN 20 -> VLAN 30 traffic
iptables -A FORWARD -s 10.0.20.0/24 -d 10.0.30.0/24 -j DROP

# Drop any other VLAN 30 -> VLAN 20 traffic
iptables -A FORWARD -s 10.0.30.0/24 -d 10.0.20.0/24 -j DROP
```

### Persist across reboots
```bash
# iptables-persistent was already installed — save current state manually
iptables-save > /etc/iptables/rules.v4

# Verify rules are in the filter section
grep -A 20 "^:FORWARD" /etc/iptables/rules.v4
```

On next boot, `netfilter-persistent` restores rules from `/etc/iptables/rules.v4` automatically.

---

## Tests

All run from the respective VMs. `nc` (netcat) is used to test TCP connectivity without needing the actual service to respond.

```bash
# From taufiq-app-server:

# Test 1 — port 5432 allowed
nc -zv 10.0.30.20 5432
# Connection to 10.0.30.20 5432 port [tcp/postgresql] succeeded!  ✅

# Test 2 — port 22 blocked
nc -zv -w 3 10.0.30.20 22
# nc: connect to 10.0.30.20 port 22 (tcp) timed out  ✅

# From taufiq-db:

# Test 3 — db cannot initiate to app-server
nc -zv -w 3 10.0.20.102 80
# nc: connect to 10.0.20.102 port 80 (tcp) timed out  ✅
```

The `-w 3` flag sets a 3-second timeout — without it, nc waits indefinitely for dropped packets.

---

## Summary

| Rule | Direction | Port | Action | Why |
|------|-----------|------|--------|-----|
| ESTABLISHED,RELATED | both | any | ACCEPT | Allow reply traffic for connections already permitted |
| app -> db | VLAN 20 -> VLAN 30 | 5432 | ACCEPT | PostgreSQL — the only legitimate cross-tier traffic |
| app -> db | VLAN 20 -> VLAN 30 | 22 | DROP | No SSH from app tier into the database |
| db -> app | VLAN 30 -> VLAN 20 | any | DROP | Database never initiates — defence in depth |
| VLAN 20 -> VLAN 30 | subnet | any | DROP | Catch-all — any other app->db traffic dropped |
| VLAN 30 -> VLAN 20 | subnet | any | DROP | Catch-all — any other db->app traffic dropped |
