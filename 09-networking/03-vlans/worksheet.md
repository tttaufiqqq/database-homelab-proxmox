# Module 03 — VLANs & Network Segmentation

**Goal:** Tag VM interfaces into their VLAN tiers and set up Linux routing on the Proxmox host so they can still reach each other and the internet.

**Do not skip steps or reorder them.** The host-side setup must be done before tagging VMs, otherwise you lose connectivity to the VMs.

---

## Concepts

### What a VLAN does

A VLAN (Virtual LAN) logically separates traffic on the same physical network. Without VLANs, every device on vmbr0 can talk to every other device. With VLANs:

- VLAN 20 traffic is invisible to VLAN 30
- Only a router (in our case, the Proxmox host) can pass traffic between them
- You control exactly what is allowed to cross — nothing gets through by default

### 802.1Q tagging

When a VM sends a packet, the bridge adds a VLAN tag (a number 1–4094) to it. Other interfaces only receive packets tagged for their VLAN. The Proxmox bridge handles this automatically once you set the VLAN tag on a VM's network interface.

### VLAN sub-interfaces

On the Proxmox host, `vmbr0.20` is a sub-interface of `vmbr0` that only sees VLAN 20 traffic. You assign it an IP — that IP becomes the default gateway for all VMs in VLAN 20. Same for `vmbr0.30`.

### IP forwarding

By default, Linux silently drops packets that arrive on one interface and need to leave via another. Enabling IP forwarding tells the kernel: "yes, I am a router — forward packets between interfaces." One sysctl line turns this on.

### NAT (masquerade)

VMs on 10.0.x.x are on private subnets your home router knows nothing about. NAT (masquerade) on the Proxmox host rewrites the source IP of outgoing packets from 10.0.x.x to 192.168.0.10, so the home router forwards them. Replies come back to the Proxmox host, which rewrites them back to the original VM IP.

---

## VLAN Design

| VLAN | Subnet | Gateway (Proxmox host) | VM |
|---|---|---|---|
| 20 | 10.0.20.0/24 | 10.0.20.1 | taufiq-app-server → 10.0.20.102 |
| 30 | 10.0.30.0/24 | 10.0.30.1 | taufiq-db → 10.0.30.20 |

---

## Step 1 — Create VLAN sub-interfaces on Proxmox host

SSH into the Proxmox host:

```bash
ssh root@100.88.184.21
```

Edit the network interfaces file:

```bash
nano /etc/network/interfaces
```

Add these two blocks at the end (after the existing vmbr1 block):

```
auto vmbr0.20
iface vmbr0.20 inet static
        address 10.0.20.1/24
        vlan-raw-device vmbr0

auto vmbr0.30
iface vmbr0.30 inet static
        address 10.0.30.1/24
        vlan-raw-device vmbr0
```

Save and apply:

```bash
ifreload -a
```

Verify sub-interfaces are up:

```bash
ip addr show vmbr0.20
ip addr show vmbr0.30
```

Expected: both show their 10.0.x.1 addresses.

Result:
```
(paste here)
```

---

## Step 2 — Enable IP forwarding

```bash
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
sysctl -p
```

Verify:

```bash
sysctl net.ipv4.ip_forward
```

Expected: `net.ipv4.ip_forward = 1`

Result:
```
(paste here)
```

---

## Step 3 — Add NAT rule (VMs reach internet via host)

```bash
iptables -t nat -A POSTROUTING -s 10.0.0.0/8 -o vmbr0 -j MASQUERADE
```

Make it persist across reboots:

```bash
apt-get install -y iptables-persistent
netfilter-persistent save
```

Verify the rule is in place:

```bash
iptables -t nat -L POSTROUTING -n -v
```

Expected: a MASQUERADE rule for `10.0.0.0/8` on `vmbr0`.

Result:
```
(paste here)
```

---

## Step 4 — Tag VM interfaces in Proxmox UI

Do **one VM at a time**. The VM must be running — you are changing the bridge VLAN tag, not the VM's OS config.

### Tag taufiq-app-server (VM 101) → VLAN 20

1. In Proxmox UI: click **101 (app-server)**
2. **Hardware** tab
3. Click the **Network Device (net0)**
4. Click **Edit**
5. Set **VLAN Tag** to `20`
6. Click **OK**

No reboot needed — the bridge tag applies immediately.

### Tag taufiq-db (VM 100) → VLAN 30

1. Click **100 (db-server)**
2. **Hardware** tab
3. Click **Network Device (net0)**
4. Click **Edit**
5. Set **VLAN Tag** to `30`
6. Click **OK**

Verify both tags applied:

```bash
bridge vlan show
```

Expected: tap101i0 shows VLAN 20, tap100i0 shows VLAN 30.

Result:
```
(paste here)
```

---

## Step 5 — Update taufiq-app-server netplan

At this point taufiq-app-server has lost its IP (it's on VLAN 20 now but still configured for 192.168.0.102). Use the Proxmox console to make this change — **do not rely on SSH, it will be disconnected**.

In Proxmox UI: click **101 (app-server)** → **Console**

```bash
sudo nano /etc/netplan/50-cloud-init.yaml
```

Replace the entire contents with:

```yaml
network:
  ethernets:
    ens18:
      addresses: [10.0.20.102/24]
      routes:
        - to: default
          via: 10.0.20.1
      nameservers:
        addresses: [8.8.8.8, 1.1.1.1]
  version: 2
```

Apply:

```bash
sudo netplan apply
```

Verify:

```bash
ip addr show ens18
ping -c 3 8.8.8.8
```

Expected: ens18 shows 10.0.20.102, ping reaches internet.

Result:
```
(paste here)
```

---

## Step 6 — Update taufiq-db netplan

Use Proxmox console for VM 100 the same way.

```bash
sudo nano /etc/netplan/50-cloud-init.yaml
```

Replace with:

```yaml
network:
  ethernets:
    ens18:
      addresses: [10.0.30.20/24]
      routes:
        - to: default
          via: 10.0.30.1
      nameservers:
        addresses: [8.8.8.8, 1.1.1.1]
  version: 2
```

Apply:

```bash
sudo netplan apply
```

Verify:

```bash
ip addr show ens18
ping -c 3 8.8.8.8
```

Result:
```
(paste here)
```

---

## Step 7 — Verify cross-VLAN connectivity

From taufiq-app-server, test PostgreSQL port reachability:

```bash
# Should succeed — PostgreSQL is on this port
nc -zv 10.0.30.20 5432

# Should succeed — basic reachability
ping -c 3 10.0.30.20
```

Result:
```
(paste here)
```

---

## Step 8 — Update Tailscale note

Tailscale should reconnect automatically after the IP change — it establishes its own tunnel regardless of the underlying IP. Verify:

```bash
# On taufiq-app-server
tailscale status

# Should still show taufiq-db as a peer
```

Result:
```
(paste here)
```

---

## What to notice

- The VMs are now on completely separate subnets. Without the host routing, they cannot talk at all.
- Internet still works because the host NATs all 10.0.x.x traffic through 192.168.0.10 → home router.
- Tailscale reconnects through the NAT automatically — no manual action needed.
- PostgreSQL on taufiq-db is reachable from taufiq-app-server via the host router, which is why the TemplateHub app still works.

---

## Next

Once connectivity is verified, move to Module 04 — add firewall rules to restrict cross-VLAN traffic (allow only what is needed, deny the rest).

See [completed.md](completed.md) to record your findings.
