# ERD Diagram

## 1. ASCII ERD

```text
+-------------------+         +-------------------+
|     app_users     |         |    categories     |
|-------------------|         |-------------------|
| PK id             |         | PK id             |
| email             |         | slug              |
| role              |         | name              |
| status            |         | is_active         |
+---------+---------+         +---------+---------+
          |                             |
          | 1                           | 1
          |                             |
          | *                           | *
          v                             v
+-------------------+         +-------------------+
|       carts       |         |     products      |
|-------------------|         |-------------------|
| PK id             |         | PK id             |
| FK app_user_id    |         | FK category_id    |
| session_token     |         | slug              |
| status            |         | status            |
+---------+---------+         | price_cents       |
          |                   +----+---------+----+
          | 1                     |         |
          |                       |         |
          | *                     | *       | *
          v                       v         v
+-------------------+     +-------------------+     +-------------------+
|     cart_items    |     |  product_assets   |     |   product_tags    |
|-------------------|     |-------------------|     |-------------------|
| PK id             |     | PK id             |     | PK/FK product_id  |
| FK cart_id        |     | FK product_id     |     | PK/FK tag_id      |
| FK product_id     |     | storage_path      |     +---------+---------+
| quantity          |     | file_name         |               |
+---------+---------+     +-------------------+               | *
          |                                                     |
          | *                                                   | 1
          |                                                     v
          |                                           +-------------------+
          |                                           |       tags        |
          |                                           |-------------------|
          |                                           | PK id             |
          |                                           | slug              |
          |                                           | name              |
          |                                           +-------------------+
          |
          |                +-------------------+
          +--------------> |      orders       |
                           |-------------------|
                           | PK id             |
                           | FK app_user_id    |
                           | FK cart_id        |
                           | public_order_no   |
                           | status            |
                           +----+---------+----+
                                |         |
                                | 1       | 1
                                |         |
                                | *       | 1
                                v         v
                      +-------------------+     +-------------------+
                      |    order_items    |     |     payments      |
                      |-------------------|     |-------------------|
                      | PK id             |     | PK id             |
                      | FK order_id       |     | FK order_id UNIQUE|
                      | FK product_id     |     | bill_code         |
                      | price snapshot    |     | status            |
                      +----+---------+----+     +----+---------+----+
                           |         |               |         |
                           | 1       | *             | 1       | 1
                           |         |               |         |
                           | *       |               | *       | *
                           v         |               v         v
                 +-------------------+|    +-------------------+   +---------------------------+
                 |download_entitlements||    |  payment_events   |   |    admin_audit_logs      |
                 |-------------------|||    |-------------------|   |---------------------------|
                 | PK id             |||    | PK id             |   | PK id                    |
                 | FK order_id       |||    | FK payment_id     |   | FK admin_user_id         |
                 | FK order_item_id  |+-----| payload_json      |   | entity_type              |
                 | FK app_user_id    |      | source            |   | before_json / after_json |
                 | access_token      |      +-------------------+   +---------------------------+
                 +---------+---------+
                           |
                           | 1
                           |
                           | *
                           v
                 +---------------------------+
                 | entitlement_download_logs |
                 |---------------------------|
                 | PK id                    |
                 | FK entitlement_id        |
                 | FK product_asset_id      |
                 | downloaded_at            |
                 +--------------------------+
```

## 2. Relationship by Table

### 2.1 `app_users`
- One `app_users` record can own many `carts`.
- One `app_users` record can place many `orders`.
- One `app_users` record can receive many `download_entitlements`.
- One admin `app_users` record can create many `admin_audit_logs`.
- One admin `app_users` record may be referenced by many `products` as creator or updater.

### 2.2 `categories`
- One `categories` record can classify many `products`.

### 2.3 `tags`
- One `tags` record can be linked to many `products` through `product_tags`.

### 2.4 `products`
- Each `products` record belongs to one `categories` record.
- One `products` record can appear in many `cart_items`.
- One `products` record can appear in many `order_items`.
- One `products` record can have many `product_assets`.
- One `products` record can have many tags through `product_tags`.

### 2.5 `product_tags`
- `product_tags` is a junction table for the many-to-many relationship between `products` and `tags`.

