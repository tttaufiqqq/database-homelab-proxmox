# Module 05 — Why: DNS Internal Name Resolution

---

## Why we did this

After Modules 03 and 04, the network was segmented and secured. But every config file, every connection string, every reference between VMs still used raw IPs: `10.0.30.20`, `10.0.20.102`.

Hardcoded IPs are fragile. If an IP changes, every config that references it breaks. In a lab where you're actively learning and restructuring the network, IPs change. DNS decouples names from addresses.

---

## The fragility of hardcoded IPs

```
Without DNS:

  TemplateHub DATABASE_URL:
    postgresql://user:pass@10.0.30.20:5432/templatehub

  If taufiq-db moves to a new subnet:
    1. Update DATABASE_URL in .env file
    2. Update pg_hba.conf on the DB server
    3. Update UFW rules
    4. Redeploy the container
    5. Pray you didn't miss anywhere

With DNS:

  TemplateHub DATABASE_URL:
    postgresql://user:pass@taufiq-db.homelab.lab:5432/templatehub

  If taufiq-db moves to a new subnet:
    1. Update one DNS A record
    2. Done
```

---

## Why bind9 on taufiq-db

Several options exist for internal DNS:

| Option | Pros | Cons |
|--------|------|------|
| bind9 on taufiq-db | No new VM. Industry-standard. Transferable skills. | Single point of failure if DB is down |
| bind9 on new LXC | Isolated service | Extra VM to manage at this stage |
| dnsmasq | Simpler config | Less educational — hides how DNS really works |
| /etc/hosts on each VM | Zero infrastructure | Manual, doesn't scale, breaks when IPs change |

bind9 on taufiq-db is the right choice for a learning lab: no extra overhead, and it's the same software used in real enterprise DNS infrastructure. The single-point-of-failure tradeoff is acceptable — this is a lab, not production.

---

## How DNS fits into the existing network

```mermaid
graph TD
    subgraph VLAN20["VLAN 20 — App Tier"]
        APP[taufiq-app-server\n10.0.20.102]
        SR1[systemd-resolved\n127.0.0.53]
    end

    subgraph VLAN30["VLAN 30 — Data Tier"]
        DB[taufiq-db\n10.0.30.20]
        B9[bind9\n:53\nauthoritative: homelab.lab]
        SR2[systemd-resolved\n127.0.0.53]
    end

    subgraph INTERNET["Internet"]
        GD[Google DNS\n8.8.8.8]
    end

    APP -->|DNS query| SR1
    SR1 -->|forward to 10.0.30.20| B9
    DB -->|DNS query| SR2
    SR2 -->|forward to 10.0.30.20| B9
    B9 -->|homelab.lab: answer| SR1
    B9 -->|unknown domain: forward| GD
    GD -->|internet IP| B9

    style VLAN20 fill:#1a3a1a,color:#fff
    style VLAN30 fill:#1a1a3a,color:#fff
    style INTERNET fill:#3a3a1a,color:#fff
```

---

## Why bind9 is authoritative, not recursive

Two modes:

```
Recursive resolver:          Authoritative nameserver:
  Asks other DNS servers       Owns the zone data
  on your behalf               Answers directly for its zones
  (what 8.8.8.8 does)          (what our bind9 does for homelab.lab)

  "I'll go find the answer"    "I AM the answer for this domain"
```

Our bind9 is configured as both:
- **Authoritative** for `homelab.lab` — answers directly from the zone file
- **Forwarder** for everything else — passes to 8.8.8.8 without recursing itself

This is the simplest production-like setup. No root hints, no full recursion — just own your zone and forward the rest.

---

## Why systemd-resolved, not /etc/resolv.conf

Ubuntu 24.04 runs `systemd-resolved` as the system DNS stub resolver. It manages `/etc/resolv.conf` dynamically. Editing that file directly gets overwritten on reboot.

```
Wrong approach (gets overwritten):
  echo "nameserver 10.0.30.20" >> /etc/resolv.conf

Right approach (persistent):
  /etc/systemd/resolved.conf:
    [Resolve]
    DNS=10.0.30.20
    FallbackDNS=8.8.8.8
    Domains=homelab.lab
```

The `Domains=homelab.lab` setting means you can query `taufiq-db` instead of the full `taufiq-db.homelab.lab` — the search domain is appended automatically.

---

## Why two firewall layers needed updating

DNS crossed a VLAN boundary. That means it had to pass through:

```
taufiq-app-server
      |
      | UDP/TCP :53
      v
[iptables FORWARD on Proxmox host]   <-- layer 1: was blocking all port 53
      |
      v
[UFW on taufiq-db]                   <-- layer 2: was not allowing port 53 inbound
      |
      v
bind9 :53
```

Each layer is independent. Opening one without the other still blocks DNS. This is a real-world lesson: when a service doesn't respond, trace the full path — every hop can have its own firewall.

---

## What we gained

- Internal hostnames now work across VLANs — configs reference names, not IPs
- Hands-on experience with zone files, SOA records, and the bind9 config structure
- Understood the difference between authoritative and recursive DNS
- Learned why systemd-resolved requires `/etc/systemd/resolved.conf`, not direct edits to `/etc/resolv.conf`
- Reinforced the firewall lesson from Module 04 — every new service needs its port opened at every network layer it crosses

---

## What comes next (and why DNS had to come first)

Module 06 (Nginx reverse proxy) will use internal DNS hostnames in its upstream configs. Without DNS, the Nginx config would hardcode IPs. With DNS:

```
Nginx upstream block (future):

  upstream taufiq-db {
      server taufiq-db.homelab.lab:5432;   <- readable, decoupled from IPs
  }
```

DNS is infrastructure for infrastructure. It makes everything that follows cleaner.
