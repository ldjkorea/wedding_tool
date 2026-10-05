import assert from 'node:assert/strict';
import { canonicalForm } from '../../src/lib/contractValidation';
import { calculateContractPrice, checkIsSunday } from '../../src/lib/pricing';

// Runs in a fresh Node process for each TZ, rather than changing TZ inside one process.
const form = JSON.parse(process.env.FLOW_DATE_FIXTURE!);
for (const [date, sunday] of [
  ['2027-04-17', false], ['2027-04-18', true],
  ['2027-03-13', false], ['2027-03-14', true], // US DST transition
  ['2027-11-06', false], ['2027-11-07', true],
  ['2028-01-01', false], ['2028-01-02', true],
] as const) {
  const canonical = canonicalForm({ ...form, weddingDate: date, sundayDiscount: !sunday });
  assert.equal(canonical.weddingDate, date);
  assert.equal(canonical.sundayDiscount, sunday, `${process.env.TZ}: ${date}`);
  assert.equal(checkIsSunday(date), sunday);
  const pricing = calculateContractPrice(canonical);
  assert.equal(pricing.isSunday, sunday);
  assert.equal(pricing.contractTotal, 1250000 - (sunday ? 100000 : 0));
  assert.equal(pricing.depositAmount, 300000);
  assert.equal(pricing.balanceAmount, pricing.contractTotal - 300000);
  assert.equal(pricing.futureCashbackTotal, 0);
}
assert.throws(() => canonicalForm({ ...form, weddingDate: '2027-02-29' }));
assert.throws(() => canonicalForm({ ...form, weddingDate: '2027-04-18T00:00:00Z' }));
console.log(`PASS timezone ${process.env.TZ}: eight calendar dates and invalid dates`);
