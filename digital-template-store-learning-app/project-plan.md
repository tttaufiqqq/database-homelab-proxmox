# Project Plan - TemplateHub
Created: 2026-05-02
Source: C:\Users\taufi\Documents\Fantaz - AI Memory\Project Resources\plan-format.md

## Instructions
- Auto-commit code after each completed todo item (chains with Auto-Commit if installed)
- Update this file every 5 completed items (checkpoint save)
- Do not commit this plan file — it is your AI's working reference

## Architecture

Core stack:
- Next.js
- PostgreSQL
- Prisma
- ToyyibPay sandbox
- Tailwind CSS

Primary references:
- [Project Specification](C:/Users/taufi/Documents/Dev/database/digital-template-store-learning-app/project-specification.md)
- [ERD Diagram](C:/Users/taufi/Documents/Dev/database/digital-template-store-learning-app/erd-diagram.md)
- [UI Template Extraction Plan](C:/Users/taufi/Documents/Dev/database/digital-template-store-learning-app/ui-template-extraction-plan.md)

High-level module flow:

```text
Storefront -> Cart -> Checkout -> ToyyibPay Bill Creation -> Callback Processing
          -> Orders -> Payments -> Entitlements -> Protected Downloads

Admin -> Product Management -> Orders Review -> Payment Event Review -> Audit Logs
```

Delivery boundaries:
- Storefront pages are customer-facing and read mostly from products, categories, tags, and published assets.
- Checkout and payment logic are server-side and must treat callback processing as the source of truth.
- Product assets must be stored outside the public web root and served through entitlement checks.
- Admin features should remain separated from storefront UI and backed by secure authentication.

## Current Implementation Snapshot

App repo status in `C:\Users\taufi\Documents\Dev\templatehub`:
- Prisma schema, initial migration, seed script, and Prisma client wrapper are in place.
- The extracted storefront shell exists, with reusable `navbar`, `hero`, `footer`, and `product-card` components.
- Storefront routes already exist for home, products, product detail, cart, checkout, download token access, and order success.
- Admin routes already exist for login, products, product creation, product edit, and order review.
- API route files already exist for checkout, ToyyibPay bill creation, ToyyibPay return, ToyyibPay callback, and secure downloads.
- Repository and service files already exist for products, orders, payments, checkout, entitlements, and payment processing.

Important constraint for the next implementation pass:
- Most Phase 3 onward routes and services are still placeholders, so route existence should not be treated as functional completion.
- The next working session should prefer filling the product catalog read path end-to-end before touching checkout or admin behavior.

## Implementation Plan

### Phase 1: Project Scaffold and Development Baseline
- [x] Create the Next.js application scaffold for TemplateHub in a dedicated app folder.
- [x] Add Prisma, Tailwind CSS, Zod, and core supporting dependencies.
- [x] Establish the folder structure from the project specification, including `prisma`, `src/app`, `src/components`, `src/lib`, `src/server`, `storage`, and `tests`.
- [x] Create the initial `.env` and `.env.example` files with PostgreSQL, Prisma, ToyyibPay sandbox, storage, and admin bootstrap variables.
- [x] Extract the reusable UI shell from `ecommerce-app-frontend-template` into the new app structure.
- [x] Set up shared design tokens, global styles, and base UI components such as button, modal, drawer, and toast.

### Phase 2: Prisma Schema and Database Foundation
- [x] Convert the approved PostgreSQL schema into Prisma models in `prisma/schema.prisma`.
- [x] Model enums, relations, unique constraints, indexes, and audit-oriented entities accurately in Prisma.
- [x] Create the first Prisma migration and validate that it applies cleanly to PostgreSQL.
- [x] Add a Prisma client wrapper in `src/lib/db/prisma.ts`.
- [x] Create seed data for categories, tags, admin user, and a small starter product catalog.

### Phase 3: Storefront Catalog and Product Discovery
- [ ] Build the storefront home page using the extracted UI template components.
- [ ] Build the product listing page with category, tag, and keyword filtering.
- [ ] Build the product detail page with price, description, preview information, and downloadable asset summary.
- [ ] Replace all hardcoded frontend product data with Prisma-backed queries.
- [ ] Add empty-state and unavailable-product handling for unpublished or archived products.

Execution notes:
- Start by implementing `product-repository.ts` and `product-service.ts` so all storefront catalog pages consume the same read layer.
- Wire the home page first to featured or newest published products from the seed dataset.
- After the home page is live, build the `/products` filters around query parameters for category, tag, search, sort, and pagination defaults.
- Complete the product detail page last in this phase so it can reuse the same normalized product DTO shape as listing cards.
- Treat unpublished, archived, or missing products as first-class states with safe fallbacks instead of rendering partial data.

### Phase 4: Cart and Checkout Flow
- [ ] Implement a cart state model suitable for guest checkout and future account support.
- [ ] Build the cart panel or cart page using the refactored template UI.
- [ ] Build the checkout form for buyer name, email, and phone number.
- [ ] Create the order creation flow that persists orders, order items, and initial payment records.
- [ ] Add validation and error handling for unavailable products, invalid input, and empty carts.

