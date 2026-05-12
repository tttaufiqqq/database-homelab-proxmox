# Module 06 — Reverse Proxy (Nginx) — Rationale & Theory

## Why a Reverse Proxy

Backend services run on specific ports: TemplateHub on 3000, Vault UI on 8200, Grafana on 3000, pgAdmin on 80. Without a reverse proxy, you need to remember and type port numbers for everything. A reverse proxy sits in front of all services and routes requests by hostname — so you access `grafana.lab` instead of `10.0.20.102:3030`.

This is the same pattern every production deployment uses. Cloudflare, Nginx in front of app servers, API gateways — all are forms of reverse proxying.

---

## Forward Proxy vs Reverse Proxy

| | Forward Proxy | Reverse Proxy |
|---|---|---|
| Sits between | Client and internet | Client and backend servers |
| Client knows about it? | Yes (configured in browser/OS) | No (transparent) |
| Used for | Caching, filtering, anonymity | Routing, SSL termination, load balancing |
| Example | Squid, corporate web filter | Nginx, HAProxy, Cloudflare |

A forward proxy acts on behalf of the client. A reverse proxy acts on behalf of the server.

---

## How Nginx Routes by Hostname

When a browser sends a request to `http://templatehub.lab`, the HTTP request contains a `Host` header: `Host: templatehub.lab`. Nginx reads this header and matches it against `server_name` directives in its configuration. The matching server block handles the request and proxies it to the configured upstream.

This means one Nginx process on one IP can serve dozens of different services — it never looks at the URL path for routing decisions (unless you configure `location` blocks), only the hostname.

---

## The Nginx Config Structure

```
/etc/nginx/
├── nginx.conf              # main config — worker processes, logging, include sites
├── sites-available/        # config files (inactive)
│   ├── templatehub.lab
│   ├── admin.lab
│   └── vault.lab
└── sites-enabled/          # symlinks to active configs
    ├── templatehub.lab -> ../sites-available/templatehub.lab
    └── ...
```

`sites-available` holds all configs. `sites-enabled` holds symlinks to the active ones. To enable a site: `ln -s /etc/nginx/sites-available/templatehub.lab /etc/nginx/sites-enabled/`. To disable: remove the symlink.

---

## A Minimal Proxy Server Block

```nginx
upstream templatehub_backend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name templatehub.lab;

    location / {
        proxy_pass http://templatehub_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**`upstream` block** — names a backend pool. Even with one server, using an upstream block makes it easy to add more later (load balancing in M07).

**`proxy_set_header Host $host`** — passes the original hostname to the backend. Without this, the backend sees `localhost` instead of `templatehub.lab`.

**`X-Real-IP` / `X-Forwarded-For`** — passes the real client IP. Without these, the backend sees `127.0.0.1` (Nginx's address) for every request. Application logs become useless.

**`X-Forwarded-Proto`** — tells the backend whether the original request was HTTP or HTTPS. Important when backends need to generate correct redirect URLs.

---

## Why This Module Matters for the Homelab

This lab doesn't go through Cloudflare for internal services. Vault UI, Grafana, pgAdmin — these only need to be reachable within the homelab network. Nginx provides a clean `.lab` naming layer over the raw IP:port addresses.

When the observability stack and Vault come online in future phases, they'll have proper `*.lab` subdomains from day one — no reconfiguration needed. The Nginx config just needs a new server block per service.

This is also the layer where you'd add TLS for internal HTTPS: generate a self-signed cert (or use a local CA), add `listen 443 ssl` and `ssl_certificate` to each server block. The backends stay plain HTTP internally.

---

## Homelab Network Context

At this point in the lab:
- `taufiq-app-server` is on `10.0.20.102` (VLAN 20), also reachable via Tailscale at `100.97.172.9`
- Containers running on app-server: templatehub (3000), admin-templatehub (3001)
- Future services: Vault UI (8200), Grafana (3030), pgAdmin (80) — on services VLAN once those VMs exist

Nginx runs on the host (not in Docker) so it can proxy to Docker containers bound to `127.0.0.1:*`.

To test from the Windows dev machine:
- Via Tailscale: add entries to `C:\Windows\System32\drivers\etc\hosts` pointing `.lab` names to `100.97.172.9`
- Via VLAN: add entries pointing to `10.0.20.102` (requires being on the homelab network or routed through the Proxmox host)

---

## Connection to Module 07

Module 07 adds HAProxy in front of multiple backend instances. The upstream block in Nginx already supports multiple servers — M06 and M07 use the same mental model. M06 routes by hostname. M07 distributes load across a pool.
