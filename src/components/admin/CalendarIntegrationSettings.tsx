'use client';
import { useEffect, useState } from 'react';
import type { CalendarIntegrationStatus } from '@/types/calendarIntegration';
type Api = (url: string, method?: string, body?: unknown) => Promise<{ integration?: CalendarIntegrationStatus }>;
const names = { disabled: '사용 안 함', disconnected: '연결 전', connected: '정상 연결됨', missing: '캘린더를 찾을 수 없음', error: '연결 확인 필요' };
const help: Record<string, string> = {
  CONNECTION_MISSING: '촬영 일정 캘린더를 먼저 만들어 주세요.', CALENDAR_MISSING: '연결된 Google Calendar를 찾을 수 없습니다. 삭제 여부를 확인해 주세요.',
  CREATION_UNCERTAIN: '생성 결과를 확인하지 못했습니다. 연결 확인 버튼으로 먼저 기존 캘린더를 찾습니다.',
  DUPLICATE_EVENT: '같은 계약 일정이 여러 개 있습니다. 관리자에게 확인을 요청해 주세요.', EVENT_MISSING: '등록했던 일정이 삭제되었습니다. 관리자에게 확인을 요청해 주세요.',
  EVENT_IDENTITY_CHANGED: '일정의 연결 정보가 변경되었습니다. 관리자에게 확인을 요청해 주세요.', CONNECTION_CHANGED: '이 계약이 등록된 이전 캘린더와 현재 연결이 다릅니다. 관리자에게 문의해 주세요.',
  PRIVATE_ACCESS_REQUIRED: '캘린더가 전체 공개 또는 조직 공개되어 있습니다. 비공개로 변경한 뒤 다시 확인해 주세요.', TIMEZONE_CHANGED: '캘린더 시간대를 서울로 설정해 주세요.',
  ACCESS_DENIED: 'Google 접근 권한을 관리자에게 확인해 주세요.',
};
export function CalendarIntegrationSettings({ api, owner = false }: { api: Api; owner?: boolean }) {
  const [state, setState] = useState<CalendarIntegrationStatus | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  useEffect(() => { let active = true; api('calendar-integration').then(result => { if (active) setState(result.integration!); }).catch(error => { if (active) setMessage(error.message); }); return () => { active = false; }; }, [api]);
  async function act(method = 'GET', body?: unknown) {
    if (busy) return; setBusy(true); setMessage('');
    try { const result = await api('calendar-integration', method, body); setState(result.integration!); setMessage(method === 'GET' ? '일정 연결 상태를 확인했습니다.' : '일정 설정 및 요청을 저장했습니다.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : '요청을 완료하지 못했습니다.'); } finally { setBusy(false); }
  }
  return <section aria-label="Google Calendar 촬영일정" className="integration-screen space-y-5">
    <header className="integration-heading">
      <h2 className="text-2xl font-semibold">Google Calendar 촬영일정</h2>
      <ol className="grid gap-3 mt-5 text-sm list-decimal pl-5"><li>기본값은 OFF입니다. 아래에서 Google Calendar 사용을 켜세요.</li><li>촬영 일정 캘린더 만들기를 누르면 업체 전용 캘린더가 연결됩니다.</li><li>고객 접수는 예약현황판에만 표시됩니다. 대표 승인 후 Google 일정이 등록됩니다.</li><li>계약서 발송 완료 후 같은 일정의 상태가 갱신됩니다. 중복 일정을 만들지 않습니다.</li></ol><p className="mt-3">승인한 계약의 예식일과 장소를 전용 캘린더에 자동으로 등록합니다.</p>
      <p className="mt-2 text-sm">사용하지 않아도 계약서 발송은 정상 작동합니다. Google Sheets와 별도로 선택할 수 있습니다.</p>
    </header>
    {message && <p role="status" className="integration-notice">{message}</p>}
    {!state ? <p>일정 연결을 확인하고 있습니다.</p> : <>
      {state.demo && <p className="integration-demo">로컬 Demo입니다. 실제 Google Calendar나 일정은 생성하지 않습니다.</p>}
      <div className="integration-grid">
        <div className="integration-panel integration-controls">
          <label className="integration-toggle"><input type="checkbox" checked={state.enabled} disabled={busy} onChange={event => {
            const enabled = event.target.checked;
            if (window.confirm(enabled ? '앞으로 승인하는 계약의 예식일정을 자동 등록할까요? 과거 계약은 자동으로 가져오지 않습니다.' : '새 일정의 자동 등록을 중지할까요? 기존 캘린더와 일정은 그대로 남습니다.')) void act('PUT', { enabled, durationMinutes: state.durationMinutes, expectedRevision: state.revision });
          }} /> Google Calendar 사용</label>
          <label className="integration-field">캘린더 표시시간<select aria-label="캘린더 표시시간" aria-describedby="calendar-duration-help" disabled={busy} value={state.durationMinutes} onChange={event => {
            const durationMinutes = Number(event.target.value);
            if (window.confirm('새 계약 일정의 표시시간을 ' + durationMinutes / 60 + '시간으로 변경할까요? 기존 일정과 계약조건은 유지됩니다.')) void act('PUT', { enabled: state.enabled, durationMinutes, expectedRevision: state.revision });
          }}>{[60,120,180,240,360,480].map(value => <option key={value} value={value}>{value / 60}시간</option>)}</select></label>
          <p id="calendar-duration-help" className="integration-help">캘린더에 보여 줄 시간 블록입니다. 실제 촬영시간이나 계약금액은 바뀌지 않습니다. 새로 승인하는 계약부터 적용됩니다.</p>
          <div className="integration-status border-t pt-4"><span>연결 상태</span><strong className="integration-badge" data-state={state.connection}>{names[state.connection]}</strong></div>
          {state.name && <p className="text-sm">캘린더: {state.name}</p>}
          {state.errorCode && <p className="text-sm text-red-700">{help[state.errorCode] || 'Google 연결 상태를 관리자에게 확인해 주세요.'}</p>}
          {state.enabled && ['disconnected','missing'].includes(state.connection) && <>
            <p className="integration-help">{state.connection === 'missing' ? '삭제된 캘린더는 자동 복구하지 않습니다. 이전 계약 일정은 관리자 확인이 필요합니다.' : '아직 전용 일정 캘린더가 없습니다.'}</p>
            <button className="admin-button admin-primary" disabled={busy} onClick={() => void act('POST', { operation: 'create', expectedRevision: state.revision })}>{state.connection === 'missing' ? '새 캘린더 만들기' : '촬영 일정 캘린더 만들기'}</button>
          </>}
          {state.enabled && state.errorCode === 'CREATION_UNCERTAIN' && <button className="admin-button" disabled={busy} onClick={() => void act('POST', { operation: 'create', expectedRevision: state.revision })}>생성한 캘린더 연결 확인</button>}
          {state.url && <a href={state.url} target="_blank" rel="noopener noreferrer" className="admin-button">캘린더 열기</a>}
          {state.enabled && !state.workerReady && <p role="alert" className="text-sm text-red-700">자동 일정 등록이 준비되지 않았습니다. 사용 설정을 다시 저장하거나 관리자에게 Google 권한을 확인해 달라고 요청해 주세요.</p>}
        </div>
        <aside className="integration-panel integration-preview" aria-label="일정 표시 예시">
          <h3>이렇게 등록됩니다 (가상 예시)</h3>
          <p>[계약확정] 김신랑 · 이신부 — TEST 웨딩홀</p>
          <p className="mt-3">2026.10.24 · 13:00 ~ {String(13 + state.durationMinutes / 60).padStart(2,'0')}:00 (서울)</p>
          <p className="mt-2 text-sm">상품: TEST 촬영 상품</p>
          <p className="integration-help mt-5 border-t pt-4">대표님이 확인한 최종 날짜와 장소를 사용합니다. 모든 일정은 서울 시간 기준입니다.</p>
        </aside>
      </div>
      <section className="integration-panel space-y-3">
        <div className="integration-status"><h3 className="font-semibold">일정 등록 상태</h3><button className="admin-button" disabled={busy} onClick={() => void act()}>일정 상태 확인</button></div>
        <p className="integration-summary">조회한 계약 중 완료 {state.counts.synced}건 · 대기 {state.counts.pending}건 · 확인 필요 {state.counts.failed + state.counts.unknown}건</p>
        <p className="integration-help">일정 등록 오류가 있어도 계약과 계약서 발송 결과는 유지됩니다. 고객에게 다시 제출하도록 안내하지 마세요.</p>
        <ul className="space-y-4">{state.jobs.map(job => <li key={job.contractId} className="integration-job">
          <p className="font-semibold">{job.contractNumber} · {job.status === 'pending' ? '등록 대기' : '일정 등록 확인 필요'}</p>
          <p className="integration-help mt-1">{help[job.errorCode] || '연결 확인 후 다시 등록하면 기존 일정을 찾아 갱신합니다.'}</p>
          {job.lastAttemptAt && <p className="integration-help mt-1">마지막 확인: {new Date(job.lastAttemptAt).toLocaleString('ko-KR')}</p>}
          <button className="admin-button mt-3" disabled={busy || !state.enabled || state.connection !== 'connected'} onClick={() => void act('POST', { operation: 'retry', contractId: job.contractId })}>다시 등록</button>
        </li>)}</ul>
        {state.nextCursor && <button className="admin-button" disabled={busy} onClick={async () => {
          setBusy(true); try { const next = (await api('calendar-integration?cursor=' + encodeURIComponent(state.nextCursor!))).integration!;
            setState({ ...next, jobs: [...state.jobs, ...next.jobs], counts: { pending: state.counts.pending + next.counts.pending, failed: state.counts.failed + next.counts.failed, unknown: state.counts.unknown + next.counts.unknown, synced: state.counts.synced + next.counts.synced } });
          } catch { setMessage('다음 계약 상태를 확인하지 못했습니다.'); } finally { setBusy(false); }
        }}>다음 일정 상태 확인</button>}
      </section>
      <details className="integration-more"><summary>사용과 복구 안내</summary>
        <p>반영 위치: 대표님이 보는 전용 Google Calendar입니다. 캘린더에서 수정해도 계약서 내용은 바뀌지 않습니다.</p>
        <p>승인 후 별도 작업이 일정을 등록하고, 계약서 발송이 완료되면 같은 일정을 갱신합니다. 기본 표시시간은 3시간입니다.</p>
        <p>사용을 꺼도 기존 캘린더와 일정을 삭제하지 않습니다. 다시 켜도 과거 계약은 자동 등록하지 않습니다.</p>
      </details>
      {!owner && state.diagnostics && <details className="integration-panel integration-more"><summary>고급 연결 진단</summary>
        <p>Calendar ID 일부: {state.diagnostics.calendarIdHint || '미연결'}</p><p>연결 생성 상태: {state.diagnostics.creationState}</p>
        <p>운영 설정 버전: {state.revision} · 사용 주기: {state.diagnostics.cycle}</p><p>연동 오류: {state.errorCode || '없음'}</p>
        <p>계약별 연결 식별자는 서버 Record에서 관리합니다. 오류 계약번호로 비공개 Record의 calendarSync를 확인하세요. 임의 식별자 입력과 기존 계약 자동 재연결은 지원하지 않습니다.</p>
      </details>}
    </>}
  </section>;
}