### Phase 5: ToyyibPay Integration and Payment Processing
- [ ] Implement the ToyyibPay sandbox client in `src/lib/payment/toyyibpay.ts`.
- [ ] Build the create-bill server flow that generates a ToyyibPay bill and stores the returned bill code and payment URL.
- [ ] Implement the return URL handler and the callback URL handler.
- [ ] Persist all gateway payloads in `payment_events` and update payment state idempotently.
- [ ] Mark orders as paid only after validated success and create download entitlements transactionally.

### Phase 6: Digital Fulfillment and Secure Downloads
- [ ] Build the order success page and payment pending state page.
- [ ] Build the protected downloads page using entitlement tokens.
- [ ] Implement secure asset delivery outside the public web root.
- [ ] Log download events and enforce entitlement checks before serving files.
- [ ] Add failure handling for invalid, expired, revoked, or missing entitlements.

### Phase 7: Admin Operations and Content Management
- [ ] Implement admin authentication and route protection.
- [ ] Build the admin products page for create, edit, publish, archive, and asset linking workflows.
- [ ] Build the admin orders page for order status review and customer lookup.
- [ ] Build the admin payment events page for callback inspection and troubleshooting.
- [ ] Record admin actions in audit logs for product and order management operations.

### Phase 8: Testing, Reliability, and Homelab Readiness
- [ ] Add integration tests for checkout, bill creation, callback handling, and entitlement creation.
- [ ] Add regression tests for duplicate callbacks and repeated fulfillment attempts.
- [ ] Verify indexes and query paths for product listing, order lookup, and token-based downloads.
- [ ] Review and finalize `.env.example` and local development documentation for Prisma, PostgreSQL, and ToyyibPay sandbox setup.
- [ ] Run an end-to-end sandbox payment drill and confirm that purchase-to-download works correctly.

### Phase 9: Polish and MVP Handover
- [ ] Replace any remaining demo-only template logic with production-oriented app flows.
- [ ] Refine loading states, empty states, success states, and error messages across storefront and admin pages.
- [ ] Review the schema, UI, and payment flow against the functional and non-functional requirements.
- [ ] Document known limitations for version 1, including guest checkout constraints and manual admin reconciliation boundaries.
- [ ] Prepare the project for the next phase of work, including deployment setup or local homelab hosting.

## Progress Log

2026-05-02 - Created the initial development-start project plan based on the approved specification, schema, diagrams, and UI extraction plan.
2026-05-02 - Completed Phase 1 scaffold baseline in the separate app codebase at `C:\Users\taufi\Documents\Dev\templatehub`.
2026-05-02 - Added the core app dependencies, specification-aligned folder structure, and initial environment template for PostgreSQL, ToyyibPay sandbox, storage, and admin bootstrap values.
2026-05-02 - Extracted the first reusable storefront UI shell and design foundation from `ecommerce-app-frontend-template`, including the shared button, modal, drawer, and toast components.
2026-05-02 - Verified the current app baseline with `npm run lint` and `npm run build` inside `C:\Users\taufi\Documents\Dev\templatehub`.
2026-05-02 - Completed the Prisma schema translation in `C:\Users\taufi\Documents\Dev\templatehub\prisma\schema.prisma`, including enums, mapped fields, relations, and indexes from the approved PostgreSQL design.
2026-05-02 - Added the first migration artifact in `C:\Users\taufi\Documents\Dev\templatehub\prisma\migrations\20260502193000_init_templatehub`, including extension setup and database-level check constraints that Prisma does not infer by default.
2026-05-02 - Added a Prisma 7-compatible client wrapper and seed script in the app repo, with a starter admin user, categories, tags, products, and product assets.
2026-05-02 - Verified the app code again with `npm run prisma:generate`, `npm run lint`, and `npm run build` inside `C:\Users\taufi\Documents\Dev\templatehub`.
2026-05-02 - Applied the initial migration successfully to the live PostgreSQL target at `100.75.213.36:5432/templatehub` and created a dedicated shadow database for Prisma migration workflows.
2026-05-02 - Seeded and verified the starter catalog in PostgreSQL: 1 admin user, 4 categories, 6 tags, 4 published products, 5 product assets, and 12 product-tag links.
2026-05-02 - Audited the current `templatehub` app repo and confirmed that multiple storefront, admin, and API routes already exist as scaffolds or placeholders beyond the completed Phase 1 and Phase 2 database baseline.
2026-05-02 - Updated this plan to distinguish placeholder route scaffolding from actual feature completion and to set a stricter next-session focus on the Phase 3 catalog read path.

## Next Session Start Point

- Continue in the app repo at `C:\Users\taufi\Documents\Dev\templatehub`.
- Begin Phase 3 by implementing the product read stack in `src/server/repositories/product-repository.ts` and `src/server/services/product-service.ts`.
- Replace the current preview-only storefront home page with Prisma-backed featured or newest published products from the seeded catalog.
- Build the `/products` page next with query-param-driven category, tag, keyword, and sort handling.
- Finish the `/products/[slug]` page after the listing page so both views share one normalized product data shape.
- Preserve the current UI shell and swap the hardcoded preview content for database reads through the Prisma client wrapper.
- Leave checkout, ToyyibPay, downloads, and admin route placeholders untouched until the storefront catalog flow is genuinely live end-to-end.
- Keep using auto-commit after each completed todo item.
