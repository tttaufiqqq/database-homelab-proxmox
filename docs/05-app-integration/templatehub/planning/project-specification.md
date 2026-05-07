# Digital Template Store Project Specification

## 1. Project Overview

### 1.1 Project Name
TemplateHub

### 1.2 Project Type
Digital product e-commerce web application

### 1.2.1 Standardized Technology Stack
- Frontend and backend framework: Next.js
- Primary database: PostgreSQL
- ORM and migration tool: Prisma
- Payment gateway: ToyyibPay sandbox for development and integration testing

### 1.3 Project Summary
TemplateHub is a digital product e-commerce application that sells downloadable templates such as budget sheets, invoice packs, study planners, and freelancer business templates. The application integrates with the ToyyibPay sandbox payment gateway for checkout and uses PostgreSQL as the primary system of record for products, carts, orders, payments, entitlements, and audit events.

This project is intentionally scoped as a learning app for a PostgreSQL-focused homelab. It is designed to be simple enough to finish while still exercising realistic e-commerce behavior such as payment redirection, callback processing, idempotent order updates, protected file access, and operational reporting.

### 1.4 Why This Project Was Chosen
- It is the easiest digital e-commerce product to ship because there is no shipping, stock warehouse, or courier integration.
- It is strong for learning because it still requires catalog design, order state transitions, payment integration, callback handling, and secure digital fulfillment.
- It has good portfolio value because the workflow is recognizable as a real business application.
- It matches ToyyibPay sandbox well because the gateway flow of bill creation, redirect, return, and callback maps directly to a single digital checkout flow.

## 2. Domain Requirements

### 2.1 Business Domain
The system operates in the digital commerce domain. The business sells downloadable digital products to customers through a web storefront and fulfills access after successful payment.

### 2.2 Domain Assumptions
- Products are digital only.
- Each product may contain one or more downloadable files.
- Physical delivery is not part of the system.
- ToyyibPay is the only payment gateway in version 1.
- The application initially supports guest checkout, with optional customer account support later.
- Prices are stored in Malaysian Ringgit as integer cents to avoid floating-point rounding issues.
- An order is considered fulfilled only after a successful payment confirmation is recorded by the system.

### 2.3 Domain Rules
- A product must belong to one category.
- A product may have multiple downloadable assets.
- A customer may place many orders.
- An order must contain at least one order item.
- A payment record must be linked to exactly one order.
- A successful payment creates at least one download entitlement.
- A customer can only download assets that belong to purchased products with a paid order.
- Repeated ToyyibPay callbacks must not produce duplicate entitlements.
- Admins manage products, files, and order review.

## 3. Functional Requirements

### 3.1 Customer Functions
- The system shall allow a visitor to browse active products.
- The system shall allow a visitor to search products by name, keyword, category, and tag.
- The system shall allow a visitor to view product details including description, preview information, price, and included files.
- The system shall allow a visitor to add products to a cart.
- The system shall allow a visitor to update or remove cart items.
- The system shall allow a visitor to checkout as a guest by entering name, email, and phone number.
- The system shall create an order before redirecting the buyer to ToyyibPay.
- The system shall create a ToyyibPay bill for the order.
- The system shall redirect the buyer to the ToyyibPay sandbox payment page.
- The system shall receive the buyer back through a return URL after ToyyibPay processing.
- The system shall receive asynchronous payment callback data from ToyyibPay.
- The system shall mark an order as paid only after successful payment confirmation is recorded.
- The system shall generate download entitlements for paid products.
- The system shall allow the buyer to access purchased files through a protected download page.
- The system shall show order status to the buyer using the order number and email.

### 3.2 Admin Functions
- The system shall allow an admin to log in securely.
- The system shall allow an admin to create, update, publish, unpublish, and archive product listings.
- The system shall allow an admin to upload and link product files to products.
- The system shall allow an admin to manage categories and tags.
- The system shall allow an admin to view orders and payment statuses.
- The system shall allow an admin to review ToyyibPay callback payloads for troubleshooting.
- The system shall allow an admin to resend or refresh customer download access when appropriate.
- The system shall record audit logs for important admin actions.

### 3.3 System Functions
- The system shall enforce status transitions for carts, orders, payments, and entitlements.
- The system shall store all external payment payloads for audit and debugging purposes.
- The system shall prevent duplicate order fulfillment when duplicate callbacks are received.
- The system shall generate unique public order references.
- The system shall protect downloadable assets from direct public access.
- The system shall log failed callback processing attempts.
- The system shall support backups and recovery without losing transactional integrity.

