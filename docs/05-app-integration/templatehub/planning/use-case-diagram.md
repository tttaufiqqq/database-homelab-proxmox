# Use Case Diagram

```text
Actors:
  [Visitor]
  [Buyer]
  [Admin]
  [ToyyibPay Sandbox]

                           +--------------------------------------+
                           |            TemplateHub               |
                           |--------------------------------------|
[Visitor] ---------------->| (Browse products)                    |
[Visitor] ---------------->| (View product details)               |
[Visitor] ---------------->| (Manage cart)                        |
[Buyer]   ---------------->| (Checkout order)                     |
[Buyer]   ---------------->| (Download purchased files)           |
[Admin]   ---------------->| (Manage products)                    |
[Admin]   ---------------->| (Review orders and payments)         |
[Admin]   ---------------->| (Manage product assets)              |
[ToyyibPay Sandbox] ------>| (Send payment callback)              |
[ToyyibPay Sandbox] ------>| (Return buyer after payment)         |
                           |                                      |
                           | (Checkout order) ----includes---->   |
                           |    (Create local order)              |
                           | (Checkout order) ----includes---->   |
                           |    (Create payment record)           |
                           | (Pay with ToyyibPay) -includes-->    |
                           |    (Create ToyyibPay bill)           |
                           | (Pay with ToyyibPay) -includes-->    |
                           |    (Process payment callback)        |
                           | (Process payment callback)           |
                           |    ----includes----> (Grant access)  |
                           +--------------------------------------+
```
