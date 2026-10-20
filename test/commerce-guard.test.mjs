import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutPreflight, assertCheckoutAllowed, createCheckoutGate, COMMERCE_GUARD_VERSION } from '../sdk/commerce.js';

const authorization = Object.freeze({
  authorization_id: 'consent-2026-001',
  issued_at: '2026-10-20T11:00:00Z',
  expires_at: '2026-10-20T11:15:00Z',
  merchant_origin: 'https://store.example.com/',
  merchant_id: 'store-001',
  payee_id: 'psp:merchant-001',
  currency: 'COP',
  items: [
    { sku: 'shoes-001', variant_id: 'size-42-black', quantity: 1, max_unit_amount_minor: '250000' },
    { sku: 'shirt-002', variant_id: 'size-M-blue', quantity: 2, max_unit_amount_minor: '50000' }
  ],
  max_total_minor: '365000',
  max_shipping_minor: '15000',
  max_tax_minor: '0',
  max_fee_minor: '0',
  shipping_address_fingerprint: 'sha256:'+'a'.repeat(64),
  shipping_method_id: 'standard',
  return_policy_id: 'returns-30d-v1'
});
const checkout = Object.freeze({
  merchant_origin: 'https://store.example.com/',
  merchant_id: 'store-001',
  payee_id: 'psp:merchant-001',
  currency: 'COP',
  items: [
    { sku: 'shoes-001', variant_id: 'size-42-black', quantity: 1, unit_amount_minor: '250000' },
    { sku: 'shirt-002', variant_id: 'size-M-blue', quantity: 2, unit_amount_minor: '50000' }
  ],
  shipping_address_fingerprint: 'sha256:'+'a'.repeat(64),
  shipping_method_id: 'standard',
  return_policy_id: 'returns-30d-v1',
  amounts: {
    subtotal_minor: '350000',
    shipping_minor: '15000',
    tax_minor: '0',
    fee_minor: '0',
    discount_minor: '0',
    total_minor: '365000'
  }
});
const clock = Date.parse('2026-10-20T11:10:00Z');
const clone = (v) => structuredClone(v);
const probe = (authChange = {}, quoteChange = {}, now = clock) => checkoutPreflight({
  authorization: { ...clone(authorization), ...authChange },
  checkout: { ...clone(checkout), ...quoteChange },
  now
});
const has = (result, code) => result.reasons.some(r => r.code === code);

test('baseline apparel purchase passes with verified sum, same SKU, size, shipping and COP currency', () => {
  const verdict = probe();
  assert.equal(COMMERCE_GUARD_VERSION, '0.1.0');
  assert.equal(verdict.action, 'allow');
  assert.deepEqual(verdict.reasons, []);
  assert.equal(verdict.checks.checkout_math_reconciled, true);
  assert.equal(verdict.product, 'commerce_guard');
});

