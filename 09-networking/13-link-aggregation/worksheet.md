# Module 13 — Link Aggregation & Bonding — Worksheet

## Concepts

**1. What is link aggregation? What two benefits does it provide compared to a single physical link?**

_Answer:_

**2. What is LACP (802.3ad)? How does it differ from static aggregation, and what does the negotiation exchange look like?**

_Answer:_

**3. Linux supports several bonding modes. Describe the behaviour of these four: `active-backup`, `balance-rr`, `balance-xor`, `802.3ad`.**

_Answer:_

**4. With `balance-rr`, traffic is distributed across all links in round-robin order. What problem can this cause with TCP streams, and how does `balance-xor` address it?**

_Answer:_

**5. In `active-backup` mode, how does the system detect that the active link has failed and switch to the backup?**

_Answer:_

**6. Your Proxmox host currently has one physical NIC. If you added a second NIC, what bonding mode would give you redundancy without requiring LACP support from the home router?**

_Answer:_

---

## Implementation Tasks

> Note: This module is conceptual + config-level if only one NIC is available. The commands below apply to a Proxmox host with two NICs.

- [ ] Check current NIC interfaces on Proxmox host: `ip link show`
- [ ] If two NICs available: create a bond interface in `/etc/network/interfaces`
- [ ] Set mode to `active-backup` with `bond-slaves eth0 eth1`
- [ ] Set `bond-miimon 100` (link monitoring every 100ms)
- [ ] Verify bond status: `cat /proc/net/bonding/bond0`
- [ ] Identify active slave and backup slave
- [ ] Simulate failover: `ip link set eth0 down` — verify bond switches to eth1
- [ ] Restore: `ip link set eth0 up` — verify eth0 re-enters as backup

---

## Reflection

**If you only have one physical NIC (current homelab situation), is link aggregation useful? What would you need to add to your homelab to make this module fully hands-on?**

_Answer:_
