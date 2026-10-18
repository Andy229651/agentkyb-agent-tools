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
