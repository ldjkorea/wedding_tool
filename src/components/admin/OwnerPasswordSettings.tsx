'use client';
import { useEffect, useState } from 'react';

type Api = (url: string, method?: string, body?: unknown) => Promise<any>;
type Status = { studioName: string; revision: number; source: 'initial' | 'environment' | 'master' };
export function OwnerPasswordSettings({ api }: { api: Api }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    api('owner-password').then(value => { if (active) setStatus(value); })
      .catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, [api]);
  return <section className="max-w-xl space-y-5">
    <header><h2 className="text-xl font-semibold">사장님 로그인 비밀번호</h2>
      <p className="mt-2">현재 업체의 사장님이 예약현황과 운영 설정에 들어갈 때 사용하는 숫자 6자리입니다. 업체마다 다르게 설정해 주세요.</p>
      <p className="mt-2 text-sm">고객 계약 내용과 상품 가격에는 영향을 주지 않습니다. 변경하면 사장님은 새 비밀번호로 다시 로그인해야 합니다.</p></header>
    {status && <div className="border rounded p-4 bg-white"><strong>{status.studioName}</strong>
      <p className="mt-2 text-sm">{status.source === 'initial' ? '미설정 · 초기 비밀번호 000000' : '사장님 비밀번호 설정됨'}</p>
      {status.source === 'initial' && <p className="mt-2 text-sm">초기 비밀번호는 Demo 확인용입니다. 실제 운영에서는 총관리자가 새 비밀번호를 저장하기 전 예약정보 접근이 차단됩니다.</p>}</div>}
    <form className="space-y-4" onSubmit={async event => {
      event.preventDefault();
      if (busy || !status) return;
      if (password !== confirmation) { setMessage('두 비밀번호가 일치하지 않습니다.'); return; }
      setBusy(true); setMessage('');
      try {
        const saved = await api('owner-password', 'PUT', { password, expectedRevision: status.revision });
        setStatus({ ...status, revision: saved.revision, source: 'master' });
        setMessage('사장님 비밀번호를 변경했습니다. 기존 사장님 로그인은 종료되었습니다.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '저장하지 못했습니다. 다시 조회해 주세요.');
        setStatus(null);
        try { setStatus(await api('owner-password')); } catch { /* Existing error remains visible. */ }
      } finally { setPassword(''); setConfirmation(''); setBusy(false); }
    }}>
      <label className="block">새 비밀번호<input className="admin-input" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="new-password" required disabled={busy} value={password} onChange={event => setPassword(event.target.value.replace(/\D/g, ''))} /></label>
      <p className="text-sm">숫자 6자리. 초기값 000000은 새 비밀번호로 사용할 수 없습니다.</p>
      <label className="block">새 비밀번호 확인<input className="admin-input" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="new-password" required disabled={busy} value={confirmation} onChange={event => setConfirmation(event.target.value.replace(/\D/g, ''))} /></label>
      <p className="text-sm">저장 시 변경: 이 업체의 사장님 비밀번호 교체 · 기존 사장님 세션 종료</p>
      <button className="admin-button admin-primary" disabled={busy || !status}>{busy ? '저장 중…' : '사장님 비밀번호 변경'}</button>
    </form>
    {message && <p role="status" className="border p-3 bg-white">{message}</p>}
  </section>;
}
