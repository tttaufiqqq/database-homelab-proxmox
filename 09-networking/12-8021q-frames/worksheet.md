# Module 12 — 802.1Q Frame-Level Deep Dive — Worksheet

## Concepts

**1. Draw the structure of an 802.1Q-tagged Ethernet frame. What 4-byte tag is inserted, and between which original fields?**

_Answer:_

**2. The 4-byte 802.1Q tag contains four fields. Name them, their sizes, and what each one represents.**

_Answer:_

**3. What is the native VLAN on a trunk port? What happens to frames sent on the native VLAN — are they tagged or untagged?**

_Answer:_

**4. What is double tagging (QinQ / 802.1ad)? What problem does it solve, and what security risk does single-layer VLAN tagging create that it exploits?**

_Answer:_

**5. In M03 you configured VLAN-aware bridges in Proxmox. At what point does the VLAN tag get added and removed — on the VM, on the bridge, or on the Proxmox host interface?**

_Answer:_

**6. What EtherType value identifies an 802.1Q-tagged frame? What EtherType value identifies an IPv4 frame?**

_Answer:_

---

## Implementation Tasks

- [ ] On Proxmox host, capture tagged frames on the trunk interface: `tcpdump -i vmbr0 -e -v vlan`
- [ ] Generate traffic from taufiq-app-server to taufiq-db and observe VLAN tags in tcpdump output
- [ ] Confirm VLAN ID 20 appears on app-server traffic and VLAN ID 30 on db traffic
- [ ] On taufiq-app-server, capture traffic on the sub-interface: `tcpdump -i eth0.20` — note frames here are untagged (tag stripped by the kernel)
- [ ] Compare the same frame as seen on `vmbr0` (tagged) vs `eth0.20` (untagged)
- [ ] Identify the EtherType field in a raw tcpdump capture (`-xx` flag shows hex)

---

## Reflection

**In M03 you experienced VLANs as a config task. Now you've seen the actual 4-byte tag in the frame. How does this change your mental model of what the Proxmox bridge is doing when it "assigns a VLAN" to a VM?**

_Answer:_
