'use client';
import { useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
export function OwnerEntry({ children, dirty = false }: { children: ReactNode; dirty?: boolean }) {
  const taps = useRef<number[]>([]),
    router = useRouter();
  function tap() {
    const now = Date.now();
    taps.current = [...taps.current.filter((time) => now - time <= 3000), now];
    if (taps.current.length < 5) return;
    taps.current = [];
    if (
      !dirty ||
      window.confirm(
        '사장님 로그인으로 이동하면 작성 중인 계약 내용은 저장되지 않습니다. 이동할까요?',
      )
    )
      router.push('/owner');
  }
  return (
    <button
      type="button"
      onClick={tap}
      className="touch-manipulation select-none rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
      aria-label="브랜드 로고"
    >
      {children}
    </button>
  );
}