const blocked = [
  ['missing trusted authorization', null, null, 'invalid_authorization', 'authorization'],
  ['missing checkout', null, null, 'invalid_checkout', 'checkout'],
  ['missing consent id', { authorization_id: '' }, {}, 'missing_authorization_id'],
  ['expiry', {}, {}, 'authorization_expired', 'expires_at'],
  ['future consent', {}, {}, 'authorization_not_yet_valid', 'issued_at'],
  ['overlong consent', { expires_at: '2026-10-22T11:00:00Z' }, {}, 'invalid_authorization_window'],
  ['malformed UTC', { expires_at: '2026-10-20' }, {}, 'invalid_authorization_window'],
  ['noncanonical UTC', { expires_at: '2026-02-30T11:15:00Z' }, {}, 'invalid_authorization_window'],
  ['invalid merchant origin', {}, { merchant_origin: 'http://store.example.com/' }, 'invalid_merchant_origin'],
  ['malicious merchant origin', {}, { merchant_origin: 'https://store.example.com.evil.net/' }, 'merchant_origin_changed'],
  ['merchant ID replaced', {}, { merchant_id: 'fake-shop' }, 'merchant_id_changed'],
  ['payment payee altered', {}, { payee_id: 'psp:other-merchant' }, 'payee_id_changed'],
  ['currency changed', {}, { currency: 'USD' }, 'currency_changed'],
  ['invalid currency', {}, { currency: 'COP$' }, 'invalid_currency'],
  ['shipping destination altered', {}, { shipping_address_fingerprint: 'sha256:'+'b'.repeat(64) }, 'shipping_address_fingerprint_changed'],
  ['shipping method changed', {}, { shipping_method_id: 'express' }, 'shipping_method_id_changed'],
  ['new product', {}, { items: [...clone(checkout.items), { sku: 'hidden-extra', variant_id: 'default', quantity: 1, unit_amount_minor: '0' }] }, 'unauthorized_product'],
  ['removed product', {}, { items: [clone(checkout.items[0])] }, 'authorized_product_missing'],
  ['size swapped', {}, { items: [{ ...clone(checkout.items[0]), variant_id: 'size-40-black' }, clone(checkout.items[1])] }, 'unauthorized_product'],
  ['quantity increased', {}, { items: [{ ...clone(checkout.items[0]), quantity: 2 }, clone(checkout.items[1])] }, 'quantity_changed'],
  ['duplicate SKU variant', {}, { items: [...clone(checkout.items), clone(checkout.items[0])] }, 'duplicate_item'],
  ['fraudulent line subtotal', {}, { amounts: { ...clone(checkout.amounts), subtotal_minor: '340000' } }, 'subtotal_mismatch'],
  ['fraudulent order total', {}, { amounts: { ...clone(checkout.amounts), total_minor: '360000' } }, 'total_mismatch'],
  ['negative shipping as string', {}, { amounts: { ...clone(checkout.amounts), shipping_minor: '-1000' } }, 'invalid_shipping_minor'],
  ['fractional amount', {}, { amounts: { ...clone(checkout.amounts), fee_minor: '0.1' } }, 'invalid_fee_minor'],
  ['unexpected extra fee field', {}, { amounts: { ...clone(checkout.amounts), service_fee_minor: '5000' } }, 'invalid_amounts_unknown_field'],
  ['missing tax field', {}, { amounts: { ...clone(checkout.amounts), tax_minor: undefined } }, 'invalid_tax_minor'],
  ['unexpected checkout field', {}, { gift_card_charge_minor: '1000' }, 'invalid_checkout_unknown_field'],
  ['discount larger than gross', {}, { amounts: { ...clone(checkout.amounts), discount_minor: '400000' } }, 'total_mismatch'],
  ['no shipping fingerprint', {}, { shipping_address_fingerprint: '' }, 'invalid_shipping_address_fingerprint'],
  ['no trusted maximum', { max_total_minor: undefined }, {}, 'invalid_total_limit'],
  ['missing fee cap', { max_fee_minor: undefined }, {}, 'invalid_max_fee_minor'],
  ['unexpected authorization field', { implicit_authorization: true }, {}, 'invalid_authorization_unknown_field'],
  ['invalid trusted clock', {}, {}, 'invalid_clock', 'clock']
];

test('tampering and incomplete consent always block', () => {
  for (const [name, authDelta, quoteDelta, expectedCode, special] of blocked) {
    let params;
    if (special === 'authorization') params = { authorization: null, checkout, now: clock };
    else if (special === 'checkout') params = { authorization, checkout: null, now: clock };
    else if (special === 'expires_at') params = { authorization, checkout, now: Date.parse('2026-10-20T11:15:00Z') };
    else if (special === 'issued_at') params = { authorization, checkout, now: Date.parse('2026-10-20T10:59:59Z') };
    else if (special === 'clock') params = { authorization, checkout, now: Infinity };
    else params = { authorization: { ...clone(authorization), ...authDelta }, checkout: { ...clone(checkout), ...quoteDelta }, now: clock };
    const verdict = checkoutPreflight(params);
    assert.equal(verdict.action, 'block', name + ': ' + JSON.stringify(verdict.reasons));
    assert.ok(has(verdict, expectedCode), name + ': ' + JSON.stringify(verdict.reasons));
    assert.throws(() => assertCheckoutAllowed(params), /Commerce Guard stopped checkout/, name);
  }
});