### 2.6 `product_assets`
- Each `product_assets` record belongs to one `products` record.
- One `product_assets` record can appear in many `entitlement_download_logs`.

### 2.7 `carts`
- One `carts` record may belong to one `app_users` record, or may remain anonymous for guest sessions.
- One `carts` record can contain many `cart_items`.
- One `carts` record may be converted into one `orders` record.

### 2.8 `cart_items`
- Each `cart_items` record belongs to one `carts` record.
- Each `cart_items` record references one `products` record.

### 2.9 `orders`
- One `orders` record may belong to one `app_users` record.
- One `orders` record may be created from one `carts` record.
- One `orders` record must have many `order_items`.
- One `orders` record has exactly one `payments` record in this version.
- One `orders` record can create many `download_entitlements`.

### 2.10 `order_items`
- Each `order_items` record belongs to one `orders` record.
- Each `order_items` record references one `products` record.
- One `order_items` record can create one or more `download_entitlements`, though the expected version 1 pattern is one entitlement per purchased product line.

### 2.11 `payments`
- Each `payments` record belongs to exactly one `orders` record.
- One `payments` record can have many `payment_events`.

### 2.12 `payment_events`
- Each `payment_events` record belongs to one `payments` record.
- This table stores repeated callbacks, retries, return payloads, and manual reconciliation logs without overwriting prior records.

### 2.13 `download_entitlements`
- Each `download_entitlements` record belongs to one `orders` record.
- Each `download_entitlements` record belongs to one `order_items` record.
- Each `download_entitlements` record may belong to one `app_users` record if the customer has an account.
- One `download_entitlements` record can have many `entitlement_download_logs`.

### 2.14 `entitlement_download_logs`
- Each `entitlement_download_logs` record belongs to one `download_entitlements` record.
- Each `entitlement_download_logs` record references one `product_assets` record.

### 2.15 `admin_audit_logs`
- Each `admin_audit_logs` record belongs to one admin `app_users` record.
- The entity being changed may be a product, category, order, or other managed record, represented generically by `entity_type` and `entity_id`.

## 3. Why These Relationships Were Chosen

### 3.1 User to Cart and User to Order
These relationships support both guest checkout and future account-based purchasing. A cart or order can optionally link to a user account, which keeps version 1 flexible without forcing sign-up.

### 3.2 Category to Product
This is a straightforward one-to-many relationship because each product should belong to one primary category for simpler storefront navigation and filtering.

### 3.3 Product to Tag Through Junction Table
Tags are many-to-many by nature because one product can be labeled with many tags and one tag can describe many products. A junction table is the clean normalized design.

### 3.4 Product to Asset
Digital products often contain multiple downloadable files such as PDF, spreadsheet, ZIP bundle, or preview pack. This one-to-many relationship supports richer products without duplicating product records.

### 3.5 Cart to Cart Items and Order to Order Items
These relationships separate the container from its contents. This keeps totals recalculable, supports future multi-item checkout, and preserves line-level snapshots at order time.

### 3.6 Order to Payment
Version 1 uses one payment per order because the checkout flow is intentionally simple. This keeps the state model easy to reason about while still reflecting a real payment integration.

### 3.7 Payment to Payment Events
This relationship is critical for traceability. Payment gateways can send repeated callbacks or return parameters at different times. Storing every event separately prevents loss of audit history and supports debugging.

### 3.8 Order Item to Download Entitlement
Entitlements are attached to purchased order items instead of directly to products alone because fulfillment should be tied to a specific purchase event. This makes revocation, reissue, and auditing cleaner.

### 3.9 Entitlement to Download Logs
This relationship supports secure digital delivery by recording what was downloaded, when it happened, and which asset was accessed. It is useful for analytics, support, and abuse investigation.

### 3.10 Admin User to Audit Logs
Administrative actions should always be attributable. Linking audit logs back to the admin user supports accountability and operational review.

## 4. Design Summary

This ERD was chosen to balance:
- normalized relational design
- realistic e-commerce behavior
- clear payment auditability
- secure digital fulfillment
- room for future growth without overcomplicating version 1

The schema is intentionally structured so that the most sensitive workflows, especially payment confirmation and digital access, are traceable through explicit relational links rather than inferred application behavior.
