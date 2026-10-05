'use client';
import { discountLabel, getPromotionDayName, isPromotionDate, isDiscountActive, getDiscountById } from '@/services/configuration';


import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
}

export const CalendarModal: React.FC<CalendarModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  onSelectDate,
}) => {
  // 오늘 날짜 기준 기본 설정
  const today = new Date();
  const currentYear = today.getFullYear();

  // 뷰 상태 (연도 및 월)
  const [viewYear, setViewYear] = useState<number>(currentYear);
  const [viewMonth, setViewMonth] = useState<number>(today.getMonth()); // 0 ~ 11

  // 모달이 열리거나 selectedDate가 바뀔 때 뷰 초기화
  useEffect(() => {
    if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      const [y, m] = selectedDate.split('-').map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    }
  }, [isOpen, selectedDate]);

  if (!isOpen) return null;

  // 이전 달 이동
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((prev) => prev - 1);
      setViewMonth(11);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  // 다음 달 이동
  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((prev) => prev + 1);
      setViewMonth(0);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  // 해당 월 1일의 요일 (0: 일요일 ~ 6: 토요일)
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  // 해당 월의 총 일수
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // 요일 라벨
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  // 연도 선택 목록 (올해 - 1년부터 3년 뒤까지)
  const availableYears = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[rgb(var(--studio-background))] border border-[rgb(var(--studio-line))] rounded-3xl p-5 sm:p-6 w-full max-w-sm shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 상단 헤더 */}
        <div className="flex items-center justify-between border-b border-[rgb(var(--studio-border))] pb-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[rgb(var(--studio-primary))]">예식일 선택</h3>
            <p className="text-xs text-[rgb(var(--studio-muted))] mt-0.5">원하시는 예식 날짜를 터치해 주세요.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[rgb(var(--studio-border))] text-[rgb(var(--studio-muted))] hover:text-[rgb(var(--studio-primary))] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 연 / 월 내비게이션 & 빠른 선택 */}
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-2 rounded-xl hover:bg-[rgb(var(--studio-border))] text-[rgb(var(--studio-primary))] transition-colors"
            aria-label="이전 달"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-1.5 font-bold text-base sm:text-lg text-[rgb(var(--studio-primary))]">
            {/* 연도 드롭다운 */}
            <select
              value={viewYear}
              onChange={(e) => setViewYear(Number(e.target.value))}
              className="bg-transparent text-[rgb(var(--studio-primary))] font-bold focus:outline-none cursor-pointer py-1 px-1 rounded hover:bg-[rgb(var(--studio-border))]/50 transition-colors"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>

            {/* 월 드롭다운 */}
            <select
              value={viewMonth}
              onChange={(e) => setViewMonth(Number(e.target.value))}
              className="bg-transparent text-[rgb(var(--studio-primary))] font-bold focus:outline-none cursor-pointer py-1 px-1 rounded hover:bg-[rgb(var(--studio-border))]/50 transition-colors"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>
                  {i + 1}월
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-2 rounded-xl hover:bg-[rgb(var(--studio-border))] text-[rgb(var(--studio-primary))] transition-colors"
            aria-label="다음 달"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 text-center text-xs font-semibold py-1.5 border-b border-[rgb(var(--studio-border))]">
          {weekDays.map((d, idx) => (
            <div
              key={d}
              className={
                idx === 0
                  ? 'text-red-500' // 일요일 빨강
                  : idx === 6
                  ? 'text-blue-500' // 토요일 파랑
                  : 'text-[rgb(var(--studio-body))]'
              }
            >
              {d}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {/* 이전 달 공백 칸 */}
          {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-10 sm:h-11" />
          ))}

          {/* 이번 달 일자들 */}
          {Array.from({ length: daysInMonth }, (_, idx) => {
            const dayNum = idx + 1;
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(
              dayNum
            ).padStart(2, '0')}`;
            const dayOfWeek = (firstDayOfWeek + idx) % 7;
            const isSunday = dayOfWeek === 0;
            const isSaturday = dayOfWeek === 6;
            const isSelected = selectedDate === dateStr;

            return (
              <button
                key={dayNum}
                type="button"
                onClick={() => {
                  onSelectDate(dateStr);
                  onClose();
                }}
                className={`h-10 sm:h-11 rounded-xl flex flex-col items-center justify-center relative transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'bg-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))] font-bold shadow-md scale-105'
                    : isSunday
                    ? 'hover:bg-red-50 text-red-600 font-semibold'
                    : isSaturday
                    ? 'hover:bg-blue-50 text-blue-600 font-semibold'
                    : 'hover:bg-[rgb(var(--studio-border))]/60 text-[rgb(var(--studio-primary))]'
                }`}
              >
                <span className="text-xs sm:text-sm leading-none">{dayNum}</span>

                {/* 일요일 할인 뱃지 표시 */}
                {isPromotionDate(dateStr) && (
                  <span
                    className={`text-[9px] scale-90 tracking-tighter mt-0.5 leading-none px-1 rounded ${
                      isSelected
                        ? 'bg-[rgb(var(--studio-background))]/20 text-[rgb(var(--studio-background))]'
                        : 'bg-red-100 text-red-600 font-bold'
                    }`}
                  >
                    할인
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 안내 푸터 및 닫기 버튼 */}
        <div className="pt-2 border-t border-[rgb(var(--studio-border))] space-y-2.5">
          {isDiscountActive('sunday') && (<div className="flex items-center gap-2 p-2 bg-[rgb(var(--studio-background))] rounded-xl text-xs text-[rgb(var(--studio-body))] border border-[rgb(var(--studio-line))]">
            <span className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--studio-accent))] shrink-0 inline-block" />
            <span>
              <strong>{getPromotionDayName()} 예식</strong> 선택 시 {discountLabel('sunday')} {getDiscountById('sunday')?.type === 'cashback' ? '추후 캐시백이' : '즉시 할인이'} 자동 적용됩니다.
            </span>
          </div>)}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-[#FFFFFF] border border-[rgb(var(--studio-line))] rounded-xl text-xs sm:text-sm font-semibold text-[rgb(var(--studio-body))] hover:bg-[rgb(var(--studio-border))] transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
