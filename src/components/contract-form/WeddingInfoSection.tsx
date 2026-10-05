import { FieldRequirement } from '@/components/contract-form/FieldRequirement';
import { getClientContent, getPromotionDayName, isPromotionDate, discountLabel, getDiscountById, getFormField, isFormFieldEnabled, isFormFieldRequired } from '@/services/configuration';
import React from 'react';
import { Calendar, Clock, MapPin } from 'lucide-react';
import { checkIsSunday } from '@/lib/pricing';
import { CalendarModal } from '@/components/common/CalendarModal';

interface WeddingInfoSectionProps {
  weddingDate: string;
  weddingTime: string;
  weddingVenue: string;
  weddingHall: string;
  makeupLocation?: string;
  onChange: (fields: Partial<{
    weddingDate: string;
    weddingTime: string;
    weddingVenue: string;
    weddingHall: string;
    makeupLocation: string;
  }>) => void;
  errors?: Record<string, string>;
}

export const WeddingInfoSection: React.FC<WeddingInfoSectionProps> = ({
  weddingDate,
  weddingTime,
  weddingVenue,
  weddingHall,
  makeupLocation = '',
  onChange,
  errors = {},
}) => {
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  const isSunday = isPromotionDate(weddingDate);

  // 날짜 한글 포맷 변환 (예: 2026년 10월 25일 (일요일))
  const formatKoreanDate = (dateStr: string) => {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return '';
    const [y, m, d] = dateStr.split('-');
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = dayNames[dateObj.getDay()];
    return `${y}년 ${parseInt(m, 10)}월 ${parseInt(d, 10)}일 (${dayName}요일)`;
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[rgb(var(--studio-surface))] pb-3">
        <h3 className="text-base sm:text-lg font-semibold text-[rgb(var(--studio-primary))] flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[rgb(var(--studio-muted))]" />
          <span>1. 예식 정보</span>
        </h3>
        <p className="text-xs sm:text-sm text-[rgb(var(--studio-muted))] mt-1 break-keep leading-relaxed">
          예식이 진행되는 소중한 날짜와 시간, 장소를 <span className="whitespace-nowrap">입력해 주세요.</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 sm:gap-5">
        {/* 예식일 (터치/클릭 시 전용 달력 팝업 오픈 - 좌우로 더 길게 sm:col-span-7) */}
        <div className="sm:col-span-7">
          <label className="block text-xs sm:text-sm font-semibold text-[rgb(var(--studio-primary))] mb-2">
            예식일 <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsCalendarOpen(true)}
              className={`w-full h-12 px-3.5 bg-[#FFFFFF] border ${
                errors.weddingDate
                  ? 'border-red-400 focus:ring-red-400'
                  : 'border-[rgb(var(--studio-line))] hover:border-[rgb(var(--studio-primary))] focus:border-[rgb(var(--studio-primary))]'
              } rounded-xl text-sm sm:text-base text-left flex items-center justify-between transition-all font-medium group cursor-pointer shadow-sm`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Calendar className="w-5 h-5 text-[rgb(var(--studio-muted))] group-hover:text-[rgb(var(--studio-primary))] transition-colors shrink-0" />
                {weddingDate ? (
                  <span className="text-[rgb(var(--studio-primary))] font-bold">
                    {formatKoreanDate(weddingDate)}
                  </span>
                ) : (
                  <span className="text-[rgb(var(--studio-muted))]/70">
                    날짜를 눌러 달력에서 선택해 주세요
                  </span>
                )}
              </div>
              <span className="text-xs px-2.5 py-1 bg-[rgb(var(--studio-background))] border border-[rgb(var(--studio-line))] rounded-lg text-[rgb(var(--studio-body))] group-hover:bg-[rgb(var(--studio-primary))] group-hover:text-[rgb(var(--studio-background))] transition-all font-semibold shrink-0">
                {weddingDate ? '변경' : '달력 선택'}
              </span>
            </button>
          </div>
          {errors.weddingDate && (
            <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.weddingDate}</p>
          )}

          {/* 달력 모달 컴포넌트 */}
          <CalendarModal
            isOpen={isCalendarOpen}
            onClose={() => setIsCalendarOpen(false)}
            selectedDate={weddingDate}
            onSelectDate={(date) => onChange({ weddingDate: date })}
          />
        </div>

        {/* 예식시간 (자유 텍스트 입력창 - 좌우로 좀 더 좁게 sm:col-span-5) */}
        <div className="sm:col-span-5">
          <label className="block text-xs sm:text-sm font-semibold text-[rgb(var(--studio-primary))] mb-2">
            예식 시간 <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="예: 13:00 (24시간 형식)"
              value={weddingTime}
              onChange={(e) => onChange({ weddingTime: e.target.value })}
              className={`w-full h-12 px-3.5 bg-[#FFFFFF] border ${
                errors.weddingTime ? 'border-red-400 focus:ring-red-400' : 'border-[rgb(var(--studio-line))] focus:border-[rgb(var(--studio-primary))]'
              } rounded-xl text-sm sm:text-base text-[rgb(var(--studio-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--studio-primary))]/10 transition-all placeholder:text-[rgb(var(--studio-muted))]/70 font-medium`}
            />
          </div>
          {errors.weddingTime && (
            <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.weddingTime}</p>
          )}
        </div>

        {/* 일요일 할인 자동 감지 배너 (예식일과 예식시간 밑으로 1줄 전체 길게 이어짐) */}
        {weddingDate && isSunday && (
          <div className="col-span-1 sm:col-span-12 p-3 sm:p-3.5 bg-[rgb(var(--studio-background))] border border-[rgb(var(--studio-accent))]/50 rounded-xl flex items-center gap-2.5 text-xs sm:text-sm text-[rgb(var(--studio-body))] animate-fade-in shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-[rgb(var(--studio-accent))] inline-block animate-pulse shrink-0" />
            <span className="break-keep leading-relaxed">
              <strong>{getPromotionDayName()} 예식</strong> 확인 — <span className="text-[rgb(var(--studio-primary))] font-bold whitespace-nowrap">{discountLabel('sunday')} {getDiscountById('sunday')?.type === 'cashback' ? '추후 캐시백' : '즉시 할인'}</span>이 자동 적용됩니다.
            </span>
          </div>
        )}

        {/* 웨딩홀 명 */}
        <div className="sm:col-span-6">
          <label className="block text-xs sm:text-sm font-semibold text-[rgb(var(--studio-primary))] mb-2">
            웨딩홀 명 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="예: 더채플앳청담, 엘타워, 빌라드지디"
            value={weddingVenue}
            onChange={(e) => onChange({ weddingVenue: e.target.value })}
            className={`w-full h-12 px-3.5 bg-[#FFFFFF] border ${
              errors.weddingVenue ? 'border-red-400' : 'border-[rgb(var(--studio-line))] focus:border-[rgb(var(--studio-primary))]'
            } rounded-xl text-sm sm:text-base text-[rgb(var(--studio-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--studio-primary))]/10 transition-all placeholder:text-[rgb(var(--studio-muted))]/70 font-medium`}
          />
          {errors.weddingVenue && (
            <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.weddingVenue}</p>
          )}
        </div>

        {/* 홀명 / 층수 */}
        {isFormFieldEnabled('weddingHall') && (<div className="sm:col-span-6">
          <label htmlFor="contract-field-weddingHall" className="block text-xs sm:text-sm font-semibold text-[rgb(var(--studio-primary))] mb-2">{getFormField('weddingHall').label} <FieldRequirement field="weddingHall" /></label>
          <input
            id="contract-field-weddingHall"
            required={isFormFieldRequired('weddingHall')}
            aria-required={isFormFieldRequired('weddingHall')}
            aria-invalid={!!errors.weddingHall}
            type="text"
            placeholder={getFormField('weddingHall').placeholder}
            value={weddingHall}
            onChange={(e) => onChange({ weddingHall: e.target.value })}
            className={`w-full h-12 px-3.5 bg-[#FFFFFF] border ${
              errors.weddingHall ? 'border-red-400' : 'border-[rgb(var(--studio-line))] focus:border-[rgb(var(--studio-primary))]'
            } rounded-xl text-sm sm:text-base text-[rgb(var(--studio-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--studio-primary))]/10 transition-all placeholder:text-[rgb(var(--studio-muted))]/70 font-medium`}
          />
          {errors.weddingHall && (
            <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.weddingHall}</p>
          )}
        </div>)}

        {/* 메이크업 준비정보의 표시·필수 여부는 업체 Form Schema를 따른다. */}
        {(isFormFieldEnabled('makeupLocation')) && (<details
          open={(isFormFieldRequired('makeupLocation') || !!(errors.makeupLocation)) || undefined}
          onToggle={(event) => {
            if ((isFormFieldRequired('makeupLocation') || !!(errors.makeupLocation)) && !event.currentTarget.open) {
              event.currentTarget.open = true;
            }
          }}
          className="sm:col-span-12 rounded-xl border border-[rgb(var(--studio-border))] p-4"
        >
          <summary className="cursor-pointer text-sm font-semibold text-[rgb(var(--studio-body))]">{(isFormFieldRequired('makeupLocation')) ? "메이크업 준비 정보 (필수 항목 포함)" : "메이크업 준비 정보 (선택 · 나중에 확인)"}</summary>
          {isFormFieldEnabled('makeupLocation') && (<div className="pt-3">
            <label htmlFor="makeup-location" className="block text-xs sm:text-sm font-semibold text-[rgb(var(--studio-primary))] mb-2">{getFormField('makeupLocation').label} <FieldRequirement field="makeupLocation" /></label>
            <input
              required={isFormFieldRequired('makeupLocation')}
              aria-required={isFormFieldRequired('makeupLocation')}
              aria-invalid={!!errors.makeupLocation}
              id="makeup-location"
              maxLength={300}
              type="text"
              placeholder={getFormField('makeupLocation').placeholder}
              value={makeupLocation}
              onChange={(e) => onChange({ makeupLocation: e.target.value })}
              className={`w-full h-12 px-3.5 bg-[#FFFFFF] border ${
                errors.makeupLocation ? 'border-red-400' : 'border-[rgb(var(--studio-line))] focus:border-[rgb(var(--studio-primary))]'
              } rounded-xl text-sm sm:text-base text-[rgb(var(--studio-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--studio-primary))]/10 transition-all placeholder:text-[rgb(var(--studio-muted))]/70 font-medium`}
            />
            <p className="text-xs sm:text-sm text-[rgb(var(--studio-muted))] mt-2 break-keep leading-relaxed">
              {isFormFieldRequired('makeupLocation') ? '계약 접수에 필요한 메이크업 준비 정보를 입력해 주세요.' : getClientContent().makeupNotice}
            </p>
            {errors.makeupLocation && (
              <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.makeupLocation}</p>
            )}
          </div>)}
        </details>)}
      </div>
    </div>
  );
};
