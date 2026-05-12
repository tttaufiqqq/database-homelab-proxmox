# Module 20 — pfSense as Router & Firewall — Worksheet

## Concepts

**1. What is the difference between a stateful firewall and a stateless packet filter? Which is pfSense, and why does it matter?**

_Answer:_

**2. In M04 you implemented inter-VLAN routing using Linux sub-interfaces and nftables on the Proxmox host. What does pfSense give you that this setup does not?**

_Answer:_

**3. pfSense has WAN and LAN interface roles. In this homelab, what would map to WAN and what would map to LAN?**

_Answer:_

**4. What is the pfSense default firewall rule on the LAN interface, and why is it considered a security risk in a segmented network?**

_Answer:_

**5. pfSense supports packages — Suricata, pfBlockerNG, HAProxy. What does Suricata do when installed on pfSense compared to running it standalone on a Linux VM?**

_Answer:_

**6. What is the difference between floating rules and interface rules in pfSense? When would you use a floating rule?**

_Answer:_

---

## Implementation Tasks

- [ ] Create pfSense VM in Proxmox: FreeBSD, 1 GiB RAM, 8 GiB disk, 2 NICs (WAN: vmbr0, LAN: vmbr0 VLAN-aware)
- [ ] Boot and complete pfSense initial setup wizard
- [ ] Assign WAN interface (upstream to home router or Proxmox bridge)
- [ ] Assign LAN interface (internal VLAN bridge)
- [ ] Access pfSense WebGUI from dev machine
- [ ] Configure inter-VLAN routing: add VLAN 20 and VLAN 30 as OPT interfaces
- [ ] Add firewall rule: VLAN 20 → VLAN 30: allow TCP port 5432 only
- [ ] Add firewall rule: VLAN 30 → VLAN 20: deny all
- [ ] Verify app-server can reach DB on 5432
- [ ] Verify app-server cannot reach DB on port 22
- [ ] Remove the Linux nftables routing rules from M04 (pfSense now handles this)
- [ ] Install Suricata package — enable on LAN interface
- [ ] Trigger a test alert and observe in Suricata logs

---

## Reflection

**After this module you have pfSense doing what nftables was doing in M04. What did you gain? What did you lose (if anything)? Which approach is better for this homelab long-term?**

_Answer:_
