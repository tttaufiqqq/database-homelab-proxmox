# Module 07 — Load Balancing (HAProxy) — Worksheet

## Concepts

**1. What is the difference between a reverse proxy (Nginx) and a load balancer (HAProxy)?**

_Answer:_

**2. HAProxy config has three main sections: `frontend`, `backend`, and `listen`. What does each one do?**

_Answer:_

**3. What is the difference between active/active and active/passive load balancing?**

_Answer:_

**4. HAProxy supports multiple balancing algorithms: `roundrobin`, `leastconn`, `source`. When would you use `source` instead of `roundrobin`?**

_Answer:_

**5. What is a health check in HAProxy? What happens to a backend server when it fails a health check?**

_Answer:_

**6. What are sticky sessions? Give a scenario where sticky sessions are necessary and one where they work against you.**

_Answer:_

**7. HAProxy has a stats page. What information does it show, and why is it useful beyond just "is it running"?**

_Answer:_

---

## Implementation Tasks

- [ ] Install HAProxy on taufiq-app-server
- [ ] Configure HAProxy frontend on port 8080 (Nginx owns port 80)
- [ ] Add backend pool: `templatehub-1` (127.0.0.1:3000) + `templatehub-2` (127.0.0.1:3002)
- [ ] Enable HTTP health checks on both backends
- [ ] Enable HAProxy stats page on port 8404
- [ ] Start a second TemplateHub Docker container on port 3002
- [ ] Add Nginx server block: `lb.lab` → 127.0.0.1:8080
- [ ] Test: access `http://lb.lab` — verify it loads
- [ ] Verify load is distributed: check stats page at `http://100.97.172.9:8404/stats`
- [ ] Stop one container: `docker stop templatehub-2`
- [ ] Observe: HAProxy marks backend as DOWN, all traffic routes to the remaining one
- [ ] Restart container: `docker start templatehub-2`
- [ ] Observe: HAProxy marks backend as UP, traffic distributes again

---

## Reflection

**At this point you have Nginx (M06) and HAProxy (M07) both running on the same machine. How do they relate — are they competing, or complementary?**

_Answer:_
