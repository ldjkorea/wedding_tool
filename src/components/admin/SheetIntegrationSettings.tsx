'use client';
import { useCallback, useEffect, useState } from 'react';
import type { SheetIntegrationStatus } from '@/types/sheetIntegration';
type AdminApi = (url: string, method?: string, body?: unknown) => Promise<{ integration?: SheetIntegrationStatus }>;
const connectionNames = { disabled: '사용 안 함', disconnected: '사용함 / 연결 안 됨', connected: '사용함 / 정상 연결', error: '동기화 오류 / 확인 필요' };
const jobNames = { pending: '동기화 대기', failed: '동기화 실패', unknown: '처리 여부 확인 필요' };
const errorHelp: Record<string, string> = {
  CONNECTION_MISSING: '계약관리 Sheet를 먼저 만들어 주세요.',
  PRIVATE_ACCESS_REQUIRED: 'Sheet가 비공개인지, 실행 계정이 접근할 수 있는지 확인해 주세요.',
  SCHEMA_CHANGED: '첫 행의 제목 또는 계약목록 탭이 변경되었습니다. 원래 제목을 복구한 뒤 다시 동기화해 주세요.',
  DUPLICATE_ROW: '시스템 식별자가 중복되어 자동 갱신을 중단했습니다. 행 복제 여부를 확인해 주세요.',
  WRITE_UNCERTAIN: '쓰기 결과를 확인하지 못했습니다. 다시 동기화하면 같은 계약 행을 찾아 확인합니다.',
  CREATION_UNCERTAIN: 'Sheet 생성 결과가 확인되지 않았습니다. 생성 버튼을 다시 누르면 기존 생성 파일을 먼저 확인합니다. 새 파일을 반복 생성하지 않습니다.',
  CONNECTION_UNAVAILABLE: 'Sheet 삭제 여부와 실행 계정의 접근 권한을 확인해 주세요.',
  SYNC_UNAVAILABLE: 'Sheet 접근 또는 쓰기에 실패했습니다. 연결을 확인한 뒤 다시 동기화해 주세요.',
  CONFIGURATION_UNAVAILABLE: '연결 설정을 확인하지 못했습니다. 서버 설정을 점검해 주세요.',
};
const ownerErrorHelp: Record<string, string> = { PRIVATE_ACCESS_REQUIRED: '계약목록의 공유 또는 접근 권한을 확인하도록 관리자에게 요청해 주세요.', DUPLICATE_ROW: '같은 계약이 여러 행에 복사되어 확인이 필요합니다. 관리자에게 문의해 주세요.', CONFIGURATION_UNAVAILABLE: '연결 정보를 확인하지 못했습니다. 관리자에게 확인을 요청해 주세요.' };
export function SheetIntegrationSettings({ api, owner = false }: { api: AdminApi; owner?: boolean }) {
  const help = owner ? { ...errorHelp, ...ownerErrorHelp } : errorHelp;
  const [state, setState] = useState<SheetIntegrationStatus | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const load = useCallback(async () => { const response = await api('sheet-integration'); setState(response.integration!); }, [api]);
  useEffect(() => {
    let current = true;
    api('sheet-integration').then(response => { if (current) setState(response.integration!); }).catch(error => { if (current) setMessage(error.message); });
    return () => { current = false; };
  }, [api]);
  async function perform(task: () => Promise<void>) {
    if (busy) return; setBusy(true); setMessage('');
    try { await task(); } catch (error) { setMessage(error instanceof Error ? error.message : '상태를 확인하지 못했습니다.'); } finally { setBusy(false); }
  }
  return <section aria-label="Google Sheets 계약목록" className="integration-screen space-y-5">
    <header className="integration-heading"><h2 className="text-2xl font-semibold">Google Sheets 계약목록</h2>
      <p className="mt-3">접수한 계약의 고객명·예식일·상품·금액·진행상태를 비공개 목록에 정리합니다.</p>
      <p className="mt-2">사용하지 않아도 계약 접수와 계약서 발송은 정상적으로 작동합니다.</p>
    </header>
    {message && <p role="status" className="integration-notice">{message}</p>}
    {!state ? <p>연동 상태를 확인하고 있습니다.</p> : <>
      {state.demo && <p className="integration-demo">로컬 Demo입니다. 연결과 목록 기록을 로컬에서 모의하며 실제 Google 파일은 만들지 않습니다.</p>}
      <div className="integration-grid"><div className="integration-panel integration-controls"><label className="integration-toggle"><input type="checkbox" checked={state.enabled} disabled={busy} onChange={event => {
        const enabled = event.target.checked;
        if (!window.confirm(enabled ? '고객명·예식일·연락처·이메일 등을 비공개 계약목록에 기록하도록 사용할까요?' : '자동 동기화를 중지할까요? 기존 Sheet와 계약 자료는 그대로 남습니다.')) return;
        perform(async () => { const response = await api('sheet-integration', 'PUT', { enabled, expectedRevision: state.revision }); setState(response.integration!); setMessage(enabled ? '계약목록 사용 설정을 저장했습니다.' : '자동 동기화를 중지했습니다. 기존 자료는 유지됩니다.'); });
      }} /> 자동 동기화 사용 (기본 OFF)</label>
      <p className="integration-help">접수·승인·발송 결과를 자동으로 반영합니다. Google 작업이 보통 약 1분 간격으로 처리하므로 즉시 표시되지 않을 수 있습니다. 사용을 중지해도 기존 Sheet는 남습니다. 상품·약관 설정에는 영향을 주지 않습니다.</p></div>
      <div className="integration-panel integration-controls"><p className="integration-status"><span>연결 상태</span><span className="integration-badge" data-state={state.connection}>{connectionNames[state.connection]}</span></p>
        {state.name && <p className="mt-2"><strong>Sheet:</strong> <span>{state.name}</span></p>}
        {state.createdAt && <p className="mt-1 text-sm">생성일: {new Date(state.createdAt).toLocaleString('ko-KR')}</p>}
        {state.errorCode && <p className="mt-2 text-red-700">{help[state.errorCode] || '연결 상태를 확인해 주세요.'}</p>}
        {state.enabled && !state.name && <><p className="mt-3">아직 계약관리 Sheet가 없습니다.</p><button className="admin-button admin-primary mt-3" disabled={busy} onClick={() => perform(async () => {
          const response = await api('sheet-integration', 'POST', { operation: 'create', expectedRevision: state.revision }); setState(response.integration!); setMessage('계약관리 Sheet 생성 및 연결 결과를 확인했습니다.');
        })}>새 계약관리 Sheet 만들기</button></>}
        {state.url && <a href={state.url} target="_blank" rel="noopener noreferrer" className="admin-button">Google Sheets에서 열기</a>}
        {state.enabled && !state.workerReady && <p role="alert" className="mt-2 text-red-700">자동 동기화 작업이 없습니다. 사용 설정을 다시 저장해 작업을 등록하거나 실행 계정 권한을 확인해 주세요.</p>}
      </div></div>
      {owner && <section className="integration-panel space-y-4"><h3 className="font-semibold">목록 저장 · 불러오기 · 복구</h3><p className="integration-help">계약 원본은 Google Drive의 접수 내역·확정 계약 내용이며 계약서 교부 시 PDF도 자동 보관합니다. Sheet는 조회용 사본입니다. 시트 수정값으로 계약서를 덮어쓰지 않습니다. 같은 Google 계정의 자료이므로 독립된 3중 백업은 아닙니다.</p>
        <div className="flex flex-wrap gap-3"><button className="admin-button" disabled={busy || !state.name} onClick={() => perform(async () => {const response = await api('sheet-integration','POST',{operation:'read'});setState(response.integration!);setMessage('Google Sheets에 저장된 목록을 불러왔습니다. 최대 50건 미리보기입니다.');})}>시트 목록 불러오기</button>
        <button className="admin-button admin-primary" disabled={busy || !state.enabled || !state.name} onClick={() => {if (!window.confirm('계약 원본을 기준으로 Sheet 목록을 저장·복구할까요? 시트에서 직접 편집한 목록 값은 원본 값으로 돌아갑니다. 확정 계약서는 변경되지 않습니다.')) return; perform(async () => {const response = await api('sheet-integration','POST',{operation:'sync',...(state.syncCursor ? {cursor:state.syncCursor} : {})});setState(response.integration!);setMessage(String(response.integration!.queuedCount || 0)+'건의 저장·복구를 요청했습니다. 자동 작업 후 동기화 상태를 확인하세요.');});}}>{state.syncCursor ? '다음 계약 저장·복구' : '원본에서 시트 저장·재동기화'}</button></div>
        {state.previewRows && <div className="overflow-x-auto"><table className="w-full text-sm text-left"><caption className="text-left py-3">실제 Sheet 저장 내용 (최대 50건)</caption><thead><tr>{['계약번호','예식일','신랑','신부','상품','금액','상태'].map(label=><th key={label} className="p-2 border-b">{label}</th>)}</tr></thead><tbody>{state.previewRows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j} className="p-2 border-b">{cell}</td>)}</tr>)}</tbody></table>{!state.previewRows.length && <p className="p-3">저장된 계약이 없습니다.</p>}</div>}
      </section>}
      <section className="integration-panel"><div className="integration-status"><h3 className="font-semibold">동기화 상태</h3><button className="admin-button" disabled={busy} onClick={() => perform(load)}>동기화 상태 확인</button></div>
        <p className="integration-summary mt-3">조회한 계약 중 동기화 오류 {state.counts.failed + state.counts.unknown}건 · 대기 {state.counts.pending}건 · 완료 {state.counts.synced}건</p>
        <p className="integration-help mt-3">오류가 있어도 계약 접수와 발송 결과는 유지됩니다. 고객에게 다시 제출하도록 안내하지 마세요.</p>

        {state.jobs.length > 0 && <ul className="mt-4 space-y-3">{state.jobs.map(job => <li key={job.contractId} className="integration-job"><p className="font-medium">{job.contractNumber} · {jobNames[job.status]}</p>
          <p className="text-sm mt-1">{help[job.errorCode] || '자동 동기화를 기다리거나 연결 확인 후 다시 요청해 주세요.'}</p>
          <button className="admin-button mt-2" disabled={busy || !state.enabled || !state.name} onClick={() => perform(async () => { await api('sheet-integration', 'POST', { operation: 'retry', contractId: job.contractId }); await load(); setMessage('다시 동기화를 요청했습니다. 상태 확인으로 결과를 확인해 주세요.'); })}>다시 동기화</button>
        </li>)}</ul>}
        {state.nextCursor && <button className="admin-button mt-3" disabled={busy} onClick={() => perform(async () => {
          const response = await api('sheet-integration?cursor=' + encodeURIComponent(state.nextCursor!)), next = response.integration!;
          const counts = { pending: state.counts.pending + next.counts.pending, failed: state.counts.failed + next.counts.failed, unknown: state.counts.unknown + next.counts.unknown, synced: state.counts.synced + next.counts.synced };
          setState({ ...next, connection: next.connection === 'connected' && (counts.failed || counts.unknown) ? 'error' : next.connection, counts, jobs: [...state.jobs, ...next.jobs] });
        })}>다음 계약 상태 확인</button>}
      </section>
      <details className="integration-more"><summary>사용과 복구 안내</summary><p>반영 위치: 대표님이 보는 비공개 Google Sheets입니다. 목록을 수정해도 확정 계약서와 발송 결과는 바뀌지 않습니다.</p><p>접수·확정·발송 완료 후 별도 작업이 목록을 갱신합니다. 사용 중지 중에는 대기 작업을 처리하지 않습니다.</p><p>{owner ? '목록이 늦게 반영되어도 계약 접수와 발송 결과는 유지됩니다. 오류가 있으면 해당 계약의 다시 동기화를 선택하세요.' : '계약의 공식 원본은 영속 Record·확정 Snapshot·PDF·발송 상태입니다. 현재 버전은 새 Sheet 생성과 신규 계약 자동 기록, 개별 실패건 재시도를 제공합니다. 과거 계약 전체 가져오기와 기존 Sheet 연결은 지원하지 않습니다.'}</p></details>
    </>}
  </section>;
}
