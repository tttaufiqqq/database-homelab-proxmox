# Module 08 — Ethernet Frames & MAC Tables — Worksheet

## Concepts

**1. What is the structure of an Ethernet II frame? Name each field and its size.**

_Answer:_

**2. A switch receives a frame with a destination MAC it has never seen before. What does it do, and what is this behavior called?**

_Answer:_

**3. What is a CAM table (MAC address table)? What happens when it fills up, and why is that a security concern?**

_Answer:_

**4. What is the difference between a hub, a switch, and a router in terms of which OSI layer they operate at and how they forward traffic?**

_Answer:_

**5. What is a broadcast domain? How do VLANs affect broadcast domains?**

_Answer:_

**6. A frame is sent to MAC address `FF:FF:FF:FF:FF:FF`. What happens on the network?**

_Answer:_

**7. What is the OUI portion of a MAC address? How many bytes is it, and what does it identify?**

_Answer:_

---

## Implementation Tasks

- [ ] On taufiq-app-server, run `tcpdump -e -i eth0` and capture raw frames — identify src MAC, dst MAC, EtherType in the output
- [ ] Run `ip link show` — record the MAC address of each interface
- [ ] On the Proxmox host, inspect the bridge MAC table: `bridge fdb show dev vmbr0`
- [ ] Generate traffic between VMs and watch the MAC table populate in real time
- [ ] Identify broadcast frames in tcpdump output (dst `ff:ff:ff:ff:ff:ff`)
- [ ] Look up a MAC address OUI: take the first 3 bytes of a NIC MAC and identify the vendor

---

## Reflection

**Everything above Layer 2 (IP, TCP, HTTP) depends on Ethernet frames working correctly. What breaks if MAC address resolution fails?**

_Answer:_
