# Demo Data, S3 Deployment & Git History Reset — Design

**Date:** 2026-05-16
**Status:** Approved, pending implementation

---

## Overview

Three changes to make the project safe and easy to demo to prospective buyers:

1. **Plugin config fallback** — `viz-plugin.ts` falls back to `viz.config.example.yml` when `viz.config.yml` is missing, so CI builds work without extra steps and buyers can run `pnpm dev` immediately after cloning.
2. **S3 + CloudFront deployment** — replace the GitHub Pages workflow with an S3 sync + CloudFront invalidation workflow using GitHub Secrets for credentials.
3. **Demo data rewrite** — delete all 29 company-specific service YAML files and `externals.yml`; replace with a fictional e-commerce company ("Nexmart") with no references to "aviv", "immowelt", "seloger", "DTP", "CAF", "WLCAF", "ACL", "delegation", or "napoleon".
4. **Git history reset** — squash all commits into a single `Initial commit` so no company-identifiable history remains.

---

## Part 1: Plugin Config Fallback

**File:** `src/viz-plugin.ts` — `readConfig()` function.

**New lookup order:**
1. If `viz.config.yml` exists → use it (existing behaviour)
2. Else if `viz.config.example.yml` exists → use it, print warning to console
3. Else → throw `"Neither viz.config.yml nor viz.config.example.yml found."`

**Warning message:**
```
[viz-plugin] viz.config.yml not found, falling back to viz.config.example.yml
```

**Impact:**
- CI: no extra steps needed — `viz.config.example.yml` is committed and drives the build
- Buyers: `pnpm dev` works immediately after clone, before they copy the example
- Existing local users: unaffected (`viz.config.yml` still takes priority)

---

## Part 2: S3 Deploy Workflow

**File:** `.github/workflows/deploy.yml` — full replacement.

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
      - run: npm install -g pnpm@11
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}
      - run: aws s3 sync dist/ s3://${{ secrets.S3_BUCKET }} --delete
      - run: aws cloudfront create-invalidation --distribution-id ${{ secrets.CLOUDFRONT_DIST_ID }} --paths "/*"
