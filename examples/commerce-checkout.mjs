// Offline clothes checkout demo — NO web requests, wallet, actual order or payment.
// Run: node examples/commerce-checkout.mjs
import { checkoutPreflight, createCheckoutGate } from '../sdk/commerce.js';

const consent = {
  authorization_id: 'customer-consent-demo-001',
  issued_at: '2026-10-20T11:00:00Z',
  expires_at: '2026-10-20T11:15:00Z',
  merchant_origin: 'https://clothing.example.com/',
  merchant_id: 'store-1',
  payee_id: 'psp:store-1',
  currency: 'COP',
  items: [
    { sku: 'sneaker-100', variant_id: 'black-size-42', quantity: 1,
      max_unit_amount_minor: '250000' }
  ],
  max_total_minor: '265000',
  max_shipping_minor: '15000',
  max_tax_minor: '0',
  max_fee_minor: '0',
  shipping_address_fingerprint: 'sha256:'+'a'.repeat(64),
  shipping_method_id: 'standard',
  return_policy_id: 'returns-30-days-v1'
};
const quote = {
  merchant_origin: 'https://clothing.example.com/',
  merchant_id: 'store-1',
  payee_id: 'psp:store-1',
  currency: 'COP',
  items: [
    { sku: 'sneaker-100', variant_id: 'black-size-42', quantity: 1,
      unit_amount_minor: '250000' }
  ],
  shipping_address_fingerprint: consent.shipping_address_fingerprint,
  shipping_method_id: 'standard',
  return_policy_id: 'returns-30-days-v1',
  amounts: {
    subtotal_minor: '250000', shipping_minor: '15000', tax_minor: '0',
    fee_minor: '0', discount_minor: '0', total_minor: '265000'
  }
};
// The "consent" object is a stand-in for an independently authenticated
// first-party authorization database. NEVER infer it from merchant checkout.
const clock = () => Date.parse('2026-10-20T11:05:00Z');
const correct = checkoutPreflight({ authorization: consent, checkout: quote, now: clock() });
const wrongSize = checkoutPreflight({
  authorization: consent, checkout: {
    ...quote, items: [{ ...quote.items[0], variant_id: 'black-size-41' }]
  }, now: clock()
});
const higherPrice = checkoutPreflight({
  authorization: consent, checkout: {
    ...quote, items: [{ ...quote.items[0], unit_amount_minor: '300000' }],
    amounts: { ...quote.amounts, subtotal_minor: '300000', total_minor: '315000' }
  }, now: clock()
});
const alteredPayee = checkoutPreflight({
  authorization: consent, checkout: { ...quote, payee_id: 'psp:fraud' }, now: clock()
});

let executed = 0;
const gated = createCheckoutGate({
  getTrustedAuthorization: async () => consent,
  // PSP callback here is a SIMULATION, never a charge. The production PSP
  // must require separate consent, bind order ID and check final charge.
  executeCheckout: async () => { executed++; return { simulated: true, charged: false }; },
  clock
});
await gated(quote);
for (const tampered of [
  { ...quote, payee_id: 'psp:fraud' },
  { ...quote, items: [{ ...quote.items[0], variant_id: 'black-size-41' }] }
]) {
  try { await gated(tampered); } catch {}
}
if (correct.action !== 'allow' || wrongSize.action !== 'block' ||
  higherPrice.action !== 'review' || alteredPayee.action !== 'block' ||
  executed !== 1) throw new Error('Commerce Guard demonstration failed.');
console.log('COMMERCE_GUARD_DEMO_OK', {
  valid: correct.action,
  wrong_size: wrongSize.action,
  over_budget: higherPrice.action,
  diverted_payee: alteredPayee.action,
  simulated_checkout_callbacks: executed,
  real_charges: 0
});
