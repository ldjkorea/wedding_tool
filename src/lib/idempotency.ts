/**
 * 중복 발송 방지 (Idempotency & Send Lock) 모듈
 * 별도 무거운 DB 없이 인메모리 및 임시 레지스트리를 통해 동일 계약의 중복 발송을 차단합니다.
 */

interface SentRecord {
  contractId: string;
  contractNumber: string;
  sentAt: string;
  customerEmail: string;
}

// 글로벌 캐시 (Node.js 런타임 유지)
const demoRuntime = globalThis as typeof globalThis & { weddingDemoSent?: Map<string, SentRecord>; weddingDemoLocks?: Set<string> };
const sentRegistry = demoRuntime.weddingDemoSent ??= new Map<string, SentRecord>();
const activeLocks = demoRuntime.weddingDemoLocks ??= new Set<string>();

export function isContractAlreadySent(contractId: string): boolean {
  return sentRegistry.has(contractId);
}

export function getSentRecord(contractId: string): SentRecord | undefined {
  return sentRegistry.get(contractId);
}

export function markContractAsSent(contractId: string, contractNumber: string, customerEmail: string): SentRecord {
  const record: SentRecord = {
    contractId,
    contractNumber,
    sentAt: new Date().toISOString(),
    customerEmail,
  };
  sentRegistry.set(contractId, record);
  return record;
}

export function acquireSendLock(contractId: string): boolean {
  if (sentRegistry.has(contractId) || activeLocks.has(contractId)) {
    return false;
  }
  activeLocks.add(contractId);
  return true;
}

export function releaseSendLock(contractId: string): void {
  activeLocks.delete(contractId);
}

// 테스트 및 데모 초기화용
export function clearSentRegistry(): void {
  sentRegistry.clear();
  activeLocks.clear();
}