```

**Required GitHub Secrets:**

| Secret | Value |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key |
| `AWS_REGION` | AWS region (e.g. `eu-west-1`) |
| `S3_BUCKET` | S3 bucket name |
| `CLOUDFRONT_DIST_ID` | CloudFront distribution ID |

The CloudFront invalidation step can be removed if no distribution is configured; S3 static website URL works directly over HTTP in that case.

---

## Part 3: Demo Data Rewrite

### Fictional company: Nexmart

A generic e-commerce platform. No real company names anywhere — not in file names, service names, summaries, team names, or owner fields.

### viz.config.example.yml areas (replaces DTP areas)

| New id | New label | Replaces |
|--------|-----------|---------|
| checkout | Checkout | WLCAF |
| fulfillment | Fulfillment | CAF Dispatcher |
| identity | Identity | ACL |
| platform | Platform | Delegation |
| mobile | Mobile | Mobile (unchanged concept) |
| catalog | Catalog | Private Listings |
| legacy | Legacy | Legacy (unchanged concept) |
| external | External | External (unchanged concept) |

### viz.config.example.yml kinds and edgeKinds

Kinds stay the same (frontend, backend, bff, library, infra, mobile, test, external). Edge kinds stay the same. Only the `areas` section changes to the new e-commerce areas above.

### Service files (29 total)

All 29 old files in `data/services/` deleted. Old `data/externals.yml` deleted. New files named `<service-id>.yml`.

**Checkout (7 services):**
| File | id | name | kind |
|------|----|------|------|
| `checkout-web.yml` | checkout-web | Checkout Web | frontend |
| `checkout-bff.yml` | checkout-bff | Checkout BFF | bff |
| `cart-service.yml` | cart-service | Cart Service | backend |
| `order-service.yml` | order-service | Order Service | backend |
| `payment-gateway.yml` | payment-gateway | Payment Gateway | backend |
| `promotions-service.yml` | promotions-service | Promotions Service | backend |
| `checkout-e2e.yml` | checkout-e2e | Checkout E2E Tests | test |

**Fulfillment (3 services):**
| File | id | name | kind |
|------|----|------|------|
| `fulfillment-api.yml` | fulfillment-api | Fulfillment API | backend |
| `fulfillment-dashboard.yml` | fulfillment-dashboard | Fulfillment Dashboard | frontend |
| `shipment-tracker.yml` | shipment-tracker | Shipment Tracker | backend |

**Identity (2 services):**
| File | id | name | kind |
|------|----|------|------|
| `auth-service.yml` | auth-service | Auth Service | backend |
| `user-permissions.yml` | user-permissions | User Permissions | backend |

**Platform (3 services):**
| File | id | name | kind |
|------|----|------|------|
| `notification-service.yml` | notification-service | Notification Service | backend |
| `media-service.yml` | media-service | Media Service | backend |
| `design-system.yml` | design-system | Design System | library |

**Mobile (5 services):**
| File | id | name | kind |
|------|----|------|------|
| `shopper-ios.yml` | shopper-ios | Shopper iOS | mobile |
| `shopper-android.yml` | shopper-android | Shopper Android | mobile |
| `seller-android.yml` | seller-android | Seller Android | mobile |
| `mobile-bff.yml` | mobile-bff | Mobile BFF | bff |
| `mobile-component-lib.yml` | mobile-component-lib | Mobile Component Library | library |

**Catalog (7 services):**
| File | id | name | kind |
|------|----|------|------|
| `product-catalog-api.yml` | product-catalog-api | Product Catalog API | backend |
| `catalog-bff.yml` | catalog-bff | Catalog BFF | bff |
| `search-service.yml` | search-service | Search Service | backend |
| `inventory-service.yml` | inventory-service | Inventory Service | backend |
| `recommendation-engine.yml` | recommendation-engine | Recommendation Engine | backend |
| `product-listing-ui.yml` | product-listing-ui | Product Listing UI | frontend |
| `product-detail-ui.yml` | product-detail-ui | Product Detail UI | frontend |

**Legacy (2 services):**
| File | id | name | kind |
|------|----|------|------|
| `legacy-catalog-api.yml` | legacy-catalog-api | Legacy Catalog API | backend |
| `legacy-order-processor.yml` | legacy-order-processor | Legacy Order Processor | backend |

### externals.yml (6 externals)

| id | name | summary |
|----|------|---------|
| stripe | Stripe | Payment processing |
| sendgrid | SendGrid | Transactional email |
| twilio | Twilio | SMS notifications |
| google-analytics | Google Analytics | Web analytics |
| aws-s3-assets | AWS S3 (Assets) | Product image and media storage |
| algolia | Algolia | Hosted search index |

### Dependency graph

Realistic depends_on edges to make the graph interesting:

- `checkout-web` → `checkout-bff` (sync-http)
- `checkout-bff` → `cart-service`, `order-service`, `promotions-service` (sync-http)
- `order-service` → `payment-gateway`, `fulfillment-api`, `inventory-service` (sync-http)
- `payment-gateway` → stripe (sync-http)
- `fulfillment-api` → `shipment-tracker` (sync-http)
- `shipment-tracker` → twilio (async-event)
- `order-service` → `notification-service` (async-event)
- `notification-service` → sendgrid, twilio (sync-http)
- `auth-service` → `user-permissions` (sync-http)
- `checkout-bff` → `auth-service` (sync-http)
- `mobile-bff` → `cart-service`, `order-service`, `auth-service`, `product-catalog-api` (sync-http)
- `shopper-ios` → `mobile-bff` (sync-http)
- `shopper-android` → `mobile-bff` (sync-http)
- `seller-android` → `mobile-bff` (sync-http)
- `product-catalog-api` → `search-service`, `inventory-service` (sync-http)
- `search-service` → algolia (sync-http)
- `recommendation-engine` → `product-catalog-api` (database-read)
- `catalog-bff` → `product-catalog-api`, `recommendation-engine` (sync-http)
- `product-listing-ui` → `catalog-bff` (sync-http)
- `product-detail-ui` → `catalog-bff` (sync-http)
- `media-service` → `aws-s3-assets` (sync-http)
- `product-catalog-api` → `media-service` (sync-http)
- `checkout-e2e` → `checkout-web` (consumes)
- `legacy-catalog-api` → `product-catalog-api` (replaces)
- `legacy-order-processor` → `order-service` (replaces)
- `fulfillment-dashboard` → `fulfillment-api` (sync-http)
- `checkout-bff` → `google-analytics` (async-event)
- `design-system` shared by `checkout-web`, `product-listing-ui`, `product-detail-ui`, `fulfillment-dashboard` (shared-lib)
- `mobile-component-lib` shared by `shopper-ios`, `shopper-android`, `seller-android` (shared-lib)

---

## Part 4: Git History Reset

**Procedure (irreversible):**

```bash
git checkout --orphan clean-start
git add -A
git commit -m "Initial commit"
git branch -D main
git branch -m clean-start main
```

**Result:** Single commit on `main`. All prior history — including any commits referencing the company — is permanently gone from the local repo. The working tree is unchanged.

**Note:** If the repo has already been pushed to a remote, the remote still has the old history. A force-push (`git push --force origin main`) would be needed to overwrite it. This should be done before sharing the repo URL with anyone.

---

## Acceptance Criteria

- `pnpm dev` works immediately after `git clone` with no additional setup
- `pnpm build` succeeds in CI with no `viz.config.yml` present
- Zero occurrences of "aviv", "immowelt", "seloger", "DTP", "CAF", "WLCAF", "ACL", "delegation", "napoleon" anywhere in tracked files
- S3 deploy workflow runs successfully on push to `main` (once secrets are configured)
- Git log shows exactly one commit: `Initial commit`

---

## Out of Scope

- Creating the S3 bucket or CloudFront distribution (user's existing infrastructure)
- Setting up the GitHub Secrets (documented in README, done by user)
- Designing the IAM policy for the deploy user
