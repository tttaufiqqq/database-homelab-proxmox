# Module 10 — DHCP Deep Dive — Worksheet

## Concepts

**1. Walk through the DORA process (Discover, Offer, Request, Acknowledge). What is the destination IP of the Discover message, and why?**

_Answer:_

**2. What are DHCP options? Name 4 commonly used ones and what they configure on the client.**

_Answer:_

**3. What is a DHCP lease time? What happens when the lease reaches 50% of its duration?**

_Answer:_

**4. What is a DHCP static lease (reservation)? How does the server identify which client to give a specific IP to?**

_Answer:_

**5. What is a DHCP relay agent? Why is it needed, and where does it run?**

_Answer:_

**6. Your VMs currently get IPs from the home router via the Proxmox bridge. What would change if you ran your own DHCP server inside the homelab?**

_Answer:_

---

## Implementation Tasks

- [ ] Install `dnsmasq` on taufiq-db: `sudo apt install dnsmasq`
- [ ] Configure a DHCP range for the VLAN 20 subnet (10.0.20.100–10.0.20.200)
- [ ] Add a static lease for taufiq-app-server by MAC address → 10.0.20.102
- [ ] Set DHCP option 6 (DNS) to point to the bind9 server from M05
- [ ] Set DHCP option 3 (gateway) to 10.0.20.1 (Proxmox host sub-interface)
- [ ] Capture a DORA exchange with tcpdump: `tcpdump -i eth0 port 67 or port 68`
- [ ] Renew the lease from taufiq-app-server: `sudo dhclient -r && sudo dhclient eth0`
- [ ] Verify the client received the correct IP, gateway, and DNS

---

## Reflection

**DHCP uses UDP broadcasts. After setting up VLANs (M03), a DHCP server on VLAN 30 cannot serve clients on VLAN 20 without a relay agent. Why, and where would you place the relay?**

_Answer:_
