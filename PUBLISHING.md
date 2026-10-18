# Publication and adoption verification

This is a **public source repository** for AgentKYB's payment guard SDK and vendor-check agent skill. The separate private AgentKYB backend, AgentPay pilot, payment ledger, secrets and deployment code are not published here.

## Source and CI verification

1. Verify unauthenticated access to:
   - https://github.com/Andy229651/agentkyb-agent-tools
   - https://github.com/Andy229651/agentkyb-agent-tools/blob/main/skills/agentkyb-vendor-check/SKILL.md
2. Confirm the public tree excludes credentials, .env, payment ledger, private backend and Cloudflare wrangler configuration.
3. Run locally or inspect CI for:
   - npm test
   - npm run check:skill
   - node examples/before-pay.mjs
   - npm pack --dry-run --json
4. Independently test installation using:
   - npm install github:Andy229651/agentkyb-agent-tools
   - node -e "import('@agentkyb/payment-guard').then(m => console.log(m.PAYMENT_GUARD_VERSION))"

## Agent skills registries

The source skill is at skills/agentkyb-vendor-check/SKILL.md. The repo is designed for compatible agent-skills installers (for example, npx skills add Andy229651/agentkyb-agent-tools).

**Do not claim ClawHub, skills.sh, npm or any third-party catalog has indexed this project until independently verified.** A registry-specific publication may require an account, review and additional steps. Verify current official publisher instructions before attempting registry publication, and use the account owner for any authenticated login. Do not share auth tokens in chat.

## Agent-first discovery test

Search from a clean catalog client, **without including the AgentKYB brand, repository URL or endpoint**:
- verify vendor before paying
- supplier counterparty KYB
- payment guard for x402 agents

Record the catalog, timestamp, query and whether a relevant result points to this repository or the live MCP endpoint.

Then install from a clean environment with no access to the private repository. Verify the skill detects the task, describes the paid tool, presents its price, and requires separate spending consent. A self-funded live call with an independently operated agent is a separate milestone and requires the user's explicit authorization.

Never classify impressions, tests, testnet, controlled payments or self-installations as external customers or revenue.
