// Diagnostic only: never signs, sends PAYMENT-SIGNATURE, or pays real USDC.
// This tests whether an unauthenticated, independent MCP client can discover
// and receive an x402 payment challenge for vendor_preflight.
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const endpoint = 'https://agentkyb.andy229651.workers.dev/mcp-x402';
const expectedWallet = '0x63Ef759d667394EFB6dd9403fD60ac7B619d3018'.toLowerCase();
const client = new Client({ name: 'agentkyb-public-no-spend-gate', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
const transport = new StreamableHTTPClientTransport(new URL(endpoint));

try {
  await client.connect(transport);
  const tools = await client.listTools();
  const tool = tools?.tools?.find(t => t.name === 'vendor_preflight');
  if (!tool) throw new Error('VENDOR_PREFLIGHT_NOT_DISCOVERED');
  if (tool?._meta?.['agents-x402/paymentRequired'] !== true) throw new Error('MISSING_PAID_TOOL_METADATA');
  if (Number(tool?._meta?.['agents-x402/priceUSD']) !== 0.05) throw new Error('ADVERTISED_PRICE_CHANGED');
  console.log('ANONYMOUS_VENDOR_TOOL_DISCOVERY_OK', JSON.stringify({
    tool: tool.name, advertised_price_usd: 0.05, endpoint
  }));

  // Simulated buyer describes a public entity. No wallet, payment token,
  // signing routine or paid funds are supplied.
  const result = await client.callTool({
    name: 'vendor_preflight',
    arguments: { name: 'Revolut Ltd', country: 'GB', domain: 'revolut.com' }
  });
  const challenge = result?._meta?.['x402/error'];
  if (!result?.isError || !Array.isArray(challenge?.accepts) || challenge.accepts.length === 0) {
    throw new Error('EXPECTED_UNPAID_X402_CHALLENGE_NOT_RETURNED');
  }
  const accepted = challenge.accepts.find(a => a.network === 'eip155:8453');
  if (!accepted) throw new Error('UNEXPECTED_X402_NETWORK');
  const recipient = String(accepted?.payTo || accepted?.pay_to || '').toLowerCase();
  if (recipient !== expectedWallet) throw new Error('UNEXPECTED_PAYMENT_RECIPIENT');
  if (String(accepted?.amount) !== '50000') throw new Error('UNEXPECTED_MICRO_USDC_AMOUNT');
  console.log('ANONYMOUS_VENDOR_PAYMENT_CHALLENGE_OK', JSON.stringify({
    network: accepted.network, price_usdc: '0.05', wallet_matches_pinned: true,
    payment_signed: false, settlement_attempted: false
  }));
} finally {
  try { await transport.terminateSession?.(); } catch {}
  try { await client.close(); } catch {}
}
