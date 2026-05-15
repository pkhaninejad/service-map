# Demo Data, S3 Deployment & Git History Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all company-specific demo data with a fictional e-commerce architecture (Nexmart), add S3+CloudFront deployment, fix the plugin to work without viz.config.yml, and wipe git history.

**Architecture:** Plugin gets a config fallback so CI builds work without a local viz.config.yml. All 29 DTP service YAML files are deleted and replaced with Nexmart e-commerce services. The GitHub Pages workflow is replaced with an S3 sync workflow. Finally, all git history is squashed into a single clean commit.

**Tech Stack:** Vite plugin API (Node.js), YAML, GitHub Actions, AWS CLI, git

**Spec:** `docs/superpowers/specs/2026-05-16-demo-and-deployment-design.md`

---

> **No test runner configured.** Verification uses `pnpm build` (TypeScript + Vite) and a grep scan for leaked company names.

> **Order matters:** Tasks 1–12 make code changes and commit normally. Task 13 verifies. Task 14 resets history last — all prior commits disappear permanently.

---

## File Map

| Action | File |
|--------|------|
| Modify | `src/viz-plugin.ts` (readConfig fallback) |
| Modify | `viz.config.example.yml` (new e-commerce areas) |
| Replace | `.github/workflows/deploy.yml` |
| Delete | `data/services/aviv-android.yml` and all 28 other old service files |
| Delete | `data/externals.yml` |
| Create | `data/services/checkout-web.yml` |
| Create | `data/services/checkout-bff.yml` |
| Create | `data/services/cart-service.yml` |
| Create | `data/services/order-service.yml` |
| Create | `data/services/payment-gateway.yml` |
| Create | `data/services/promotions-service.yml` |
| Create | `data/services/checkout-e2e.yml` |
| Create | `data/services/fulfillment-api.yml` |
| Create | `data/services/fulfillment-dashboard.yml` |
| Create | `data/services/shipment-tracker.yml` |
| Create | `data/services/auth-service.yml` |
| Create | `data/services/user-permissions.yml` |
| Create | `data/services/notification-service.yml` |
| Create | `data/services/media-service.yml` |
| Create | `data/services/design-system.yml` |
| Create | `data/services/shopper-ios.yml` |
| Create | `data/services/shopper-android.yml` |
| Create | `data/services/seller-android.yml` |
| Create | `data/services/mobile-bff.yml` |
| Create | `data/services/mobile-component-lib.yml` |
| Create | `data/services/product-catalog-api.yml` |
| Create | `data/services/catalog-bff.yml` |
| Create | `data/services/search-service.yml` |
| Create | `data/services/inventory-service.yml` |
| Create | `data/services/recommendation-engine.yml` |
| Create | `data/services/product-listing-ui.yml` |
| Create | `data/services/product-detail-ui.yml` |
| Create | `data/services/legacy-catalog-api.yml` |
| Create | `data/services/legacy-order-processor.yml` |
| Create | `data/externals.yml` |

---

## Task 1: Plugin config fallback

**Files:**
- Modify: `src/viz-plugin.ts:55-73`

- [ ] **Step 1: Replace the readConfig function body**

Open `src/viz-plugin.ts`. Replace the existing `readConfig` function (lines 54–73) with:

```typescript
function readConfig(root: string): VizConfig {
  const configPath = path.resolve(root, "viz.config.yml");
  const examplePath = path.resolve(root, "viz.config.example.yml");

  let usedPath: string;
  if (fs.existsSync(configPath)) {
    usedPath = configPath;
  } else if (fs.existsSync(examplePath)) {
    console.warn(
      "[viz-plugin] viz.config.yml not found, falling back to viz.config.example.yml"
    );
    usedPath = examplePath;
  } else {
    throw new Error(
      "Neither viz.config.yml nor viz.config.example.yml found.\nCreate viz.config.yml by copying viz.config.example.yml."
    );
  }

  const config = yaml.load(fs.readFileSync(usedPath, "utf-8")) as VizConfig;
  if (!config.areas?.length)
    throw new Error(`${path.basename(usedPath)}: 'areas' must have at least one entry.`);
  if (!config.kinds?.length)
    throw new Error(`${path.basename(usedPath)}: 'kinds' must have at least one entry.`);
  if (!config.statuses?.length)
    throw new Error(`${path.basename(usedPath)}: 'statuses' must have at least one entry.`);
  if (!config.edgeKinds?.length)
    throw new Error(`${path.basename(usedPath)}: 'edgeKinds' must have at least one entry.`);
  return config;
}
```

