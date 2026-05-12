# Module 14 — NAT Deep Dive — Worksheet

## Concepts

**1. What is the difference between SNAT, DNAT, and masquerade? Give a concrete example of each in this homelab.**

_Answer:_

**2. Describe the four NAT types: Full Cone, Address-Restricted Cone, Port-Restricted Cone, and Symmetric. Which one does your home router most likely use?**

_Answer:_

**3. Why does Symmetric NAT break peer-to-peer connections (gaming, WebRTC, BitTorrent)? How do services like Tailscale and TURN servers work around this?**

_Answer:_

**4. What is CGNAT (Carrier-Grade NAT)? How do you check if your ISP is using it, and what does it mean for hosting a server at home?**

_Answer:_

**5. What is hairpin NAT (NAT loopback)? Why would you need it in this homelab?**

_Answer:_

**6. In M04 you added a masquerade rule in nftables. Trace the full journey of a packet from taufiq-app-server (10.0.20.102) to google.com — what IP address transformations happen at each hop?**

_Answer:_

---

## Implementation Tasks

- [ ] Inspect the current nftables NAT rules on the Proxmox host: `nft list ruleset`
- [ ] Identify the masquerade rule — which chain and table is it in?
- [ ] Add a DNAT rule: forward TCP port 8888 on the Proxmox host to taufiq-app-server:3000
- [ ] Test the DNAT rule from the Windows machine via the Proxmox host IP
- [ ] Check if your ISP is using CGNAT: `curl ifconfig.me` vs `ip route get 1.1.1.1` — if the WAN IP is in `100.64.0.0/10`, you are behind CGNAT
- [ ] Run `traceroute google.com` from taufiq-app-server — identify where NAT occurs in the path
- [ ] Delete the test DNAT rule after the exercise

---

## Reflection

**You currently access TemplateHub externally via Cloudflare Tunnel — not a port forward. Why is a Cloudflare Tunnel immune to CGNAT where a direct port forward would fail?**

_Answer:_
