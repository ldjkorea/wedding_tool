'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { OwnerBooking } from '@/types/ownerBooking';

import { BookingDetail, bookingStatusLabels as statuses } from './BookingDetail';
import { ConsoleNavigation, ConsoleLoading } from './ConsolePrimitives';
const calendarStatuses = {
  disabled: '자동 등록 대상 아님',
  pending: '등록 대기',
  working: '등록 중',
  synced: '등록 완료',
  failed: '등록 확인 필요',
  unknown: '등록 상태 확인 필요',
};
const seoulDate = () =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
function monthDays(month: string) {
  const [year, value] = month.split('-').map(Number);
  return {
    offset: new Date(Date.UTC(year, value - 1, 1)).getUTCDay(),
    days: new Date(Date.UTC(year, value, 0)).getUTCDate(),
  };
}
function moveMonth(month: string, difference: number) {
  const [year, value] = month.split('-').map(Number),
    date = new Date(Date.UTC(year, value - 1 + difference, 1));
  return date.toISOString().slice(0, 7);
}

export function OwnerBookings() {
  const [authenticated, setAuthenticated] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [pin, setPin] = useState(''),
    [message, setMessage] = useState(''),
    [rows, setRows] = useState<OwnerBooking[]>([]),
    [demo, setDemo] = useState(false);
  const [month, setMonth] = useState(''),
    [selected, setSelected] = useState<string | null>(null),
    [pendingOnly, setPendingOnly] = useState(false),
    [cursor, setCursor] = useState<string | null>(null);
  const [detail, setDetail] = useState<OwnerBooking | null>(null);
  const epoch = useRef(0),
    activity = useRef(Date.now());
  const clear = useCallback(() => {
    epoch.current++;
    setAuthenticated(false);
    setRows([]);
    setDetail(null);
    setCursor(null);
    setPin('');
  }, []);
  const api = useCallback(
    async (url: string, method = 'GET', body?: unknown) => {
      const response = await fetch('/api/owner-control/' + url, {
        method,
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const data = await response.json();
      if (response.status === 401) {
        clear();
        throw new Error('비밀번호를 확인하거나 다시 로그인해 주세요.');
      }
      if (!response.ok || !data.success)
        throw new Error(
          response.status === 429
            ? '로그인 시도가 많습니다. 15분 후 다시 시도해 주세요.'
            : '정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
        );
      return data;
    },
    [clear],
  );
  const load = useCallback(
    async (next?: string) => {
      const current = epoch.current,
        data = await api('bookings' + (next ? '?cursor=' + encodeURIComponent(next) : ''));
      if (current !== epoch.current) return;
      setRows(
        (previous) =>
          Array.from(
            new Map(
              (next ? [...previous, ...data.bookings] : data.bookings).map((row: OwnerBooking) => [
                row.contractId,
                row,
              ]),
            ).values(),
          ) as OwnerBooking[],
      );
      setCursor(data.nextCursor);
      setDemo(data.demo);
      setAuthenticated(true);
    },
    [api],
  );
  useEffect(() => {
    const today = seoulDate();
    setMonth(today.slice(0, 7));
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api, load]);
  useEffect(() => {
    if (!authenticated) return;
    activity.current = Date.now();
    const active = () => {
      activity.current = Date.now();
    };
    const timer = setInterval(() => {
      if (Date.now() - activity.current > 1800000) {
        clear();
        setMessage('이용 시간이 만료되었습니다. 다시 로그인해 주세요.');
      } else api('auth').catch(() => clear());
    }, 60000);
    window.addEventListener('pointerdown', active);
    window.addEventListener('keydown', active);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pointerdown', active);
      window.removeEventListener('keydown', active);
    };
  }, [authenticated, api, clear]);
  async function perform(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await task();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '연결을 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  }
  const filtered = rows
    .filter((row) =>
      pendingOnly
        ? row.status === 'submitted'
        : row.weddingDate.startsWith(month) && (!selected || row.weddingDate === selected),
    )
    .sort((a, b) =>
      (a.weddingDate + a.weddingTime + a.contractId).localeCompare(
        b.weddingDate + b.weddingTime + b.contractId,
      ),
    );
  const days = month ? monthDays(month) : { offset: 0, days: 0 },
    waiting = rows.filter((row) => row.status === 'submitted').length;
  return (
    <main className="admin-workspace booking-workspace">
      {loading ? <ConsoleLoading /> : !authenticated ? (
        <section className="booking-login admin-login">
          <p className="booking-eyebrow">OWNER ACCESS</p>
          <h1>사장님 로그인</h1>
          <p className="booking-muted">6자리 비밀번호를 입력해 주세요.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void perform(async () => {
                epoch.current++;
                try {
                  await api('pin', 'POST', { password: pin });
                  await load();
                } finally {
                  setPin('');
                }
              });
            }}
          >
            <label htmlFor="owner-pin">비밀번호 6자리</label>
            <input
              id="owner-pin"
              disabled={busy || loading}
              className="owner-input booking-pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              autoComplete="current-password"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
              required
            />
            <button
              className="owner-button admin-primary"
              disabled={busy || loading || pin.length !== 6}
            >
              {busy ? '확인 중…' : '로그인'}
            </button>
          </form>
          <Link href="/">고객 계약 화면으로</Link>
        </section>
      ) : (
        <>
          <ConsoleNavigation current="bookings" />
          <header className="booking-header">
            <div>
              <p className="booking-eyebrow">RESERVATIONS</p>
              <h1>예약현황</h1>
              <p className="booking-muted">예식일과 확인할 계약을 한곳에서 확인하세요.</p>
            </div>
            <div className="booking-actions">
              <button
                className="owner-button"
                disabled={busy}
                onClick={() => void perform(() => load())}
              >
                새로고침
              </button>
              <Link className="owner-button" href="/studio-control?tab=calendar">Google Calendar 설정</Link>
              <button
                className="owner-button"
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    await api('auth', 'DELETE', {});
                    clear();
                  })
                }
              >
                로그아웃
              </button>
            </div>
          </header>
          {demo && (
            <p className="integration-demo">
              테스트용 Demo입니다. 실제 Google 등록이나 이메일 발송은 하지 않습니다.
            </p>
          )}
          <div className="booking-overview">
            <button className="booking-stat" onClick={() => { const today = seoulDate(); setMonth(today.slice(0,7)); setSelected(today); setPendingOnly(false); }}><span>오늘 촬영 · 확정 예약</span><strong>{rows.filter(row => row.weddingDate === seoulDate() && row.status !== 'submitted').length}<small>건{cursor ? ' 이상' : ''}</small></strong></button>
            <button
              className={'booking-stat' + (pendingOnly ? ' selected' : '')}
              onClick={() => {
                setPendingOnly(!pendingOnly);
                setSelected(null);
              }}
              aria-pressed={pendingOnly}
            >
              <span>대표 확인 대기</span>
              <strong>
                {waiting}
                <small>건{cursor ? ' 이상' : ''}</small>
              </strong>
            </button>
            <div className="booking-stat">
              <span>선택한 달의 예약</span>
              <strong>
                {rows.filter((row) => row.weddingDate.startsWith(month)).length}
                <small>건{cursor ? ' 이상' : ''}</small>
              </strong>
            </div>
            <div className="booking-stat"><span>계약 진행 · 선택한 달</span><strong>{rows.filter(row => row.weddingDate.startsWith(month) && row.status === 'approved').length}<small>건{cursor ? ' 이상' : ''}</small></strong></div>
          </div>
            <p className="booking-muted booking-calendar-guide">
              이 달력에는 접수·승인·완료된 예약이 모두 표시됩니다.
              <br />
              Google Calendar에는 연동을 켠 뒤 대표 승인한 계약만 등록됩니다.
            </p>
          {cursor && (
            <div className="booking-partial">
              <p>
                계약을 일부 조회했습니다. 이전 계약까지 보려면 추가로 불러와 주세요. 달력과 건수도
                함께 갱신됩니다.
              </p>
              <button
                className="owner-button"
                disabled={busy}
                onClick={() => void perform(() => load(cursor))}
              >
                예약 더 불러오기
              </button>
            </div>
          )}
          <div className="booking-columns">
            <section className="booking-calendar" aria-label="월간 예약 달력">
              <div className="booking-month">
                <button
                  aria-label="이전 달"
                  onClick={() => {
                    setMonth(moveMonth(month, -1));
                    setSelected(null);
                    setPendingOnly(false);
                  }}
                >
                  ‹
                </button>
                <h2>
                  {Number(month.slice(0, 4))}년 {Number(month.slice(5))}월
                </h2>
                <button
                  aria-label="다음 달"
                  onClick={() => {
                    setMonth(moveMonth(month, 1));
                    setSelected(null);
                    setPendingOnly(false);
                  }}
                >
                  ›
                </button>
              </div>
              <div className="booking-weekdays">
                {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="booking-days">
                {Array.from({ length: days.offset }, (_, index) => (
                  <span key={'empty' + index} />
                ))}
                {Array.from({ length: days.days }, (_, index) => {
                  const date = month + '-' + String(index + 1).padStart(2, '0'),
                    entries = rows.filter((row) => row.weddingDate === date);
                  return (
                    <button
                      key={date}
                      className={selected === date ? 'selected' : ''}
                      aria-label={date + ' 예약 ' + entries.length + '건'}
                      aria-pressed={selected === date}
                      aria-current={date === seoulDate() ? 'date' : undefined}
                      onClick={() => {
                        setSelected(date);
                        setPendingOnly(false);
                      }}
                    >
                      <span>{index + 1}</span>
                      {entries.length > 0 && (
                        <small
                          className={
                            entries.some((row) => row.status === 'submitted') ? 'pending' : ''
                          }
                        >
                          {entries.length}건
                        </small>
                      )}
                      <span className="calendar-entry-list">{entries.slice(0,2).map(entry => <span className="calendar-entry" key={entry.contractId}><b>{entry.weddingTime}</b><span>{entry.groomName} · {entry.brideName}</span><em>{statuses[entry.status]}</em></span>)}{entries.length > 2 && <span>+{entries.length - 2}건 더 보기</span>}</span>
                    </button>
                  );
                })}
              </div>
              <div className="booking-calendar-footer">
                <span>● 확인 대기 포함</span>
                <button
                  onClick={() => {
                    setSelected(null);
                    setPendingOnly(false);
                  }}
                >
                  이번 달 전체
                </button>
                <button
                  onClick={() => {
                    const today = seoulDate();
                    setMonth(today.slice(0, 7));
                    setSelected(today);
                    setPendingOnly(false);
                  }}
                >
                  오늘
                </button>
              </div>
            </section>
            <section className="booking-list" aria-label="예약 목록">
              <div className="booking-list-heading">
                <div>
                  <p className="booking-eyebrow">BOOKING LIST</p>
                  <h2>
                    {pendingOnly
                      ? '대표 확인 대기'
                      : selected
                        ? Number(selected.slice(5, 7)) +
                          '월 ' +
                          Number(selected.slice(8)) +
                          '일 예약'
                        : Number(month.slice(5)) + '월 예약'}
                  </h2>
                </div>
                <span>{filtered.length}건</span>
              </div>
              {filtered.length === 0 ? (
                <div className="booking-empty">
                  <h3>
                    {cursor ? '조회한 계약 중 해당 예약이 없습니다.' : '표시할 예약이 없습니다.'}
                  </h3>
                  <p>고객이 계약을 접수하면 이곳에서 확인할 수 있습니다.</p>
                </div>
              ) : (
                filtered.map((row) => (
                  <article className="booking-card" key={row.contractId}>
                    <div className="booking-card-top">
                      <strong>
                        {row.weddingDate.slice(5).replace('-', '월 ')}일 · {row.weddingTime}
                      </strong>
                      <span className={'booking-status ' + row.status}>{statuses[row.status]}</span>
                    </div>
                    <h3><button className="booking-detail-link" onClick={() => setDetail(row)} aria-label={row.groomName + ' · ' + row.brideName + ' 예약 상세'}>{row.groomName} · {row.brideName}<span aria-hidden="true"> ↗</span></button></h3>
                    <p>
                      {row.weddingVenue}
                      {row.weddingHall ? ' · ' + row.weddingHall : ''}
                    </p>
                    <p className="booking-muted">
                      {row.productName} · {row.contractTotal.toLocaleString('ko-KR')}원
                    </p>
                    <div className="booking-card-bottom">
                      <span className="booking-muted">
                        Google Calendar · {calendarStatuses[row.calendarStatus]}
                      </span>
                      <button className="owner-button" onClick={() => setDetail(row)}>예약 상세</button>
                      <Link
                        className={
                          'owner-button ' + (row.status === 'submitted' ? 'admin-primary' : '')
                        }
                        href={'/review?ownerContract=' + encodeURIComponent(row.contractId)}
                      >
                        {row.status === 'submitted' ? '내용 확인하기' : '계약 보기'}
                      </Link>
                    </div>
                  </article>
                ))
              )}
            </section>
          </div>
        </>
      )}
      {detail && authenticated && <BookingDetail key={detail.contractId} row={detail} onClose={() => setDetail(null)} onUnauthorized={clear} />}
      {message && (
        <p role="alert" className="booking-error">
          {message}
        </p>
      )}
    </main>
  );
}
