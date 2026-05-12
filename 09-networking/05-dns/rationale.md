# Module 05 — Why: DNS Internal Name Resolution

---

## Why we did this

After Modules 03 and 04, the network was segmented and secured. But every config file, every connection string, every reference between VMs still used raw IPs: `10.0.30.20`, `10.0.20.102`.

Hardcoded IPs are fragile. If an IP changes, every config that references it breaks. In a lab where you're actively learning and restructuring the network, IPs change. DNS decouples names from addresses.

---

## Theory

### The DNS hierarchy

DNS is a distributed, hierarchical system. No single server knows every hostname. Instead, queries are delegated down a tree.

```
                          . (root)
                         / \
                       com  lab  org  net  ...
                      /         \
                 google          homelab
                    |                \
               www.google.com    taufiq-db.homelab.lab
```

```mermaid
graph TD
    ROOT[".(root)\n13 root servers worldwide"] --> TLD_COM[".com\nTLD nameservers"]
    ROOT --> TLD_LAB[".lab\n(our private TLD)"]
    TLD_COM --> GOOGLE["google.com\nGoogle's nameservers"]
    TLD_LAB --> HL["homelab.lab\nbind9 on taufiq-db"]
    HL --> REC1["taufiq-db → 10.0.30.20"]
    HL --> REC2["taufiq-app-server → 10.0.20.102"]
    HL --> REC3["proxmox → 192.168.0.10"]

    style HL fill:#1a1a3a,color:#fff
    style ROOT fill:#3a1a1a,color:#fff
```

Our bind9 is authoritative for the `homelab.lab` subtree. For anything outside that subtree, it forwards to 8.8.8.8.

---

### DNS record types

| Type | Full name | What it does | Example |
|------|-----------|-------------|---------|
| A | Address | Hostname → IPv4 | `taufiq-db → 10.0.30.20` |
| AAAA | IPv6 Address | Hostname → IPv6 | (not used here) |
| NS | Nameserver | Who answers for this zone | `homelab.lab → taufiq-db.homelab.lab` |
| SOA | Start of Authority | Zone metadata — serial, TTL defaults | Required on every zone |
| CNAME | Canonical Name | Alias → real hostname | `db → taufiq-db.homelab.lab` |
| PTR | Pointer | IPv4 → hostname (reverse DNS) | `10.0.30.20 → taufiq-db` |
| MX | Mail Exchange | Mail routing | (not used here) |

We only use A, NS, and SOA in this lab. CNAME and PTR become useful in Module 06 (reverse proxy).

---

### How a full DNS resolution works (step by step)

When you type `taufiq-db.homelab.lab` in an app on taufiq-app-server:

```
Step 1 — App calls getaddrinfo("taufiq-db.homelab.lab")
             |
             v
Step 2 — systemd-resolved (127.0.0.53) receives query
         Checks its cache -- cache miss
             |
             v
Step 3 — systemd-resolved forwards to configured DNS server: 10.0.30.20
         (crosses VLAN boundary — iptables + UFW must allow UDP/TCP 53)
             |
             v
Step 4 — bind9 receives query for taufiq-db.homelab.lab
         Checks: is homelab.lab in my zones? YES.
         Looks up A record: 10.0.30.20
             |
             v
Step 5 — bind9 returns answer: taufiq-db.homelab.lab. 604800 IN A 10.0.30.20
             |
             v
Step 6 — systemd-resolved caches the result (TTL: 604800 seconds = 7 days)
         Returns 10.0.30.20 to the app
             |
             v
Step 7 — App connects to 10.0.30.20:5432
```

For `google.com`:

```
Steps 1-3 same.

Step 4 — bind9 receives query for google.com
         Checks: is google.com in my zones? NO.
         Forwards to 8.8.8.8 (Google's public DNS)
             |
             v
Step 5 — 8.8.8.8 resolves google.com -> 172.217.x.x
         Returns to bind9
             |
             v
Step 6 — bind9 returns answer to systemd-resolved
Steps 6-7 same.
```

---

### TTL — Time to Live

Every DNS record has a TTL (seconds). Resolvers cache the answer for that duration.

```
taufiq-db   604800   IN   A   10.0.30.20
              ^
              TTL = 604800 seconds = 7 days

After querying, systemd-resolved caches this for 7 days.
Any app on this VM gets the cached answer immediately for 7 days.
```

Low TTL = changes propagate quickly but generate more queries.
High TTL = fewer queries but stale caches after changes.

For an internal lab DNS, 7 days is fine. If you change an IP, flush the cache: `resolvectl flush-caches`.

---

### SOA record explained

The SOA (Start of Authority) record is required on every zone. It tells secondary nameservers when to refresh and how long to cache negative responses.

```
@   IN  SOA   taufiq-db.homelab.lab.  admin.homelab.lab.  (
                  2026051201    ; Serial   -- increment every time you change the zone
                  604800        ; Refresh  -- secondary checks for updates every 7 days
                  86400         ; Retry    -- if refresh fails, retry after 1 day
                  2419200       ; Expire   -- stop serving if no contact after 28 days
                  604800 )      ; Neg TTL  -- cache "this name doesn't exist" for 7 days

Field 1: primary nameserver FQDN (must end with a dot)
Field 2: admin email — @ replaced with . (admin@homelab.lab = admin.homelab.lab.)
```

We have no secondary nameserver, so Refresh/Retry/Expire only matter for future scaling. The serial number matters now — increment it on every zone change or bind9 won't detect your edits.

---

### The stub resolver — what 127.0.0.53 is

`systemd-resolved` runs a **stub resolver** on `127.0.0.53`. Every DNS query from apps on the machine goes there first. The stub then forwards to the real DNS server configured in `/etc/systemd/resolved.conf`.

```
App  -->  127.0.0.53 (stub resolver)  -->  10.0.30.20 (bind9)
          systemd-resolved                 real nameserver
          (local only, always available)   (may be on another machine)
```

The stub provides a consistent local endpoint even when the upstream DNS server changes. Apps never need to know which DNS server is configured — they always talk to 127.0.0.53.

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
