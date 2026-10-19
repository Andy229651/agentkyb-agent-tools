# AgentKYB — Vendor Verification for AI Payment Workflows

**A practical integration pilot for agent developers, MCP platforms and procurement/payment automation teams.**

## Problem

AI agents can discover services and initiate payments, but automated workflows still need an explicit decision point before sending funds to an unfamiliar company or vendor.

## What AgentKYB offers today

- **Vendor Preflight**: paid MCP/x402 verification returning structured company, domain and potential sanctions evidence where supported by the available data sources, with `allow`, `review` or `block` for routing. Decision support only: not a compliance certification, a guarantee, sanctions clearance or permission to pay.
- **Payment Guard SDK**: free, local, non-custodial pre-sign checks. Compares recipient, USDC amount, endpoint and Base network against *separately trusted* values. The client keeps wallet custody, authorization, signing and budgets.
- **Interfaces**: public MCP and x402 on Base mainnet. Current `vendor_preflight` price: **0.05 USDC per completed paid request**. Geographic scope and source depth vary; confirm coverage before scoping.

Production MCP: `https://agentkyb.andy229651.workers.dev/mcp-x402`  
Agent skill: https://clawhub.ai/andy229651/skills/agentkyb-vendor-check  
Free SDK: https://github.com/Andy229651/agentkyb-agent-tools

## Proposed 7-day integration pilot

**For:** a developer or team with an AI agent, MCP service, procurement, marketplace payout or automated supplier payment flow.

**Goal:** insert a verifiable decision step **before** their own payment operation.

1. Scope one real workflow, entity and supported jurisdiction.
2. Install the SDK or skill and run a simulated Payment Guard test. Confirm a modified recipient or quote blocks signing.
3. Connect a client to the production MCP endpoint and read the unpaid x402 challenge, without spending funds.
4. **Optional, independently authorized:** use the prospect's own approved wallet and budget for one real `vendor_preflight` request, paid at the posted 0.05 USDC price. Never give AgentKYB or its maintainers private keys.
5. Deliver a brief implementation record: compatibility, evidence fields, allow/review/block handling, limitations, and possible recurring usage.

**Outside scope:** customer wallet custody, sanctions clearance, legal approval, unlimited global coverage, guarantees against fraud, or any SLA that has not been contracted.

**Commercial model:** implementation support, trial allowance or partner/volume fees can be quoted after scoping. **No prepaid pilot or subscription is advertised as currently available.**

## Evidence of success

- Independent installation and one simulated blocked tampered payment.
- A functioning MCP connection and unpaid x402 challenge inspection.
- If an approved paid request occurs, structured output and auditable settlement receipt consumed in the partner's workflow.
- Clear attribution between leads, maintainer-controlled tests, third-party installations, external paid calls and revenue.

## Partner checklist

A practical buyer brings: (a) one use case, (b) the MCP or x402 library/agent stack, (c) a test developer, and (d) one target company in a supported jurisdiction. An independently controlled funded wallet is optional and only necessary for a partner-authorized real paid test.

## Discuss a pilot

Open an issue: https://github.com/Andy229651/agentkyb-agent-tools/issues

*Pilot offer for discovery conversations; partnership and commercial terms are subject to agreement.*
