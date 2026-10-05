'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { OwnerEditors, ownerMenus } from './OwnerEditors';
import { CalendarIntegrationSettings } from './CalendarIntegrationSettings';
import { SheetIntegrationSettings } from './SheetIntegrationSettings';
import type { OwnerSettings } from '@/types/ownerSettings';
import { formatKRW } from '@/lib/pricing';

type Tab = typeof ownerMenus[number][0] | 'home';
function summaries(before: OwnerSettings, after: OwnerSettings) {
  const labels: Record<string, string> = { name: '이름', price: '가격', amount: '혜택 금액', description: '설명', subtitle: '한 줄 안내', includedItems: '주요 제공내용', retouchedCount: '보정본 수', additionalRetouchedCount: '추가 보정본 수', originalCount: '원본 안내', albumSpec: '앨범 구성', coupleAlbumSummary: '부부 앨범', parentAlbumSummary: '부모님 앨범', active: '사용 여부', displayOrder: '표시 순서', code: '코드' };
  const display = (key: string, value: unknown): string => key === 'price' || key === 'amount' ? formatKRW(Number(value)) : key === 'active' ? value ? '사용' : '사용 안 함' : Array.isArray(value) ? value.join(' / ') : String(value ?? '없음');
  return (Object.keys(after) as (keyof OwnerSettings)[]).flatMap(key => after[key].flatMap((value, index) => {
    const item = value as unknown as Record<string, unknown>, old = before[key][index] as unknown as Record<string, unknown> | undefined;
    const name = String(item.name || item.code || '새 할인코드');
    if (!old) return [name + ' 추가'];
    return Object.entries(item).filter(([field, next]) => field !== 'id' && JSON.stringify(next) !== JSON.stringify(old[field])).map(([field, next]) => name + ' · ' + labels[field] + ': ' + display(field, old[field]) + ' → ' + display(field, next));
  }));
}
function ownerMessage(status: number, error: unknown, saving = false) {
  if (status === 401) return '로그인이 필요하거나 이용 시간이 만료되었습니다. 다시 로그인해 주세요.';
  if (status === 409) return String(error).includes('다른') || String(error).includes('다시 불러') ? '다른 곳에서 설정이 변경되었습니다. 최신 내용을 불러온 뒤 다시 저장해 주세요.' : '진행 중인 계약 또는 설정 확인이 필요합니다. 해당 계약을 먼저 확인하거나 관리자에게 문의해 주세요.';
  if (status === 429) return '로그인 시도가 많습니다. 15분 후 다시 시도해 주세요.';
  if (status === 400) return String(error).includes('계약금보다') ? '할인 적용 후 상품 금액이 계약금보다 작습니다. 가격과 혜택 금액을 확인해 주세요.' : '입력 내용을 확인해 주세요. 금액은 0 이상 정수, 코드는 중복 없이 입력하고 사용 중단은 사용 안 함으로 선택해 주세요.';
  if (status === 503) return '관리자에게 로그인 또는 저장 설정 확인을 요청해 주세요.';
  return saving ? '저장 결과를 확인하지 못했습니다. 최신 내용을 불러와 적용 여부를 확인한 뒤 다시 시도해 주세요.' : '요청을 완료하지 못했습니다. 잠시 후 다시 확인하거나 관리자에게 문의해 주세요.';
}
export function OwnerConsole() {
  const [desktop, setDesktop] = useState(false), [authenticated, setAuthenticated] = useState(false), [password, setPassword] = useState('');
  const [settings, setSettings] = useState<OwnerSettings | null>(null), [original, setOriginal] = useState<OwnerSettings | null>(null), [version, setVersion] = useState(0);
  const [benefits, setBenefits] = useState<{ id: string; timing: string; condition: string }[]>([]);
  const [tab, setTab] = useState<Tab>('home'), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [confirmSave, setConfirmSave] = useState(false);
  const activity = useRef(0), heartbeat = useRef(0), dialog = useRef<HTMLElement | null>(null);
  const editEpoch = useRef(0), loadSequence = useRef(0), sessionEpoch = useRef(0);
  const attemptedInitialLoad = useRef(false);
  const clear = useCallback(() => { sessionEpoch.current++; loadSequence.current++; setAuthenticated(false); setSettings(null); setOriginal(null); setConfirmSave(false); setBenefits([]); }, []);
  const api = useCallback(async (url: string, method = 'GET', body?: unknown) => {
    if (url === 'auth' && method === 'POST') sessionEpoch.current++;
    const epoch = sessionEpoch.current;
    let response: Response, data;
    try {
      response = await fetch('/api/owner-control/' + url, { method, credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      data = await response.json();
    } catch { throw new Error(ownerMessage(502, '', method === 'PUT')); }
    if (response.status === 401 && epoch === sessionEpoch.current) clear();
    if (!response.ok || !data.success) throw new Error(ownerMessage(response.status, data.error, method === 'PUT'));
    heartbeat.current = Date.now(); return data;
  }, [clear]);
  const load = useCallback(async () => {
    const edit = editEpoch.current, sequence = ++loadSequence.current, session = sessionEpoch.current;
    const data = await api('settings');
    if (sequence !== loadSequence.current || edit !== editEpoch.current || session !== sessionEpoch.current) return;
    setSettings(data.settings); setOriginal(structuredClone(data.settings)); setVersion(data.version); setBenefits(data.benefits); setAuthenticated(true); activity.current = Date.now();
  }, [api]);
  useEffect(() => { const query = window.matchMedia('(min-width: 1024px)'); const change = () => setDesktop(query.matches); change(); query.addEventListener('change', change); return () => query.removeEventListener('change', change); }, []);
  useEffect(() => {
    if (!desktop || attemptedInitialLoad.current) return;
    attemptedInitialLoad.current = true; load().catch(() => {});
  }, [desktop, load]);
  useEffect(() => {
    if (!authenticated || !desktop) return;
    const active = () => { activity.current = Date.now(); };
    window.addEventListener('pointerdown', active); window.addEventListener('keydown', active);
    const timer = window.setInterval(() => {
      if (Date.now() - activity.current >= 1800000) { clear(); setMessage('이용 시간이 만료되었습니다. 다시 로그인해 주세요.'); return; }
      if (activity.current > heartbeat.current && Date.now() - heartbeat.current >= 60000) api('auth').catch(error => setMessage(error.message));
    }, 30000);
    return () => { clearInterval(timer); window.removeEventListener('pointerdown', active); window.removeEventListener('keydown', active); };
  }, [authenticated, desktop, clear, api]);
  useEffect(() => { if (!confirmSave) return; const prior = document.activeElement as HTMLElement | null; dialog.current?.focus(); return () => prior?.focus(); }, [confirmSave]);
  const dirty = JSON.stringify(settings) !== JSON.stringify(original), changes = settings && original ? summaries(original, settings) : [];
  async function perform(task: () => Promise<void>) { if (busy) return; setBusy(true); setMessage(''); try { await task(); } catch (error) { setMessage(error instanceof Error ? error.message : '요청을 완료하지 못했습니다.'); } finally { setBusy(false); } }
  function confirm() {
    if (!settings) return;
    for (const list of Object.values(settings)) for (const item of list) for (const value of Object.values(item)) if (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 0 || value > 100000000)) { setMessage('금액과 수량은 0부터 100,000,000까지의 정수로 입력해 주세요.'); return; }
    if (settings.codes.some(code => !code.code.trim() || code.amount <= 0)) { setMessage('할인코드와 0원보다 큰 할인금액을 입력해 주세요.'); return; }
    setConfirmSave(true);
  }
  if (!desktop) return <main className="admin-workspace p-6"><section className="admin-mobile-card"><p className="text-sm font-semibold mb-4">안전한 운영 설정</p><h1 className="text-xl font-semibold">운영 설정은 PC에서 이용해 주세요.</h1><p className="mt-3">화면 너비 1,024px 이상에서 이용할 수 있습니다.</p><p className="mt-4 text-sm">작은 화면에서 설정을 잘못 변경하지 않도록 PC에서 편집할 수 있습니다. 고객 계약 작성은 모바일에서도 이용할 수 있습니다.</p></section></main>;
  return <main className="admin-workspace max-w-6xl mx-auto w-full p-8">
    <header className="admin-page-header mb-8"><h1 className="text-3xl font-bold">운영 설정</h1><p className="mt-3 text-slate-600">상품과 혜택을 쉽게 관리하세요. 저장한 내용은 이후 새로 계약하는 고객에게 적용되며, 이미 확정된 계약의 내용과 금액은 유지됩니다.</p></header>
    {message && !confirmSave && <p role="status" className="border rounded-lg p-4 my-5 bg-slate-50 whitespace-pre-wrap">{message}</p>}
    {!authenticated ? <form className="admin-login max-w-md space-y-5" onSubmit={event => { event.preventDefault(); perform(async () => { try { await api('auth', 'POST', { password }); await load(); } finally { setPassword(''); } }); }}>
      <label className="block font-medium">대표 비밀번호<input aria-label="대표 비밀번호" className="owner-input" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label><button className="owner-button admin-primary w-full" disabled={busy}>로그인</button>
    </form> : <>
      <div className="admin-toolbar flex justify-between mb-6"><button className="owner-button" disabled={busy} onClick={() => setTab('home')}>운영 메뉴</button><div className="flex gap-3"><button className="owner-button" disabled={busy} onClick={() => { if (!dirty || window.confirm('저장하지 않은 변경을 버리고 최신 내용을 불러올까요?')) perform(load); }}>최신 내용 불러오기</button><button className="owner-button" disabled={busy} onClick={() => perform(async () => { await api('auth', 'DELETE', {}); clear(); setMessage('로그아웃되었습니다.'); })}>로그아웃</button></div></div>
      {dirty && <section className="mb-6 sticky top-2 z-20 border rounded-xl p-6 bg-slate-50"><h2 className="font-semibold">저장하지 않은 변경사항이 있습니다.</h2><p className="mt-2 text-sm">메뉴를 바꿔도 입력한 내용은 유지됩니다. 저장 전에 변경 내용을 확인해 주세요.</p><button className="owner-button mt-4" disabled={busy} onClick={confirm}>변경사항 저장</button></section>}
      <fieldset disabled={busy}>
        {tab === 'home' ? <div className="admin-menu-grid">{ownerMenus.map(([key, title, text]) => <section key={key} className="admin-menu-card"><h2 className="text-xl font-semibold">{title}</h2><p className="mt-3 mb-5 text-slate-600">{text}</p><button className="owner-button" onClick={() => setTab(key)}>{key === 'products' ? '상품 관리' : key === 'options' ? '옵션 관리' : key === 'discounts' ? '할인 관리' : key === 'codes' ? '할인코드 관리' : key === 'calendar' ? 'Google Calendar 설정' : 'Google Sheets 설정'}</button></section>)}</div> : <section className="border rounded-xl p-7 bg-white">{tab !== 'calendar' && tab !== 'sheets' && <header className="admin-page-header mb-7"><h2 className="text-2xl font-semibold mb-3">{ownerMenus.find(([key]) => key === tab)?.[1]}</h2><p className="text-slate-600">{ownerMenus.find(([key]) => key === tab)?.[2]}</p></header>}{tab === 'calendar' ? <CalendarIntegrationSettings api={api} owner /> : tab === 'sheets' ? <SheetIntegrationSettings api={api} owner /> : settings && <OwnerEditors key={tab} kind={tab} settings={settings} update={next => { editEpoch.current++; setSettings(next); setMessage(''); }} benefits={benefits} />}</section>}
      </fieldset>

      {confirmSave && settings && <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-8 z-50"><section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="변경사항 확인" className="bg-white rounded-xl p-7 w-full max-w-3xl max-h-[85vh] overflow-y-auto" onKeyDown={event => {
        if (event.key === 'Escape' && !busy) setConfirmSave(false);
        if (event.key === 'Tab') { const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'), first = buttons[0], last = buttons[buttons.length - 1]; if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
      }}><h2 className="text-xl font-semibold">변경사항 확인</h2>{message && <p role="status" className="border p-4 mt-4 bg-slate-50">{message}</p>}<ul className="list-disc ml-5 mt-5 space-y-2">{changes.map((text, index) => <li key={index}>{text}</li>)}</ul><p className="mt-5">이후 새로 계약하는 고객부터 적용됩니다. 진행 중인 계약은 대표 확인이 다시 필요할 수 있으며, 확정된 계약은 유지됩니다.</p><div className="flex gap-3 mt-6"><button className="owner-button" disabled={busy} onClick={() => setConfirmSave(false)}>취소</button><button className="owner-button" disabled={busy} onClick={() => perform(async () => { await api('settings', 'PUT', { changes: settings, version }); await load(); setConfirmSave(false); setMessage('변경사항을 저장했습니다. 이후 새로 계약하는 고객부터 적용됩니다.'); })}>저장</button></div></section></div>}
    </>}
  </main>;
}
