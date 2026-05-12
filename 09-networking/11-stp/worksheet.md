# Module 11 — STP & Layer 2 Loop Prevention — Worksheet

> **Tool:** Cisco Packet Tracer — this module requires a multi-switch topology that cannot be replicated on a single Proxmox host.

## Concepts

**1. What is a broadcast storm? Describe step by step how one forms when three switches are connected in a triangle with no loop prevention.**

_Answer:_

**2. How does STP elect a root bridge? What is the Bridge ID, and which switch wins when all priorities are equal?**

_Answer:_

**3. Name the five STP port states and describe what each one does with frames.**

_Answer:_

**4. What is the difference between STP (802.1D) and RSTP (802.1w)? What improvement does RSTP make to convergence time?**

_Answer:_

**5. What is PVST+ (Per-VLAN Spanning Tree)? Why would you want different STP topologies per VLAN?**

_Answer:_

**6. What is a PortFast port? When should it be used, and what risk does it introduce?**

_Answer:_

---

## Implementation Tasks (Packet Tracer)

- [ ] Create a topology: 3 switches connected in a triangle (Switch1–Switch2–Switch3–Switch1)
- [ ] Add one PC to each switch
- [ ] Do NOT enable STP — observe the broadcast storm (watch the simulation mode)
- [ ] Enable STP on all switches
- [ ] Identify which switch becomes the root bridge and why
- [ ] Identify which port is in Blocking state and why
- [ ] Change the priority of Switch2 to force it to become root bridge
- [ ] Enable PortFast on the PC-facing ports
- [ ] Shut down the link between root bridge and another switch — observe convergence time
- [ ] Repeat with RSTP — compare convergence time

---

## Reflection

**Linux bridges support STP (set `stp_state 1` in `/etc/network/interfaces`). When would you enable STP on a Proxmox bridge, and when is it unnecessary?**

_Answer:_
