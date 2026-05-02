# db-server / taufiq-db Server Hardening Documentation

**Date:** 2026-05-02  
**Proxmox VM:** `db-server` — guest hostname `taufiq-db` — Ubuntu 24.04.4 LTS  
**Server Local IP:** `192.168.0.20`  
**Server Tailscale IP:** `100.75.213.36`  
**Working PC:** MSI Windows (`100.68.235.121`)

---

## Overview

This document covers the steps taken to secure SSH access on the `taufiq-db` Ubuntu server, replacing password-based login with SSH key authentication and restricting access through a Tailscale VPN tunnel.

---

## 1. Generate SSH Key Pair on Windows

On the Windows PC, open PowerShell and generate an Ed25519 key pair:

```powershell
ssh-keygen -t ed25519 -C "taufiq-db access"
```

This creates two files:
- `C:\Users\taufi\.ssh\id_ed25519` — private key (never share)
- `C:\Users\taufi\.ssh\id_ed25519.pub` — public key (copied to server)

---

## 2. Copy Public Key to Server

While password login was still active, SSH into the server and add the public key:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys   # paste contents of id_ed25519.pub here
chmod 600 ~/.ssh/authorized_keys
```

---

## 3. Disable SSH Password Authentication

### 3a. Main SSH config

Edited `/etc/ssh/sshd_config`:

```
PasswordAuthentication no
PubkeyAuthentication yes
ChallengeResponseAuthentication no
UsePAM no
PermitRootLogin prohibit-password
```

### 3b. Cloud-init override (important)

Ubuntu cloud images include an override file that re-enables password auth. This was found and fixed:

```bash
sudo grep -r "PasswordAuthentication" /etc/ssh/sshd_config.d/
# Output: /etc/ssh/sshd_config.d/50-cloud-init.conf:PasswordAuthentication yes
```

Edited `/etc/ssh/sshd_config.d/50-cloud-init.conf`:
```
PasswordAuthentication no
```

### 3c. Validate and restart SSH

```bash
sudo sshd -t               # validate config, no output = no errors
sudo systemctl restart ssh
```

### 3d. Verified password login is blocked

```bash
ssh -o PreferredAuthentications=password taufiq@192.168.0.20
# Result: Permission denied (publickey) ✅
```

---

## 4. Install Tailscale

Installed Tailscale on the server using the official install script:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Authenticated via browser URL using `taufiq33992@gmail.com`.

### Tailscale network status

```
100.75.213.36   taufiq-db   linux    ✅ online
100.68.235.121  msi         windows  ✅ online
100.91.66.124   iphone-11   iOS      offline
```

---

## 5. Restrict SSH to Tailscale Interface Only

Configured UFW to only allow SSH connections coming through the Tailscale interface (`tailscale0`), blocking direct access via local IP:

```bash
sudo ufw allow in on tailscale0 to any port 22
sudo ufw enable
```

### UFW status

```
Status: active

To                         Action      From
--                         ------      ----
22 on tailscale0           ALLOW       Anywhere
22 (v6) on tailscale0      ALLOW       Anywhere (v6)
```

---

## 6. Final Connection Method

SSH into the server from anywhere using the Tailscale IP:

```powershell
ssh taufiq@100.75.213.36
```

Requirements:
- Tailscale must be running on the client device
- Client must be logged into the same Tailscale account (`taufiq33992@gmail.com`)

---

## Security Summary

| Layer | Detail | Status |
|---|---|---|
| SSH key authentication | Ed25519 key pair | ✅ Enabled |
| SSH password login | Disabled in sshd_config + cloud-init override | ✅ Disabled |
| Tailscale VPN | Server joined tailnet | ✅ Connected |
| UFW firewall | SSH only via `tailscale0` interface | ✅ Active |

---

## Recovery (If Locked Out)

If SSH access is ever lost:
1. Open the **Proxmox web UI**
2. Navigate to the VM → **Console** tab
3. Log in directly and re-add a public key to `~/.ssh/authorized_keys`

---

## Key File Locations

| File | Location |
|---|---|
| Private key (Windows) | `C:\Users\taufi\.ssh\id_ed25519` |
| Public key (Windows) | `C:\Users\taufi\.ssh\id_ed25519.pub` |
| Authorized keys (server) | `/home/taufiq/.ssh/authorized_keys` |
| SSH config (server) | `/etc/ssh/sshd_config` |
| Cloud-init override (server) | `/etc/ssh/sshd_config.d/50-cloud-init.conf` |
