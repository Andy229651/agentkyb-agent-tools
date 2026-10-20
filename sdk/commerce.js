/**
 * AgentKYB Commerce Guard v0.1 — offline checkout integrity preflight.
 *
 * Scope: apparel and ordinary online products. No browser, wallet, PSP,
 * networks, secrets, payment execution, merchant KYB or user-authentication.
 *
 * IMPORTANT TRUST BOUNDARY:
 * - "authorization" MUST be supplied independently from a first-party,
 *   authenticated consent system. This library does NOT authenticate it.
 * - "checkout" MUST be a normalized, complete checkout quote supplied by
 *   a trusted commerce adapter just before the payment operation.
 * - "allow" is only a consistency verdict, NOT permission to spend.
 */

export const COMMERCE_GUARD_VERSION = '0.1.0';
const ACTION_PRIORITY = { allow: 0, review: 1, block: 2 };
const MAX_TTL_MS = 24 * 60 * 60 * 1000;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const CURRENCY = /^[A-Z]{3}$/;
const HASH = /^sha256:[a-f0-9]{64}$/;
const MINOR = /^(0|[1-9][0-9]{0,17})$/;
const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const ALLOWED_AUTH_KEYS = [
  'authorization_id', 'issued_at', 'expires_at', 'merchant_origin',
  'merchant_id', 'payee_id', 'currency', 'items', 'max_total_minor',
  'max_shipping_minor', 'max_tax_minor', 'max_fee_minor',
  'shipping_address_fingerprint', 'shipping_method_id', 'return_policy_id'
];
const ALLOWED_QUOTE_KEYS = [
  'merchant_origin', 'merchant_id', 'payee_id', 'currency',
  'items', 'shipping_address_fingerprint', 'shipping_method_id',
  'return_policy_id', 'amounts'
];
const ALLOWED_AUTH_ITEM_KEYS = ['sku', 'variant_id', 'quantity', 'max_unit_amount_minor'];
const ALLOWED_QUOTE_ITEM_KEYS = ['sku', 'variant_id', 'quantity', 'unit_amount_minor'];
const ALLOWED_AMOUNT_KEYS = [
  'subtotal_minor', 'shipping_minor', 'tax_minor', 'fee_minor',
  'discount_minor', 'total_minor'
];

const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const identifier = x => typeof x === 'string' && ID.test(x);
const minor = x => typeof x === 'string' && MINOR.test(x) ? BigInt(x) : null;
const quantity = x => Number.isSafeInteger(x) && x >= 1 && x <= 10_000;
const utcTime = value => {
  if (typeof value !== 'string' || !UTC_ISO.test(value)) return null;
  const n = Date.parse(value);
  if (!Number.isFinite(n)) return null;
  const normalized = new Date(n).toISOString();
  if (normalized !== value && normalized.replace('.000Z', 'Z') !== value) return null;
  return n;
};
const merchantOrigin = value => {
  if (typeof value !== 'string' || value.length > 300) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
        parsed.pathname !== '/' || parsed.search || parsed.hash ||
        parsed.port !== '' || parsed.origin + '/' !== value) return null;
    // This is syntactic validation only; DNS, certificates, ownership and
    // redirects must be independently validated by the commerce platform.
    const hostname = parsed.hostname;
    if (!hostname.includes('.') || hostname.endsWith('.local') ||
        hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname) ||
        hostname.startsWith('[')) return null;
    return parsed.origin;
  } catch { return null; }
};

function checkShape(value, allowed, code, add) {
  if (!object(value)) {
    add('block', code, 'A required object is absent or malformed.');
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) add('block', code + '_unknown_field', 'Unrecognized checkout field must be mapped explicitly.');
  }
  return true;
}

function inspectItems(authItems, quoteItems, add) {
  if (!Array.isArray(authItems) || !Array.isArray(quoteItems) ||
      authItems.length === 0 || quoteItems.length === 0 ||
      authItems.length > 100 || quoteItems.length > 100) {
    add('block', 'invalid_cart', 'Cart and authorization must contain 1–100 items.');
    return null;
  }

  function toMap(items, trusted) {
    const values = new Map();
    for (const item of items) {
      const keys = trusted ? ALLOWED_AUTH_ITEM_KEYS : ALLOWED_QUOTE_ITEM_KEYS;
      if (!checkShape(item, keys, 'invalid_item', add)) continue;
      if (!identifier(item.sku) || !identifier(item.variant_id) || !quantity(item.quantity)) {
        add('block', 'invalid_item_identity', 'Each item needs a valid SKU, variant and exact quantity.');
        continue;
      }
      const price = minor(trusted ? item.max_unit_amount_minor : item.unit_amount_minor);
      if (price === null) {
        add('block', 'invalid_unit_price', 'Unit amounts must be nonnegative integer strings in currency minor units.');
        continue;
      }
      const key = JSON.stringify([item.sku, item.variant_id]);
      if (values.has(key)) {
        add('block', 'duplicate_item', 'Duplicate SKU/variant lines are not allowed.');
        continue;
      }
      values.set(key, { quantity: item.quantity, price });
    }
    return values;
  }

  const allowed = toMap(authItems, true);
  const actual = toMap(quoteItems, false);
  if (allowed.size !== authItems.length || actual.size !== quoteItems.length) return null;

  let subtotal = 0n;
  for (const [key, line] of actual) {
    subtotal += line.price * BigInt(line.quantity);
    const expected = allowed.get(key);
    if (!expected) {
      add('block', 'unauthorized_product', 'Checkout contains a SKU or variant not authorized by the buyer.');
      continue;
    }
    if (line.quantity !== expected.quantity) {
      add('block', 'quantity_changed', 'Quantity no longer matches the buyer authorization.');
    }
    if (line.price > expected.price) {
      add('review', 'unit_price_increased', 'A line-item unit price exceeds the authorized ceiling.');
    }
  }
  for (const key of allowed.keys()) {
    if (!actual.has(key)) add('block', 'authorized_product_missing', 'An authorized SKU/variant is missing from checkout.');
  }
  return subtotal;
}

