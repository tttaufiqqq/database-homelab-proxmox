# Module 04 — Worksheet: Linux Routing & Firewalling

---

## Concepts

### The Proxmox host as a router

The Proxmox host is a standard Linux machine. With two VLAN sub-interfaces (vmbr0.20 and vmbr0.30), it already has one foot in each subnet. IP forwarding tells the kernel to pass packets between those interfaces instead of dropping them.

```
Without IP forwarding:
  Packet arrives on vmbr0.30 destined for 10.0.20.x  --> kernel drops it

With IP forwarding:
  Packet arrives on vmbr0.30 destined for 10.0.20.x  --> kernel routes to vmbr0.20
```

Enable:
```bash
sysctl net.ipv4.ip_forward=1             # immediate
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf   # persistent
```

---

### The iptables table/chain model

iptables organises rules into tables, each with chains:

```
Table: filter  (default — what we use for firewalling)
  INPUT    -- traffic destined for this host
  FORWARD  -- traffic passing through this host
  OUTPUT   -- traffic originating from this host

Table: nat
  POSTROUTING  -- used for NAT/masquerade (rewrite source IP on outbound packets)
```

For VM-to-VM firewall rules: always use the **filter FORWARD chain** on the Proxmox host.

---

### Stateful matching

iptables can track connection state:

| State | Meaning |
|-------|---------|
| NEW | First packet of a new connection |
| ESTABLISHED | Packet belongs to a connection already seen in both directions |
| RELATED | Packet related to an established connection (e.g. ICMP error) |

```bash
# Without this rule, reply packets from db -> app would be dropped
iptables -A FORWARD -m state --state ESTABLISHED,RELATED -j ACCEPT
```

This rule must be added **before** any DROP rules.

---

### Rule evaluation order

```
Packet enters FORWARD chain
       |
       v
   Rule 1: ts-forward  --> Tailscale handles its own traffic
       |
       v
   Rule 2: ESTABLISHED,RELATED ACCEPT  --> reply packets pass through here
       |
       v
   Rule 3: src=10.0.20.102 dst=10.0.30.20 dpt:5432 ACCEPT
       |
       v
   Rule 4: src=10.0.20.102 dst=10.0.30.20 dpt:22 DROP
       |
       v
   Rule 5: src=10.0.30.20 dst=10.0.20.102 DROP
       |
       v
   Rule 6: src=10.0.20.0/24 dst=10.0.30.0/24 DROP
       |
       v
   Rule 7: src=10.0.30.0/24 dst=10.0.20.0/24 DROP
       |
       v
   Default policy: ACCEPT  (for everything else — Tailscale, internet)
```

First match wins. Once a rule matches, evaluation stops.

---

### NAT — how VMs reach the internet

VMs on 10.0.x.x have private IPs the home router has never heard of. NAT (masquerade) rewrites the source IP of outbound packets to the Proxmox host's real IP (192.168.0.10). The home router sees it as traffic from the host, routes it out, and the reply comes back to the host — which rewrites it back to the original VM IP.

```
taufiq-app-server                 Proxmox Host              Home Router
  10.0.20.102                  192.168.0.10 (vmbr0)          192.168.0.1
       |                               |                          |
       |-- src:10.0.20.102 ----------->|                          |
       |                  MASQUERADE   |                          |
       |                  src rewritten|-- src:192.168.0.10 ----->|
       |                               |                          |-- to internet
       |                               |<-- reply to 192.168.0.10-|
       |<-- reply to 10.0.20.102 ------|                          |
```

The iptables NAT rule:
```bash
iptables -t nat -A POSTROUTING -s 10.0.0.0/8 -o vmbr0 -j MASQUERADE
```

This was set up in Module 03. The `-s 10.0.0.0/8` covers all current and future VLAN subnets.

---

### Persistence

`iptables-persistent` (Debian/Ubuntu) restores rules at boot from:
- `/etc/iptables/rules.v4` — IPv4
- `/etc/iptables/rules.v6` — IPv6

Save current state:
```bash
iptables-save > /etc/iptables/rules.v4
```

The service is `netfilter-persistent`. It runs `iptables-restore` on boot.

---

## Apply

- [x] View current FORWARD chain state
- [x] Add ESTABLISHED,RELATED rule
- [x] Add app -> db port 5432 ACCEPT
- [x] Add app -> db port 22 DROP
- [x] Add db -> app DROP
- [x] Add subnet catch-all DROPs (VLAN 20<->30)
- [x] Remove duplicate rule
- [x] Test port 5432 allowed from app-server
- [x] Test port 22 blocked from app-server
- [x] Test db cannot initiate to app-server
- [x] Persist rules with iptables-save
- [x] Verify rules present in /etc/iptables/rules.v4
