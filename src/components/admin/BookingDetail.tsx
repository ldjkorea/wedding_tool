'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { OwnerBooking } from '@/types/ownerBooking';
import type { ReviewContractResponse } from '@/types/backend';
import { ConsoleDialog, ConsoleLoading } from './ConsolePrimitives';
import { formatKRW } from '@/lib/pricing';

export const bookingStatusLabels = { submitted: '확인 대기', approved: '예약 확정 · 발송 진행', sent: '계약 완료' };
export function BookingDetail({ row, onClose, onUnauthorized }: { row: OwnerBooking; onClose: () => void; onUnauthorized: () => void }) {
  const [detail, setDetail] = useState<ReviewContractResponse | null>(null), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch('/api/owner-control/contract?id=' + encodeURIComponent(row.contractId), {cache:'no-store', credentials:'same-origin', signal:controller.signal});
        if (response.status === 401) { onUnauthorized(); return; }
        const value = await response.json();
        if (!response.ok || !value.success || value.contractId !== row.contractId) throw new Error('Review unavailable');
        if (!controller.signal.aborted) setDetail(value);
      } catch { if (!controller.signal.aborted) setError('예약 상세를 불러오지 못했습니다. 닫은 뒤 다시 시도해 주세요.'); }
    }
    void load(); return () => controller.abort();
  }, [row.contractId, onUnauthorized]);
  const data = detail?.data, pricing = detail?.pricing;
  const status = detail?.isAlreadySent ? 'sent' : detail?.snapshot ? 'approved' : row.status;
  return <ConsoleDialog title="예약 상세" drawer onClose={onClose}>
    <div className="detail-intro"><span className={'booking-status ' + status}>{bookingStatusLabels[status]}</span><h3>{data?.groomName || row.groomName} · {data?.brideName || row.brideName}</h3><p className="booking-muted">{row.contractNumber}</p></div>
    {error ? <p role="alert" className="booking-error">{error}</p> : !detail ? <ConsoleLoading>예약 내용을 불러오고 있습니다…</ConsoleLoading> : data && pricing && <>
      <section className="detail-section"><h3>예약 정보</h3><dl><dt>예식일 · 시간</dt><dd>{data.weddingDate} · {data.weddingTime} (서울)</dd><dt>장소</dt><dd>{data.weddingVenue} {data.weddingHall}</dd></dl></section>
      <section className="detail-section"><h3>상품 및 금액</h3><dl>
        {pricing.breakdown.map((item, index) => <div className="detail-pair" key={index}><dt>{item.name}{item.category === 'future_cashback' ? ' · 추후 캐시백' : ''}</dt><dd>{formatKRW(item.amount)}</dd></div>)}
        <dt>총 계약금액</dt><dd><strong>{formatKRW(pricing.contractTotal)}</strong></dd><dt>계약금</dt><dd>{formatKRW(pricing.depositAmount)}</dd><dt>잔금</dt><dd>{formatKRW(pricing.balanceAmount)}</dd><dt>추후 캐시백</dt><dd>{formatKRW(pricing.futureCashbackTotal)}</dd>
      </dl><p className="booking-muted">캐시백은 계약금액에서 차감되지 않습니다.</p></section>
      <section className="detail-section"><h3>고객 정보</h3><dl><dt>신랑 연락처</dt><dd>{data.groomPhone || '미입력'}</dd><dt>신부 연락처</dt><dd>{data.bridePhone || '미입력'}</dd><dt>수신 이메일</dt><dd>{data.email}</dd></dl>
        {(data.requestNotes || data.shootRequestNotes) && <p className="detail-note">요청사항: {data.requestNotes || data.shootRequestNotes}</p>}
      </section>
      <section className="detail-section"><h3>계약 상태</h3><p>{detail.isAlreadySent ? '고객과 대표에게 계약서 발송이 완료되었습니다.' : detail.snapshot ? '승인한 내용이 확정되었습니다. 계약서 발송 상태를 확인해 주세요.' : '대표 확인 전입니다. 내용을 검토하고 명시적으로 승인해야 계약이 확정됩니다.'}</p><p className="booking-muted">계약서 보관: {detail.documentStored ? '보관됨' : '최종 처리 시 보관'}</p></section>
      <div className="console-dialog-actions"><Link className="owner-button admin-primary" href={'/review?ownerContract=' + encodeURIComponent(row.contractId)}>{detail.isAlreadySent ? '계약서 보기' : '예약 확인·수정 및 승인'}</Link></div>
    </>}
  </ConsoleDialog>;
}
