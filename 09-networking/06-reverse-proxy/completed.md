# Module 06 — Reverse Proxy (Nginx) — Completed

**Date:** 2026-05-12
**VM:** taufiq-app-server (10.0.20.102, Tailscale: 100.97.172.9)

---

## Concept Answers

**1. Forward proxy vs reverse proxy:**
A forward proxy acts on behalf of the client (sits between client and internet — client knows about it). A reverse proxy acts on behalf of the server (sits between client and backends — transparent to the client). Examples: Squid = forward. Nginx/Cloudflare = reverse.

**2. Client IP problem:**
The backend sees `127.0.0.1` (Nginx's address) for every request. Fix: add `proxy_set_header X-Real-IP $remote_addr` and `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for` to the location block.

**3. Upstream block:**
Defines a named backend pool. Even with one server, an upstream block keeps config clean and makes adding more servers (load balancing in M07) a one-line change rather than a rewrite of every proxy_pass.

**4. SSL termination at proxy:**
Backends only need to handle plain HTTP internally. The proxy holds the cert and handles TLS handshakes once. No need to install and rotate certs on every backend service separately.

**5. worker_processes / worker_connections:**
`worker_processes` = number of worker child processes (usually matches CPU cores, or `auto`). `worker_connections` = max connections per worker. Max concurrent connections = worker_processes × worker_connections.

**6. proxy_set_header Host $host:**
Passes the original request hostname (e.g. `templatehub.lab`) to the backend. Without it, the backend receives `localhost` — it can't generate correct redirect URLs or match virtual host configs.

---

## Implementation Log

### Install Nginx

```bash
sudo apt update
sudo apt install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx
```

Verify default page:
```bash
curl http://127.0.0.1
# Expected: Welcome to nginx!
```

### Disable default site

```bash
sudo rm /etc/nginx/sites-enabled/default
```

### Create server blocks

```bash
sudo nano /etc/nginx/sites-available/templatehub.lab
```

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

```bash
sudo nano /etc/nginx/sites-available/admin.lab
```

```nginx
upstream admin_backend {
    server 127.0.0.1:3001;
}

server {
    listen 80;
    server_name admin.lab;

    location / {
        proxy_pass http://admin_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo nano /etc/nginx/sites-available/vault.lab
```

```nginx
upstream vault_backend {
    server 127.0.0.1:8200;
}

server {
    listen 80;
    server_name vault.lab;

    location / {
        proxy_pass http://vault_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo nano /etc/nginx/sites-available/grafana.lab
```

```nginx
upstream grafana_backend {
    server 127.0.0.1:3030;
}

server {
    listen 80;
    server_name grafana.lab;

    location / {
        proxy_pass http://grafana_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Enable all sites

```bash
sudo ln -s /etc/nginx/sites-available/templatehub.lab /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/admin.lab /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/vault.lab /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/grafana.lab /etc/nginx/sites-enabled/
```

### Test and reload

```bash
sudo nginx -t
# Expected: syntax is ok / test is successful

sudo systemctl reload nginx
```

### Add hosts entries on Windows machine

Edit `C:\Windows\System32\drivers\etc\hosts` (as Administrator):

```
100.97.172.9    templatehub.lab
100.97.172.9    admin.lab
100.97.172.9    vault.lab
100.97.172.9    grafana.lab
```

### Verify

Open in browser:
- `http://templatehub.lab` — TemplateHub loads
- `http://admin.lab` — Admin panel loads
- `http://vault.lab` — 502 Bad Gateway (expected — Vault not installed yet)
- `http://grafana.lab` — 502 Bad Gateway (expected — Grafana not installed yet)

Check access log:
```bash
sudo tail -f /var/log/nginx/access.log
```

---

## UFW (if active)

If UFW is running on taufiq-app-server, allow port 80:
```bash
sudo ufw allow 'Nginx HTTP'
sudo ufw status
```

---

## Outcomes

- Nginx installed and running on taufiq-app-server
- `templatehub.lab` routes to Docker container on port 3000 — Next.js app renders (session error expected — NEXT_PUBLIC_APP_URL is baked as the Cloudflare domain, not `.lab`)
- `admin.lab` routes to Docker container on port 3001 — Admin login page renders fully and correctly
- `vault.lab` and `grafana.lab` configs in place — 502 until those services are deployed in later phases
- `.lab` hostname routing working from Windows dev machine via Tailscale + hosts file
- Nginx routing verified: both containers serving real UI through the proxy

**Note on templatehub.lab session error:** "APPLICATION INTERRUPTED" is a Next.js CSRF/session origin mismatch — the Docker image has `NEXT_PUBLIC_APP_URL=templatehub.tttaufiqqq.com` baked in at build time. The `.lab` domain was never in the allowed origins. This is expected and does not indicate an Nginx problem. Nginx is working correctly.

---

## Why We Do This

Every service in this homelab runs on a different port: TemplateHub on 3000, Admin on 3001, Vault on 8200, Grafana on 3030. Without a reverse proxy, you need to remember and type port numbers for everything — `10.0.20.102:3000`, `10.0.20.102:8200`. That breaks down the moment you have more than 3 services.

A reverse proxy solves this by sitting in front of all services and routing by hostname. You type `grafana.lab` — Nginx reads the `Host` header, matches it to the `grafana.lab` server block, and forwards to port 3030. The client never sees the port. The backend never changes.

This is the same architecture used in every production environment. Cloudflare in front of your app is a reverse proxy. An API gateway routing `/auth/*` to one service and `/orders/*` to another is a reverse proxy. The pattern is everywhere.

In this homelab specifically, M05 (DNS) gave every VM a readable name. M06 gives every service a readable name. Together they complete the internal naming layer — no IP addresses, no port numbers, just meaningful hostnames. When Vault and Grafana come online in later phases, adding them is one new Nginx server block. Nothing else changes.
