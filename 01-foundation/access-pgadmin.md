# Connect pgAdmin to `db-server`

**Date:** 2026-05-02  
**Proxmox VM:** `db-server`  
**Guest hostname:** `taufiq-db`  
**Current implemented method:** Direct PostgreSQL over Tailscale  
**Alternative method:** SSH tunnel over Tailscale

---

## Overview

This document now covers both:

1. the current live setup using direct PostgreSQL access over Tailscale
2. the SSH tunnel method as a fallback or more restrictive admin path

Your current implemented setup is:

- PostgreSQL listens on `127.0.0.1` and `100.75.213.36`
- UFW allows `22/tcp` and `5432/tcp` on `tailscale0`
- `pg_hba.conf` allows remote Tailscale clients from `100.64.0.0/10`
- pgAdmin connects directly to `100.75.213.36:5432`
- `taufiq_dba` is used as the daily pgAdmin admin role

This means PostgreSQL is now operating as a real remote service inside your tailnet.

---

## Current implemented method — direct over Tailscale

### Connection details used in pgAdmin

Use these values in pgAdmin:

- `Host name/address`: `100.75.213.36`
- `Port`: `5432`
- `Maintenance database`: `postgres`
- `Username`: `taufiq_dba`
- `Password`: the PostgreSQL password for `taufiq_dba`

Do **not** enable SSH tunneling for this method.

### Server-side PostgreSQL listener

Current setting:

```conf
listen_addresses = 'localhost, 100.75.213.36'
```

Observed listening sockets:

```text
127.0.0.1:5432
100.75.213.36:5432
```

### Current `pg_hba.conf` remote access rule

Current Tailscale rule:

```conf
host    all    all    100.64.0.0/10    scram-sha-256
```

This allows Tailscale clients to attempt PostgreSQL login using password authentication.

### Current UFW rules

Current access policy:

```text
22/tcp on tailscale0       ALLOW IN    Anywhere
5432/tcp on tailscale0     ALLOW IN    Anywhere
```

This means:

- SSH is reachable only over Tailscale
- PostgreSQL is reachable only over Tailscale
- neither service is exposed on normal LAN or internet-facing interfaces

### Daily admin role

Current admin role used for pgAdmin:

```sql
ALTER ROLE taufiq_dba WITH SUPERUSER;
```

This keeps `postgres` available as the built-in recovery/admin account while `taufiq_dba` is used for day-to-day remote administration.

### Verification commands

On the server:

```bash
sudo ufw status verbose
ss -tlnp | grep 5432
sudo -u postgres psql -c "SHOW listen_addresses;"
sudo grep -v '^#' /etc/postgresql/16/main/pg_hba.conf | grep -v '^$'
```

From Windows:

```powershell
Test-NetConnection 100.75.213.36 -Port 5432
```

Expected result:

- `TcpTestSucceeded : True`

---

## Alternative method — SSH tunnel

### Step 1 — Open a tunnel from Windows

On your Windows machine, open PowerShell and run:

```powershell
ssh -L 15432:127.0.0.1:5432 taufiq@100.75.213.36
```

What this does:

- local port `15432` on your Windows PC
- forwards through SSH
- reaches `127.0.0.1:5432` on the Ubuntu server

Keep this PowerShell window open while using pgAdmin.

---

## Step 2 — Make sure your PostgreSQL user has a password

pgAdmin connects using normal PostgreSQL username/password authentication.

If you have only been using:

```bash
sudo -u postgres psql
```

then you may not have set a password yet for the `postgres` role, because that method uses local peer authentication.

On the server, set a password:

```bash
sudo -u postgres psql
```

```sql
ALTER USER postgres WITH PASSWORD 'StrongPasswordHere';
```

You can also create a separate admin user instead of using `postgres` directly, which is a better long-term habit.

Example:

```sql
CREATE ROLE taufiq_dba WITH LOGIN PASSWORD 'StrongPasswordHere';
GRANT pg_read_all_settings TO taufiq_dba;
GRANT pg_read_all_stats TO taufiq_dba;
```

If you want full administrative capability, decide that deliberately rather than automatically using superuser for everything.

---

## Step 3 — Add the server in pgAdmin

Open pgAdmin on your Windows machine and create a new server.

### General tab

- `Name`: `db-server`

### Connection tab

- `Host name/address`: `127.0.0.1`
- `Port`: `15432`
- `Maintenance database`: `postgres`
- `Username`: `postgres` or your chosen PostgreSQL login role
- `Password`: the password you set above

