# Module 03 — Completed Notes

**Date:** 2026-05-12

---

## Step 1 — VLAN sub-interfaces

```
55: vmbr0.20@vmbr0: inet 10.0.20.1/24 — UP
56: vmbr0.30@vmbr0: inet 10.0.30.1/24 — UP
```

## Step 2 — IP forwarding

```
net.ipv4.ip_forward = 1
```

## Step 3 — NAT rule

```
Chain POSTROUTING:
  0     0 MASQUERADE  all  --  *  vmbr0  10.0.0.0/8  0.0.0.0/0
```

Persisted via iptables-persistent / netfilter-persistent.

## Step 4 — bridge vlan show after tagging

```
fwpr101p0   20 PVID Egress Untagged   ← app-server on VLAN 20
fwpr100p0   30 PVID Egress Untagged   ← db-server on VLAN 30
vmbr0       1, 20, 30 (trunk)
```

## Step 5 — taufiq-app-server new IP

```
ens18: inet 10.0.20.102/24 — valid_lft forever
ping 8.8.8.8: 3/3 received
```

## Step 6 — taufiq-db new IP

Old config was split across two netplan files:
- `50-cloud-init.yaml` — updated to 10.0.30.20/24
- `00-installer-config.yaml` — had old static 192.168.0.20, cleared to `network: version: 2`

```
ens18: inet 10.0.30.20/24 — valid_lft forever (only IP, clean)
ping 8.8.8.8: 3/3 received
```

## Step 7 — cross-VLAN connectivity

```
ping 10.0.30.20 from app-server: 3/3 received, ~0.4ms
nc -zv 10.0.30.20 5432: Connection succeeded
```

Additional fixes required:
- ufw on taufiq-db only allowed 5432 on tailscale0 — added rule: allow from 10.0.20.0/24 to port 5432
- PostgreSQL listen_addresses was `localhost, 100.75.213.36` — changed to `*`
- pg_hba.conf — added `host all all 10.0.20.0/24 scram-sha-256`
- Restarted PostgreSQL

## Step 8 — Tailscale status

```
100.97.172.9  taufiq-app-server  linux  active
100.75.213.36 taufiq-db          linux  active
100.88.184.21 taufiq             linux  active
```

Tailscale reconnected automatically through NAT. No manual action required.

---

## Summary

| VM | Old IP | New IP | VLAN | Status |
|---|---|---|---|---|
| taufiq-app-server | 192.168.0.102 (DHCP) | 10.0.20.102/24 | 20 | ✅ |
| taufiq-db | 192.168.0.20 (static) | 10.0.30.20/24 | 30 | ✅ |
| Proxmox host | 192.168.0.10 (vmbr0) | unchanged + 10.0.20.1, 10.0.30.1 (sub-ifaces) | — | ✅ |

---

## Ready for Module 04?

- [x] Both VMs have 10.0.x.x IPs
- [x] Internet works from both VMs
- [x] taufiq-app-server can reach taufiq-db on port 5432
- [x] Tailscale reconnected on both VMs
- [x] TemplateHub containers verified still working (200 on templatehub.tttaufiqqq.com)
- [x] Firewall rules written (Module 04)
