import { readFileSync } from 'node:fs';
const skill = readFileSync(new URL('../skills/agentkyb-commerce-guard/SKILL.md', import.meta.url), 'utf8');
for (const token of [
  'name: agentkyb-commerce-guard', 'description:', 'online shopping', 'clothing',
  'checkoutPreflight', 'createCheckoutGate', 'size', 'variant', 'payee',
  'shipping', 'return policy', 'allow', 'review', 'block',
  'independently authenticated', 'no real payment', '0.05 USDC'
]) {
  if (!skill.toLowerCase().includes(token.toLowerCase())) {
    throw new Error('Commerce skill missing required statement: '+token);
  }
}
if (!skill.startsWith('---\n') || !skill.includes('\n---\n')) {
  throw new Error('Skill frontmatter missing');
}
console.log('COMMERCE_GUARD_SKILL_METADATA_OK');
