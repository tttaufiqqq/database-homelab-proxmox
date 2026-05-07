# Context Diagram

```text
+------------------+                               +----------------------+
|      Buyer       |                               |       Admin          |
|------------------|                               |----------------------|
| - browse store   |                               | - manage products    |
| - checkout       |                               | - review orders      |
| - pay            |                               | - review payments    |
| - download files |                               | - manage assets      |
+---------+--------+                               +----------+-----------+
          |                                                      |
          | product views, cart, checkout, downloads             | admin actions
          v                                                      v
   +-----------------------------------------------------------------------+
   |                        TEMPLATEHUB SYSTEM                              |
   |-----------------------------------------------------------------------|
   | storefront | cart | checkout | payment orchestration | fulfillment    |
   | admin panel | audit logging | reporting | secure file access           |
   +----------------------+-----------------------------+-------------------+
                          |                             |
                          | create bill, callback       | persist data
                          v                             v
             +--------------------------+    +-----------------------------+
             |   ToyyibPay Sandbox      |    |         PostgreSQL          |
             |--------------------------|    |-----------------------------|
             | - bill creation          |    | - products                  |
             | - payment page           |    | - carts                     |
             | - callback + return      |    | - orders                    |
             +--------------------------+    | - payments                  |
                                             | - entitlements              |
                                             | - audit logs                |
                                             +-----------------------------+
```