## 4. Non-Functional Requirements

### 4.1 Security
- The system shall hash all admin passwords using a modern password hashing algorithm.
- The system shall validate ToyyibPay callback requests before updating order state.
- The system shall store downloadable files outside the public web root.
- The system shall use least-privilege PostgreSQL roles for app access.
- The system shall log security-sensitive events such as admin login, failed login, payment mismatch, and unauthorized download attempts.

### 4.2 Reliability
- The system shall process payment callbacks idempotently.
- The system shall keep order, payment, and entitlement changes inside database transactions where required.
- The system shall support backup and restore drills as part of homelab operations.
- The system shall preserve audit history for payment events even if order status changes later.

### 4.3 Performance
- Product listing and search pages should respond quickly under normal homelab load.
- Protected download token lookup should be indexed for constant-time access.
- Order and payment status lookups should be indexed by public reference and gateway bill code.

### 4.4 Maintainability
- The application shall separate storefront, admin, and payment integration modules clearly.
- The schema shall use explicit foreign keys, constraints, and indexes.
- The codebase shall support future extension to customer accounts and additional gateways.

### 4.5 Availability
- The application should tolerate interrupted browser redirects by relying on server-side payment callback records.
- The system should allow administrators to reconcile orders manually if gateway callbacks are delayed.

## 5. Use Case List

| Use Case ID | Use Case Name | Primary Actor |
|---|---|---|
| UC-01 | Browse products | Visitor |
| UC-02 | View product details | Visitor |
| UC-03 | Manage cart | Visitor |
| UC-04 | Checkout order | Buyer |
| UC-05 | Pay with ToyyibPay | Buyer |
| UC-06 | Download purchased files | Buyer |
| UC-07 | Manage products | Admin |
| UC-08 | Review orders and payments | Admin |

## 6. Flow of Events

The following format follows the reference PDF structure: use case ID, name, actor, description, pre-condition, post-condition, followed by normal, alternative, and exception flow.

### 6.1 Use Case ID: UC-01
### Use Case Name: Browse products
### Actor: Visitor
### Description
Browsing the list of published digital products.

### Pre-condition
1. The storefront is available.
2. At least one product is published in the system.

### Post-condition
The visitor views matching products and may continue to product details.

### Normal flow
UC1-1. The visitor opens the storefront page.  
UC1-2. The system retrieves published products, categories, and visible prices.  
UC1-3. The system displays the product catalog.  
UC1-4. The visitor enters a keyword or selects a category filter.  
UC1-5. The system displays the matching products on the current screen.  
UC1-6. The visitor selects a product.  
UC1-7. The use case resumes on UC-02.

### Alternative flow
If the visitor clears all filters:  
UC1-8. The system reloads the default published catalog view.

### Exception flow
If there are no published products:  
UC1-9. The system displays an empty catalog message.

### 6.2 Use Case ID: UC-02
### Use Case Name: View product details
### Actor: Visitor
### Description
Viewing complete information for a selected digital product.

### Pre-condition
1. The visitor is browsing the storefront.
2. The selected product exists and is published.

### Post-condition
The visitor views the product details and may add the product to the cart.

### Normal flow
UC2-1. The visitor clicks a product from the catalog.  
UC2-2. The system retrieves the product details, category, tags, and attached file metadata.  
UC2-3. The system displays the product name, description, price, previews, and included assets summary.  
UC2-4. The visitor clicks the add to cart button.  
UC2-5. The use case resumes on UC-03.

### Exception flow
If the product is unpublished or archived:  
UC2-6. The system displays a product unavailable message and returns the visitor to the catalog.

### 6.3 Use Case ID: UC-03
### Use Case Name: Manage cart
### Actor: Visitor
### Description
Adding, reviewing, updating, and removing products in the shopping cart.

### Pre-condition
1. The visitor has opened at least one published product page.

### Post-condition
The cart reflects the chosen items and is ready for checkout.

### Normal flow
UC3-1. The visitor clicks add to cart for a selected product.  
UC3-2. The system creates or retrieves the active cart session.  
UC3-3. The system adds the selected product to the cart.  
UC3-4. The visitor opens the cart page.  
UC3-5. The system displays cart items, quantities, and subtotal.  
UC3-6. The visitor updates quantity or removes an item.  
UC3-7. The system recalculates the cart total.  
UC3-8. The visitor clicks checkout.  
UC3-9. The use case resumes on UC-04.

