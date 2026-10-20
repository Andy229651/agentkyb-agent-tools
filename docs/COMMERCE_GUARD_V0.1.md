# AgentKYB Commerce Guard v0.1 — Clothing and Online Products

**Status:** Public-source SDK candidate, not a production commerce-payment gateway, not an active UCP/AP2/ACP integration, not a revenue-generating checkout API.

## What it solves

Insert a deterministic local guard between an AI shopping agent's **authenticated, independently stored buyer permission** and the **complete final checkout quote**. Check whether the cart still fits the permission that the person gave.

This version is intended for apparel (size, color, SKU) and ordinary ecommerce products. It does not book flights, place orders, authenticate users, capture card payments or perform KYB.

The first principle is **fail closed**: missing authorization, unrecognized price fields, an inconsistent total, changed merchant/payee, modified SKU or variant, changed address, quantity, currency or shipment method all cause `block`.

A higher line-item price or shipping/tax/fee/total over the explicit buyer ceiling causes `review`, requiring fresh authenticated consent; a different return policy also causes `review`. Neither `review` nor `block` may reach the payment executor.

## API (Node.js 20+)

Install directly from the public GitHub repository:

```sh
npm install github:Andy229651/agentkyb-agent-tools
```

Import just the commerce module:

```js
import {
  checkoutPreflight,
  assertCheckoutAllowed,
  createCheckoutGate
} from '@agentkyb/payment-guard/commerce';
```

This is an **offline SDK**. There is no remote Commerce Guard endpoint, hosted subscription, store plugin or card payment processor in v0.1.

`checkoutPreflight({authorization,checkout,now})` returns a result:

```json
{
  "product": "commerce_guard",
  "policy_version": "0.1.0",
  "action": "review",
  "reasons": [
    {
      "severity": "review",
      "code": "total_over_budget",
      "detail": "Total exceeds the buyer-approved limit; obtain new consent."
    }
  ]
}
```

`assertCheckoutAllowed(...)` throws for **both** `review` and `block`.

`createCheckoutGate({getTrustedAuthorization,executeCheckout,clock})` retrieves the consent from a separate trusted loader, evaluates a detached immutable quote, and calls the supplied **external** checkout callback only for `allow`. It does not execute an order itself. A PSP must independently bind actual payment capture to the same authorized order details.

## Normalized data contract

The consent must come from a **first-party authenticated authorization service**, not from scraped product pages or the seller's own checkout response. It includes:

| authorization field | Meaning |
| --- | --- |
| `authorization_id` | Trusted reference to a separately authenticated consent record. It is **not a signature**. |
| `issued_at`, `expires_at` | Strict UTC timestamps with a maximum 24-hour authorization window; shorter lifetimes recommended |
| `merchant_origin` | Canonical, public HTTPS origin, e.g. `https://store.example.com/` |
| `merchant_id` | Independently trusted marketplace/merchant identifier |
| `payee_id` | Independently trusted PSP recipient/merchant-of-record identifier |
| `currency` | ISO 4217 code such as `COP`, `USD` or `EUR`; **no FX conversion** |
| `items` | One or more exact `sku`, `variant_id`, `quantity`, and `max_unit_amount_minor` |
| `max_total_minor` | Total maximum including delivery, taxes and every other charge |
| `max_shipping_minor`, `max_tax_minor`, `max_fee_minor` | Independent ceilings on each class of charge |
| `shipping_address_fingerprint` | `sha256:` + 64 lowercase hex digits over canonical address, computed and pinned **by the trusted buyer system** |
| `shipping_method_id` | Exact shipping service authorized by the buyer |
| `return_policy_id` | Trustworthy policy version identifier tied to actual return terms |

The adapter maps the **final** observed checkout quote to:

- `merchant_origin`, `merchant_id`, `payee_id`, `currency`;
- `items` with exact `sku`, `variant_id` (for apparel, include size/color), `quantity`, `unit_amount_minor`;
- `shipping_address_fingerprint`, `shipping_method_id`, `return_policy_id`;
- `amounts`: `subtotal_minor`, `shipping_minor`, `tax_minor`, `fee_minor`, `discount_minor`, `total_minor`.

**Amounts are nonnegative base-10 integer strings representing ISO currency minor units**, not floating-point amounts: COP 300000 is 300,000 pesos; USD 1999 is $19.99. Both are strings, e.g. `"300000"`, `"1999"`. The integration must apply the correct ISO currency exponent. The SDK does not know exchange rates.

## Apparel demo

```sh
git clone https://github.com/Andy229651/agentkyb-agent-tools.git
cd agentkyb-agent-tools
npm test
npm run demo:commerce
```

The demonstration uses a fake store, a sneaker in **size 42**, a COP budget, a deterministic clock and a no-spend mock callback. It tests the approved purchase, altered size, increased price and redirected payee.

Expected output includes `COMMERCE_GUARD_DEMO_OK`, with `real_charges: 0`.

The demo uses simulated data only. It is **not evidence of a retail marketplace or UCP integration**.

## Security boundaries and requirements

1. **Authenticated buyer intent is mandatory.** A raw JSON `authorization` object is not proof that a person approved anything. The host must authenticate the person, enforce consent scope and expiration, and store the approved data separately from merchant, agent prompt and product-page content.
2. **Payee and merchant identity must be independently pinned.** A syntactically valid `https://` domain does not establish merchant ownership, certificate chain, DNS legitimacy or payment account identity.
3. **Do not trust raw merchant totals.** The checkout adapter must map **every price component** into the supported amount fields, preserving currency and taxes. Unexpected unrecognized fields cause a block; a malicious adapter that silently discards charges is outside the guard's detection scope.
4. **Order binding and replay resistance remain the responsibility of the PSP and host.** The SDK does not enforce unique authorization consumption, wallet spending limits, order identity, tokens, SCA/3DS or capture-time changes.
5. **No stored address data.** Only a caller-calculated fingerprint is compared. Protect low-entropy address data by using a suitable keyed representation in your own consent infrastructure. The SDK cannot independently confirm the shipping address.
6. **Policy IDs are opaque.** The commerce platform must pin and verify a return-policy version against the actual visible terms.
7. **Validation should run immediately before purchase.** Any final quote, tax, delivery, seller or payee change after the guard requires reevaluation and potentially new consent.
8. **No actual spending.** Local tests, clean installs, catalogs and mocks are maintainer-controlled evidence only, not external revenue.

## Future interoperability

Explore adapters for authenticated merchant product/checkout resources and agent commerce protocols (for example, UCP, ACP and AP2). **No protocol support is claimed yet.** First obtain a willing developer partner and a complete normalizable sandbox checkout payload; then build a tested adapter rather than guessing a vendor-specific payload shape.

## Commercial model

The Commerce Guard logic is free locally in v0.1. Integration/support fees and a hosted, paid risk-enrichment endpoint are **concepts under customer validation**, not active subscriptions. AgentKYB's separate paid `vendor_preflight` service remains at **0.05 USDC**, on supported jurisdictions and with independently authorized payment.

Contact for a scoped technical pilot: https://github.com/Andy229651/agentkyb-agent-tools/issues
