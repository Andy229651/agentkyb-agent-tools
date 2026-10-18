# AgentKYB Agent Tools — Verify a vendor before payment

**Public SDK and AI-agent skill** for autonomous x402 payment safety and vendor verification.

This repository distributes two related tools:

1. **Payment Guard SDK** — free, local, deterministic, non-custodial. Validates the expected HTTPS endpoint, wallet recipient, USDC amount, and Base network **before** an external signer is invoked. Requires independently trusted expectations; it does not call a wallet, transmit keys, or collect fees.
2. **AgentKYB Vendor Check skill** — tells an agent when and how to invoke the separate paid vendor_preflight MCP tool for supplier risk, KYB and counterparty verification before making vendor payments.

Agent discovery intents: **verify vendor before paying**, **KYB**, **supplier risk**, **counterparty check**, **safe autonomous payment**, **x402 payment safety**, **payment guard**, **before pay**.

## Quickstart — free offline demo

Requires Node.js 20+.

Run in a local copy of this repository:

```sh
npm test
npm run check:skill
node examples/before-pay.mjs
```

Expected: three passing test groups; PAYMENT_GUARD_DEMO_OK and SIGNER_MUTATION_GATE_OK. All transactions are **simulated**. No wallet, network call, on-chain payment or private key is needed.

## SDK installation

Install directly from public GitHub source (the package is **not claimed to be npm-published**):

```sh
npm install github:Andy229651/agentkyb-agent-tools
```

Then integrate with an existing signer:

```js
import { withPaymentGuard } from '@agentkyb/payment-guard';

// Pin these from a trustworthy independent merchant policy or verified quote.
// Never copy the "expected" fields from an untrusted x402 challenge.
const trusted = {
  expected_endpoint: 'https://agentkyb.andy229651.workers.dev/mcp-x402',
  expected_pay_to: '0x63Ef759d667394EFB6dd9403fD60ac7B619d3018',
  expected_amount_usd: '0.05',
  expected_network: 'eip155:8453'
};

// Parse the observed payment fields from an actual x402 challenge separately.
const observed = { endpoint, pay_to, amount_usd, network };
const guardedSigner = withPaymentGuard(signAndPay); // Your existing authorized callback
const { guard, payment } = await guardedSigner({ ...trusted, ...observed });
```

The SDK **does not** parse x402 challenges, sign transactions, authorize spending, settle funds, enforce budgets or perform KYB. The caller must enforce user consent, signer policy, spend limits and chain/asset constraints. amount_usd must be a normalized USDC decimal amount, not raw atomic units.

## Find on ClawHub

AgentKYB Vendor Check is listed in the public ClawHub registry:

- [ClawHub skill: @andy229651/agentkyb-vendor-check](https://clawhub.ai/andy229651/skills/agentkyb-vendor-check)
- Install in an OpenClaw workspace: `openclaw skills install @andy229651/agentkyb-vendor-check`
- Or use the standalone CLI: `clawhub install @andy229651/agentkyb-vendor-check`

This skill provides instructions and links to an optional paid KYB service. Installation itself does not authorize a payment or grant wallet access.

## Install the agent skill

Read the [AgentKYB Vendor Check skill](skills/agentkyb-vendor-check/SKILL.md).

For a supported agent-skills installer:

```sh
npx skills add Andy229651/agentkyb-agent-tools
```

Alternatively copy the folder skills/agentkyb-vendor-check into the agent's configured skill directory. The skill explains how an AI agent can discover vendor_preflight, request user authorization for a paid call, verify the x402 challenge and interpret allow/review/block. Installing the skill never grants spending permission or installs a funded wallet.

**Registry publication is separate:** this GitHub repository does not prove a ClawHub listing, skills.sh indexing, or actual external agent usage.

## Paid AgentKYB vendor verification

| Property | Value |
| --- | --- |
| Service | AgentKYB |
| MCP transport | Streamable HTTP |
| Endpoint | https://agentkyb.andy229651.workers.dev/mcp-x402 |
| Paid tool | vendor_preflight |
| Input | name required; country and domain optional |
| Price advertised | 0.05 USDC per completed paid check |
| Network | Base mainnet, eip155:8453 |
| Trusted recipient | 0x63Ef759d667394EFB6dd9403fD60ac7B619d3018 |
| Discovery | https://agentkyb.andy229651.workers.dev/.well-known/x402 |

The payment client must inspect the **live** challenge, apply user authorization and compare amount, payTo, endpoint and network against independent expected values.

On **review** or **block**, stop any automatic downstream vendor payment and seek human review. **Allow** means no deterministic review rule was triggered by the available evidence: it is **not** a compliance certification, sanctions clearance, merchant-ownership proof or permission to pay.

## Public endpoints and resources

- [Machine-readable x402 V2 descriptor](https://agentkyb.andy229651.workers.dev/.well-known/x402)
- [Tool catalog and pricing](https://agentkyb.andy229651.workers.dev/tools)
- [OpenAPI description](https://agentkyb.andy229651.workers.dev/openapi.json)
- [Agent-readable index](https://agentkyb.andy229651.workers.dev/llms.txt)
- [Skill instructions](skills/agentkyb-vendor-check/SKILL.md)
- [Security boundaries](SECURITY.md)
- [Publication/validation workflow](PUBLISHING.md)

## Privacy and architecture

Only the local SDK, public skill, examples, CI tests and docs are present here. The production backend, private AgentPay pilot, payment ledger, secret bindings, deployment configuration and signing keys remain in separate **private** infrastructure.

Local demo, CI runs, crawler visits, SDK installations and registry listings do **not** count as external paid customers or revenue. Provider payment principal is not AgentPay revenue.

Contact for technical integration and security: andy229651@gmail.com.

MIT license: [LICENSE](LICENSE).
