# AgentKYB Commerce Guard — 7-day shopping-agent integration pilot

**For:** developers building AI shopping agents for clothing, shoes, electronics and other ordinary online products.

**What exists today:** a free local checkout-integrity SDK, a clothing demo with fake product data, detailed test suite and public source. This is **not** a hosted shopping API or merchant checkout/PSP integration. No order or actual payment can be performed by these components alone.

## Core problem

A user approves a specific seller, SKU, size/color variant, quantity, destination and budget. When the shopping agent reaches final checkout, the seller may have changed the item, shipping price, taxes, returns, merchant/payee or total. We want the agent to stop rather than assume prior approval still applies.

## Seven-day candidate pilot

| Day | Activity | Evidence |
| --- | --- | --- |
| 1 | Map one real shopping-agent use case and its buyer-consent storage | Data-flow diagram with trusted authorization source |
| 2 | Map a complete *sandbox* final checkout quote to the [SDK contract](COMMERCE_GUARD_V0.1.md) | No unknown price fields or silent drops |
| 3 | Run normal shoes/clothing purchase simulation | `allow` for exact match; no actual checkout |
| 4 | Inject adverse quote changes: size, seller/payee, price, shipping, expiry and tax | `block` or `review`, PSP mock never called |
| 5 | Connect `createCheckoutGate` to a partner-provided **mock** purchase callback | Rejected quotes never reach the callback |
| 6 | Review consent authentication, charge binding, repeat purchase and replay prevention with partner | Defined owner for each mandatory security check |
| 7 | Report fit, gaps and whether a funded, independent checkout pilot is justified | Integration evidence, developer feedback, defined next action |

A **live real-money purchase is strictly out of scope** unless the buyer separately authorizes a specific order, seller, amount and payment method and the partner provides appropriate regulated checkout controls. No developer should send us card data, wallet private keys, customer passwords or raw shipping addresses.

## What we need from the partner

1. A developer contact and which agent/runtime they use (for example a custom MCP agent).
2. A **sandbox** checkout response with all item, shipping, tax, fee, return and payee fields.
3. A first-party buyer-consent design or mock consent store, independent of merchant quote.
4. Agreement on what success looks like: no charges in tests, blocked mutations, time to integrate, interest in paid support or deeper vendor enrichment.

## Business positioning

- Free: local `@agentkyb/payment-guard/commerce` deterministic policy SDK.
- Potentially paid: developer integration/support and optional online vendor intelligence when a validated use case requires external data.
- The separate `vendor_preflight` KYB service currently advertises **0.05 USDC** on Base for supported entities, but is not a dependency of the local Commerce Guard.
- Commercial implementation pricing is *not yet validated*, so there is no published subscription or guaranteed pilot fee.

## Links

- Source: https://github.com/Andy229651/agentkyb-agent-tools
- Integration contract: [Commerce Guard v0.1](COMMERCE_GUARD_V0.1.md)
- Simulated clothing checkout: [Demo](../examples/commerce-checkout.mjs)
- Report a technical integration question: https://github.com/Andy229651/agentkyb-agent-tools/issues

**Important:** An in-house demo, GitHub install or security scan counts as *controlled test*, not a third-party customer, sale, transaction or revenue.
