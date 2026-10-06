'use client';
import { useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ConsoleDialog } from '@/components/admin/ConsolePrimitives';
import { PasswordField } from './PasswordField';

export function MasterEntry({ children, dirty = false }: { children: ReactNode; dirty?: boolean }) {
  const clicks = useRef<number[]>([]), pending = useRef(false);
  const [open, setOpen] = useState(false), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const router = useRouter();
  function close() { setOpen(false); setPassword(''); setError(''); clicks.current = []; }
  function enter() {
    const now = Date.now();
    clicks.current = [...clicks.current.filter(time => now - time < 3000), now];
    if (clicks.current.length < 5) return;
    clicks.current = []; setError(''); setPassword(''); setOpen(true);
  }
  async function login() {
    if (pending.current) return;
    if (dirty && !window.confirm('작성 중인 계약 정보가 있습니다. 관리자 화면으로 이동하면 입력 내용이 사라질 수 있습니다. 이동할까요?')) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/master-control/auth', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({password}) });
      const result = await response.json();
      if (!response.ok || result.success !== true) throw new Error('Authentication failed');
      setPassword(''); router.push('/master-control');
    } catch { setError('로그인하지 못했습니다. 비밀번호를 확인하고 다시 시도해 주세요.'); }
    finally { setPassword(''); pending.current = false; setBusy(false); }
  }
  return <><button type="button" className="copyright-entry" onClick={enter}>{children}</button>
    {open && <ConsoleDialog title="관리자 인증" onClose={close} busy={busy}>
      <p className="booking-muted">관리자 비밀번호를 입력해 주세요.</p>
      <form className="console-auth-form" onSubmit={event => { event.preventDefault(); void login(); }}>
        <PasswordField id="hidden-master-password" label="관리자 비밀번호" value={password} onChange={event => setPassword(event.target.value)} required disabled={busy} />
        {error && <p role="alert" className="booking-error">{error}</p>}
        <div className="console-dialog-actions"><button type="button" className="owner-button" disabled={busy} onClick={close}>취소</button><button className="owner-button admin-primary" disabled={busy || !password}>{busy ? '확인 중…' : '로그인'}</button></div>
      </form>
    </ConsoleDialog>}
  </>;
}
