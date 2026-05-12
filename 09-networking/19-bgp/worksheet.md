# Module 19 — BGP with FRRouting — Worksheet

## Concepts

**1. What is BGP (Border Gateway Protocol)? Why is it called a "path vector" protocol rather than a distance-vector or link-state protocol?**

_Answer:_

**2. What is the difference between eBGP (external BGP) and iBGP (internal BGP)?**

_Answer:_

**3. BGP selects the best path using a list of attributes. Name the first four attributes BGP evaluates in order, and what each one means.**

_Answer:_

**4. What is a BGP prefix? When an AS advertises `10.0.20.0/24` to its peers, what is it telling them?**

_Answer:_

**5. What is AS path prepending? Why would you prepend your own ASN multiple times to a route you advertise?**

_Answer:_

**6. What is FRRouting (FRR)? What is its relationship to Quagga, and what routing protocols does it support?**

_Answer:_

---

## Implementation Tasks

- [ ] Install FRRouting on both VMs:
  ```bash
  sudo apt install frr frr-pythontools
  ```
- [ ] Enable BGP daemon: edit `/etc/frr/daemons` → set `bgpd=yes`
- [ ] Restart FRR: `sudo systemctl restart frr`
- [ ] Configure BGP on taufiq-app-server (AS 65001):
  ```
  sudo vtysh
  configure terminal
  router bgp 65001
   bgp router-id 10.0.20.102
   neighbor 10.0.30.20 remote-as 65002
   address-family ipv4 unicast
    network 10.0.20.0/24
  ```
- [ ] Configure BGP on taufiq-db (AS 65002):
  ```
  sudo vtysh
  configure terminal
  router bgp 65002
   bgp router-id 10.0.30.20
   neighbor 10.0.20.102 remote-as 65001
   address-family ipv4 unicast
    network 10.0.30.0/24
  ```
- [ ] Verify peering is established: `show bgp summary`
- [ ] View the BGP table: `show bgp ipv4 unicast`
- [ ] Verify the received prefix appears in the routing table: `show ip route`
- [ ] Practice AS path prepending: advertise a prefix with `set as-path prepend 65001 65001`
- [ ] Observe the AS path attribute in `show bgp ipv4 unicast` output

---

## Reflection

**BGP is how the internet routes traffic between thousands of ISPs. After this module, explain in plain terms why BGP route leaks (an AS accidentally advertising prefixes it doesn't own) can take down large parts of the internet.**

_Answer:_
