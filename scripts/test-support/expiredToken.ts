import assert from 'node:assert/strict';
import { createApprovalToken, verifyApprovalToken } from '../../src/lib/token';
import type { ContractFormData } from '../../src/types/contract';

/** Valid signature and exp > iat; verifies the actual expiry boundary rather than
 * creating a structurally invalid token with a negative lifetime. */
export function expiredToken(id: string, data: ContractFormData): string {
  const originalNow = Date.now;
  const issued = originalNow() - 2000;
  let token: string;
  try {
    Date.now = () => issued;
    token = createApprovalToken(id, data, 1000);
    const decoded = verifyApprovalToken(token);
    assert.equal(decoded.exp, issued + 1000);
    Date.now = () => decoded.exp - 1;
    assert.equal(verifyApprovalToken(token).contractId, id);
    Date.now = () => decoded.exp;
    assert.throws(() => verifyApprovalToken(token), /만료/);
  } finally { Date.now = originalNow; }
  assert.throws(() => verifyApprovalToken(token!), /만료/);
  return token!;
}
