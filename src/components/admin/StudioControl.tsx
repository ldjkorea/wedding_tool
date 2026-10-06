'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { validateStudioSettings } from '@/services/settingsValidation';
import type { StudioSettings, SettingsHead } from '@/types/studioSettings';

const sections = [
  ['studioConfig', '업체정보'], ['productsConfig', '상품'], ['optionsConfig', '옵션'],
  ['discountsConfig', '할인 / 혜택'], ['contractPolicy', '계약정책'], ['formSchema', '고객 입력폼'], ['content', '계약서 / 안내 문구'],
] as const;
import { ConsoleNavigation, ConsoleLoading, ConsoleDialog } from './ConsolePrimitives';
import { PasswordField } from '@/components/ui/PasswordField';
import { deduplicateRead } from '@/lib/inflightRequest';
import { SettingFields } from './SettingFields';
import { CalendarIntegrationSettings } from './CalendarIntegrationSettings';
import { SheetIntegrationSettings } from './SheetIntegrationSettings';
import { OwnerPasswordSettings } from './OwnerPasswordSettings';
import { sectionInformation, describeChanges, type Tree } from './settingsPresentation';


export function StudioControl() {
  const [authenticated, setAuthenticated] = useState(false);
  const initialLoad = useRef(false);
  const [system, setSystem] = useState<{ version: string; mode: string; storage: string } | null>(null);
  const [password, setPassword] = useState(''), [settings, setSettings] = useState<StudioSettings | null>(null);
  const [original, setOriginal] = useState<StudioSettings | null>(null), [revision, setRevision] = useState(0);
  const [history, setHistory] = useState<SettingsHead['history']>([]), [restoreRevision, setRestoreRevision] = useState('');
  const [tab, setTab] = useState<typeof sections[number][0] | 'integration' | 'ownerPassword'>('studioConfig'), [message, setMessage] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [busy, setBusy] = useState(false), [recovery, setRecovery] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const lastActivity = useRef(0), lastHeartbeat = useRef(0);
  const reads = useRef(new Map<string, Promise<any>>()), sessionEpoch = useRef(0), loadSequence = useRef(0), pending = useRef(false);
  const api = useCallback(async (url: string, method = 'GET', body?: unknown) => {
    if (url === 'auth' && method !== 'GET') sessionEpoch.current++;
    const epoch = sessionEpoch.current;
    const request = async () => {
    const response = await fetch('/api/master-control/' + url, { method, credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (response.status === 401 && epoch === sessionEpoch.current) { setAuthenticated(false); setSettings(null); setOriginal(null); setConfirmSave(false); }
    if (!response.ok || !data.success) throw new Error(data.error || '요청 실패');
    lastHeartbeat.current = Date.now(); return data;
    };
    return method === 'GET' ? deduplicateRead(reads.current, epoch + ':' + url, request) : request();
  }, []);
  const load = useCallback(async (initial?: Awaited<ReturnType<typeof api>>) => {
    const epoch = sessionEpoch.current, sequence = ++loadSequence.current;
    const data = initial || await api('settings');
    if (epoch !== sessionEpoch.current || sequence !== loadSequence.current) return;
    const document = data.settings as StudioSettings | null;
    if (document) {
      document.partnerCodes ??= [];
      document.studioConfig.businessInformation ??= '';
      document.productsConfig.forEach(product => { product.shootScope ??= ''; });
    }
    setSettings(document); setOriginal(document ? structuredClone(document) : null); setRevision(data.revision);
    setRecovery(!!data.recoveryRequired); setHistory(data.history); setAuthenticated(true);
    setSystem(data.system);
    lastActivity.current = Date.now();
  }, [api]);
  useEffect(() => {
    if (initialLoad.current) return;
    initialLoad.current = true;
    load().catch(() => {}).finally(() => setInitialLoading(false));
  }, [load]);
  useEffect(() => {
    if (!authenticated) return;
    const activity = () => { lastActivity.current = Date.now(); };
    window.addEventListener('pointerdown', activity); window.addEventListener('keydown', activity);
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity.current >= 1800000) { setAuthenticated(false); setSettings(null); setOriginal(null); setConfirmSave(false); setMessage('미사용 시간이 지나 세션이 만료되었습니다.'); return; }
      if (lastActivity.current > lastHeartbeat.current && Date.now() - lastHeartbeat.current >= 60000) api('auth').catch(error => setMessage(error.message));
    }, 30000);
    return () => { clearInterval(timer); window.removeEventListener('pointerdown', activity); window.removeEventListener('keydown', activity); };
  }, [authenticated, api]);
  const changes = settings && original ? describeChanges(original, settings) : [];
  const dirty = JSON.stringify(settings) !== JSON.stringify(original);
  async function perform(task: () => Promise<void>) {
    if (pending.current) return; pending.current = true; setBusy(true); setMessage('');
    try { await task(); } catch (error) { setMessage(error instanceof Error ? error.message : '요청 실패'); } finally { pending.current = false; setBusy(false); }
  }
  function update(path: string[], value: Tree) {
    setSettings(previous => {
      if (!previous) return previous;
      const copy = structuredClone(previous); let node: any = copy;
      for (const key of path.slice(0, -1)) node = node[key];
      node[path.at(-1)!] = value;
      if (path[0] === 'formSchema' && path.at(-1) === 'enabled' && value === false) node.required = false;
      return copy;
    });
  }
  return <main className="admin-workspace max-w-6xl mx-auto w-full p-8">
    <ConsoleNavigation current="master" dirty={dirty} /><p className="booking-eyebrow">SERVICE ADMINISTRATION</p><h1 className="text-2xl font-bold mb-2">총관리자 설정</h1>
    <p className="text-sm mb-6">설정 변경은 신규 계약에 적용됩니다. 미처리 계약은 정책 변경 보호에 의해 차단될 수 있습니다. 이미 확정된 계약은 유지됩니다.</p>
    {message && <p role="status" className="border p-3 my-4 bg-white whitespace-pre-wrap">{message}</p>}
    {initialLoading ? <ConsoleLoading>관리자 인증 상태를 확인하고 있습니다…</ConsoleLoading> : !authenticated ? <form className="admin-login max-w-md space-y-4" onSubmit={event => { event.preventDefault(); perform(async () => {
      try { const result = await api('auth', 'POST', { password, initialView: 'settings' }); await load(result.initial); } finally { setPassword(''); }
    }); }}>
      <PasswordField id="master-login-password" label="관리자 비밀번호" className="admin-input" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} required />
      <button className="admin-button admin-primary w-full" disabled={busy}>{busy ? '확인 중…' : '로그인'}</button>
    </form> : <>
      <div className="admin-toolbar flex mb-6"><span>설정 버전 {revision}{dirty ? ' · 저장하지 않은 변경 있음' : ''}</span>
        <button className="admin-button" disabled={busy} onClick={() => perform(async () => { await api('auth', 'DELETE', {}); setAuthenticated(false); setSettings(null); setOriginal(null); setConfirmSave(false); setMessage('로그아웃되었습니다.'); })}>로그아웃</button>
        <button className="admin-button" disabled={busy} onClick={() => { if (!dirty || window.confirm('저장하지 않은 변경을 버리고 다시 불러올까요?')) perform(load); }}>다시 불러오기</button>
      </div>
      {recovery && <p role="alert" className="text-red-700 mb-4">저장본 무결성 오류로 고객 계약 처리가 차단되어 있습니다. 정상 revision으로 복구해 주세요.</p>}
      <section className="console-service-summary" aria-label="서비스 상태"><div><span>설정 상태</span><strong>{recovery ? '복구 필요' : '조회 완료'}</strong></div><div><span>활성 설정 버전</span><strong>{revision}</strong></div><div><span>시스템 버전</span><strong>{system?.version || '확인 중'}</strong><small>{system?.mode === 'gas' ? 'Google 연결 환경' : '테스트 환경'}</small></div></section>
      <p className="booking-muted mb-6">일상적인 상품·가격 변경은 운영 설정에서 관리하세요. 이곳에서는 업체 정보, 계약 정책, 계정과 복구 설정을 관리합니다.</p>
      {busy && <p className="console-progress" role="status">처리 중입니다…</p>}
      <fieldset disabled={busy} className="contents"><div className="master-mobile-menu"><label htmlFor="master-menu">관리 메뉴</label><select id="master-menu" aria-describedby="master-menu-help" value={tab} onChange={event => setTab(event.target.value as typeof tab)}>{sections.map(([key,label]) => <option value={key} key={key}>{label}</option>)}<option value="integration">외부 연동</option><option value="ownerPassword">사장님 비밀번호</option></select><p id="master-menu-help" className="text-sm">변경할 항목을 선택하세요. 입력한 내용은 메뉴를 바꿔도 유지됩니다.</p></div><div className="settings-layout master-settings-layout"><nav className="admin-side-nav settings-navigation master-desktop-menu" aria-label="설정 메뉴">{sections.map(([key, label],index) =>
        <div key={key}>{(index === 0 || index === 1 || index === 4 || index === 5) && <p>{index === 0 ? '업체' : index === 1 ? '상품과 혜택' : index === 4 ? '계약' : '고객 화면'}</p>}<button type="button" aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>{label}</button></div>)}<p>Google 연결</p><button type="button" aria-current={tab === 'integration' ? 'page' : undefined} onClick={() => setTab('integration')}>외부 연동</button><p>계정</p><button type="button" aria-current={tab === 'ownerPassword' ? 'page' : undefined} onClick={() => setTab('ownerPassword')}>사장님 비밀번호</button></nav>
        <section className="settings-content">
          {tab === 'ownerPassword' ? <OwnerPasswordSettings api={api} /> : tab === 'integration' ? <div className="space-y-12"><SheetIntegrationSettings api={api} /><CalendarIntegrationSettings api={api} /></div> : <>
          <header className="mb-6 border-b pb-5"><h2 className="text-xl font-semibold">{sectionInformation[tab].title}</h2><p className="mt-2">{sectionInformation[tab].purpose}</p><p className="mt-2 text-sm"><strong>반영 위치:</strong> {sectionInformation[tab].locations}</p><p className="mt-1 text-sm text-slate-600">예: {sectionInformation[tab].example}</p></header>
          {settings && <SettingFields value={settings[tab] as unknown as Tree} path={[tab]} update={update} />}
          {settings && tab === 'studioConfig' && <aside className="border-l-4 border-slate-500 p-4 bg-white mt-5" aria-label="업체 표시 예시"><p className="text-sm mb-2">고객 표시 예시</p><h3 className="text-xl font-semibold">{settings.studioConfig.displayName}</h3><p>{settings.studioConfig.brandTagline}</p><p className="text-sm mt-2">{settings.studioConfig.representativeName} · {settings.studioConfig.representativePhone}</p><p className="text-sm">{settings.studioConfig.representativeEmail}</p></aside>}
          {settings && tab === 'discountsConfig' && <section className="border-t pt-5 mt-6"><h2 className="text-lg font-semibold">짝꿍 할인코드</h2><p className="mt-2 text-sm">고객에게 안내할 코드와 즉시 할인금액을 등록합니다. 전체 코드 목록은 관리자에게만 표시됩니다. 짝꿍 혜택이 사용 안 함이면 활성 코드도 적용되지 않습니다.</p><p className="mt-2 text-sm">대소문자는 구분하지 않으며 앞뒤 공백은 제거합니다. 내부 공백은 사용할 수 없습니다. 사용을 중단할 코드는 삭제하지 않고 활성 체크를 해제하세요. 이미 확정된 계약은 당시 코드와 할인금액을 유지합니다.</p><SettingFields value={settings.partnerCodes as unknown as Tree} path={['partnerCodes']} update={update} /></section>}
          {dirty && <aside className="border rounded p-4 mt-6 bg-white" aria-label="저장할 변경 요약"><h3 className="font-semibold">저장할 변경 {changes.length}건</h3><ul className="list-disc ml-5 mt-2 text-sm space-y-1">{changes.slice(0, 10).map((change, index) => <li key={index}>{change}</li>)}</ul>{changes.length > 10 && <p className="text-sm mt-2">전체 변경은 저장 확인 화면에서 확인합니다.</p>}</aside>}
          {settings && <div className="flex gap-3 mt-6">
            <button className="admin-button" disabled={busy} onClick={() => { try { validateStudioSettings(settings, original || settings); setMessage('입력 검증 통과. 저장 전 상품·금액·약관을 확인해 주세요.'); } catch (error) { setMessage((error as Error).message); } }}>저장 전 검증</button>
            <button className="admin-button" disabled={busy || !dirty || recovery} onClick={() => { try { validateStudioSettings(settings, original || settings); setConfirmSave(true); } catch (error) { setMessage((error as Error).message); } }}>전체 변경 저장</button>
          </div>}
          </>}
        </section></div></fieldset>
      <section className="master-recovery mt-8 border p-4 bg-white"><h2 className="font-semibold">이전 설정 복구</h2><p className="text-sm my-2">최근 20개 설정 이력을 조회합니다. 복구하면 새 버전이 저장됩니다. 확정된 계약은 바뀌지 않으며 미처리 계약은 다시 확인해야 합니다.</p>
        <select aria-label="복구 revision" className="border p-2 mr-3" value={restoreRevision} onChange={event => setRestoreRevision(event.target.value)}><option value="">revision 선택</option>{history.map(item => <option value={item.revision} key={item.revision}>{item.revision} · {item.updatedAt} · {item.actor === 'owner' ? '업체대표' : item.actor === 'master' ? '총관리자' : '기존 기록'}</option>)}</select>
        <button className="admin-button" disabled={busy || !restoreRevision} onClick={() => perform(async () => {
          if (!window.confirm('선택한 revision으로 복구할까요? 저장하지 않은 변경은 버려집니다.')) return;
          await api('restore', 'POST', { revision: Number(restoreRevision), expectedRevision: revision }); await load(); setMessage('이전 설정 복구 완료');
        })}>복구</button>
      </section>
      {confirmSave && settings && <ConsoleDialog title="저장할 변경사항 확인" wide busy={busy} onClose={() => setConfirmSave(false)}>
        <p className="my-3">아래 {changes.length}건을 신규 계약에 적용합니다. 미처리 계약은 변경 보호에 의해 재확인이 필요할 수 있습니다. 확정 계약의 내용과 금액은 유지합니다.</p><ul className="list-disc ml-5 space-y-2">{changes.map((change, index) => <li key={index}>{change}</li>)}</ul><div className="flex gap-3 mt-6"><button className="admin-button" disabled={busy} onClick={() => setConfirmSave(false)}>돌아가서 수정</button><button className="admin-button" disabled={busy} onClick={() => perform(async () => { validateStudioSettings(settings, original || settings); await api('settings', 'PUT', { settings, expectedRevision: revision }); await load(); setConfirmSave(false); setMessage('설정 저장 및 재조회가 완료되었습니다.'); })}>변경사항 저장</button></div>
      </ConsoleDialog>}
    </>}
  </main>;
}
