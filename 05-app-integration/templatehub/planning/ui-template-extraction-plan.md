# UI Template Extraction Plan

## 1. Source Template

Source folder:
[ecommerce-app-frontend-template](ecommerce-app-frontend-template)

## 2. Goal

Use the existing frontend template as the visual and interaction foundation for TemplateHub, while extracting only the reusable UI elements and avoiding demo-only business logic.

The template already has a good base for:
- premium storefront styling
- product grid presentation
- cart interactions
- modal and drawer patterns
- lightweight admin interface patterns
- shared interaction feedback such as toasts

However, the current template is still a demo and contains hardcoded products, fake authentication, localStorage cart logic, and a simulated ToyyibPay checkout. Those parts should be replaced by the real app backend.

The real application stack assumed by this extraction plan is:
- Next.js
- PostgreSQL
- Prisma
- ToyyibPay sandbox integration

## 3. What Should Be Reused

### 3.1 Reusable UI Components

These components are good extraction candidates because they are mostly presentational and can be reused with minimal changes:

- `src/components/Button.tsx`
  Reuse as the base button component for storefront, checkout, and admin actions.

- `src/components/Modal.tsx`
  Reuse for order details, auth screens, file preview, confirmation dialogs, and admin overlays.

- `src/components/Drawer.tsx`
  Reuse for mobile navigation, cart drawer, filters drawer, and possible admin side panels.

- `src/components/Toast.tsx`
  Reuse for success, error, and info feedback across the app.

### 3.2 Reusable Domain-Oriented UI Patterns

These components contain useful UI structure but need data and behavior refactoring:

- `src/components/ProductCard.tsx`
  Reuse the visual card layout, image block, title, price area, and call-to-action structure.
  Replace:
  - hardcoded `Product` type
  - direct `addToCart` assumptions
  - demo currency formatting logic

- `src/components/Cart.tsx`
  Reuse:
  - cart list layout
  - quantity controls
  - order summary layout
  - payment method block styling
  Replace:
  - step logic that mixes cart, checkout, and fake success state
  - local-only checkout handling
  - shipping address assumptions
  - simulated ToyyibPay payment

- `src/components/AuthModal.tsx`
  Reuse:
  - modal structure
  - sign-in and sign-up visual layout
  Replace:
  - fake auth flow
  - localStorage user persistence

- `src/components/AdminDashboard.tsx`
  Reuse selectively:
  - dashboard card layout
  - summary stat blocks
  - table styling
  - page section structure
  Replace:
  - fake charts
  - fake schedule data
  - fake recent orders

### 3.3 Reusable Styling Foundation

The CSS theme in `src/index.css` is worth extracting:
- color tokens
- border color system
- background tone system
- button contrast pattern
- consistent uppercase tracking-heavy commerce styling
- scrollbar styling

This gives TemplateHub a coherent storefront identity immediately.

## 4. What Should Not Be Reused Directly

These parts should not be copied as-is into the real application:

- `src/data.ts`
  Demo-only hardcoded product data.

- `src/types.ts`
  Too small for the real data model and not aligned to the PostgreSQL schema.

- `src/context/AuthContext.tsx`
  Uses simulated sign-in/sign-up and localStorage-only auth.

- `src/context/CartContext.tsx`
  Useful conceptually, but should be reworked to support server-backed cart state or a more deliberate client cart model.

- `src/App.tsx`
  Good as a visual prototype, but it mixes too many concerns in one file and contains sections not relevant to TemplateHub.

## 5. Important UI Elements to Extract for TemplateHub

These are the most important UI ideas from the template for this digital-product app:

### 5.1 Storefront Shell
- sticky top navigation
- category navigation
- search entry point
- cart icon with item count
- responsive mobile drawer

### 5.2 Product Discovery
- clean product grid
- product card with thumbnail, title, category, and price
- hover-driven CTA reveal
- category-based browsing

### 5.3 Checkout Experience
- cart drawer or modal
- checkout summary block
- clear total section
- payment method highlight block for ToyyibPay
- clear error feedback and pending states

### 5.4 Post-Payment Experience
- success confirmation screen
- order number display
- purchased file list
- call-to-action toward download access

### 5.5 Admin UI
- simple management dashboard shell
- summary cards for orders, paid orders, revenue, and download activity
- table layout for products, orders, and payment events

## 6. Recommended Extraction Map

### 6.1 New UI Folder Structure for TemplateHub