Then save the connection.

If the SSH tunnel is active, pgAdmin should connect successfully.

---

## How to verify the tunnel works

Before opening pgAdmin, you can test connectivity from Windows:

```powershell
Test-NetConnection 127.0.0.1 -Port 15432
```

Expected result:

- `TcpTestSucceeded : True`

If it says `False`, either:

- the SSH tunnel is not running
- the SSH session closed
- PostgreSQL is not listening on `127.0.0.1:5432` on the server

---

## Troubleshooting

### Problem: pgAdmin says connection refused

Check:

- the SSH tunnel PowerShell window is still open
- the SSH command used `15432:127.0.0.1:5432`
- PostgreSQL is running on the server

On the server:

```bash
sudo systemctl status postgresql
ss -tlnp | grep 5432
```

You should see PostgreSQL listening on `127.0.0.1:5432`.

### Problem: password authentication failed

This usually means:

- wrong PostgreSQL username
- wrong password
- the role does not have `LOGIN`

Check on the server:

```sql
SELECT rolname, rolcanlogin
FROM pg_roles
WHERE rolname IN ('postgres', 'taufiq_dba');
```

### Problem: SSH works, pgAdmin still cannot connect

Confirm the tunnel locally:

```powershell
Test-NetConnection 127.0.0.1 -Port 15432
```

If that fails, the issue is the tunnel.

If it succeeds, the issue is likely PostgreSQL auth or the pgAdmin connection settings.

---

## Direct connection over Tailscale

You can also make PostgreSQL listen on the server's Tailscale IP and connect directly from pgAdmin without SSH tunneling.

Use this when you want PostgreSQL to behave like a normal remote database service inside your tailnet.

This widens exposure compared with the SSH tunnel method, so keep it limited to Tailscale.

### What changes

You need all three layers:

1. PostgreSQL must listen on the Tailscale IP
2. `pg_hba.conf` must allow Tailscale clients
3. the firewall must allow `5432/tcp` on `tailscale0`

### Step 1 — Update PostgreSQL listener

Edit:

```bash
sudo nano /etc/postgresql/16/main/postgresql.conf
```

Set:

```conf
listen_addresses = '127.0.0.1,100.75.213.36'
```

This keeps local access working and also exposes PostgreSQL on the Tailscale interface.

### Step 2 — Allow Tailscale clients in `pg_hba.conf`

Edit:

```bash
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

Add this line near the other host rules:

```conf
host    all    all    100.64.0.0/10    scram-sha-256
```

That allows any Tailscale client to authenticate with a username and password.

If you want this narrower later, replace the network with a single client IP such as:

```conf
host    all    all    100.68.235.121/32    scram-sha-256
```

### Step 3 — Open PostgreSQL only on Tailscale

Run:

```bash
sudo ufw allow in on tailscale0 proto tcp to any port 5432
sudo ufw status verbose
```

You should end up with a rule that allows `5432/tcp` on `tailscale0` while keeping other interfaces blocked by default.

### Step 4 — Restart PostgreSQL

Run:

```bash
sudo systemctl restart postgresql
sudo systemctl status postgresql
ss -tlnp | grep 5432
```

Expected result:

- PostgreSQL is running
- PostgreSQL listens on `127.0.0.1:5432`
- PostgreSQL also listens on `100.75.213.36:5432`

### Step 5 — Connect from pgAdmin directly

In pgAdmin, create or edit a server with:

- `Host name/address`: `100.75.213.36`
- `Port`: `5432`
- `Maintenance database`: `postgres`
- `Username`: your PostgreSQL role
- `Password`: that role's PostgreSQL password

Do **not** enable the SSH Tunnel tab for this method.

### Step 6 — Verify from Windows

Before opening pgAdmin, you can test reachability:

```powershell
Test-NetConnection 100.75.213.36 -Port 5432
```

Expected result:

- `TcpTestSucceeded : True`

### Security note

This is still much safer than exposing PostgreSQL on the normal LAN or the internet, because access is constrained to Tailscale. But it is less strict than the SSH tunnel method because the database port itself is now reachable to your tailnet.

---

## Recommended practice

For this homelab, use:

- direct PostgreSQL over Tailscale when you want the database to behave like a normal remote service
- SSH tunneling when you want a more restrictive admin path with less direct exposure

This keeps your setup aligned with the hardening work already completed.