- [ ] **Step 2: Verify build passes**

```bash
pnpm build 2>&1 | tail -5
```

Expected: `✓ built in ...ms`

- [ ] **Step 3: Verify fallback works by temporarily renaming viz.config.yml**

```bash
mv viz.config.yml viz.config.yml.bak
pnpm build 2>&1 | grep "viz-plugin\|built"
mv viz.config.yml.bak viz.config.yml
```

Expected: output contains `[viz-plugin] viz.config.yml not found, falling back to viz.config.example.yml` followed by `✓ built in ...ms`

- [ ] **Step 4: Commit**

```bash
git add src/viz-plugin.ts
git commit -m "feat: viz-plugin falls back to viz.config.example.yml when viz.config.yml is missing"
```

---

## Task 2: Update viz.config.example.yml with e-commerce areas

**Files:**
- Modify: `viz.config.example.yml`

The `areas` section changes from DTP-specific names to generic e-commerce names. Kinds, statuses, and edgeKinds stay the same. Area `id` values must match the `area:` field in all service YAML files created in later tasks.

- [ ] **Step 1: Replace the areas section in viz.config.example.yml**

Replace the entire file content with:

```yaml
# viz.config.example.yml
# Copy this file to viz.config.yml and customise it for your team.
# viz.config.yml is gitignored — only the example is tracked.

# Path to the directory containing service YAML files (relative to repo root).
dataDir: ./data

areas:
  - id: checkout
    label: Checkout
    color: { bg: "#eff6ff", border: "#2563eb", text: "#1d4ed8", pill: "#dbeafe" }
  - id: catalog
    label: Catalog
    color: { bg: "#f5f3ff", border: "#7c3aed", text: "#6d28d9", pill: "#ede9fe" }
  - id: fulfillment
    label: Fulfillment
    color: { bg: "#ecfeff", border: "#0891b2", text: "#0e7490", pill: "#cffafe" }
  - id: identity
    label: Identity
    color: { bg: "#fdf2f8", border: "#db2777", text: "#be185d", pill: "#fce7f3" }
  - id: mobile
    label: Mobile
    color: { bg: "#f0fdf4", border: "#16a34a", text: "#15803d", pill: "#dcfce7" }
  - id: platform
    label: Platform
    color: { bg: "#fff7ed", border: "#ea580c", text: "#c2410c", pill: "#fed7aa" }
  - id: legacy
    label: Legacy
    color: { bg: "#fafaf9", border: "#78716c", text: "#57534e", pill: "#f5f5f4" }
  - id: external
    label: External
    color: { bg: "#f8fafc", border: "#94a3b8", text: "#64748b", pill: "#f1f5f9" }

kinds:
  - id: frontend
    label: Frontend
    icon: "⬡"
  - id: backend
    label: Backend
    icon: "λ"
  - id: bff
    label: BFF
    icon: "⇌"
  - id: library
    label: Library
    icon: "◈"
  - id: infra
    label: Infra
    icon: "☁"
  - id: mobile
    label: Mobile
    icon: "⬜"
  - id: test
    label: Test
    icon: "✓"
  - id: external
    label: External
    icon: "○"

statuses:
  - Planning
  - In Progress
  - On Hold
  - Done
  - Done / Maintenance
  - Deprecated
  - Being Migrated

edgeKinds:
  - id: sync-http
    label: HTTP
    color: "#1e293b"
  - id: async-event
    label: Async Event
    color: "#7c3aed"
    dashed: true
    animated: true
  - id: database-read
    label: DB Read
    color: "#059669"
  - id: database-write
    label: DB Write
    color: "#dc2626"
  - id: shared-lib
    label: Shared Lib
    color: "#94a3b8"
    dashed: true
  - id: replaces
    label: Replaces
    color: "#d97706"
  - id: deprecates
    label: Deprecates
    color: "#cbd5e1"
    dashed: true
  - id: consumes
    label: Consumes
    color: "#0891b2"
  - id: publishes
    label: Publishes
    color: "#0891b2"
    dashed: true
```

- [ ] **Step 2: Also update your local viz.config.yml to match**

```bash
cp viz.config.example.yml viz.config.yml
```

- [ ] **Step 3: Commit**

```bash
git add viz.config.example.yml
git commit -m "feat: update viz.config.example.yml with Nexmart e-commerce areas"
```

