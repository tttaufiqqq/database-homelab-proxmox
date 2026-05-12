# Module 02 — Proxmox Networking Internals

**Goal:** Understand exactly how your VMs are networked right now, before touching anything.
This is the baseline you'll compare against after applying VLANs and pfSense.

---

## Concepts

### Linux bridges

Proxmox does not use physical NICs directly for VMs. Instead it creates a **Linux bridge** (default: `vmbr0`) — a virtual switch that the host and all VMs plug into.

```
Physical NIC (e.g. eno1)
        |
    vmbr0  (Linux bridge — acts like a switch)
    /    \    \
 Host   VM1   VM2
```

Each VM gets a virtual interface (`tapX`) that connects to the bridge. From the VM's perspective it looks like a normal Ethernet interface.

### How VMs get addresses

Two options:
- **DHCP** — VM sends a broadcast, your router/DHCP server replies with an IP
- **Static** — IP is hardcoded in the VM's netplan config (`/etc/netplan/`)

Your current VMs (taufiq-db, taufiq-app-server) likely have static IPs since Tailscale relies on stable addressing.

### Tailscale overlay

Tailscale creates a separate virtual interface (`tailscale0`) on each VM with its own IP range (`100.x.x.x`). It runs on top of whatever physical/bridge network is already configured. VMs reach each other via Tailscale IPs regardless of what subnet the bridge uses.

This means right now your VMs talk via Tailscale, not directly via the bridge. After the VLAN + pfSense setup, they will use direct 10.0.x.x addresses and Tailscale becomes admin-only.

---

## Audit Tasks

Run each command and fill in the results below. You need access to:
- Proxmox host shell (via Proxmox web UI > Shell, or `ssh root@100.88.184.21`)
- taufiq-db shell (SSH via Tailscale: `ssh taufiq@100.75.213.36`)
- taufiq-app-server shell (SSH via Tailscale: `ssh taufiq@100.97.172.9`)

---

### Part A — Proxmox Host

**1. Show the bridge config**

```bash
cat /etc/network/interfaces
```

Result:
```
(paste here)
```

Questions to answer:
- What is the bridge name? (default: `vmbr0`)
- What physical NIC is attached to the bridge?
- Is VLAN-aware mode enabled? (look for `bridge-vlan-aware yes`)
- What IP is assigned to the host on the bridge?

---

**2. Show all network interfaces**

```bash
ip addr show
```

Result:
```
(paste here)
```

Questions to answer:
- What interfaces exist? (expect: lo, the physical NIC, vmbr0, tailscale0, tapX for each VM)
- What IP does tailscale0 have?
- Are there any unexpected interfaces?

---

**3. Show the bridge's MAC table (what's plugged into vmbr0)**

```bash
brctl show
```

Result:
```
(paste here)
```

Questions to answer:
- What interfaces are listed as members of vmbr0?
- How many tap interfaces are there? (one per running VM)

---

**4. Show routing table**

```bash
ip route show
```

Result:
```
(paste here)
```

Questions to answer:
- What is the default gateway?
- What subnets is the host directly connected to?

---

### Part B — taufiq-db

**5. Show network interfaces on the DB server**

```bash
ip addr show
```

Result:
```
(paste here)
```

Questions to answer:
- What is the IP on the main interface (eth0 or ens18)?
- What is the Tailscale IP (tailscale0)?
- Are both IPs in the expected ranges?

---

**6. Show netplan config (how the static IP is set)**

```bash
cat /etc/netplan/*.yaml
```

Result:
```
(paste here)
```

Questions to answer:
- Is the IP set statically or via DHCP?
- What gateway is configured?
- What DNS servers are set?

---

**7. Show routing table**

```bash
ip route show
```

Result:
```
(paste here)
```

Questions to answer:
- Default gateway IP?
- Does traffic to the app-server go via Tailscale or the bridge?

---

**8. Test reachability — both paths**

```bash
# Test Tailscale path to app-server
ping -c 3 100.97.172.9

# Test bridge path to app-server (replace with actual bridge IP if known)
ping -c 3 <app-server-bridge-ip>
```

Result:
```
(paste here)
```

Questions to answer:
- Does the Tailscale ping succeed?
- Does the bridge ping succeed? (may fail if VMs are on different subnets — that's fine, note it)

---

### Part C — taufiq-app-server

**9. Show network interfaces**

```bash
ip addr show
```

Result:
```
(paste here)
```

---

**10. Show netplan config**

```bash
cat /etc/netplan/*.yaml
```

Result:
```
(paste here)
```

---

**11. Show Docker networks**

```bash
docker network ls
docker network inspect bridge
```

Result:
```
(paste here)
```

Questions to answer:
- What subnet does Docker's default bridge use? (default: 172.17.0.0/16)
- What IPs do the running containers have?
- Could a Docker subnet conflict with your planned 10.0.x.x scheme?

---

## Summary — fill in after completing the audit

| Item | Current value | Notes |
|---|---|---|
| Proxmox bridge | vmbr0 | |
| VLAN-aware enabled | yes / no | |
| taufiq-db bridge IP | | |
| taufiq-db Tailscale IP | 100.75.213.36 | |
| taufiq-app-server bridge IP | | |
| taufiq-app-server Tailscale IP | 100.97.172.9 | |
| Default gateway | | |
| DNS servers on VMs | | |
| Docker bridge subnet | 172.17.x.x | |
| VMs communicate via | Tailscale / bridge / both | |

---

## What to notice

- If VLAN-aware mode is **off** on vmbr0, you will need to enable it before Module 03 (VLANs). This requires a brief network interruption on the Proxmox host.
- If VMs are currently using DHCP, you will need to set static IPs before assigning them to VLAN subnets.
- The Docker `172.17.0.0/16` subnet must not overlap with your planned `10.0.x.x` scheme — it won't, but confirm it.

---

## Next

Once this audit is done, results feed directly into Module 03 (VLAN setup) and Module 04 (pfSense config).

See [completed.md](completed.md) to record your findings.