export function checkoutPreflight({ authorization, checkout, now } = {}) {
  const reasons = [];
  let action = 'allow';
  const add = (severity, code, detail) => {
    if (!reasons.some(r => r.code === code)) reasons.push({ severity, code, detail });
    if (ACTION_PRIORITY[severity] > ACTION_PRIORITY[action]) action = severity;
  };

  const authOK = checkShape(authorization, ALLOWED_AUTH_KEYS, 'invalid_authorization', add);
  const quoteOK = checkShape(checkout, ALLOWED_QUOTE_KEYS, 'invalid_checkout', add);
  if (!authOK || !quoteOK) {
    return { product: 'commerce_guard', policy_version: COMMERCE_GUARD_VERSION,
      action: 'block', reasons, checks: { authorization_shape: authOK, checkout_shape: quoteOK },
      limitations: ['This is not an authenticated consent proof or a payment authorization.'] };
  }

  if (!identifier(authorization.authorization_id)) {
    add('block', 'missing_authorization_id', 'First-party authorization reference is required.');
  }

  const issued = utcTime(authorization.issued_at);
  const expires = utcTime(authorization.expires_at);
  const nowMs = now === undefined ? Date.now() : now;
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    add('block', 'invalid_clock', 'A trusted wall-clock timestamp is required.');
  }
  if (issued === null || expires === null || expires <= issued ||
      expires - issued > MAX_TTL_MS) {
    add('block', 'invalid_authorization_window', 'Authorization must have a valid UTC window no longer than 24 hours.');
  } else if (Number.isSafeInteger(nowMs)) {
    if (nowMs < issued) add('block', 'authorization_not_yet_valid', 'Authorization is not yet valid.');
    if (nowMs >= expires) add('block', 'authorization_expired', 'Authorization has expired.');
  }

  const trustedMerchant = merchantOrigin(authorization.merchant_origin);
  const actualMerchant = merchantOrigin(checkout.merchant_origin);
  if (!trustedMerchant || !actualMerchant) {
    add('block', 'invalid_merchant_origin', 'Both merchant origins must be valid canonical public HTTPS origins.');
  } else if (trustedMerchant !== actualMerchant) {
    add('block', 'merchant_origin_changed', 'Checkout merchant domain differs from the authorized domain.');
  }
  for (const key of ['merchant_id', 'payee_id']) {
    if (!identifier(authorization[key]) || !identifier(checkout[key])) {
      add('block', 'invalid_' + key, 'Trusted and observed merchant/payment identities are required.');
    } else if (authorization[key] !== checkout[key]) {
      add('block', key + '_changed', 'Merchant or payment destination differs from buyer authorization.');
    }
  }

  if (!CURRENCY.test(authorization.currency) || !CURRENCY.test(checkout.currency)) {
    add('block', 'invalid_currency', 'A supported ISO 4217 three-letter uppercase currency code is required.');
  } else if (authorization.currency !== checkout.currency) {
    add('block', 'currency_changed', 'Checkout currency does not match authorized currency; no FX conversion occurs.');
  }

  for (const field of ['shipping_address_fingerprint', 'shipping_method_id', 'return_policy_id']) {
    const valid = field === 'shipping_address_fingerprint' ? HASH : ID;
    if (typeof authorization[field] !== 'string' || !valid.test(authorization[field]) ||
        typeof checkout[field] !== 'string' || !valid.test(checkout[field])) {
      add('block', 'invalid_' + field, 'A validated checkout condition and trusted expectation are required.');
    } else if (authorization[field] !== checkout[field]) {
      add(field === 'return_policy_id' ? 'review' : 'block',
        field + '_changed', 'A material fulfillment or return condition changed.');
    }
  }

  const computedSubtotal = inspectItems(authorization.items, checkout.items, add);
  const maxTotal = minor(authorization.max_total_minor);
  const ceilings = [
    ['shipping_minor', 'max_shipping_minor'],
    ['tax_minor', 'max_tax_minor'],
    ['fee_minor', 'max_fee_minor']
  ];
  if (maxTotal === null) add('block', 'invalid_total_limit', 'A trusted total price ceiling is required.');

  let verifiedTotal = null;
  if (checkShape(checkout.amounts, ALLOWED_AMOUNT_KEYS, 'invalid_amounts', add)) {
    const amounts = {};
    for (const key of ALLOWED_AMOUNT_KEYS) {
      amounts[key] = minor(checkout.amounts[key]);
      if (amounts[key] === null) add('block', 'invalid_' + key, 'Complete nonnegative integer minor-unit amounts are required.');
    }
    if (Object.values(amounts).every(x => x !== null)) {
      if (computedSubtotal !== null && amounts.subtotal_minor !== computedSubtotal) {
        add('block', 'subtotal_mismatch', 'Line-item subtotal does not equal sum of quantity × unit price.');
      }
      const due = amounts.subtotal_minor + amounts.shipping_minor +
        amounts.tax_minor + amounts.fee_minor - amounts.discount_minor;
      if (due < 0n || due !== amounts.total_minor) {
        add('block', 'total_mismatch', 'Checkout total does not reconcile with all charges and discounts.');
      } else {
        verifiedTotal = due;
        if (maxTotal !== null && due > maxTotal) {
          add('review', 'total_over_budget', 'Total exceeds the buyer-approved limit; obtain new consent.');
        }
      }
      for (const [field, ceilingKey] of ceilings) {
        const ceiling = minor(authorization[ceilingKey]);
        if (ceiling === null) {
          add('block', 'invalid_' + ceilingKey, 'Explicit buyer-approved charge ceilings are required.');
        } else if (amounts[field] > ceiling) {
          add('review', field + '_over_budget', 'Checkout charges exceed the separately approved ceiling.');
        }
      }
    }
  }
  for (const [, key] of ceilings) {
    if (minor(authorization[key]) === null) add('block', 'invalid_' + key, 'Explicit buyer-approved charge ceilings are required.');
  }

  return {
    product: 'commerce_guard',
    policy_version: COMMERCE_GUARD_VERSION,
    action,
    reasons,
    checks: {
      trusted_authorization_present: authOK && identifier(authorization.authorization_id),
      merchant_and_payee_match: Boolean(trustedMerchant && actualMerchant &&
        trustedMerchant === actualMerchant && authorization.merchant_id === checkout.merchant_id &&
        authorization.payee_id === checkout.payee_id),
      checkout_math_reconciled: verifiedTotal !== null,
      no_unapproved_material_change: action === 'allow'
    },
    limitations: [
      'An allow result compares supplied data only; it is not identity verification, buyer authentication, legal advice, regulatory clearance or permission to charge.',
      'The calling application must establish independent, authenticated buyer consent, validate merchant/payee identity, enforce budget/replay constraints and bind final PSP capture to the same reviewed quote.',
      'Shipping fingerprint, product attributes and return_policy_id are opaque caller assertions; this SDK does not independently validate the underlying address, inventory, fit, seller reputation or return terms.',
      'The checkout adapter must include every real charge and discount and use the ISO 4217 currency exponent; the SDK does not convert currencies or execute payments.'
    ]
  };
}