### Exception flow
If the cart is empty:  
UC3-10. The checkout button is disabled and the system displays a continue shopping option.

### 6.4 Use Case ID: UC-04
### Use Case Name: Checkout order
### Actor: Buyer
### Description
Submitting buyer details and creating a local order before payment.

### Pre-condition
1. The buyer has at least one item in the cart.
2. The selected products are published and purchasable.

### Post-condition
An order and initial payment record are created in the system.

### Normal flow
UC4-1. At the checkout page, the buyer reviews the selected item or items.  
UC4-2. The buyer enters name, email address, and phone number.  
UC4-3. The buyer confirms the purchase.  
UC4-4. The system validates the checkout input.  
UC4-5. The system creates a customer record if no matching customer exists.  
UC4-6. The system creates an order with status `pending`.  
UC4-7. The system copies the cart items into order items.  
UC4-8. The system creates an initial payment record with status `created`.  
UC4-9. The use case resumes on UC-05.

### Alternative flow
If the buyer email already exists in the customer table:  
UC4-10. The system links the order to the existing customer record and resumes on UC4-6.

### Exception flow
If any item in the cart is no longer purchasable:  
UC4-11. The system stops checkout and shows a product unavailable message.  
UC4-12. The buyer is returned to the cart page.

### 6.5 Use Case ID: UC-05
### Use Case Name: Pay with ToyyibPay
### Actor: Buyer
### Description
Paying for the selected order using the ToyyibPay sandbox gateway.

### Pre-condition
1. The buyer has successfully created an order.
2. The order contains at least one order item.
3. The payment record exists with status `created`.

### Post-condition
The payment outcome is recorded and the order is either paid or left unpaid.

### Normal flow
UC5-1. The buyer clicks the pay now button.  
UC5-2. The system sends a create bill request to the ToyyibPay sandbox API.  
UC5-3. The ToyyibPay sandbox returns a bill code and payment URL.  
UC5-4. The system stores the returned bill code in the payment record and updates the status to `pending`.  
UC5-5. The system redirects the buyer to the ToyyibPay sandbox payment page.  
UC5-6. The buyer completes the payment on ToyyibPay.  
UC5-7. ToyyibPay sends a callback request to the system callback URL.  
UC5-8. The system logs the callback payload in the payment events table.  
UC5-9. The system validates the callback against the payment and order records.  
UC5-10. The system updates the payment status to `paid`.  
UC5-11. The system updates the order status to `paid`.  
UC5-12. The system creates download entitlements for the ordered products.  
UC5-13. The buyer is redirected back through the return URL and sees a payment success message.

### Alternative flow
If ToyyibPay returns the buyer before the callback arrives:  
UC5-14. The system displays a pending payment verification message.  
UC5-15. Once the callback is received and validated, the system updates the order to paid and the buyer can access downloads.

If a duplicate callback is received:  
UC5-16. The system stores the callback event for audit but does not create duplicate entitlements.  
UC5-17. The use case ends.

### Exception flow
If ToyyibPay bill creation fails:  
UC5-18. The system marks the payment as `failed` and displays a payment initiation error.

If payment is unsuccessful:  
UC5-19. The system records the callback or return payload.  
UC5-20. The system keeps the order as unpaid and displays a payment failed message.

### 6.6 Use Case ID: UC-06
### Use Case Name: Download purchased files
### Actor: Buyer
### Description
Accessing digital files that belong to a paid order.

### Pre-condition
1. The order is marked as `paid`.
2. At least one active download entitlement exists for the buyer.

### Post-condition
The requested file is served and the download is logged.

### Normal flow
UC6-1. The buyer opens the success page or access link.  
UC6-2. The system retrieves the download entitlement using a secure token.  
UC6-3. The system validates that the entitlement is active and not expired.  
UC6-4. The system displays the purchased product files.  
UC6-5. The buyer selects a file to download.  
UC6-6. The system logs the download event.  
UC6-7. The system streams the file to the buyer.

### Exception flow
If the token is invalid or expired:  
UC6-8. The system denies access and displays an invalid download link message.

### 6.7 Use Case ID: UC-07
### Use Case Name: Manage products
### Actor: Admin
### Description
Creating and maintaining the digital product catalog.

### Pre-condition
1. The admin is successfully logged in.

### Post-condition
The product catalog is updated.

