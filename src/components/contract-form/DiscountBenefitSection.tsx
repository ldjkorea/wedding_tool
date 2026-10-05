import { discountLabel, getClientContent, renderConfigText, getDiscountLabel, getPromotionDayName, getDiscounts, getDiscountById } from '@/services/configuration';
import React from 'react';
import { Tag, Gift, Check, UserCheck } from 'lucide-react';

interface DiscountBenefitSectionProps {
  isSunday: boolean;
  partnerDiscount: boolean;
  partnerName: string;
  verification?: { status: string; message: string; amount: number };
  portfolioConsent: boolean;
  reviewContractCashback: boolean;
  reviewMainCashback: boolean;
  onChange: (fields: Partial<{
    partnerDiscount: boolean;
    partnerName: string;
    partnerDiscountAmount: number;
    portfolioConsent: boolean;
    reviewContractCashback: boolean;
    reviewMainCashback: boolean;
  }>) => void;
  errors?: Record<string, string>;
}

export const DiscountBenefitSection: React.FC<DiscountBenefitSectionProps> = ({
  isSunday,
  partnerDiscount,
  partnerName,
  verification,
  portfolioConsent,
  reviewContractCashback,
  reviewMainCashback,
  onChange,
  errors = {},
}) => {
  // 입력 시 혜택을 선택하고 내용이 없으면 해제. 서버가 유효한 코드를 검증합니다.
  const handlePartnerNameChange = (val: string) => {
    onChange({
      partnerName: val,
      partnerDiscount: false,
      partnerDiscountAmount: 0,
    });
  };


  const benefitCards = {
    weekday: (<div
          className={`p-4 sm:p-5 rounded-2xl border transition-all ${
            isSunday
              ? 'bg-[#FFFFFF] border-2 border-[rgb(var(--studio-primary))] shadow-sm'
              : 'bg-[rgb(var(--studio-background))] border-[rgb(var(--studio-border))] opacity-75'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <Tag className={`w-4 h-4 shrink-0 ${isSunday ? 'text-[rgb(var(--studio-accent))]' : 'text-[rgb(var(--studio-highlight))]'}`} />
              <span className="text-sm sm:text-base font-semibold text-[rgb(var(--studio-primary))] break-keep">
                {getDiscountLabel('sunday', 'form')}
              </span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full shrink-0 font-medium ${isSunday ? 'bg-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))]' : 'bg-[rgb(var(--studio-border))] text-[rgb(var(--studio-muted))]'}`}>
                {isSunday ? '자동 적용됨' : getPromotionDayName() + ' 예식 시 자동'}
              </span>
            </div>
            <span className="text-base sm:text-lg font-bold text-[rgb(var(--studio-accent))] tabular-nums shrink-0 text-right">
              {getDiscountById('sunday')?.type === 'immediate' ? '-' : ''}{discountLabel('sunday')}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[rgb(var(--studio-muted))] mt-2 leading-relaxed break-keep">
            {isSunday
              ? `선택하신 예식일이 ${getPromotionDayName()}이므로 ${discountLabel('sunday', true)} ${getDiscountById('sunday')?.type === 'cashback' ? '추후 캐시백이' : '즉시 할인이'} 자동 반영되었습니다.`
              : `예식일이 ${getPromotionDayName()}인 경우 ${discountLabel('sunday', true)} ${getDiscountById('sunday')?.type === 'cashback' ? '추후 캐시백이' : '즉시 할인이'} 자동 적용됩니다.`}
          </p>
        </div>),
    partner: (<div
          className={`p-4 sm:p-5 rounded-2xl border transition-all ${
            partnerDiscount
              ? 'bg-[#FFFFFF] border-2 border-[rgb(var(--studio-primary))] shadow-sm ring-2 ring-[rgb(var(--studio-primary))]/10'
              : 'bg-[#FFFFFF] border-[rgb(var(--studio-border))]'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                onClick={() => {
                  if (partnerDiscount) {
                    onChange({ partnerDiscount: false, partnerName: '', partnerDiscountAmount: 0 });
                  } else {
                    document.getElementById('contract-partner-code')?.focus();
                  }
                }}
                className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 cursor-pointer ${
                  partnerDiscount
                    ? 'bg-[rgb(var(--studio-primary))] border-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))]'
                    : 'border-[rgb(var(--studio-line))] bg-white'
                }`}
              >
                {partnerDiscount && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
              <span className="text-sm sm:text-base font-semibold text-[rgb(var(--studio-primary))] break-keep flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[rgb(var(--studio-muted))]" />
                <span>{getDiscountLabel('partner', 'form')}</span>
                {partnerDiscount ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))] font-semibold">
                    {verification?.amount.toLocaleString('ko-KR')}원 할인 적용됨
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[rgb(var(--studio-background))] border border-[rgb(var(--studio-line))] text-[rgb(var(--studio-muted))]">
                    유효한 코드 확인 후 적용
                  </span>
                )}
              </span>
            </div>
            <span className="text-base sm:text-lg font-bold text-[rgb(var(--studio-accent))] tabular-nums shrink-0 text-right">
              {partnerDiscount ? '-' + (verification?.amount || 0).toLocaleString('ko-KR') + '원' : '코드별 할인'}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-[rgb(var(--studio-muted))] mt-2 pl-7.5 leading-relaxed break-keep">
            업체에서 안내받은 <strong>할인코드</strong>를 입력해 주세요. 서버 확인에 성공한 코드의 할인액만 계약금액에서 차감됩니다.
          </p>

          {/* 짝꿍 코드/성함 입력 빈칸 (상시 노출) */}
          <div className="mt-3.5 pt-3.5 border-t border-[rgb(var(--studio-surface))] pl-7.5 space-y-1.5">
            <label className="block text-xs sm:text-sm font-semibold text-[rgb(var(--studio-primary))]">
              짝꿍 할인코드
            </label>
            <div className="relative">
              <input
                type="text"
                id="contract-partner-code"
                aria-label="짝꿍 할인코드"
                placeholder="업체에서 안내받은 할인코드를 입력해 주세요"
                value={partnerName}
                onChange={(e) => handlePartnerNameChange(e.target.value)}
                className="w-full h-12 px-3.5 bg-[rgb(var(--studio-background))] border border-[rgb(var(--studio-line))] focus:border-[rgb(var(--studio-primary))] rounded-xl text-sm sm:text-base text-[rgb(var(--studio-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--studio-primary))]/10 transition-all placeholder:text-[rgb(var(--studio-muted))]/70 font-medium"
              />
            </div>
            {errors.partnerName && (
              <p className="text-xs text-red-500 mt-1 font-medium">{errors.partnerName}</p>
            )}
            <p className="text-xs text-[rgb(var(--studio-muted))]">대소문자는 구분하지 않으며 앞뒤 공백은 무시합니다. 코드 내부 공백은 사용할 수 없습니다.</p>
            {verification?.message && <p role="status" className={verification.status === 'valid' ? 'text-sm text-green-700' : 'text-sm text-red-600'}>{verification.message}</p>}
          </div>
        </div>),
    portfolio: (<div
          onClick={() => onChange({ portfolioConsent: !portfolioConsent })}
          className={`cursor-pointer p-4 sm:p-5 rounded-2xl border transition-all select-none ${
            portfolioConsent
              ? 'bg-[#FFFFFF] border-2 border-[rgb(var(--studio-primary))] shadow-sm ring-2 ring-[rgb(var(--studio-primary))]/10'
              : 'bg-[#FFFFFF] border-[rgb(var(--studio-border))] hover:border-[rgb(var(--studio-muted))]'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div
                className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 mt-0.5 ${
                  portfolioConsent
                    ? 'bg-[rgb(var(--studio-primary))] border-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))]'
                    : 'border-[rgb(var(--studio-line))] bg-white'
                }`}
              >
                {portfolioConsent && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
              <span className="text-sm sm:text-base font-semibold text-[rgb(var(--studio-primary))] break-keep">
                {getDiscountLabel('portfolio', 'form')} <span className="text-xs sm:text-sm text-[rgb(var(--studio-muted))] font-normal">(SNS & 포트폴리오)</span>
              </span>
            </div>
            <span className="text-base sm:text-lg font-bold text-[rgb(var(--studio-accent))] tabular-nums shrink-0 text-right">
              {getDiscountById('portfolio')?.type === 'immediate' ? '-' : ''}{discountLabel('portfolio')}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[rgb(var(--studio-muted))] mt-2 pl-7.5 leading-relaxed break-keep">
            {renderConfigText(getClientContent().portfolioDescription)}
          </p>
        </div>),
    review_contract: (<div
          onClick={() => onChange({ reviewContractCashback: !reviewContractCashback })}
          className={`cursor-pointer p-4 sm:p-5 rounded-2xl border transition-all select-none ${
            reviewContractCashback
              ? 'bg-[#FFFFFF] border-2 border-[rgb(var(--studio-accent))] shadow-sm ring-2 ring-[rgb(var(--studio-accent))]/15'
              : 'bg-[#FFFFFF] border-[rgb(var(--studio-border))] hover:border-[rgb(var(--studio-muted))]'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                  reviewContractCashback
                    ? 'bg-[rgb(var(--studio-accent))] border-[rgb(var(--studio-accent))] text-[rgb(var(--studio-background))]'
                    : 'border-[rgb(var(--studio-line))] bg-white'
                }`}
              >
                {reviewContractCashback && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
              <span className="text-sm sm:text-base font-semibold text-[rgb(var(--studio-primary))] break-keep">
                {getDiscountLabel('review_contract', 'form')}
              </span>
            </div>
            <span className="text-sm sm:text-base font-bold text-[rgb(var(--studio-body))] tabular-nums shrink-0 text-right bg-[rgb(var(--studio-surface))] px-2.5 py-0.5 rounded-lg border border-[rgb(var(--studio-line))]">
              {discountLabel('review_contract')} 할인
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[rgb(var(--studio-muted))] mt-2 pl-7.5 leading-relaxed break-keep">
            웨딩 커뮤니티 또는 개인 블로그에 계약 후기 작성 시 {discountLabel('review_contract', true)} 페이백 <span className="whitespace-nowrap">{getClientContent().reviewContractChannelNotice}</span>
          </p>
        </div>),
    review_main: (<div
          onClick={() => onChange({ reviewMainCashback: !reviewMainCashback })}
          className={`cursor-pointer p-4 sm:p-5 rounded-2xl border transition-all select-none ${
            reviewMainCashback
              ? 'bg-[#FFFFFF] border-2 border-[rgb(var(--studio-accent))] shadow-sm ring-2 ring-[rgb(var(--studio-accent))]/15'
              : 'bg-[#FFFFFF] border-[rgb(var(--studio-border))] hover:border-[rgb(var(--studio-muted))]'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                  reviewMainCashback
                    ? 'bg-[rgb(var(--studio-accent))] border-[rgb(var(--studio-accent))] text-[rgb(var(--studio-background))]'
                    : 'border-[rgb(var(--studio-line))] bg-white'
                }`}
              >
                {reviewMainCashback && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
              <span className="text-sm sm:text-base font-semibold text-[rgb(var(--studio-primary))] break-keep">
                {getDiscountLabel('review_main', 'form')}
              </span>
            </div>
            <span className="text-sm sm:text-base font-bold text-[rgb(var(--studio-body))] tabular-nums shrink-0 text-right bg-[rgb(var(--studio-surface))] px-2.5 py-0.5 rounded-lg border border-[rgb(var(--studio-line))]">
              {discountLabel('review_main')} 할인
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[rgb(var(--studio-muted))] mt-2 pl-7.5 leading-relaxed break-keep">
            본식 촬영 종료 및 최종본 수령 후 커뮤니티/블로그에 후기 작성 시 <span className="whitespace-nowrap">{discountLabel('review_main', true)} 페이백</span>
          </p>
        </div>),
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[rgb(var(--studio-surface))] pb-3">
        <h3 className="text-base sm:text-lg font-semibold text-[rgb(var(--studio-primary))] flex items-center gap-2">
          <Tag className="w-5 h-5 text-[rgb(var(--studio-muted))]" />
          <span>5. 할인 및 혜택</span>
        </h3>
        <p className="text-xs sm:text-sm text-[rgb(var(--studio-muted))] mt-1 break-keep leading-relaxed">
          적용 가능한 즉시 할인 항목과 후기 혜택을 <span className="whitespace-nowrap">확인해 주세요.</span>
        </p>
      </div>

      {/* 1. 즉시 적용 할인 그룹 */}
      {getDiscounts().some(item => item.type === 'immediate') && (<div className="space-y-3.5">
        <h4 className="text-xs sm:text-sm font-bold tracking-wider text-[rgb(var(--studio-muted))] uppercase">
          즉시 적용 할인 (계약금액 자동 차감)
        </h4>

        {getDiscounts().filter(item => item.type === 'immediate').map(item => <React.Fragment key={item.id}>{benefitCards[item.eligibility.kind]}</React.Fragment>)}



      </div>)}

      {/* 2. 추후 페이백 그룹 */}
      {getDiscounts().some(item => item.type === 'cashback') && (<div className="space-y-3.5 pt-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs sm:text-sm font-bold tracking-wider text-[rgb(var(--studio-muted))] uppercase">
            추후 페이백 혜택
          </h4>
          <span className="text-xs sm:text-sm text-[rgb(var(--studio-accent))] font-bold flex items-center gap-1 shrink-0">
            <Gift className="w-4 h-4" />
            <span className="tabular-nums">최대 {(getDiscounts().filter(item => item.type === 'cashback').reduce((sum, item) => sum + item.amount, 0)).toLocaleString('ko-KR')}원 혜택</span>
          </span>
        </div>

        {/* 핵심 공지 문구 */}
        <div className="p-3.5 sm:p-4 bg-[rgb(var(--studio-background))] border border-[rgb(var(--studio-line))] rounded-xl text-xs sm:text-sm text-[rgb(var(--studio-body))] leading-relaxed break-keep space-y-1">
          <p className="font-semibold text-[rgb(var(--studio-primary))]">
            * 후기 혜택은 작성 확인 후 추후 캐시백으로 지급됩니다. 계약금액과 잔금에서 미리 차감하지 않습니다.
          </p>
          <div className="text-xs text-[rgb(var(--studio-muted))] space-y-0.5 pt-0.5 font-medium">
            <p>(후기 작성 후 URL 주소 {getClientContent().reviewProofChannel}으로 전달)</p>
            <p>(최소 {getClientContent().reviewRetentionMonths}개월 글 유지)</p>
          </div>
        </div>

        {getDiscounts().filter(item => item.type === 'cashback').map(item => <React.Fragment key={item.id}>{benefitCards[item.eligibility.kind]}</React.Fragment>)}


      </div>)}
    </div>
  );
};
