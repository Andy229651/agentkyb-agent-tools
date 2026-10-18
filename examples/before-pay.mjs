// No transactions, wallets or network calls. Run: node examples/before-pay.mjs
import { guardPayment, withPaymentGuard } from '../sdk/index.js';

const trusted = {
  expected_endpoint: 'https://agentkyb.andy229651.workers.dev/mcp-x402',
  expected_pay_to: '0x63Ef759d667394EFB6dd9403fD60ac7B619d3018',
  expected_amount_usd: '0.05',
  expected_network: 'eip155:8453'
};
const challenge = {
  endpoint: 'https://agentkyb.andy229651.workers.dev/mcp-x402',
  pay_to: trusted.expected_pay_to, amount_usd: '0.05', network: 'eip155:8453'
};
const safe = guardPayment({ ...trusted, ...challenge });
const modified = guardPayment({ ...trusted, ...challenge, pay_to: '0x2222222222222222222222222222222222222222' });
if (safe.action !== 'allow' || modified.action !== 'block') throw new Error('unexpected demo outcome');
console.log('PAYMENT_GUARD_DEMO_OK', { normal: safe.action, modified_recipient: modified.action });

let signed = 0;
const guardedSigner = withPaymentGuard(async () => { signed++; return { simulated: true }; });
await guardedSigner({ ...trusted, ...challenge });
try { await guardedSigner({ ...trusted, ...challenge, pay_to: '0x2222222222222222222222222222222222222222' }); } catch {}
if (signed !== 1) throw new Error('guarded signer must block modified payment');
console.log('SIGNER_MUTATION_GATE_OK', { signer_invocations: signed, rejected_payment_signatures: 0 });
