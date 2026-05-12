# Module 02 — Completed Notes

**Date:** 2026-05-12

---

## Proxmox Host (root@100.88.184.21)

### /etc/network/interfaces

```
auto lo
iface lo inet loopback

iface nic0 inet manual
iface nic1 inet manual
iface wlp1s0 inet manual

auto vmbr0
iface vmbr0 inet static
    address 192.168.0.10/24
    gateway 192.168.0.1
    bridge-ports nic0
    bridge-stp off
    bridge-fd 0

auto vmbr1
iface vmbr1 inet manual
    bridge-ports none
    bridge-stp off
    bridge-fd 0
    # isolated lab network

source /etc/network/interfaces.d/*
```

### ip addr show (key interfaces)

```
nic0 (enp0s31f6): master vmbr0, UP
vmbr0: inet 192.168.0.10/24, UP
vmbr1: no IP, DOWN (no carrier — no ports attached)
tailscale0: inet 100.88.184.21/32
wlp1s0: DOWN
tap100i0: master fwbr100i0 (VM 100 firewall bridge)
fwpr100p0: master vmbr0 (VM 100 connected to bridge)
```

### brctl show

```
bridge       id                   STP  interfaces
fwbr100i0    8000.569dc97e07b9    no   fwln100i0, tap100i0
vmbr0        8000.6c0b84e40d0d    no   fwpr100p0, nic0
vmbr1        8000.000000000000    no   (empty)
```

### ip route show

```
default via 192.168.0.1 dev vmbr0 proto kernel onlink
192.168.0.0/24 dev vmbr0 proto kernel scope link src 192.168.0.10
```

---

## taufiq-db (VM 100)

### ip addr show

```
ens18: inet 192.168.0.20/24 — static
tailscale0: inet 100.75.213.36/32
```

### /etc/netplan/*.yaml

```
Permission denied — run with sudo to read
```

Note: IP is static (no 'dynamic' flag, no metric in ip addr output).

### ip route show

```
default via 192.168.0.1 dev ens18 proto static
192.168.0.0/24 dev ens18 proto kernel scope link src 192.168.0.20
```

---

## taufiq-app-server (VM 101)

### ip addr show

```
ens18: inet 192.168.0.102/24 metric 100 — DHCP (dynamic lease, valid_lft 86374s)
tailscale0: inet 100.97.172.9/32
docker0: inet 172.17.0.1/16
veth4c5637f, vethf8e8ce4, veth86c5695: container veth pairs (3 containers running)
```

### /etc/netplan/*.yaml

```
Permission denied — run with sudo to read
```

Note: IP is DHCP — has 'dynamic' flag and 'metric 100' in ip addr output.

### docker network ls + inspect bridge

```
Docker bridge (docker0): 172.17.0.0/16, gateway 172.17.0.1
Containers:
  watchtower:        172.17.0.2
  admin-templatehub: 172.17.0.3
  templatehub:       172.17.0.4
```

---

## Summary

| Item | Value | Notes |
|---|---|---|
| Proxmox bridge | vmbr0 | Physical NIC: nic0 (enp0s31f6) |
| VLAN-aware enabled | **No** | Must enable before Module 03 |
| vmbr1 | Exists, no ports, no IP | Comment: "isolated lab network" — available for internal use |
| taufiq-db bridge IP | 192.168.0.20/24 | Static |
| taufiq-db Tailscale IP | 100.75.213.36 | |
| taufiq-app-server bridge IP | 192.168.0.102/24 | Static — converted 2026-05-12 |
| taufiq-app-server Tailscale IP | 100.97.172.9 | |
| Proxmox host bridge IP | 192.168.0.10/24 | |
| Default gateway | 192.168.0.1 | Home router |
| DNS servers on VMs | Unknown — netplan unreadable without sudo | |
| Docker bridge subnet | 172.17.0.0/16 | No conflict with 10.0.x.x plan |
| VMs communicate via | Tailscale (primary) + bridge (same subnet, 192.168.0.x) | |

---

## Key findings

### 1. VLAN-aware is OFF
Neither vmbr0 nor vmbr1 has VLAN-aware enabled. This must be turned on (in Proxmox UI: edit vmbr0 → check VLAN aware → Apply Configuration) before assigning VLAN tags to VM interfaces. Enabling it requires applying the network config — brief disruption expected.

### 2. taufiq-app-server is DHCP
192.168.0.102 is a dynamic lease. Must convert to static before assigning to a VLAN subnet. Current safe static choice: 192.168.0.102 (reserve it in router DHCP, or set via netplan).

### 3. vmbr1 already exists as isolated bridge
No ports, no IP. Originally created as an isolated lab network. This can be repurposed:
- Option A: Delete it and create VLAN-aware sub-interfaces on vmbr0 instead
- Option B: Keep it for internal-only VM communication (no external routing)

Recommended: **Option A** — enable VLAN-aware on vmbr0, create VLAN interfaces (vmbr0.10, vmbr0.20, etc.) per subnet tier.

### 4. Docker bridge no conflict
172.17.0.0/16 does not overlap with the planned 10.0.x.x scheme. Safe to proceed.

### 5. VM firewall bridge setup (VM 100)
VM 100 (db-server) uses Proxmox's firewall bridge: tap100i0 → fwbr100i0 → fwpr100p0 → vmbr0. This means Proxmox firewall is enabled for this VM. VM 101 (app-server) tap not visible in brctl — may have Proxmox firewall disabled or uses a different bridge.

---

## Ready for Module 03?

- [x] VLAN-aware mode enabled on vmbr0 — 2026-05-12
- [x] taufiq-db has a static IP — confirmed
- [x] taufiq-app-server converted to static IP — 192.168.0.102/24, gateway 192.168.0.1, DNS 8.8.8.8/1.1.1.1
- [x] Docker subnet (172.17.x.x) does not conflict with 10.0.x.x
- [x] Current state fully documented above

**Pre-work complete. Ready for Module 03.**