test('price increases and policy changes require human reapproval, never auto purchase', () => {
  const changed = [
    ['unit_price_increased', {}, {
      items: [{ ...clone(checkout.items[0]), unit_amount_minor: '260000' }, clone(checkout.items[1])],
      amounts: { ...clone(checkout.amounts), subtotal_minor: '360000', total_minor: '375000' }
    }],
    ['total_over_budget', { max_total_minor: '360000' }, {}],
    ['shipping_minor_over_budget', { max_shipping_minor: '10000' }, {}],
    ['tax_minor_over_budget', { max_tax_minor: '0' }, {
      amounts: { ...clone(checkout.amounts), tax_minor: '1000', total_minor: '366000' }
    }],
    ['fee_minor_over_budget', { max_fee_minor: '0' }, {
      amounts: { ...clone(checkout.amounts), fee_minor: '1000', total_minor: '366000' }
    }],
    ['return_policy_id_changed', {}, { return_policy_id: 'no-returns' }]
  ];
  for (const [reason, authDelta, quoteDelta] of changed) {
    const result = probe(authDelta, quoteDelta);
    assert.equal(result.action, 'review', reason + ': ' + JSON.stringify(result.reasons));
    assert.ok(has(result, reason));
  }
});

test('minor-unit string accounting supports COP without floats and USD without FX conversion', () => {
  const auth = { ...clone(authorization), currency: 'USD',
    items: [{sku:'shirt-1',variant_id:'M',quantity:2,max_unit_amount_minor:'1999'}],
    max_total_minor:'4500',max_shipping_minor:'500',max_tax_minor:'100',max_fee_minor:'0' };
  const quote = { ...clone(checkout),currency:'USD',
    items:[{sku:'shirt-1',variant_id:'M',quantity:2,unit_amount_minor:'1999'}],
    amounts:{subtotal_minor:'3998',shipping_minor:'500',tax_minor:'0',fee_minor:'0',discount_minor:'0',total_minor:'4498'} };
  assert.equal(checkoutPreflight({authorization:auth,checkout:quote,now:clock}).action, 'allow');
});

test('discounts within approved limits are reconciled and may allow lower total', () => {
  const amounts = { ...clone(checkout.amounts), discount_minor:'15000',total_minor:'350000' };
  const result = probe({}, { amounts });
  assert.equal(result.action, 'allow');
});

test('block outranks review if fraud and budget issues coexist', () => {
  const result = probe({max_total_minor:'100000'}, { payee_id:'psp:attacker' });
  assert.equal(result.action, 'block');
  assert.ok(has(result,'total_over_budget'));
  assert.ok(has(result,'payee_id_changed'));
});

test('gated checkout only invokes PSP on allow, with a frozen detached quote', async () => {
  let calls=0, consentCalls=0, captured;
  const gate=createCheckoutGate({
    getTrustedAuthorization: async () => { consentCalls++; return clone(authorization); },
    executeCheckout: async quote => {
      calls++;
      assert.equal(Object.isFrozen(quote), true);
      assert.equal(Object.isFrozen(quote.items[0]), true);
      captured=quote;
      return { simulated: true, charge_issued: false };
    },
    clock:()=>clock
  });
  const base=clone(checkout);
  const allowed=await gate(base);
  assert.equal(allowed.guard.action,'allow');
  assert.equal(calls,1);
  assert.equal(allowed.receipt.charge_issued,false);
  assert.notStrictEqual(captured,base);
  assert.notEqual(Object.isFrozen(base), true);
  for (const altered of [
    {...clone(checkout),payee_id:'psp:fraud'},
    {...clone(checkout),currency:'EUR'},
    {...clone(checkout),items:[{...clone(checkout.items[0]),variant_id:'wrong-size'},clone(checkout.items[1])]},
    {...clone(checkout),return_policy_id:'no-returns'}
  ]) await assert.rejects(gate(altered));
  assert.equal(calls,1);
  assert.equal(consentCalls,5);
});

test('gate construction fails without first-party authorization and checkout callbacks', () => {
  assert.throws(()=>createCheckoutGate({}),/Trusted consent loader/);
  assert.throws(()=>createCheckoutGate({getTrustedAuthorization:async()=>authorization}),/checkout callback/);
});

test('does not expose address or cart identifiers inside verdict', () => {
  const result=probe();
  const publicOutput=JSON.stringify(result);
  assert.ok(!publicOutput.includes('shoes-001'));
  assert.ok(!publicOutput.includes('sha256:'));
  assert.ok(!publicOutput.includes('consent-2026-001'));
});
