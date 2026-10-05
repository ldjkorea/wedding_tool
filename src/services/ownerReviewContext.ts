import { AsyncLocalStorage } from 'node:async_hooks';
import { verifyApprovalToken, type DecodedApprovalPayload } from '@/lib/token';

// Created only after server-side Owner authentication; never taken from request JSON.
const scope = new AsyncLocalStorage<{ sessionId: string; contractId: string }>();
export const getOwnerReview = () => scope.getStore();
export function withOwnerReview<T>(sessionId: string, contractId: string, task: () => T): T {
  if (
    typeof sessionId !== 'string' ||
    typeof contractId !== 'string' ||
    !/^[a-f0-9]{64}$/.test(sessionId) ||
    !/^cnt_[a-zA-Z0-9_-]{1,100}$/.test(contractId)
  )
    throw new Error('잘못된 계약 요청입니다.');
  return scope.run({ sessionId, contractId }, task);
}
export function reviewIdentity(token: string): DecodedApprovalPayload {
  const owner = scope.getStore();
  return owner
    ? { contractId: owner.contractId, iat: Date.now(), exp: Date.now() + 60000 }
    : verifyApprovalToken(token);
}
