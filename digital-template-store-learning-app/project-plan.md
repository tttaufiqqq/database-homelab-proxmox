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
- Storefront catalog routes are now live for home, products, product detail, cart, checkout, unavailable products, and order success.
- Admin routes already exist for login, products, product creation, product edit, and order review.
- The checkout API now validates guest-cart payloads and persists orders, order items, and initial payment records.
- API route files already exist for checkout, ToyyibPay bill creation, ToyyibPay return, ToyyibPay callback, and secure downloads.
- Repository and service files now contain working product, checkout, payment gateway, callback reconciliation, entitlement creation, and protected download fulfillment logic.

Important constraint for the next implementation pass:
- Phase 5 is now functionally complete, including ToyyibPay sandbox bill creation, event persistence, callback-driven payment reconciliation, and one-time entitlement creation.
- Phase 6 is now functionally complete, including entitlement-aware downloads page loading, secure storage-backed file delivery, and download logging.
- The next implementation pass should move into Phase 7 so admin authentication and operational review pages can catch up with the now-working storefront purchase lifecycle.
- Local sandbox payment testing now depends on the `npm run dev:tunnel` helper so ToyyibPay can reach a public callback URL during development.

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
- [x] Build the storefront home page using the extracted UI template components.
- [x] Build the product listing page with category, tag, and keyword filtering.
- [x] Build the product detail page with price, description, preview information, and downloadable asset summary.
- [x] Replace all hardcoded frontend product data with Prisma-backed queries.
- [x] Add empty-state and unavailable-product handling for unpublished or archived products.

Execution notes:
- Start by implementing `product-repository.ts` and `product-service.ts` so all storefront catalog pages consume the same read layer.
- Wire the home page first to featured or newest published products from the seed dataset.
- After the home page is live, build the `/products` filters around query parameters for category, tag, search, sort, and pagination defaults.
- Complete the product detail page last in this phase so it can reuse the same normalized product DTO shape as listing cards.
- Treat unpublished, archived, or missing products as first-class states with safe fallbacks instead of rendering partial data.

### Phase 4: Cart and Checkout Flow
- [x] Implement a cart state model suitable for guest checkout and future account support.
- [x] Build the cart panel or cart page using the refactored template UI.
- [x] Build the checkout form for buyer name, email, and phone number.
- [x] Create the order creation flow that persists orders, order items, and initial payment records.
- [x] Add validation and error handling for unavailable products, invalid input, and empty carts.

### Phase 5: ToyyibPay Integration and Payment Processing
- [x] Implement the ToyyibPay sandbox client in `src/lib/payment/toyyibpay.ts`.
- [x] Build the create-bill server flow that generates a ToyyibPay bill and stores the returned bill code and payment URL.
- [x] Implement the return URL handler and the callback URL handler.
- [x] Persist all gateway payloads in `payment_events` and update payment state idempotently.
- [x] Mark orders as paid only after validated success and create download entitlements transactionally.

Execution notes:
- Reuse the existing persisted order and payment records from Phase 4 instead of creating any duplicate payment bootstrap data in Phase 5.
- Start by implementing the ToyyibPay client and the create-bill flow so checkout can transition from local order creation to a real payment handoff.
- Treat the callback URL as the source of truth for payment success, while the return URL should only improve UX and trigger safe re-fetch or reconciliation behavior.
- Persist every inbound gateway payload in `payment_events`, even if it is incomplete, duplicated, or fails later validation.
- Design the payment update path to be idempotent before adding entitlement creation so duplicate callbacks do not create duplicate fulfillment.

Recommended implementation sequence:
- Implement `src/lib/payment/toyyibpay.ts` first with environment validation, request payload shaping, response parsing, and explicit sandbox error handling.
- Expand `src/server/repositories/payment-repository.ts` and `src/server/services/payment-service.ts` next so one service owns bill creation, payment event persistence, status reconciliation, and entitlement triggering.
- Wire `src/app/api/payment/toyyibpay/create-bill/route.ts` after the service layer exists, and make it accept the existing checkout-created order or payment identifiers instead of inventing a parallel flow.
- Implement `src/app/api/payment/toyyibpay/callback/route.ts` before the return route so the source-of-truth payment mutation path is completed first.
- Add the return route only after callback reconciliation is safe, and limit it to UX-focused redirect or status refresh behavior.
- Finish by replacing the `src/server/services/entitlement-service.ts` placeholder and connecting it only from the validated successful-payment branch.

Phase 5 concrete completion checklist:
- [x] Add ToyyibPay environment parsing and outbound API request helpers.
- [x] Store `bill_code`, gateway reference data, payment URL, and bill creation timestamps on the existing payment record.
- [x] Persist raw create-bill, callback, and return payloads into `payment_events` with event type metadata.
- [x] Implement duplicate-safe payment reconciliation keyed by bill code, external transaction identifiers, and current payment state.
- [x] Create entitlements only once per paid order and link them back to the successful payment.
- [x] Redirect the buyer from checkout to ToyyibPay instead of directly landing on the local order success state.
- [x] Show pending, paid, failed, expired, and cancelled outcomes clearly in the storefront order flow.
- [x] Verify the full sandbox round-trip locally before moving on to broader fulfillment polish.