### Normal flow
UC7-1. The admin opens the product management page.  
UC7-2. The admin chooses to create or edit a product.  
UC7-3. The system displays the product form.  
UC7-4. The admin enters product name, slug, category, description, price, and status.  
UC7-5. The admin uploads one or more product files.  
UC7-6. The system stores the file metadata and links the files to the product.  
UC7-7. The admin saves the product.  
UC7-8. The system validates the input, stores the changes, and writes an admin audit log entry.

### Exception flow
If the slug already exists:  
UC7-9. The system rejects the save request and displays a duplicate slug message.

## 7. PostgreSQL Schema Design

### 7.1 Schema Design Notes
- Integer monetary values are stored as cents in `price_cents`.
- Enumerated types are used for explicit state modeling.
- `payment_events` preserves immutable external gateway payloads.
- `download_entitlements` is the digital-fulfillment boundary.
- `admin_audit_logs` supports operational review.
- Prisma should be used as the main ORM and migration workflow for this schema.

### 7.2 Full PostgreSQL Schema

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE user_role AS ENUM ('admin', 'customer');
CREATE TYPE user_status AS ENUM ('active', 'disabled');
CREATE TYPE product_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE cart_status AS ENUM ('active', 'converted', 'abandoned', 'expired');
CREATE TYPE order_status AS ENUM ('pending', 'awaiting_payment', 'paid', 'failed', 'cancelled', 'refunded');
CREATE TYPE payment_provider AS ENUM ('toyyibpay');
CREATE TYPE payment_status AS ENUM ('created', 'pending', 'paid', 'failed', 'expired', 'cancelled');
CREATE TYPE entitlement_status AS ENUM ('active', 'revoked', 'expired');
CREATE TYPE event_source AS ENUM ('return_url', 'callback_url', 'manual_admin');

CREATE TABLE app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT NOT NULL UNIQUE,
    password_hash TEXT,
    full_name TEXT NOT NULL,
    phone_number TEXT,
    role user_role NOT NULL DEFAULT 'customer',
    status user_status NOT NULL DEFAULT 'active',
    email_verified_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (role = 'admin' AND password_hash IS NOT NULL)
        OR role = 'customer'
    )
);

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES categories(id),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    short_description TEXT,
    description TEXT NOT NULL,
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    currency_code CHAR(3) NOT NULL DEFAULT 'MYR',
    status product_status NOT NULL DEFAULT 'draft',
    preview_image_path TEXT,
    created_by UUID REFERENCES app_users(id),
    updated_by UUID REFERENCES app_users(id),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE product_tags (
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (product_id, tag_id)
);

CREATE TABLE product_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes >= 0),
    checksum_sha256 TEXT,
    version_label TEXT NOT NULL DEFAULT 'v1',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_user_id UUID REFERENCES app_users(id),
    session_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    status cart_status NOT NULL DEFAULT 'active',
    currency_code CHAR(3) NOT NULL DEFAULT 'MYR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    converted_at TIMESTAMPTZ
);

CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (cart_id, product_id)
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_order_no TEXT NOT NULL UNIQUE,
    app_user_id UUID REFERENCES app_users(id),
    cart_id UUID REFERENCES carts(id),
    buyer_full_name TEXT NOT NULL,
    buyer_email CITEXT NOT NULL,
    buyer_phone TEXT,
    status order_status NOT NULL DEFAULT 'pending',
    currency_code CHAR(3) NOT NULL DEFAULT 'MYR',
    subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
    total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
    notes TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    product_name_snapshot TEXT NOT NULL,
    product_slug_snapshot TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
    line_total_cents INTEGER NOT NULL CHECK (line_total_cents >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    provider payment_provider NOT NULL DEFAULT 'toyyibpay',
    status payment_status NOT NULL DEFAULT 'created',
    provider_bill_code TEXT UNIQUE,
    provider_transaction_id TEXT,
    provider_reference_1 TEXT,
    provider_reference_2 TEXT,
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
    currency_code CHAR(3) NOT NULL DEFAULT 'MYR',
    payment_url TEXT,
    initiated_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    raw_last_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    source event_source NOT NULL,
    provider_event_name TEXT NOT NULL,
    payload_json JSONB NOT NULL,
    payload_hash TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processing_status TEXT NOT NULL DEFAULT 'received',
    processing_notes TEXT
);

