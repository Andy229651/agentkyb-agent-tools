/** Public endpoint availability check, NOT an unbranded marketplace discovery test. No funds are spent. */
const origin = 'https://agentkyb.andy229651.workers.dev';
const urls = ['/.well-known/x402', '/openapi.json', '/tools', '/llms.txt'];
const results = await Promise.all(urls.map(async path => {
  const response = await fetch(origin + path, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw Error(path + ': HTTP ' + response.status);
  return { path, status: response.status, content: await response.text() };
}));
const x = JSON.parse(results.find(r => r.path === '/.well-known/x402').content);
if (x.x402Version !== 2 || !Array.isArray(x.products) || !x.products.some(p => p.id === 'vendor-preflight')) {
  throw new Error('The public x402 descriptor is missing V2 vendor discovery.');
}
console.log('AGENTKYB_PUBLIC_ENDPOINTS_OK', JSON.stringify({ paths: results.map(r => r.path), v2: true }));
console.log('NOTE: Public endpoint verification is NOT cold-start catalog indexing, skill installation, agent usage or revenue.');