### Phase 6: Digital Fulfillment and Secure Downloads
- [x] Build the order success page and payment pending state page.
- [x] Build the protected downloads page using entitlement tokens.
- [x] Implement secure asset delivery outside the public web root.
- [x] Log download events and enforce entitlement checks before serving files.
- [x] Add failure handling for invalid, expired, revoked, or missing entitlements.

Execution notes:
- Reuse the entitlements created during Phase 5 instead of inventing a second fulfillment trigger or alternate access table.
- Start with the protected downloads page and download API route so token validation, order context loading, and failure states are established before file streaming is added.
- Keep product assets outside the public web root and resolve them from `STORAGE_ROOT` only after entitlement, status, and optional expiry checks pass.
- Log every successful file delivery in `entitlement_download_logs`, including asset identity and lightweight request context where available.
- Decide the first-pass download policy before implementation: unlimited active downloads versus enforcing `download_limit` once the admin tooling exists.

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
2026-05-02 - Completed the live storefront catalog read path in the app repo, including the Prisma-backed home page, filtered product listing page, product detail page, and unavailable-product handling for draft, archived, or missing slugs.
2026-05-02 - Completed the guest cart state flow with persistent local cart storage, a shared cart drawer, live navbar cart count, and add-to-cart actions across storefront catalog views.
2026-05-03 - Completed the storefront cart page and checkout page UI for guest purchases, including buyer information capture and cart summary review.
2026-05-03 - Implemented the checkout backend flow in `templatehub`, including payload validation, published-product revalidation, transactional order creation, order item persistence, initial payment record creation, and order success page rendering.
2026-05-03 - Verified the current app state repeatedly with `npm run lint` and `npm run build` after each major Phase 3 and Phase 4 milestone, leaving the `templatehub` worktree clean at the end of Phase 4.
2026-05-03 - Audited the existing Phase 5 app files and confirmed that the payment integration remains scaffold-only: `src/lib/payment/toyyibpay.ts`, `src/server/services/payment-service.ts`, `src/server/services/entitlement-service.ts`, and the ToyyibPay route handlers are still placeholders.
2026-05-03 - Expanded this plan with the concrete implementation sequence, completion checklist, and file ownership focus for the ToyyibPay bill creation, callback reconciliation, and entitlement pass.
2026-05-03 - Completed Phase 5 in `templatehub`, including the ToyyibPay sandbox client, create-bill route, return and callback handlers, payment event persistence, callback-hash validation, idempotent payment reconciliation, and one-time entitlement creation.
2026-05-03 - Verified the new payment lifecycle with `npm run prisma:generate`, `npm run lint`, `npm run build`, `npm run db:deploy`, a live ToyyibPay sandbox bill creation, a simulated successful callback, and a duplicate-callback entitlement check.
2026-05-03 - Added the local sandbox callback helper `npm run dev:tunnel`, which generates `.env.development.local` with public HTTPS callback overrides so ToyyibPay can reach the local app during development.
2026-05-03 - Updated the plan to close Phase 5 and shift the next implementation session to Phase 6 protected downloads and secure fulfillment.
2026-05-03 - Completed Phase 6 in `templatehub`, replacing the protected-download placeholders with entitlement-aware page loading, secure download delivery, storage-path validation, failure states, download-count enforcement, and delivery logging in `entitlement_download_logs`.
2026-05-03 - Added the local helper `npm run dev:seed-assets` so development placeholder files can be generated under protected storage and the download flow can be exercised without manual file setup.
2026-05-03 - Verified the fulfillment flow with `npm run dev:seed-assets`, `npm run lint`, `npm run build`, a protected-download smoke test against a paid entitlement, and a database check confirming the new download log row and `download_count` increment.

## Next Session Start Point

- Continue in the app repo at `C:\Users\taufi\Documents\Dev\templatehub`.
- Begin Phase 7 by implementing admin authentication and route protection around the existing admin pages, keeping storefront guest checkout separate from admin access control.
- Expand the admin products flow after auth so product creation, editing, publishing, archiving, and asset-linking workflows can manage the now-live fulfillment paths.
- Build the admin orders and payment-events pages next so paid, pending, failed, and callback-received orders can be reviewed without direct database access.
- Add audit logging around the admin-side product and order management actions once the main admin mutations are wired.
- Keep using `npm run dev:tunnel` and `npm run dev:seed-assets` whenever storefront purchase-to-download regressions need to be rechecked during Phase 7 work.
- Keep using auto-commit after each completed todo item.
