# Module 21 — Network Security — Worksheet

## Concepts

**1. What is fail2ban? What does it monitor, and what action does it take when it detects an attack?**

_Answer:_

**2. What is the difference between an IDS (Intrusion Detection System) and an IPS (Intrusion Prevention System)?**

_Answer:_

**3. What is the difference between signature-based detection and anomaly-based detection? Which one would catch a novel zero-day attack?**

_Answer:_

**4. nmap has several scan types. What is the difference between a SYN scan (`-sS`), a connect scan (`-sT`), and a UDP scan (`-sU`)? Which is stealthier?**

_Answer:_

**5. What is port knocking? Describe how it works and what it protects against.**

_Answer:_

**6. Your Proxmox host has SSH open to the internet (or at least to Tailscale). What are three concrete hardening steps beyond just a strong password?**

_Answer:_

---

## Implementation Tasks

**fail2ban**
- [ ] Install fail2ban on taufiq-app-server: `sudo apt install fail2ban`
- [ ] Configure an SSH jail in `/etc/fail2ban/jail.local`
- [ ] Set `maxretry = 3`, `bantime = 1h`, `findtime = 10m`
- [ ] Simulate failed SSH logins from taufiq-db: `ssh wronguser@10.0.20.102` × 3
- [ ] Verify the ban: `sudo fail2ban-client status sshd`
- [ ] Unban the IP: `sudo fail2ban-client set sshd unbanip <ip>`

**nmap (own network only)**
- [ ] Scan taufiq-app-server from taufiq-db: `nmap -sS 10.0.20.102`
- [ ] Identify open ports — compare to what you know is running
- [ ] Run a service version scan: `nmap -sV 10.0.20.102`
- [ ] Run OS detection: `nmap -O 10.0.20.102`
- [ ] Scan the Proxmox host from inside the lab: `nmap -sS 10.0.20.1`

**Suricata (if not done in M20)**
- [ ] Install Suricata on taufiq-app-server: `sudo apt install suricata`
- [ ] Update rules: `sudo suricata-update`
- [ ] Start Suricata in IDS mode on eth0
- [ ] Trigger a test alert: `curl http://testmynids.org/uid/index.html`
- [ ] Check alerts: `sudo tail -f /var/log/suricata/fast.log`

---

## Reflection

**After completing the full networking curriculum (M08–M21), what is the single most important concept you carry forward — the one that explains the most about how networks actually work?**

_Answer:_