CREATE TABLE download_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    app_user_id UUID REFERENCES app_users(id),
    access_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    status entitlement_status NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ,
    download_limit INTEGER,
    download_count INTEGER NOT NULL DEFAULT 0 CHECK (download_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE TABLE entitlement_download_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entitlement_id UUID NOT NULL REFERENCES download_entitlements(id) ON DELETE CASCADE,
    product_asset_id UUID NOT NULL REFERENCES product_assets(id),
    ip_address INET,
    user_agent TEXT,
    downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES app_users(id),
    action_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    before_json JSONB,
    after_json JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_status_category ON products(status, category_id);
CREATE INDEX idx_products_published_at ON products(published_at);
CREATE INDEX idx_product_assets_product_id ON product_assets(product_id);
CREATE INDEX idx_carts_app_user_id ON carts(app_user_id);
CREATE INDEX idx_orders_buyer_email ON orders(buyer_email);
CREATE INDEX idx_orders_status_created_at ON orders(status, created_at);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_provider_bill_code ON payments(provider_bill_code);
CREATE INDEX idx_payment_events_payment_id ON payment_events(payment_id);
CREATE INDEX idx_payment_events_received_at ON payment_events(received_at);
CREATE INDEX idx_entitlements_order_id ON download_entitlements(order_id);
CREATE INDEX idx_entitlement_logs_entitlement_id ON entitlement_download_logs(entitlement_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_app_users_updated_at
BEFORE UPDATE ON app_users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_carts_updated_at
BEFORE UPDATE ON carts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_cart_items_updated_at
BEFORE UPDATE ON cart_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_download_entitlements_updated_at
BEFORE UPDATE ON download_entitlements
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### 7.3 Key Transaction Boundaries
- Checkout transaction:
  create customer if needed, create order, copy order items, create payment row.
- Successful callback transaction:
  insert payment event, validate payment, set payment paid, set order paid, create entitlements.
- Download transaction:
  validate entitlement, increment download count if enforced, insert download log.

## 8. App Structure and Folder Plan

### 8.0 Application Modules

The application is organized into the following functional modules:

#### 8.0.1 Storefront Module
- Displays the home page, product catalog, and product detail pages.
- Handles product browsing, category filtering, tag filtering, and keyword search.
- Shows public product information such as price, description, and previews.

#### 8.0.2 Cart Module
- Manages the active shopping cart for a visitor or buyer.
- Supports adding items, removing items, updating quantities, and calculating totals.
- Preserves cart state before checkout.

#### 8.0.3 Checkout Module
- Collects buyer details such as name, email, and phone number.
- Validates checkout data before order creation.
- Creates the local order and order items before payment begins.

#### 8.0.4 Payment Integration Module
- Integrates with the ToyyibPay sandbox API.
- Creates bills, stores bill codes, and redirects the buyer to the gateway.
- Processes return URL and callback URL events.
- Handles payment validation, reconciliation, and idempotent state updates.

#### 8.0.5 Order Management Module
- Maintains the lifecycle of orders from pending to paid, failed, or cancelled.
- Stores buyer details, order totals, and item snapshots.
- Supports buyer order lookup and admin order review.

#### 8.0.6 Digital Fulfillment Module
- Grants download entitlements after successful payment.
- Protects digital files behind secure access tokens.
- Logs download activity and enforces expiry or download limits if configured.

#### 8.0.7 Product Catalog Management Module
- Allows admins to create, edit, publish, archive, and organize products.
- Manages categories, tags, product metadata, and attached assets.
- Supports content preparation for storefront display.

#### 8.0.8 Admin and Operations Module
- Provides admin authentication and secured admin pages.
- Allows admins to review orders, payments, callback events, and fulfillment state.
- Records important admin actions in audit logs.

#### 8.0.9 Audit and Logging Module
- Stores external payment event payloads.
- Keeps operational audit trails for admin actions and download activity.
- Supports debugging, traceability, and recovery exercises in the homelab.

#### 8.0.10 Data Access and Persistence Module
- Encapsulates PostgreSQL access through the ORM and repository or service layers.
- Enforces schema constraints, transactions, and consistent read or write behavior.
- Supports future reporting and analytics extensions.

### 8.0.11 Why These Modules Were Chosen
- They separate customer-facing commerce behavior from admin and operational concerns.
- They reflect the real lifecycle of the app: browse, cart, checkout, pay, fulfill, and administer.
- They reduce coupling by isolating ToyyibPay logic from core product and order logic.
- They map cleanly to the proposed folder plan and service layer.

### 8.1 Recommended Stack
- Frontend and backend: Next.js
- Database: PostgreSQL
- ORM and migrations: Prisma
- Styling: Tailwind CSS
- Validation: Zod
- Background jobs: lightweight server actions or route handlers first, queue later if needed

### 8.1.1 Why Prisma Was Chosen
- Prisma provides strong PostgreSQL support for a fullstack MVP.
- Prisma migrations give a structured workflow for evolving the schema during development.
- Prisma Client offers type-safe access to products, orders, payments, payment events, and entitlements.
- Prisma integrates well with Next.js route handlers, server actions, and admin pages.
- Prisma keeps development fast while still allowing raw SQL for selected PostgreSQL-specific cases if needed later.

### 8.2 Proposed Folder Plan

```text
templatehub/
|-- prisma/
|   |-- schema.prisma
|   |-- seed.ts
|   `-- migrations/
|-- src/
|   |-- app/
|   |   |-- (storefront)/
|   |   |   |-- page.tsx
|   |   |   |-- products/page.tsx
|   |   |   |-- products/[slug]/page.tsx
|   |   |   |-- cart/page.tsx
|   |   |   |-- checkout/page.tsx
|   |   |   |-- order/[orderNo]/success/page.tsx
|   |   |   `-- downloads/[token]/page.tsx
|   |   |-- admin/
|   |   |   |-- login/page.tsx
|   |   |   |-- products/page.tsx
|   |   |   |-- products/new/page.tsx
|   |   |   |-- products/[id]/edit/page.tsx
|   |   |   `-- orders/page.tsx
|   |   `-- api/
|   |       |-- checkout/route.ts
|   |       |-- payment/toyyibpay/create-bill/route.ts
|   |       |-- payment/toyyibpay/return/route.ts
|   |       |-- payment/toyyibpay/callback/route.ts
|   |       `-- downloads/[token]/route.ts
|   |-- components/
|   |   |-- storefront/
|   |   |-- checkout/
|   |   |-- admin/
|   |   `-- shared/
|   |-- lib/
|   |   |-- auth/
|   |   |-- db/
|   |   |   `-- prisma.ts
|   |   |-- payment/
|   |   |   `-- toyyibpay.ts
|   |   |-- products/
|   |   |-- orders/
|   |   |-- downloads/
|   |   `-- audit/
|   |-- server/
|   |   |-- services/
|   |   |   |-- checkout-service.ts
|   |   |   |-- payment-service.ts
|   |   |   |-- entitlement-service.ts
|   |   |   `-- product-service.ts
|   |   `-- repositories/
|   |       |-- order-repository.ts
|   |       |-- payment-repository.ts
|   |       `-- product-repository.ts
|   `-- types/
|-- storage/
|   `-- product-assets/
|-- docs/
|-- tests/
|   |-- integration/
|   `-- unit/
`-- package.json
```

### 8.3 Why This Structure Was Chosen
- It cleanly separates storefront, admin, and API responsibilities.
- Payment gateway code is isolated inside `lib/payment` and service layers so ToyyibPay-specific logic does not leak through the app.
- The `server/services` layer keeps business rules such as checkout, idempotent callback handling, and entitlement creation out of UI files.
- The `storage` folder keeps downloadable assets outside public static delivery, which is better for secure file access.
- The layout scales naturally from MVP to a more formal modular monolith without forcing unnecessary complexity on day one.

## 9. Diagram Files

The diagrams for this project are separated into individual Markdown files:

- [Context Diagram](C:/Users/taufi/Documents/Dev/database/docs/05-app-integration/templatehub/planning/context-diagram.md)
- [Data Flow Diagram Level 0](C:/Users/taufi/Documents/Dev/database/docs/05-app-integration/templatehub/planning/data-flow-diagram-level-0.md)
- [Use Case Diagram](C:/Users/taufi/Documents/Dev/database/docs/05-app-integration/templatehub/planning/use-case-diagram.md)
- [Activity Diagram](C:/Users/taufi/Documents/Dev/database/docs/05-app-integration/templatehub/planning/activity-diagram-checkout-payment.md)
- [ERD Diagram](C:/Users/taufi/Documents/Dev/database/docs/05-app-integration/templatehub/planning/erd-diagram.md)
- [UI Template Extraction Plan](C:/Users/taufi/Documents/Dev/database/docs/05-app-integration/templatehub/planning/ui-template-extraction-plan.md)

## 10. Suggested Next Build Steps

1. Convert the PostgreSQL schema into Prisma models in `prisma/schema.prisma`.
2. Implement category, product, and asset management first.
3. Build guest cart and checkout flow.
4. Add ToyyibPay sandbox bill creation and callback handling.
5. Add protected entitlement download flow.
6. Add tests for duplicate callback handling and order fulfillment correctness.
