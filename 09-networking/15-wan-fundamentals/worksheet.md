# Module 15 — WAN Fundamentals & ISP Architecture — Worksheet

## Concepts

**1. What is an Autonomous System (AS)? What is an ASN, and who assigns them?**

_Answer:_

**2. What is the difference between BGP peering (settlement-free) and BGP transit (paid)? Which one would a small ISP use to reach a large ISP like Google?**

_Answer:_

**3. What is an Internet Exchange Point (IXP)? Why do ISPs prefer to exchange traffic at an IXP rather than through a transit provider?**

_Answer:_

**4. A `traceroute` to a server in the US from Malaysia shows 12 hops with RTTs of 8ms, 9ms, 180ms, 178ms, 181ms. What does the sudden jump to 180ms indicate?**

_Answer:_

**5. What is the difference between a residential broadband connection (ADSL/fiber) and a leased line? Why do businesses pay significantly more for leased lines?**

_Answer:_

**6. Why is the internet resilient — if one major backbone router fails, most traffic still reaches its destination? What routing mechanism makes this possible?**

_Answer:_

---

## Implementation Tasks

- [ ] Run `traceroute google.com` from taufiq-app-server — record every hop, note where RTT jumps significantly
- [ ] Run `traceroute 1.1.1.1` and `traceroute 8.8.8.8` — compare paths
- [ ] Look up your home IP's ASN: `curl https://ipinfo.io` — identify your ISP's AS number
- [ ] Look up a hop IP from traceroute on `https://bgp.he.net` — find which AS it belongs to
- [ ] Check if you are behind CGNAT: compare `curl ifconfig.me` with your router's WAN IP
- [ ] Run `mtr google.com` from taufiq-app-server — observe packet loss and RTT per hop in real time
- [ ] Identify the approximate physical location of each traceroute hop using the RTT (every 100ms RTT ≈ 10,000 km of fibre)

---

## Reflection

**Your homelab traffic goes: VM → Proxmox host (NAT) → home router → ISP → internet. At which point does the traffic leave your AS and enter the ISP's AS? How would you confirm this from the traceroute output?**

_Answer:_
