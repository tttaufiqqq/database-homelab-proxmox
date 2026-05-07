# Activity Diagram: Checkout and Payment

```text
Start
  |
  v
[Buyer browses catalog]
  |
  v
[Buyer selects product]
  |
  v
[Add item to cart]
  |
  v
[Open cart]
  |
  v
<Cart empty?>
  |Yes
  v
[Show continue shopping]
  |
  v
 End

  No
  |
  v
[Proceed to checkout]
  |
  v
[Enter buyer name, email, phone]
  |
  v
<Input valid?>
  |No
  v
[Show validation errors]
  |
  +------------------------------+
                                 |
                                 v
                           [Enter buyer details]

  Yes
  |
  v
[Create customer if needed]
  |
  v
[Create order and order items]
  |
  v
[Create payment record]
  |
  v
[Call ToyyibPay create bill API]
  |
  v
<Bill created?>
  |No
  v
[Mark payment failed]
  |
  v
[Show payment initiation error]
  |
  v
 End

  Yes
  |
  v
[Store bill code and payment URL]
  |
  v
[Redirect buyer to ToyyibPay]
  |
  v
[Buyer completes or cancels payment]
  |
  v
[ToyyibPay sends callback to system]
  |
  v
[Log callback payload]
  |
  v
<Callback valid and paid?>
  |No
  v
[Keep order unpaid]
  |
  v
[Show failed or pending status]
  |
  v
 End

  Yes
  |
  v
[Update payment to paid]
  |
  v
[Update order to paid]
  |
  v
[Create download entitlements]
  |
  v
[Show success page]
  |
  v
[Buyer opens secure download page]
  |
  v
 End
```
