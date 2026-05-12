# Module 07 — Load Balancing (HAProxy) — Rationale & Theory

## Why a Load Balancer

A reverse proxy routes by hostname. A load balancer distributes traffic across multiple instances of the same service. The distinction matters:

- Nginx M06: `templatehub.lab` → one backend (3000). If that process crashes, the site is down.
- HAProxy M07: `lb.lab` → backend pool of two instances (3000, 3002). If one crashes, HAProxy detects it and routes all traffic to the other. Zero manual intervention.

This is why every production deployment at any meaningful scale puts a load balancer in front of app servers.

---

## HAProxy Config Structure

```
global          # process-level settings: logging, limits, user/group
defaults        # inherited defaults for frontends and backends: timeouts, error pages
frontend        # where HAProxy listens: IP, port, ACLs, which backend to use
backend         # pool of servers: addresses, algorithm, health checks
listen          # shorthand combining a frontend + backend in one block (simpler configs)
```

A minimal config:

```haproxy
global
    log /dev/log local0
    maxconn 2000

defaults
    log     global
    mode    http
    timeout connect 5s
    timeout client  30s
    timeout server  30s

frontend templatehub_front
    bind *:8080
    default_backend templatehub_pool

backend templatehub_pool
    balance roundrobin
    option httpchk GET /
    server app1 127.0.0.1:3000 check
    server app2 127.0.0.1:3002 check
```

---

## Balancing Algorithms

| Algorithm | How it works | Best for |
|---|---|---|
| `roundrobin` | Each request goes to the next server in sequence | Stateless apps, equal-capacity backends |
| `leastconn` | Each request goes to the server with fewest active connections | Long-lived connections, unequal request durations |
| `source` | Client IP is hashed to always pick the same backend | Apps that store session state locally (not in a shared store) |
| `uri` | Request URI is hashed to always pick the same backend | Cache servers — keep the same resource on the same cache node |

`roundrobin` is the default and correct for stateless Next.js apps (session state is in the DB, not in-memory).

---

## Health Checks

```haproxy
server app1 127.0.0.1:3000 check inter 2s fall 3 rise 2
```

- `check` — enable health checks
- `inter 2s` — check every 2 seconds
- `fall 3` — mark DOWN after 3 consecutive failures
- `rise 2` — mark UP again after 2 consecutive successes

When a backend is marked DOWN, HAProxy stops sending traffic to it immediately. It keeps checking. When the backend recovers, it re-enters the pool. No manual intervention, no restart of HAProxy.

`option httpchk GET /` — HAProxy makes an actual HTTP GET request and expects a 2xx/3xx. More reliable than a TCP connection check (a port can accept connections before the app is ready).

---

## Stats Page

```haproxy
listen stats
    bind *:8404
    stats enable
    stats uri /stats
    stats refresh 5s
    stats auth admin:secret
```

Access at `http://100.97.172.9:8404/stats`. Shows:

- Each backend server: UP/DOWN status, current sessions, total requests, error rate, response time
- Frontend: total connections, request rate
- Real-time — refreshes every 5 seconds

The stats page is where you verify load is actually being distributed, spot a backend that's slow (high response time), and confirm health check recovery works.

---

## Port Layout in This Homelab

After M06 + M07:

```
Port 80   — Nginx       — routes .lab hostnames to backends
Port 8080 — HAProxy     — load balances across templatehub instances
Port 8404 — HAProxy     — stats page
Port 3000 — templatehub-1 container
Port 3002 — templatehub-2 container (second instance for M07 demo)
Port 3001 — admin-templatehub container
```

Nginx owns port 80 and is the public-facing router for `.lab` names. HAProxy sits behind it, receiving traffic forwarded from `lb.lab → 127.0.0.1:8080`. In a real deployment you'd put HAProxy first (it handles TLS termination better at scale), but for learning the concepts this is correct.

---

## Active/Active vs Active/Passive

**Active/active:** Both backends receive traffic simultaneously. Roundrobin, leastconn, and source are all active/active. Maximum throughput, any backend can go down and the other absorbs the load.

**Active/passive (backup):** One backend receives all traffic. The other only activates when the primary goes down.

```haproxy
server app1 127.0.0.1:3000 check
server app2 127.0.0.1:3002 check backup
```

Passive is for failover scenarios — a standby replica that shouldn't receive load until needed.

---

## Connection to M06

Nginx (M06) and HAProxy (M07) are not competing. They serve different routing concerns:

- Nginx routes by **hostname** → "which service?"
- HAProxy routes by **load** → "which instance of this service?"

In a layered setup: client → Nginx (`lb.lab`) → HAProxy (8080) → templatehub instance. Nginx handles the naming. HAProxy handles the distribution. Each layer does one thing.