---

## Task 3: Replace GitHub Actions deploy workflow

**Files:**
- Replace: `.github/workflows/deploy.yml`

- [ ] **Step 1: Replace .github/workflows/deploy.yml**

```yaml
name: Deploy to S3

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "22"

      - name: Install pnpm
        run: npm install -g pnpm@11

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm build

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Deploy to S3
        run: aws s3 sync dist/ s3://${{ secrets.S3_BUCKET }} --delete

      - name: Invalidate CloudFront cache
        run: aws cloudfront create-invalidation --distribution-id ${{ secrets.CLOUDFRONT_DIST_ID }} --paths "/*"
```

> **Required GitHub Secrets** — add these in repo Settings → Secrets and variables → Actions:
> - `AWS_ACCESS_KEY_ID`
> - `AWS_SECRET_ACCESS_KEY`
> - `AWS_REGION` (e.g. `eu-west-1`)
> - `S3_BUCKET` (your bucket name)
> - `CLOUDFRONT_DIST_ID` (your CloudFront distribution ID)
>
> The CloudFront step can be removed if you have no distribution — S3 static website URL will serve the app over HTTP.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: replace GitHub Pages workflow with S3+CloudFront deploy"
```

---

## Task 4: Delete all old data files

**Files:**
- Delete: all files in `data/services/`
- Delete: `data/externals.yml`

- [ ] **Step 1: Remove all old service files and externals**

```bash
git rm data/services/*.yml data/externals.yml
```

Expected: lists all 29 service files and externals.yml as removed.

- [ ] **Step 2: Commit the deletions**

```bash
git commit -m "chore: remove all company-specific service data files"
```

---

## Task 5: Create Checkout services (7 files)

**Files:** Create all files listed below in `data/services/`

- [ ] **Step 1: Create data/services/checkout-web.yml**

```yaml
id: checkout-web
name: Checkout Web
area: checkout
kind: frontend
status: In Progress
owner: Checkout Team
tech: [React, TypeScript]
summary: Customer-facing checkout flow — cart review, address entry, payment, and order confirmation.
depends_on:
  - target: checkout-bff
    kind: sync-http
    via: REST
  - target: design-system
    kind: shared-lib
related: [checkout-bff, cart-service]
```

- [ ] **Step 2: Create data/services/checkout-bff.yml**

```yaml
id: checkout-bff
name: Checkout BFF
area: checkout
kind: bff
status: In Progress
owner: Checkout Team
tech: [Node.js, TypeScript]
summary: Backend-for-frontend aggregating cart, order, promotions, and auth data for the checkout web app.
depends_on:
  - target: cart-service
    kind: sync-http
    via: REST
  - target: order-service
    kind: sync-http
    via: REST
  - target: promotions-service
    kind: sync-http
    via: REST
  - target: auth-service
    kind: sync-http
    via: REST / JWT
  - target: google-analytics
    kind: async-event
    via: GA4 events
related: [checkout-web, cart-service, order-service]
```

- [ ] **Step 3: Create data/services/cart-service.yml**

```yaml
id: cart-service
name: Cart Service
area: checkout
kind: backend
status: In Progress
owner: Checkout Team
tech: [Go, Redis]
summary: Manages shopping cart state — adding, removing, and updating line items. Uses Redis for session-based storage.
depends_on: []
related: [checkout-bff, mobile-bff]
```

- [ ] **Step 4: Create data/services/order-service.yml**

```yaml
id: order-service
name: Order Service
area: checkout
kind: backend
status: In Progress
owner: Checkout Team
tech: [Java, PostgreSQL]
summary: Owns the order lifecycle from placement through fulfilment handoff. Emits order events consumed by notification and fulfilment services.
depends_on:
  - target: payment-gateway
    kind: sync-http
    via: REST
  - target: fulfillment-api
    kind: sync-http
    via: REST
  - target: inventory-service
    kind: sync-http
    via: REST
  - target: notification-service
    kind: async-event
    via: Order events (SNS)
related: [checkout-bff, fulfillment-api, payment-gateway]
```

- [ ] **Step 5: Create data/services/payment-gateway.yml**

```yaml
id: payment-gateway
name: Payment Gateway
area: checkout
kind: backend
status: In Progress
owner: Checkout Team
tech: [Node.js, TypeScript]
summary: Abstracts payment provider integrations. Routes card, wallet, and BNPL transactions through the appropriate processor.
depends_on:
  - target: stripe
    kind: sync-http
    via: Stripe API v3
related: [order-service]
```

- [ ] **Step 6: Create data/services/promotions-service.yml**

```yaml
id: promotions-service
name: Promotions Service
area: checkout
kind: backend
status: In Progress
owner: Checkout Team
tech: [Python, PostgreSQL]
summary: Manages discount codes, campaign rules, and automatic promotions. Evaluated at checkout time via the BFF.
depends_on: []
related: [checkout-bff]
```

- [ ] **Step 7: Create data/services/checkout-e2e.yml**

```yaml
id: checkout-e2e
name: Checkout E2E Tests
area: checkout
kind: test
status: In Progress
owner: Checkout Team
tech: [Cypress, TypeScript]
summary: End-to-end test suite covering the full checkout journey from cart to order confirmation.
depends_on:
  - target: checkout-web
    kind: consumes
related: [checkout-web, checkout-bff]
```

- [ ] **Step 8: Commit**

```bash
git add data/services/checkout-web.yml data/services/checkout-bff.yml data/services/cart-service.yml data/services/order-service.yml data/services/payment-gateway.yml data/services/promotions-service.yml data/services/checkout-e2e.yml
git commit -m "feat: add Checkout area services (Nexmart demo data)"
```

---

## Task 6: Create Fulfillment services (3 files)

- [ ] **Step 1: Create data/services/fulfillment-api.yml**

```yaml
id: fulfillment-api
name: Fulfillment API
area: fulfillment
kind: backend
status: In Progress
owner: Fulfillment Team
tech: [Go, PostgreSQL]
summary: Coordinates warehouse pick-pack-ship operations. Receives orders from Order Service and dispatches to logistics providers.
depends_on:
  - target: shipment-tracker
    kind: sync-http
    via: REST
  - target: notification-service
    kind: async-event
    via: Fulfilment events (SQS)
related: [order-service, shipment-tracker, fulfillment-dashboard]
```

- [ ] **Step 2: Create data/services/fulfillment-dashboard.yml**

```yaml
id: fulfillment-dashboard
name: Fulfillment Dashboard
area: fulfillment
kind: frontend
status: In Progress
owner: Fulfillment Team
tech: [React, TypeScript]
summary: Internal tool for warehouse staff to view, prioritise, and manage pending fulfilment tasks.
depends_on:
  - target: fulfillment-api
    kind: sync-http
    via: REST
  - target: design-system
    kind: shared-lib
related: [fulfillment-api]
```

- [ ] **Step 3: Create data/services/shipment-tracker.yml**

```yaml
id: shipment-tracker
name: Shipment Tracker
area: fulfillment
kind: backend
status: In Progress
owner: Fulfillment Team
tech: [Node.js, TypeScript]
summary: Polls logistics provider APIs for parcel status updates and emits tracking events to downstream services.
depends_on:
  - target: twilio
    kind: async-event
    via: SMS delivery notifications
related: [fulfillment-api]
```

- [ ] **Step 4: Commit**

```bash
git add data/services/fulfillment-api.yml data/services/fulfillment-dashboard.yml data/services/shipment-tracker.yml
git commit -m "feat: add Fulfillment area services (Nexmart demo data)"
```

---

## Task 7: Create Identity services (2 files)

- [ ] **Step 1: Create data/services/auth-service.yml**

```yaml
id: auth-service
name: Auth Service
area: identity
kind: backend
status: Done / Maintenance
owner: Platform Team
tech: [Go, PostgreSQL, Redis]
summary: Issues and validates JWT access tokens. Handles login, logout, token refresh, and OAuth2 social login flows.
depends_on:
  - target: user-permissions
    kind: sync-http
    via: gRPC
related: [user-permissions, checkout-bff, mobile-bff]
```

- [ ] **Step 2: Create data/services/user-permissions.yml**

```yaml
id: user-permissions
name: User Permissions
area: identity
kind: backend
status: Done / Maintenance
owner: Platform Team
tech: [Go, PostgreSQL]
summary: Stores and evaluates role-based access control rules. Queried by Auth Service on every token validation.
depends_on: []
related: [auth-service]
```

- [ ] **Step 3: Commit**

```bash
git add data/services/auth-service.yml data/services/user-permissions.yml
git commit -m "feat: add Identity area services (Nexmart demo data)"
```

---

## Task 8: Create Platform services (3 files)

- [ ] **Step 1: Create data/services/notification-service.yml**

```yaml
id: notification-service
name: Notification Service
area: platform
kind: backend
status: In Progress
owner: Platform Team
tech: [Node.js, TypeScript, SQS]
summary: Consumes domain events and dispatches transactional emails and SMS messages via third-party providers.
depends_on:
  - target: sendgrid
    kind: sync-http
    via: SendGrid API v3
  - target: twilio
    kind: sync-http
    via: Twilio Messaging API
related: [order-service, fulfillment-api]
```

- [ ] **Step 2: Create data/services/media-service.yml**

```yaml
id: media-service
name: Media Service
area: platform
kind: backend
status: Done / Maintenance
owner: Platform Team
tech: [Go, S3]
summary: Handles product image upload, resizing, and CDN distribution. All product images are served through this service.
depends_on:
  - target: aws-s3-assets
    kind: sync-http
    via: AWS SDK
related: [product-catalog-api]
```

- [ ] **Step 3: Create data/services/design-system.yml**

```yaml
id: design-system
name: Design System
area: platform
kind: library
status: In Progress
owner: Platform Team
tech: [React, TypeScript, Storybook]
summary: Shared component library and design tokens used across all customer-facing and internal web applications.
depends_on: []
related: [checkout-web, product-listing-ui, product-detail-ui, fulfillment-dashboard]
```

- [ ] **Step 4: Commit**

```bash
git add data/services/notification-service.yml data/services/media-service.yml data/services/design-system.yml
git commit -m "feat: add Platform area services (Nexmart demo data)"
```

---

## Task 9: Create Mobile services (5 files)

- [ ] **Step 1: Create data/services/shopper-ios.yml**

```yaml
id: shopper-ios
name: Shopper iOS
area: mobile
kind: mobile
status: In Progress
owner: Mobile Team
tech: [Swift, iOS]
summary: Native iOS shopping app covering browse, search, cart, and checkout for end consumers.
depends_on:
  - target: mobile-bff
    kind: sync-http
    via: HTTPS / GraphQL
  - target: mobile-component-lib
    kind: shared-lib
related: [shopper-android, mobile-bff]
```

- [ ] **Step 2: Create data/services/shopper-android.yml**

```yaml
id: shopper-android
name: Shopper Android
area: mobile
kind: mobile
status: In Progress
owner: Mobile Team
tech: [Kotlin, Android]
summary: Native Android shopping app covering browse, search, cart, and checkout for end consumers.
depends_on:
  - target: mobile-bff
    kind: sync-http
    via: HTTPS / GraphQL
  - target: mobile-component-lib
    kind: shared-lib
related: [shopper-ios, mobile-bff]
```

- [ ] **Step 3: Create data/services/seller-android.yml**

```yaml
id: seller-android
name: Seller Android
area: mobile
kind: mobile
status: Planning
owner: Mobile Team
tech: [Kotlin, Android]
summary: Native Android app for marketplace sellers to manage listings, orders, and inventory on the go.
depends_on:
  - target: mobile-bff
    kind: sync-http
    via: HTTPS / GraphQL
  - target: mobile-component-lib
    kind: shared-lib
related: [shopper-android, mobile-bff]
```

- [ ] **Step 4: Create data/services/mobile-bff.yml**

```yaml
id: mobile-bff
name: Mobile BFF
area: mobile
kind: bff
status: In Progress
owner: Mobile Team
tech: [Node.js, TypeScript, GraphQL]
summary: GraphQL backend-for-frontend serving all native mobile apps. Aggregates catalog, cart, auth, and order data.
depends_on:
  - target: cart-service
    kind: sync-http
    via: REST
  - target: order-service
    kind: sync-http
    via: REST
  - target: auth-service
    kind: sync-http
    via: REST / JWT
  - target: product-catalog-api
    kind: sync-http
    via: REST
related: [shopper-ios, shopper-android, seller-android]
```

- [ ] **Step 5: Create data/services/mobile-component-lib.yml**

```yaml
id: mobile-component-lib
name: Mobile Component Library
area: mobile
kind: library
status: In Progress
owner: Mobile Team
tech: [Kotlin, Swift]
summary: Shared UI components and styling primitives used across Shopper iOS, Shopper Android, and Seller Android.
depends_on: []
related: [shopper-ios, shopper-android, seller-android]
```

- [ ] **Step 6: Commit**

```bash
git add data/services/shopper-ios.yml data/services/shopper-android.yml data/services/seller-android.yml data/services/mobile-bff.yml data/services/mobile-component-lib.yml
git commit -m "feat: add Mobile area services (Nexmart demo data)"
```

---

## Task 10: Create Catalog services (7 files)

- [ ] **Step 1: Create data/services/product-catalog-api.yml**

```yaml
id: product-catalog-api
name: Product Catalog API
area: catalog
kind: backend
status: In Progress
owner: Catalog Team
tech: [Java, PostgreSQL, Elasticsearch]
summary: Source of truth for product data — titles, descriptions, prices, images, and variants. Feeds search and recommendation engines.
depends_on:
  - target: search-service
    kind: sync-http
    via: REST (index push)
  - target: inventory-service
    kind: sync-http
    via: REST
  - target: media-service
    kind: sync-http
    via: REST
related: [catalog-bff, search-service, inventory-service]
```

- [ ] **Step 2: Create data/services/catalog-bff.yml**

```yaml
id: catalog-bff
name: Catalog BFF
area: catalog
kind: bff
status: In Progress
owner: Catalog Team
tech: [Node.js, TypeScript]
summary: Backend-for-frontend serving the product listing and detail pages. Aggregates catalog and recommendation data.
depends_on:
  - target: product-catalog-api
    kind: sync-http
    via: REST
  - target: recommendation-engine
    kind: sync-http
    via: REST
related: [product-listing-ui, product-detail-ui]
```

- [ ] **Step 3: Create data/services/search-service.yml**

```yaml
id: search-service
name: Search Service
area: catalog
kind: backend
status: In Progress
owner: Catalog Team
tech: [Go, Elasticsearch]
summary: Powers product search with full-text and faceted filtering. Delegates query execution to Algolia.
depends_on:
  - target: algolia
    kind: sync-http
    via: Algolia Search API
related: [product-catalog-api]
```

- [ ] **Step 4: Create data/services/inventory-service.yml**

```yaml
id: inventory-service
name: Inventory Service
area: catalog
kind: backend
status: In Progress
owner: Catalog Team
tech: [Go, PostgreSQL]
summary: Tracks stock levels per SKU and warehouse. Decrements stock on order placement; replenishes on receipt.
depends_on: []
related: [product-catalog-api, order-service]
```

- [ ] **Step 5: Create data/services/recommendation-engine.yml**

```yaml
id: recommendation-engine
name: Recommendation Engine
area: catalog
kind: backend
status: In Progress
owner: Catalog Team
tech: [Python, PostgreSQL]
summary: Generates personalised product recommendations using collaborative filtering on purchase and browse history.
depends_on:
  - target: product-catalog-api
    kind: database-read
    via: Read replica
related: [catalog-bff]
```

- [ ] **Step 6: Create data/services/product-listing-ui.yml**

```yaml
id: product-listing-ui
name: Product Listing UI
area: catalog
kind: frontend
status: In Progress
owner: Catalog Team
tech: [React, TypeScript]
summary: Server-side rendered product listing pages with search, filtering, and sorting. Entry point for browse and discovery.
depends_on:
  - target: catalog-bff
    kind: sync-http
    via: REST
  - target: design-system
    kind: shared-lib
related: [product-detail-ui, catalog-bff]
```

- [ ] **Step 7: Create data/services/product-detail-ui.yml**

```yaml
id: product-detail-ui
name: Product Detail UI
area: catalog
kind: frontend
status: In Progress
owner: Catalog Team
tech: [React, TypeScript]
summary: Product detail page — images, description, variants, add-to-cart. Pulls live inventory from Catalog BFF.
depends_on:
  - target: catalog-bff
    kind: sync-http
    via: REST
  - target: design-system
    kind: shared-lib
related: [product-listing-ui, catalog-bff]
```

- [ ] **Step 8: Commit**

```bash
git add data/services/product-catalog-api.yml data/services/catalog-bff.yml data/services/search-service.yml data/services/inventory-service.yml data/services/recommendation-engine.yml data/services/product-listing-ui.yml data/services/product-detail-ui.yml
git commit -m "feat: add Catalog area services (Nexmart demo data)"
```

---

## Task 11: Create Legacy services (2 files)

- [ ] **Step 1: Create data/services/legacy-catalog-api.yml**

```yaml
id: legacy-catalog-api
name: Legacy Catalog API
area: legacy
kind: backend
status: Being Migrated
owner: Catalog Team
tech: [PHP, MySQL]
summary: Original monolithic product catalog. Being decommissioned as traffic migrates to Product Catalog API.
depends_on:
  - target: product-catalog-api
    kind: replaces
related: [product-catalog-api]
```

- [ ] **Step 2: Create data/services/legacy-order-processor.yml**

```yaml
id: legacy-order-processor
name: Legacy Order Processor
area: legacy
kind: backend
status: Deprecated
owner: Checkout Team
tech: [Java, Oracle DB]
summary: Original order management system. Fully replaced by Order Service; retained for historical order data access only.
depends_on:
  - target: order-service
    kind: replaces
related: [order-service]
```

- [ ] **Step 3: Commit**

```bash
git add data/services/legacy-catalog-api.yml data/services/legacy-order-processor.yml
git commit -m "feat: add Legacy area services (Nexmart demo data)"
```

---

## Task 12: Create externals.yml

**Files:**
- Create: `data/externals.yml`

- [ ] **Step 1: Create data/externals.yml**

```yaml
# External systems Nexmart integrates with but does not own.

- id: stripe
  name: Stripe
  area: external
  kind: external
  external: true
  summary: Payment processing for card, wallet, and BNPL transactions.
  depends_on: []

- id: sendgrid
  name: SendGrid
  area: external
  kind: external
  external: true
  summary: Transactional email delivery — order confirmations, shipping updates, account notifications.
  depends_on: []

- id: twilio
  name: Twilio
  area: external
  kind: external
  external: true
  summary: SMS delivery for shipment tracking notifications and two-factor authentication.
  depends_on: []

- id: google-analytics
  name: Google Analytics
  area: external
  kind: external
  external: true
  summary: Web analytics and event tracking for customer-facing storefronts.
  depends_on: []

- id: aws-s3-assets
  name: AWS S3 (Assets)
  area: external
  kind: external
  external: true
  summary: Object storage for product images and static media assets.
  depends_on: []

- id: algolia
  name: Algolia
  area: external
  kind: external
  external: true
  summary: Hosted search index powering product discovery and autocomplete.
  depends_on: []
```

- [ ] **Step 2: Commit**

```bash
git add data/externals.yml
git commit -m "feat: add Nexmart externals (Stripe, SendGrid, Twilio, GA, S3, Algolia)"
```

---

## Task 13: Verify build and scan for leaked company names

- [ ] **Step 1: Full clean build**

```bash
rm -rf dist && pnpm build 2>&1 | tail -8
```

Expected: `✓ built in ...ms` with no errors.

If build fails with validation errors, the most likely cause is a `depends_on.target` referencing a service id that doesn't exist. Check the error message — it will name the offending service file — then fix the `target` value in that file.

- [ ] **Step 2: Scan all tracked files for company-specific strings**

```bash
git grep -iEl "aviv|immowelt|seloger|wlcaf|napoleon|caf.dispatcher" -- ':!docs/' ':!*.md'
```

Expected: **no output** (zero matches). If any files appear, open them and remove or replace the offending string, then commit the fix.

- [ ] **Step 3: Verify service count is correct**

```bash
ls data/services/*.yml | wc -l
```

Expected: `29`

---

## Task 14: Git history reset (IRREVERSIBLE)

> **This permanently deletes all prior commits.** The working tree is unchanged — only history is erased. Once done, `git log` will show exactly one commit.

> **If the repo has already been pushed to a remote:** After this task, run `git push --force origin main` to overwrite the remote history too. Do this before sharing the repo URL with anyone.

- [ ] **Step 1: Confirm the working tree is clean**

```bash
git status
```

Expected: `nothing to commit, working tree clean`

If there are uncommitted changes, commit or discard them before continuing.

- [ ] **Step 2: Create an orphan branch and commit everything**

```bash
git checkout --orphan clean-start
git add -A
git commit -m "Initial commit"
```

- [ ] **Step 3: Delete old main and rename orphan to main**

```bash
git branch -D main
git branch -m clean-start main
```

- [ ] **Step 4: Verify history is a single commit**

```bash
git log --oneline
```

Expected: exactly one line, e.g. `a1b2c3d Initial commit`

- [ ] **Step 5: (If remote exists) Force-push to overwrite remote history**

```bash
git push --force origin main
```

> Only run this if you have a remote and want the remote history wiped too.
