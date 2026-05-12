# Module 17 — Tunneling: GRE & IPIP — Worksheet

## Concepts

**1. What is encapsulation in the context of network tunneling? Draw the packet structure of an IPIP packet (outer header + inner header + payload).**

_Answer:_

**2. What is the difference between IPIP and GRE tunnels? What can GRE carry that IPIP cannot?**

_Answer:_

**3. A GRE tunnel adds overhead to each packet. How many bytes does the GRE header add, and why does this matter for MTU?**

_Answer:_

**4. What is MTU fragmentation? If the path MTU is 1500 bytes and you add a 24-byte GRE header, what is the maximum payload size? What happens if you try to send a larger packet?**

_Answer:_

**5. Tunnels create a virtual point-to-point link. What routing changes are needed on both endpoints for traffic to flow through the tunnel instead of the direct path?**

_Answer:_

**6. What is the difference between a tunnel and a VPN? Is a GRE tunnel encrypted?**

_Answer:_

---

## Implementation Tasks

- [ ] On taufiq-app-server, create an IPIP tunnel to taufiq-db:
  ```bash
  sudo ip tunnel add ipip0 mode ipip remote 10.0.30.20 local 10.0.20.102
  sudo ip link set ipip0 up
  sudo ip addr add 192.168.100.1/30 dev ipip0
  ```
- [ ] On taufiq-db, create the other end:
  ```bash
  sudo ip tunnel add ipip0 mode ipip remote 10.0.20.102 local 10.0.30.20
  sudo ip link set ipip0 up
  sudo ip addr add 192.168.100.2/30 dev ipip0
  ```
- [ ] Ping through the tunnel: from app-server ping `192.168.100.2`
- [ ] On app-server, run `tcpdump -i eth0 proto 4` — capture the IPIP packets
- [ ] Observe: outer IP header uses real IPs (10.0.x.x), inner header uses tunnel IPs (192.168.100.x)
- [ ] Check the tunnel MTU: `ip link show ipip0` — compare to eth0 MTU
- [ ] Tear down: `sudo ip tunnel del ipip0` on both VMs
- [ ] Repeat with a GRE tunnel (`mode gre`) and observe the additional GRE header in tcpdump

---

## Reflection

**This module is the foundation for M18 (WireGuard). WireGuard is also a tunnel — but what critical property does WireGuard add that GRE and IPIP lack?**

_Answer:_
