/**
 * AgentKYB Payment Guard v0.1: deterministic, local, non-custodial.
 * No wallet or key access and no external network requests.
 * All EXPECTED fields must come from independent trusted caller policy,
 * never copied from the provider's untrusted payment challenge.
 */
export const PAYMENT_GUARD_VERSION = '0.1.0';
const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const BASE_NETWORKS = new Set(['eip155:8453', 'eip155:84532']);

function parseUsdcMicro(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  if (!/^(0|[1-9]\d*)(?:\.(\d{1,6}))?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  const micro = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0') || '0');
  return micro > 0n ? micro : null;
}

function localOrPrivateHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === '::1') return true;
  if (/^(?:fc|fd|fe80):/i.test(host)) return true;
  if (host.includes(':')) return false; // No DNS or SSRF verification is performed.
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false;
  const octets = host.split('.').map(Number);
  if (octets.some(n => n > 255)) return true;
  return octets[0] === 0 || octets[0] === 10 || octets[0] === 127 ||
    octets[0] === 169 && octets[1] === 254 ||
    octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31 ||
    octets[0] === 192 && octets[1] === 168 ||
    octets[0] >= 224;
}

function normalizedHttpsUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || localOrPrivateHost(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}

export function guardPayment(input = {}) {
  const reasons = [];
  const add = (code, detail) => reasons.push({ code, detail });

  const endpoint = normalizedHttpsUrl(input.endpoint);
  const expectedEndpoint = normalizedHttpsUrl(input.expected_endpoint);
  if (!endpoint) add('invalid_endpoint', 'Payment endpoint must be public HTTPS.');
  if (!expectedEndpoint) add('missing_trusted_endpoint', 'A separately trusted expected_endpoint is required.');
  if (endpoint && expectedEndpoint && endpoint !== expectedEndpoint) add('endpoint_changed', 'Payment endpoint differs from the trusted endpoint.');

  const payTo = typeof input.pay_to === 'string' ? input.pay_to.trim() : '';
  const expectedPayTo = typeof input.expected_pay_to === 'string' ? input.expected_pay_to.trim() : '';
  if (!EVM_ADDRESS.test(payTo)) add('invalid_pay_to', 'Observed EVM payment recipient is invalid.');
  if (!EVM_ADDRESS.test(expectedPayTo)) add('missing_trusted_pay_to', 'A separately trusted expected_pay_to is required.');
  if (EVM_ADDRESS.test(payTo) && EVM_ADDRESS.test(expectedPayTo) && payTo.toLowerCase() !== expectedPayTo.toLowerCase()) {
    add('pay_to_changed', 'The payment recipient changed from the trusted recipient.');
  }

  const amount = parseUsdcMicro(input.amount_usd);
  const expectedAmount = parseUsdcMicro(input.expected_amount_usd);
  if (amount === null) add('invalid_amount', 'amount_usd must be a positive USDC amount with no more than six decimal places.');
  if (expectedAmount === null) add('missing_trusted_amount', 'A separately trusted expected_amount_usd is required.');
  if (amount !== null && expectedAmount !== null && amount !== expectedAmount) {
    add('price_changed', 'USDC amount differs from the trusted quote.');
  }

  const network = input.network;
  const expectedNetwork = input.expected_network;
  if (!BASE_NETWORKS.has(network)) add('invalid_network', 'Only Base mainnet or Base Sepolia are recognized.');
  if (!BASE_NETWORKS.has(expectedNetwork)) add('missing_trusted_network', 'A separately trusted expected_network is required.');
  if (BASE_NETWORKS.has(network) && BASE_NETWORKS.has(expectedNetwork) && network !== expectedNetwork) {
    add('network_changed', 'Payment network differs from the trusted network.');
  }

  return {
    product: 'payment_guard', policy_version: PAYMENT_GUARD_VERSION,
    action: reasons.length ? 'block' : 'allow',
    reasons,
    checks: {
      trusted_endpoint_match: Boolean(endpoint && expectedEndpoint && endpoint === expectedEndpoint),
      trusted_recipient_match: EVM_ADDRESS.test(payTo) && EVM_ADDRESS.test(expectedPayTo) && payTo.toLowerCase() === expectedPayTo.toLowerCase(),
      trusted_amount_match: amount !== null && expectedAmount !== null && amount === expectedAmount,
      trusted_network_match: BASE_NETWORKS.has(network) && BASE_NETWORKS.has(expectedNetwork) && network === expectedNetwork
    },
    limitations: [
      'An allow decision checks declared payment-intent consistency only; it does not verify wallet ownership, vendor identity, sanctions status or destination reputation.',
      'The caller must independently establish trusted expectations and enforce authorization, spend budget and signing policy.',
      'Endpoint validation does not perform DNS resolution, network isolation or a complete SSRF assessment.'
    ]
  };
}

export function assertPaymentAllowed(input) {
  const result = guardPayment(input);
  if (result.action !== 'allow') {
    const error = new Error('AgentKYB blocked payment: ' + result.reasons.map(r => r.code).join(', '));
    error.agentkyb = result;
    throw error;
  }
  return result;
}

export function withPaymentGuard(signAndPay) {
  if (typeof signAndPay !== 'function') throw new TypeError('signAndPay must be a function');
  return async (intent, ...args) => {
    const guard = assertPaymentAllowed(intent);
    const payment = await signAndPay(intent, ...args);
    return { guard, payment };
  };
}
