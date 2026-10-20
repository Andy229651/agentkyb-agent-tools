# Payment Guard security boundaries

- Non-custodial, deterministic, local; no private-key storage or external requests.
- "allow" means only that supplied payment fields match independently trusted expectations, not that the merchant is verified or that paying is safe.
- Do not derive expected_pay_to, expected_amount_usd, expected_network or expected_endpoint from the same untrusted x402 challenge being evaluated.
- Valid HTTPS does not prove DNS ownership, reputation, redirect safety or absence of SSRF. Allowlist approved merchants independently.
- Callers enforce explicit spending authorization, budgets, asset allowlists, replay safety, signer policy and receipt integrity.
- amount_usd inputs are normalized USDC decimal values, **not raw on-chain atomic units**. Parse provider requirements with a trusted x402 adapter.
- The SDK does not perform KYB, sanctions or wallet reputation checks. Use the separate paid vendor_preflight service for evidence, subject to authorization.
- Neither installing this SDK nor an "allow" result authorizes an actual transfer.
- Never share private keys, Cloudflare credentials, signing material, or other secrets in issues or skill files.

Security reports: andy229651@gmail.com

## Commerce Guard v0.1 constraints

- The free local shopping preflight does **not** authenticate buyers, collect card/wallet details, call a merchant API, reserve inventory, or execute payments.
- The trusted `authorization` must be retrieved independently from an authenticated first-party consent record; a merchant-supplied JSON document does not prove user consent.
- The checkout quote must be complete, current and normalized by a trusted adapter. Never omit provider-specific surcharges, taxes, fees, tips, discounts or other payable components when mapping to `amounts`.
- Compare exact SKU, size/color variant, quantity, seller origin, seller identity, payment payee, currency, shipping conditions and policy version before approving. `review` requires renewed authenticated buyer consent, not automatic execution.
- `authorization_id` is a reference, not a cryptographic proof. The payment provider and host must independently bind the final order, payee, amount, consent and payment session, prevent replay, apply SCA where necessary, and ensure no changes occur after preflight.
- Merchant-origin syntax does not validate ownership, reputation, redirects, DNS, certificates, phishing or homograph risk. Payee identity is only as trustworthy as the source that pinned it.
- Do not hash low-entropy customer addresses with bare SHA-256 as a privacy guarantee; derive fingerprints in a trusted system and consider keyed pseudonymization.
- Product authenticity, return-policy content and inventory cannot be proved by comparing opaque seller identifiers.
- The SDK is not an external KYB service or a consumer payment service. No e-commerce, UCP, ACP or AP2 integration is claimed in v0.1.
