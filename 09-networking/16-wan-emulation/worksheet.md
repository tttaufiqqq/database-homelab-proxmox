# Module 16 — WAN Emulation with `tc` — Worksheet

## Concepts

**1. What is Linux Traffic Control (`tc`)? What are the three components of its architecture: qdisc, class, and filter?**

_Answer:_

**2. What is `netem`? What network impairments can it simulate?**

_Answer:_

**3. What is the difference between latency and jitter? Give a real-world example of a network that has low latency but high jitter.**

_Answer:_

**4. What is `HTB` (Hierarchical Token Bucket)? How does it enforce a bandwidth limit without simply dropping all excess packets?**

_Answer:_

**5. You add 200ms latency to a VM interface with `tc`. A user makes an HTTPS request that involves a TCP handshake + TLS handshake + HTTP request/response. How many round trips does this involve, and what is the total added latency?**

_Answer:_

**6. Why is simulating WAN conditions useful for a developer? What bugs or performance problems would only appear under real WAN conditions?**

_Answer:_

---

## Implementation Tasks

- [ ] Add 100ms latency to taufiq-app-server's outbound traffic: `tc qdisc add dev eth0 root netem delay 100ms`
- [ ] Verify: ping taufiq-db from app-server — RTT should increase by ~100ms
- [ ] Add jitter on top: `tc qdisc change dev eth0 root netem delay 100ms 20ms`
- [ ] Observe variable RTT in ping output
- [ ] Add 1% packet loss: `tc qdisc change dev eth0 root netem delay 100ms 20ms loss 1%`
- [ ] Run a file transfer between VMs with and without the rule — measure speed difference
- [ ] Add bandwidth limit (1 Mbit/s): `tc qdisc replace dev eth0 root tbf rate 1mbit burst 32kbit latency 400ms`
- [ ] Download something from the internet on app-server — verify it caps at ~1 Mbps
- [ ] Remove all tc rules: `tc qdisc del dev eth0 root`
- [ ] Confirm rules are gone and normal latency is restored

---

## Reflection

**TemplateHub is deployed in Malaysia and your homelab is local. After this module, how would you test how TemplateHub performs for a user in Europe (200ms RTT)?**

_Answer:_
