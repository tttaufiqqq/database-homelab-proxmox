# Module 09 — ARP Deep Dive — Worksheet

## Concepts

**1. Walk through the full ARP request/reply process when host A (10.0.20.102) wants to send a packet to host B (10.0.30.20) on a different subnet. What role does the default gateway play?**

_Answer:_

**2. What is the ARP cache? What happens when an entry expires?**

_Answer:_

**3. What is a gratuitous ARP? Name two legitimate uses for it.**

_Answer:_

**4. What is proxy ARP? When would a router answer an ARP request on behalf of another host?**

_Answer:_

**5. Explain ARP poisoning. How does it work, and what attack does it enable?**

_Answer:_

**6. ARP only works within a broadcast domain. Why? What mechanism handles address resolution across subnets?**

_Answer:_

---

## Implementation Tasks

- [ ] On taufiq-app-server, inspect the ARP cache: `ip neigh show`
- [ ] Flush the ARP cache: `sudo ip neigh flush all`
- [ ] Ping taufiq-db (10.0.30.20) and immediately watch ARP: `tcpdump -i eth0 arp`
- [ ] Observe the ARP request (broadcast) and ARP reply (unicast) in tcpdump output
- [ ] After the ping, check ARP cache again — verify the entry appeared
- [ ] On Proxmox host, run `tcpdump -i vmbr0.20 arp` and watch the same traffic from the bridge perspective
- [ ] Send a gratuitous ARP manually: `arping -U -I eth0 10.0.20.102`

---

## Reflection

**ARP has no authentication — any host can respond to any ARP request. What does this tell you about the security model of Layer 2 networks, and how does VLAN segmentation help?**

_Answer:_
