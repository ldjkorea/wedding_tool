import { ownerProductFields, ownerOptionFields, ownerDiscountFields, ownerCodeFields } from '@/types/ownerSettings';
import type { StudioSettings } from '@/types/studioSettings';

function comparable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(comparable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, comparable(child)]));
  return value;
}
function equal(a: unknown, b: unknown) { return JSON.stringify(comparable(a)) === JSON.stringify(comparable(b)); }
/** Demo mirrors the production GAS guard; this guard never selects data from a customer patch. */
export function enforceOwnerTransition(previous: StudioSettings, next: StudioSettings) {
  const fields = { productsConfig: ownerProductFields, optionsConfig: ownerOptionFields, discountsConfig: ownerDiscountFields, partnerCodes: ownerCodeFields };
  const deny = () => { throw Object.assign(new Error('Unauthorized admin'), { code: 'ADMIN_UNAUTHORIZED' }); };
  if (!previous || !next) deny();
  for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
    if (!Object.hasOwn(fields, key) && !equal((previous as unknown as Record<string, unknown>)[key], (next as unknown as Record<string, unknown>)[key])) deny();
  }
  for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
    const old = previous[key] || [], incoming = next[key] || [], seen = new Set<string>();
    if (!Array.isArray(incoming)) deny();
    for (const entry of incoming) {
      if (!entry || typeof entry.id !== 'string' || seen.has(entry.id)) deny();
      seen.add(entry.id);
      const before = old.find(item => item.id === entry.id);
      const item = entry as unknown as Record<string, unknown>;
      if (key === 'discountsConfig') {
        const rule = entry as StudioSettings['discountsConfig'][number];
        if (!rule.eligibility || !['weekday','partner','portfolio','review_contract','review_main'].includes(rule.eligibility.kind) || !['immediate','cashback'].includes(rule.type) || (rule.eligibility.kind === 'partner' && rule.type !== 'immediate') || (before && rule.eligibility.kind !== (before as typeof rule).eligibility.kind)) deny();
      }
      if (!before) {
        if (Object.keys(item).some(field => field !== 'id' && !(fields[key] as readonly string[]).includes(field))) deny();
        continue;
      }
      const expected = structuredClone(before) as unknown as Record<string, unknown>;
      for (const field of fields[key]) if (Object.hasOwn(item, field)) expected[field] = item[field];
      if (key !== 'partnerCodes' && item.name !== (before as unknown as Record<string, unknown>).name) {
        if (key === 'discountsConfig') { expected.pricingName = item.name; expected.labels = Object.fromEntries(['form','review','pdf','summary','catalog','email'].map(channel => [channel, item.name])); }
        else expected.shortName = item.name;
      }
      if (key === 'discountsConfig' && item.description !== (before as unknown as Record<string, unknown>).description) expected.pricingDescription = item.description;
      if (!equal(expected, item)) deny();
    }
    if (old.some(item => !seen.has(item.id))) deny();
  }
}