```text
src/
|-- components/
|   |-- ui/
|   |   |-- button.tsx
|   |   |-- modal.tsx
|   |   |-- drawer.tsx
|   |   `-- toast.tsx
|   |-- storefront/
|   |   |-- navbar.tsx
|   |   |-- hero.tsx
|   |   |-- product-card.tsx
|   |   |-- product-grid.tsx
|   |   |-- product-filters.tsx
|   |   `-- footer.tsx
|   |-- cart/
|   |   |-- cart-panel.tsx
|   |   |-- cart-line-item.tsx
|   |   `-- cart-summary.tsx
|   |-- checkout/
|   |   |-- checkout-form.tsx
|   |   |-- payment-method-card.tsx
|   |   `-- order-success-card.tsx
|   |-- downloads/
|   |   `-- download-list.tsx
|   `-- admin/
|       |-- dashboard-stat-card.tsx
|       |-- orders-table.tsx
|       |-- products-table.tsx
|       `-- payment-events-table.tsx
```

### 6.2 Component Mapping from Template to Real App

| Template File | Reuse Decision | Target in Real App |
|---|---|---|
| `components/Button.tsx` | Reuse with minor cleanup | `components/ui/button.tsx` |
| `components/Modal.tsx` | Reuse with minor cleanup | `components/ui/modal.tsx` |
| `components/Drawer.tsx` | Reuse with minor cleanup | `components/ui/drawer.tsx` |
| `components/Toast.tsx` | Reuse with minor cleanup | `components/ui/toast.tsx` |
| `components/ProductCard.tsx` | Refactor heavily | `components/storefront/product-card.tsx` |
| `components/Cart.tsx` | Split into smaller pieces | `components/cart/*` and `components/checkout/*` |
| `components/AuthModal.tsx` | Refactor heavily | `components/auth/auth-modal.tsx` |
| `components/AdminDashboard.tsx` | Extract visual patterns only | `components/admin/*` |
| `context/ToastContext.tsx` | Reuse pattern | `providers/toast-provider.tsx` |
| `context/CartContext.tsx` | Rework | `providers/cart-provider.tsx` |
| `context/AuthContext.tsx` | Rebuild | `providers/auth-provider.tsx` |
| `index.css` | Reuse theme foundation | global stylesheet / design tokens |

## 7. UI Pages TemplateHub Should Have

Based on the template and the project requirements, the app UI should be organized into these main pages:

- Home page
- Product listing page
- Product detail page
- Cart panel or cart page
- Checkout page
- Payment pending page
- Order success page
- Protected downloads page
- Admin login page
- Admin products page
- Admin orders page
- Admin payment events page

## 8. Why These UI Elements Were Chosen

### 8.1 Strong Fit for Digital Commerce
The template already presents products in a premium storefront style, which suits a digital template business well. Buyers should feel they are purchasing polished digital assets, not browsing a rough internal tool.

### 8.2 Good Reuse-to-Effort Ratio
The reusable pieces are the shell components, interaction components, and visual layout system. Reusing these gives fast progress without locking the app into demo-only logic.

### 8.3 Good Separation of UI and Backend
The app we are designing needs real PostgreSQL-backed checkout and ToyyibPay integration. Reusing only the presentation layer keeps the system clean and avoids mixing fake state management into production flows.

### 8.4 Better Long-Term Maintainability
Splitting the monolithic template into smaller domain-based components makes the future Next.js app easier to extend, test, and connect to the backend modules already defined in the project specification.

## 9. Recommended Refactoring Rules Before Using the Template

1. Move generic UI pieces into `components/ui`.
2. Split domain-specific UI by storefront, cart, checkout, downloads, and admin.
3. Remove all hardcoded product data.
4. Replace localStorage-only auth and cart assumptions with real providers, server actions, or API handlers backed by Prisma.
5. Replace the fake ToyyibPay success simulation with real redirect and callback-driven UI states.
6. Replace product types with Prisma-aligned or application-domain TypeScript types.
7. Keep the visual design system, but simplify any sections that are purely decorative and unrelated to the app goals.

## 10. Final Recommendation

The template is worth using, but as a **UI system and interaction starter**, not as an application architecture starter.

The right extraction strategy is:
- keep the design language
- keep the reusable shell components
- keep the product and admin presentation patterns
- discard the fake business logic
- rebuild data flow around the real TemplateHub schema and ToyyibPay workflow