export function assertCheckoutAllowed(params) {
  const result = checkoutPreflight(params);
  if (result.action !== 'allow') {
    const error = new Error('AgentKYB Commerce Guard stopped checkout: ' +
      result.reasons.map(r => r.code).join(', '));
    error.agentkyb = result;
    throw error;
  }
  return result;
}

/**
 * Constructs a pre-capture gate. The authorization must come from a
 * separately authenticated consent store, NOT from the checkout provider.
 * This is a demo integration pattern, not a transaction executor.
 */
export function createCheckoutGate({ getTrustedAuthorization, executeCheckout, clock = Date.now } = {}) {
  if (typeof getTrustedAuthorization !== 'function' ||
      typeof executeCheckout !== 'function' || typeof clock !== 'function') {
    throw new TypeError('Trusted consent loader, checkout callback and clock functions are required.');
  }
  return async (quote, ...args) => {
    // Freeze a detached snapshot so that the guarded object cannot be
    // mutated between evaluation and callback. The PSP still MUST validate
    // the final amount and quote independently at the payment boundary.
    const snapshot = structuredClone(quote);
    const authorization = await getTrustedAuthorization();
    const guard = assertCheckoutAllowed({ authorization, checkout: snapshot, now: clock() });
    const freeze = x => {
      if (object(x) || Array.isArray(x)) {
        Object.values(x).forEach(freeze);
        Object.freeze(x);
      }
      return x;
    };
    const receipt = await executeCheckout(freeze(snapshot), ...args);
    return { guard, receipt };
  };
}
