import { readFileSync } from 'node:fs';
const content = readFileSync(new URL('../skills/agentkyb-vendor-check/SKILL.md', import.meta.url), 'utf8');
for (const fragment of [
  'name: agentkyb-vendor-check', 'description:', 'vendor_preflight',
  'verify vendor', 'supplier risk', 'counterparty check',
  '0.05 USDC', 'eip155:8453', 'expected_pay_to',
  'never', 'review', 'block'
]) {
  if (!content.toLowerCase().includes(fragment.toLowerCase())) throw new Error('Skill missing: '+fragment);
}
console.log('AGENTKYB_SKILL_METADATA_OK');
