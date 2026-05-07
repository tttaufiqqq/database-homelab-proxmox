# Data Flow Diagram Level 0

```text
External Entity: Buyer
External Entity: Admin
External Entity: ToyyibPay Sandbox

Data Store D1: Product Catalog
Data Store D2: Cart Store
Data Store D3: Order Store
Data Store D4: Payment Store
Data Store D5: Entitlement Store
Data Store D6: Audit/Event Store

Buyer
  |
  | search/browse request
  v
[P1 Browse Catalog] <------------------------------> D1 Product Catalog
  |
  | product list / product detail
  v
Buyer

Buyer
  |
  | add/remove/update cart
  v
[P2 Manage Cart] <---------------------------------> D2 Cart Store
  |
  | cart summary
  v
Buyer

Buyer
  |
  | checkout details
  v
[P3 Create Order] ---------------------------------> D3 Order Store
  |                                                   |
  | create payment seed                               | order + items
  +-------------------------------------------------> D4 Payment Store
  |
  | payment initiation request
  v
[P4 Start ToyyibPay Payment] ----------------------> ToyyibPay Sandbox
  ^                                                   |
  | bill code / payment URL                           | callback + return
  |                                                   v
  +------------------------------- [P5 Process Payment Result]
                                      |        |          |
                                      |        |          +--> D6 Audit/Event Store
                                      |        +------------> D4 Payment Store
                                      +---------------------> D3 Order Store
                                      |
                                      +---------------------> D5 Entitlement Store

Buyer
  |
  | download request with token
  v
[P6 Serve Purchased Files] <-----------------------> D5 Entitlement Store
  |                                                   |
  +-------------------------------------------------> D6 Audit/Event Store
  |
  | protected file response
  v
Buyer

Admin
  |
  | product / asset management
  v
[P7 Manage Catalog] <------------------------------> D1 Product Catalog
  |
  +------------------------------------------------> D6 Audit/Event Store

Admin
  |
  | order/payment review
  v
[P8 Review Operations] <---------------------------> D3 Order Store
  |                                                   D4 Payment Store
  +------------------------------------------------> D6 Audit/Event Store
```
