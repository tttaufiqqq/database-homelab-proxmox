# Module 07 — Load Balancing (HAProxy) — Completed

**Date:** 2026-05-12
**VM:** taufiq-app-server (10.0.20.102, Tailscale: 100.97.172.9)

---

## Concept Answers

**1. Reverse proxy vs load balancer:**
A reverse proxy routes by hostname — one backend per service name. A load balancer distributes traffic across multiple instances of the same service — it decides which backend handles each request. Nginx routes: "templatehub.lab goes to port 3000". HAProxy distributes: "this request goes to app1, next one goes to app2."

**2. frontend / backend / listen:**
- `frontend` — where HAProxy listens (IP, port). Accepts connections, applies ACLs, decides which backend to use.
- `backend` — the pool of backend servers. Defines balancing algorithm and health checks.
- `listen` — shorthand that combines a frontend + backend in one block. Cleaner for simple configs.

**3. Active/active vs active/passive:**
Active/active: both backends receive traffic simultaneously — maximum throughput, any one going down is absorbed by the others. Active/passive: one backend handles all traffic, the other (marked `backup`) only activates when the primary fails — used for failover/DR.

**4. When to use `source` instead of `roundrobin`:**
When the app stores session state in local memory rather than a shared store (Redis/DB). With `roundrobin`, the same user hits different backends on different requests — each backend has no knowledge of sessions established on the other. `source` hashes the client IP to always route to the same backend. The correct solution for modern stateless apps is to store session in a shared store and use `roundrobin`.

**5. Health checks:**
HAProxy periodically sends an HTTP request (or TCP connect) to each backend. If it fails `fall` consecutive times, the backend is marked DOWN and removed from the pool. HAProxy continues checking — when it passes `rise` consecutive checks, the backend re-enters the pool automatically.

**6. Sticky sessions:**
Routes the same client to the same backend on every request (via a cookie). Necessary when session state is stored locally on the backend (legacy apps). Works against you when one backend is slower — it can't rebalance that client to a healthy server, and it makes rolling deploys harder (you must drain sessions before replacing a backend).

**7. Stats page:**
Shows per-backend: UP/DOWN status, current sessions, total requests, error rate, response time. Per-frontend: connection rate, total traffic. Real-time view of load distribution. Useful for verifying traffic is actually balanced (not just config syntax), spotting degraded backends, and confirming health check recovery.

---

## Implementation Log

### Install HAProxy

```bash
sudo apt update && sudo apt install haproxy -y
sudo systemctl enable haproxy
```

### Configure HAProxy

```bash
sudo nano /etc/haproxy/haproxy.cfg
```

Replace contents:

```haproxy
global
    log /dev/log local0
    maxconn 2000
    user haproxy
    group haproxy
    daemon

defaults
    log     global
    mode    http
    option  httplog
    timeout connect 5s
    timeout client  30s
    timeout server  30s

frontend templatehub_front
    bind *:8080
    default_backend templatehub_pool

backend templatehub_pool
    balance roundrobin
    option httpchk GET /
    server app1 127.0.0.1:3000 check inter 2s fall 3 rise 2
    server app2 127.0.0.1:3002 check inter 2s fall 3 rise 2

listen stats
    bind *:8404
    stats enable
    stats uri /stats
    stats refresh 5s
    stats auth admin:homelab
```

```bash
sudo haproxy -c -f /etc/haproxy/haproxy.cfg
# Expected: Configuration file is valid

sudo systemctl restart haproxy
sudo systemctl status haproxy
```

### Start second TemplateHub container

```bash
docker run -d \
  --name templatehub-2 \
  --env-file /home/taufiq/.env.templatehub \
  -p 3002:3000 \
  ghcr.io/tttaufiqqq/templatehub:latest
```

Verify both containers running:
```bash
docker ps
# templatehub (3000), templatehub-2 (3002), admin-templatehub (3001)
```

### Add lb.lab to Nginx

```bash
sudo tee /etc/nginx/sites-available/lb.lab <<'EOF'
upstream haproxy_backend {
    server 127.0.0.1:8080;
}

server {
    listen 80;
    server_name lb.lab;

    location / {
        proxy_pass http://haproxy_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/lb.lab /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Add `lb.lab` to Windows hosts file:
```
100.97.172.9    lb.lab
```

### Test load balancing

Open browser → `http://lb.lab` — TemplateHub loads via HAProxy.

Check stats: `http://100.97.172.9:8404/stats` (login: admin / homelab)
- Both app1 and app2 should show green (UP)
- Request counts should increment as you reload

### Test health check failover

```bash
docker stop templatehub-2
```

Stats page: app2 turns red (DOWN). All traffic routes to app1.

```bash
docker start templatehub-2
```

Stats page: app2 recovers (UP) after 2 successful checks. Traffic distributes again.

---

## Outcomes

- HAProxy installed on taufiq-app-server, listening on port 8080
- Two TemplateHub instances in the backend pool (3000 + 3002)
- HTTP health checks active — failover verified by stopping container
- Stats page live at `http://100.97.172.9:8404/stats`
- `lb.lab` accessible via Nginx → HAProxy → container
- Traffic distribution visible in real time on stats page

---

## Why We Do This

A single app instance is a single point of failure. If the process crashes, the container OOMs, or the app deadlocks — the service is down until someone notices and restarts it.

A load balancer removes that. HAProxy continuously health-checks every backend. The moment one fails, it's removed from the pool and traffic flows to the others — in milliseconds, with no human involved. When the backend recovers, it re-enters the pool automatically.

This module also demonstrates the layered approach to infrastructure: Nginx handles naming and routing (M06), HAProxy handles distribution and resilience (M07). Each layer has one job. They compose. In production this scales: add more backends to the HAProxy pool, Nginx config doesn't change. Scale the proxy tier by adding more Nginx nodes, the backends don't change.

The networking curriculum is now complete: subnetting → Proxmox bridges → VLANs → Linux routing → DNS → reverse proxy → load balancing. Each module built on the last.

---

## Reflection

Nginx and HAProxy are not competing — they work at different layers. Nginx answers "which service?". HAProxy answers "which instance of that service?". In this homelab, `lb.lab` is the full chain: client → Nginx (hostname routing) → HAProxy (load distribution) → templatehub container. Each tool does exactly one thing.
