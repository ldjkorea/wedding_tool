'use client';
import { useEffect, useRef, useState } from 'react';
import { getBrowserConfigurationBinding } from '@/services/configuration';
import { normalizePartnerCode, isPartnerCodeFormat } from '@/lib/partnerCode';

export function usePartnerCodeVerification(code: string, enabled: boolean, apply: (valid: boolean, amount: number) => void) {
  const callback = useRef(apply); callback.current = apply;
  const [state, setState] = useState({ status: 'idle', message: '', amount: 0 });
  useEffect(() => {
    if (!enabled) return;
    callback.current(false, 0);
    const normalized = normalizePartnerCode(code);
    if (!normalized) { setState({ status: 'idle', message: '', amount: 0 }); return; }
    if (!isPartnerCodeFormat(normalized)) { setState({ status: 'invalid', message: '코드는 2~64자이며 내부 공백은 사용할 수 없습니다.', amount: 0 }); return; }
    let current = true;
    const controller = new AbortController();
    setState({ status: 'checking', message: '할인코드를 확인하고 있습니다.', amount: 0 });
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/validate-partner-code', { method: 'POST', cache: 'no-store', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'X-Contract-Configuration': getBrowserConfigurationBinding() }, body: JSON.stringify({ code: normalized }) });
        const result = await response.json();
        if (!current) return;
        if (!response.ok || !result.success) throw new Error(result.error || '코드를 확인하지 못했습니다. 다시 입력해 주세요.');
        const valid = result.valid === true && Number.isSafeInteger(result.discountAmount) && result.discountAmount > 0 && result.code === normalized;
        callback.current(valid, valid ? result.discountAmount : 0);
        setState({ status: valid ? 'valid' : 'invalid', amount: valid ? result.discountAmount : 0,
          message: valid ? result.discountAmount.toLocaleString('ko-KR') + '원 할인이 적용되었습니다.' : '등록되지 않았거나 사용 중지된 코드입니다.' });
      } catch (error) {
        if (current) { callback.current(false, 0); setState({ status: 'error', amount: 0, message: error instanceof Error ? error.message : '할인코드를 확인하지 못했습니다.' }); }
      }
    }, 450);
    return () => { current = false; clearTimeout(timer); controller.abort(); };
  }, [code, enabled]);
  return state;
}
