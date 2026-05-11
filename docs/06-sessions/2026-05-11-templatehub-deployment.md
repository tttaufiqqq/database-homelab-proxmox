# Lab Session — 2026-05-11

**Topic:** TemplateHub + admin-templatehub deployment to homelab app-server
**VMs involved:** `taufiq-app-server` (100.97.172.9), `taufiq-db` (100.75.213.36)

---

## Deployment Architecture

```
Dev PC
  └─ git push
        │
        ▼
  GitHub Actions
  └─ docker build + push
       ├─ ghcr.io/tttaufiqqq/templatehub:latest
       └─ ghcr.io/tttaufiqqq/admin-templatehub:latest
        │
        │  Watchtower polls every 300s
        ▼
  taufiq-app-server  100.97.172.9
  ├─ templatehub        :3000 ──► templatehub.tttaufiqqq.com
  ├─ admin-templatehub  :3001 ──► admin.tttaufiqqq.com  ─┐
  └─ watchtower                                           │
        │                                    Cloudflare Tunnel (HTTPS)
        │  Tailscale                                      │
        ▼                                                 ▼
  taufiq-db  100.75.213.36                          Internet
  └─ PostgreSQL 16  :5432
       └─ database: templatehub (shared by both apps)
```

---

## What We Did Today

### 1. Dockerized both Next.js apps

Added to both `templatehub` and `admin-templatehub` repos:

- `Dockerfile` — multi-stage build (builder + runner), `node:20-alpine`, standalone output
- `.dockerignore` — excludes `node_modules`, `.next`, `.git`, `.env*`
- `.github/workflows/deploy.yml` — builds and pushes to ghcr.io on push to main/master

Key decisions made:
- `output: "standalone"` added to `next.config.ts` on both repos — produces a self-contained build with no node_modules in the runner image
- Prisma generates during build (`npx prisma generate`) — needed before `next build` since Prisma client is imported at module level
- `DATABASE_URL` passed as a dummy build arg — Next.js statically analyzes API routes at build time, which imports the Prisma client, which validates that `DATABASE_URL` is set. A placeholder value satisfies the check; the real value is injected at runtime via env file.
- `NEXT_PUBLIC_APP_URL` passed as a build arg from GitHub Actions secret — baked into the JS bundle at build time, so must be known before `next build`
- Layer cache order: `COPY package.json → npm ci → COPY prisma → prisma generate → COPY source → build` — ensures package installs are only re-run when dependencies change, not when source or schema changes

### 2. Set up GitHub Actions CI/CD

- `permissions: packages: write` required explicitly — GITHUB_TOKEN doesn't have this by default
- templatehub repo uses `master` branch (not `main`) — workflow trigger updated accordingly
- Images pushed to `ghcr.io/tttaufiqqq/templatehub:latest` and `ghcr.io/tttaufiqqq/admin-templatehub:latest`

```mermaid
graph LR
    Push[git push] --> GA[GitHub Actions]
    GA --> Build[docker build\nnode:20-alpine\nstandalone output]
    Build --> Reg[ghcr.io\ncontainer registry]
    WT[Watchtower\nevery 300s] -->|poll| Reg
    Reg -->|new digest| WT
    WT -->|pull + restart| App[taufiq-app-server]
```

### 3. Configured app-server

```bash
# Auth Docker to ghcr.io (classic PAT, read:packages scope only)
echo PAT | docker login ghcr.io -u tttaufiqqq --password-stdin

# Persistent volume for protected downloads (survives container replacement)
docker volume create templatehub_storage

# Watchtower — auto-redeploys containers when new image available
docker run -d \
  --name watchtower \
  --restart unless-stopped \
  -e DOCKER_API_VERSION=1.40 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /home/taufiq/.docker/config.json:/config.json \
  containrrr/watchtower \
  --interval 300
```

**Watchtower fix:** Docker 29.x on the server requires API version ≥ 1.40. The Watchtower image defaults to client API 1.25, which was rejected. Fixed by passing `DOCKER_API_VERSION=1.40`.

### 4. Updated Cloudflare tunnel

Added second ingress to `/etc/cloudflared/config.yml`:

```yaml
tunnel: 98ad1468-15f9-4127-b878-02a19196d496
credentials-file: /etc/cloudflared/98ad1468-15f9-4127-b878-02a19196d496.json

ingress:
  - hostname: templatehub.tttaufiqqq.com
    service: http://localhost:3000
  - hostname: admin.tttaufiqqq.com
    service: http://localhost:3001
  - service: http_status:404
```

```bash
cloudflared tunnel route dns templatehub admin.tttaufiqqq.com
sudo systemctl restart cloudflared
```

### 5. Deployed containers

Env files created at `/home/taufiq/.env.templatehub` and `/home/taufiq/.env.admin-templatehub`.

```bash
docker run -d \
  --name templatehub \
  --restart unless-stopped \
  -p 3000:3000 \
  -v templatehub_storage:/app/storage/product-assets \
  --env-file /home/taufiq/.env.templatehub \
  ghcr.io/tttaufiqqq/templatehub:latest

docker run -d \
  --name admin-templatehub \
  --restart unless-stopped \
  -p 3001:3000 \
  --env-file /home/taufiq/.env.admin-templatehub \
  ghcr.io/tttaufiqqq/admin-templatehub:latest
```

### 6. Applied migrations

Run from dev PC (container's standalone image does not include Prisma CLI):

```bash
DATABASE_URL="postgresql://taufiq_dba:PASSWORD@100.75.213.36:5432/templatehub?schema=public" npm run db:deploy
```

---

## Outcome

Both apps live and serving traffic:
- `templatehub.tttaufiqqq.com` — storefront loading, products listed ✅
- `admin.tttaufiqqq.com/admin/login` — admin login page loading ✅
- Watchtower running — any push to main/master triggers auto-redeploy within 5 minutes ✅

---

## What Remains

- Add product images to templatehub `public/` folder and push (triggers Watchtower redeploy)
- Create a least-privilege PostgreSQL role for TemplateHub (currently using `taufiq_dba`)

---

## Next Phase

**Phase 1 — PostgreSQL Replication**

Pre-work: resize both VMs from 2 GiB → 1 GiB (actual usage ~380 MB each). Then:
1. Create `taufiq-db-replica` VM (1 GiB RAM, 1 core, 20 GiB, Ubuntu 24.04)
2. Install Tailscale on replica
3. Configure streaming replication from `taufiq-db`
4. Verify WAL syncing
5. Test failover promotion

See `docs/01-foundation/homelab-architecture.md` for full planned VM roadmap.
