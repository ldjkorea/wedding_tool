'use client';
import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';

export function ConsoleNavigation({ current, dirty = false }: { current: 'bookings' | 'settings' | 'master'; dirty?: boolean }) {
  return <nav className="console-navigation" aria-label="주요 메뉴">
    {([['bookings', '/owner', '예약 관리'], ['settings', '/studio-control', '운영 설정'], ['customer', '/', '고객 화면']] as const).map(([key, href, label]) =>
      <Link key={key} href={href} aria-current={current === key ? 'page' : undefined} onClick={event => {
        if (dirty && !window.confirm('저장하지 않은 변경사항이 있습니다. 저장하지 않고 이동할까요?')) event.preventDefault();
      }}>{label}</Link>)}
  </nav>;
}

export function ConsoleLoading({ children = '로그인 상태와 예약을 확인하고 있습니다…' }: { children?: ReactNode }) {
  return <section className="console-loading" role="status" aria-live="polite" aria-busy="true">
    <p>{children}</p><div className="console-skeleton" aria-hidden="true" /><div className="console-skeleton short" aria-hidden="true" />
  </section>;
}

/** Native modal provides inert background, focus containment and keyboard dismissal. */
export function ConsoleDialog({ title, onClose, children, drawer = false, busy = false }: {
  title: string; onClose: () => void; children: ReactNode; drawer?: boolean; busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = ref.current;
    element?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} aria-label={title} aria-modal="true" className={'admin-workspace console-dialog' + (drawer ? ' console-drawer' : '')}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className="console-dialog-header"><h2>{title}</h2><button className="owner-button" type="button" disabled={busy} onClick={onClose} aria-label={title + ' 닫기'}>닫기</button></header>
    {children}
  </dialog>;
}
