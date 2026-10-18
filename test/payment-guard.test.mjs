import test from 'node:test';
import assert from 'node:assert/strict';
import { guardPayment, assertPaymentAllowed, withPaymentGuard } from '../sdk/index.js';

const baseline = Object.freeze({
  endpoint: 'https://agentkyb.andy229651.workers.dev/mcp-x402',
  expected_endpoint: 'https://agentkyb.andy229651.workers.dev/mcp-x402',
  pay_to: '0x63Ef759d667394EFB6dd9403fD60ac7B619d3018',
  expected_pay_to: '0x63Ef759d667394EFB6dd9403fD60ac7B619d3018',
  amount_usd: '0.05', expected_amount_usd: '0.05',
  network: 'eip155:8453', expected_network: 'eip155:8453'
});
const blockedCases = [
  ['changed recipient', { pay_to: '0x2222222222222222222222222222222222222222' }, 'pay_to_changed'],
  ['missing trusted recipient', { expected_pay_to: undefined }, 'missing_trusted_pay_to'],
  ['changed endpoint', { endpoint: 'https://evil.example/tool' }, 'endpoint_changed'],
  ['missing trusted endpoint', { expected_endpoint: undefined }, 'missing_trusted_endpoint'],
  ['HTTP endpoint', { endpoint: 'http://agentkyb.andy229651.workers.dev/mcp-x402' }, 'invalid_endpoint'],
  ['localhost endpoint', { endpoint: 'https://localhost/mcp-x402' }, 'invalid_endpoint'],
  ['private network endpoint', { endpoint: 'https://192.168.1.1/tool' }, 'invalid_endpoint'],
  ['more expensive', { amount_usd: '0.050001' }, 'price_changed'],
  ['cheaper than trusted quote', { amount_usd: '0.04' }, 'price_changed'],
  ['missing expected price', { expected_amount_usd: undefined }, 'missing_trusted_amount'],
  ['sub-micro amount', { amount_usd: '0.0000001' }, 'invalid_amount'],
  ['zero price', { amount_usd: '0' }, 'invalid_amount'],
  ['changed network', { network: 'eip155:84532' }, 'network_changed'],
  ['missing expected network', { expected_network: undefined }, 'missing_trusted_network'],
  ['unsupported network', { network: 'eip155:1' }, 'invalid_network'],
  ['invalid recipient', { pay_to: 'bad' }, 'invalid_pay_to']
];
test('trusted, matching Base USDC payment intent may pass', () => {
  const result = assertPaymentAllowed(baseline);
  assert.equal(result.action, 'allow');
  assert.equal(result.reasons.length, 0);
});
test('all changed/missing fields fail closed with explanatory reason', () => {
  for (const [name, change, reason] of blockedCases) {
    const result = guardPayment({ ...baseline, ...change });
    assert.equal(result.action, 'block', name);
    assert.ok(result.reasons.some(r => r.code === reason), name + ': ' + JSON.stringify(result.reasons));
    assert.throws(() => assertPaymentAllowed({ ...baseline, ...change }), /AgentKYB blocked payment/, name);
  }
});
test('safe wrapper invokes the caller signer on allow and never for altered intent', async () => {
  let signed = 0;
  const guarded = withPaymentGuard(async () => { signed++; return { transaction_hash: 'simulated' }; });
  const ok = await guarded(baseline);
  assert.equal(ok.payment.transaction_hash, 'simulated');
  assert.equal(signed, 1);
  for (const [, change] of blockedCases) await assert.rejects(guarded({ ...baseline, ...change }));
  assert.equal(signed, 1);
});
