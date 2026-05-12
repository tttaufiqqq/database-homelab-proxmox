# Module 06 — Reverse Proxy (Nginx) — Worksheet

## Concepts

**1. What is the difference between a reverse proxy and a forward proxy?**

_Answer:_

**2. A client sends a request to `templatehub.lab`. Nginx receives it and forwards it to `127.0.0.1:3000`. What does the backend application see as the client IP, and how can you fix this?**

_Answer:_

**3. What is an upstream block in Nginx? Why define one instead of writing the backend address directly in `proxy_pass`?**

_Answer:_

**4. Why would you terminate SSL at the reverse proxy layer rather than at each individual backend service?**

_Answer:_

**5. Nginx has `worker_processes` and `worker_connections`. What do they control, and what is the maximum number of concurrent connections per setting?**

_Answer:_

**6. What does `proxy_set_header Host $host` do, and why does it matter?**

_Answer:_

---

## Implementation Tasks

- [ ] Install Nginx on taufiq-app-server
- [ ] Verify Nginx is running and serving the default page on port 80
- [ ] Disable the default site (`/etc/nginx/sites-enabled/default`)
- [ ] Create server block: `templatehub.lab` → upstream `127.0.0.1:3000`
- [ ] Create server block: `admin.lab` → upstream `127.0.0.1:3001`
- [ ] Create server block: `vault.lab` → upstream `127.0.0.1:8200` (placeholder — 502 expected)
- [ ] Create server block: `grafana.lab` → upstream `127.0.0.1:3030` (placeholder — 502 expected)
- [ ] Test Nginx config: `nginx -t`
- [ ] Reload Nginx: `systemctl reload nginx`
- [ ] Add host entries on Windows machine pointing `.lab` names to Tailscale IP
- [ ] Open browser → `http://templatehub.lab` — verify TemplateHub loads
- [ ] Open browser → `http://admin.lab` — verify Admin loads
- [ ] Check Nginx access log: confirm requests are proxied correctly
- [ ] (Optional) Add self-signed TLS cert and redirect HTTP → HTTPS for `.lab` names

---

## Reflection

**What is this module teaching you beyond "Nginx config syntax"?**

_Answer:_
