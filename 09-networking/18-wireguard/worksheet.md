# Module 18 — WireGuard from Scratch — Worksheet

## Concepts

**1. WireGuard uses a different security model from OpenVPN and IPsec. What is its cryptographic foundation, and why is it considered simpler and faster?**

_Answer:_

**2. What is a WireGuard peer? How does WireGuard know which peer a packet belongs to — what is the identifier?**

_Answer:_

**3. What does `AllowedIPs` do in a WireGuard config? It serves two purposes depending on direction — what are they?**

_Answer:_

**4. WireGuard is "silent" — it does not respond to unauthenticated packets. How does this affect port scanning and fingerprinting of a WireGuard server?**

_Answer:_

**5. Tailscale is built on WireGuard. What does Tailscale add on top of raw WireGuard that makes it easier to use?**

_Answer:_

**6. A WireGuard interface has a private key and a public key. How is the public key derived, and how does each peer use the other's public key?**

_Answer:_

---

## Implementation Tasks

- [ ] Install WireGuard on both VMs: `sudo apt install wireguard`
- [ ] Generate keypairs on each VM:
  ```bash
  wg genkey | tee privatekey | wg pubkey > publickey
  cat privatekey
  cat publickey
  ```
- [ ] Create `/etc/wireguard/wg0.conf` on taufiq-app-server (server role):
  ```ini
  [Interface]
  Address = 10.200.0.1/24
  PrivateKey = <app-server private key>
  ListenPort = 51820

  [Peer]
  PublicKey = <db-server public key>
  AllowedIPs = 10.200.0.2/32
  ```
- [ ] Create `/etc/wireguard/wg0.conf` on taufiq-db (client role):
  ```ini
  [Interface]
  Address = 10.200.0.2/24
  PrivateKey = <db private key>

  [Peer]
  PublicKey = <app-server public key>
  Endpoint = 10.0.20.102:51820
  AllowedIPs = 10.200.0.1/32
  PersistentKeepalive = 25
  ```
- [ ] Bring up the interfaces: `sudo wg-quick up wg0` on both VMs
- [ ] Verify the tunnel: `sudo wg show`
- [ ] Ping through the tunnel: from taufiq-db, ping `10.200.0.1`
- [ ] Run `tcpdump -i eth0 udp port 51820` — observe the encrypted WireGuard UDP packets
- [ ] Compare: the payload is unreadable (encrypted) unlike the IPIP tunnel from M17
- [ ] Tear down: `sudo wg-quick down wg0` on both VMs

---

## Reflection

**You now have Tailscale (built on WireGuard) AND a raw WireGuard tunnel configured. What does Tailscale give you that your raw wg0 tunnel does not? When would you choose raw WireGuard over Tailscale?**

_Answer:_
