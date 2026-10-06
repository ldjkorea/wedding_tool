import { clearDisabledFormFields } from '@/lib/formFields';
import { getProductById, getOptionById, getDiscountById } from '@/services/configuration';
import React from 'react';
import { ContractFormData, PriceCalculationResult } from '@/types/contract';
import { formatKRW } from '@/lib/pricing';
import { CheckCircle, ArrowLeft, Send } from 'lucide-react';

interface FinalConfirmStepProps {
  formData: ContractFormData;
  pricing: PriceCalculationResult;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  isVerifyingCode?: boolean;
}

export const FinalConfirmStep: React.FC<FinalConfirmStepProps> = ({
  formData: inputData,
  pricing,
  onBack,
  onSubmit,
  isSubmitting,
  isVerifyingCode = false,
}) => {
  const formData = clearDisabledFormFields(inputData);
  const product = getProductById(formData.productId);
  const selectedOptionItems = formData.optionIds
    .map((id) => getOptionById(id))
    .filter(Boolean);

  const weddingDateFormatted = formData.weddingDate.replace(/-/g, '.');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 타이틀 안내 */}
      <div className="border-b border-[rgb(var(--studio-surface))] pb-3">
        <h3 className="text-base sm:text-lg font-semibold text-[rgb(var(--studio-primary))] flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-[rgb(var(--studio-muted))]" />
          <span>최종 확인 및 제출</span>
        </h3>
        <p className="text-xs sm:text-sm text-[rgb(var(--studio-muted))] mt-1 break-keep leading-relaxed">
          작성하신 계약정보를 마지막으로 꼼꼼히 <span className="whitespace-nowrap">확인해 주세요.</span>
        </p>
      </div>

      {/* 요약 박스 */}
      <div className="bg-[#FFFFFF] border border-[rgb(var(--studio-border))] rounded-2xl p-5 sm:p-7 shadow-sm space-y-6">

        {/* 1. 예식 정보 */}
        <div className="space-y-2 pb-4 border-b border-[rgb(var(--studio-surface))]">
          <h4 className="text-xs font-semibold tracking-wider text-[rgb(var(--studio-muted))] uppercase">
            예식 정보
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs sm:text-sm text-[rgb(var(--studio-primary))]">
            <div className="flex items-start">
              <span className="w-20 sm:w-28 shrink-0 text-[rgb(var(--studio-muted))] pt-0.5">예식일시</span>
              <span className="font-semibold text-[rgb(var(--studio-primary))] flex-1 break-keep">{weddingDateFormatted} {formData.weddingTime}</span>
            </div>
            <div className="flex items-start">
              <span className="w-20 sm:w-28 shrink-0 text-[rgb(var(--studio-muted))] pt-0.5">웨딩홀</span>
              <span className="font-semibold text-[rgb(var(--studio-primary))] flex-1 break-keep">{formData.weddingVenue} {formData.weddingHall ? '(' + formData.weddingHall + ')' : ''}</span>
            </div>
            {formData.makeupLocation && (
              <div className="sm:col-span-2 flex items-start">
                <span className="w-20 sm:w-28 shrink-0 text-[rgb(var(--studio-muted))] pt-0.5">메이크업 샵</span>
                <span className="flex-1 break-keep text-[rgb(var(--studio-primary))]">{formData.makeupLocation}</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. 고객 정보 */}
        <div className="space-y-2 pb-4 border-b border-[rgb(var(--studio-surface))]">
          <h4 className="text-xs font-semibold tracking-wider text-[rgb(var(--studio-muted))] uppercase">
            고객 정보
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs sm:text-sm text-[rgb(var(--studio-primary))]">
            <div className="flex flex-col">
              <div className="flex items-start">
                <span className="w-20 sm:w-28 shrink-0 text-[rgb(var(--studio-muted))] pt-0.5">신랑</span>
                <span className="flex-1 break-keep font-medium">{formData.groomName} <span className="text-[rgb(var(--studio-muted))] font-normal">{formData.groomPhone ? '(' + formData.groomPhone + ')' : ''}</span></span>
              </div>
              {formData.groomFamilyMembers && (
                <div className="flex items-start mt-1 text-xs text-[rgb(var(--studio-body))]">
                  <span className="w-20 sm:w-28 shrink-0 text-[rgb(var(--studio-subtle))]">직계 가족</span>
                  <span className="flex-1 break-keep">{formData.groomFamilyMembers}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col">
              <div className="flex items-start">
                <span className="w-20 sm:w-28 shrink-0 text-[rgb(var(--studio-muted))] pt-0.5">신부</span>
                <span className="flex-1 break-keep font-medium">{formData.brideName} <span className="text-[rgb(var(--studio-muted))] font-normal">{formData.bridePhone ? '(' + formData.bridePhone + ')' : ''}</span></span>
              </div>
              {formData.brideFamilyMembers && (
                <div className="flex items-start mt-1 text-xs text-[rgb(var(--studio-body))]">
                  <span className="w-20 sm:w-28 shrink-0 text-[rgb(var(--studio-subtle))]">직계 가족</span>
                  <span className="flex-1 break-keep">{formData.brideFamilyMembers}</span>
                </div>
              )}
            </div>

            <div className="sm:col-span-2 flex items-start pt-1">
              <span className="w-20 sm:w-28 shrink-0 text-[rgb(var(--studio-muted))] pt-0.5">수신 이메일</span>
              <span className="font-medium text-[rgb(var(--studio-primary))] flex-1 break-all">{formData.email}</span>
            </div>
          </div>
        </div>

        {/* 3. 상품 및 옵션 */}
        <div className="space-y-2 pb-4 border-b border-[rgb(var(--studio-surface))]">
          <h4 className="text-xs font-semibold tracking-wider text-[rgb(var(--studio-muted))] uppercase">
            선택 상품 및 추가 옵션
          </h4>
          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between items-center">
              <span className="font-medium text-[rgb(var(--studio-primary))] break-keep">{product?.name}</span>
              <span className="tabular-nums font-medium shrink-0 text-right">{formatKRW(pricing.basePrice)}</span>
            </div>
            {selectedOptionItems.length > 0 ? (
              selectedOptionItems.map((opt) => (
                <div key={opt!.id} className="flex justify-between items-center text-[rgb(var(--studio-body))]">
                  <span className="break-keep">+ {opt!.name}</span>
                  <span className="tabular-nums font-medium shrink-0 text-right">+{formatKRW(opt!.price)}</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-[rgb(var(--studio-muted))]">추가 옵션 없음</div>
            )}
          </div>
        </div>

        {/* 4. 할인 혜택 */}
        {(pricing.immediateDiscountTotal > 0 || pricing.futureCashbackTotal > 0) && (
          <div className="space-y-2 pb-4 border-b border-[rgb(var(--studio-surface))]">
            <h4 className="text-xs font-semibold tracking-wider text-[rgb(var(--studio-muted))] uppercase">
              할인 및 혜택 적용
            </h4>
            <div className="space-y-2 text-xs sm:text-sm">
{pricing.breakdown.filter(item => item.category === 'immediate_discount').map(item => (
                <div key={item.policyId} className="flex justify-between items-start sm:items-center gap-2 text-[rgb(var(--studio-accent))]">
                  <span className="break-keep">{item.name}{getDiscountById(item.policyId || '')?.eligibility.kind === 'partner' ? ' (' + formData.partnerName + ')' : ''}</span>
                  <span className="font-semibold tabular-nums shrink-0 text-right">-{formatKRW(Math.abs(item.amount))}</span>
                </div>
              ))}
              {pricing.futureCashbackTotal > 0 && (
                <div className="mt-2.5 p-3 bg-[rgb(var(--studio-background))] rounded-xl text-xs flex justify-between items-center text-[rgb(var(--studio-body))] gap-2">
                  <span className="break-keep">후기 작성 확인 후 추후 캐시백 (계약금액·잔금 미차감):</span>
                  <span className="font-bold text-[rgb(var(--studio-primary))] tabular-nums shrink-0 text-right whitespace-nowrap">최대 {formatKRW(pricing.futureCashbackTotal)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. 요청사항 및 참고정보 */}
        {(formData.shootRequestNotes || formData.retouchRequestNotes || formData.requestNotes || formData.referralSource || formData.instagramId || formData.blogUrl) && (
          <div className="space-y-3 pb-4 border-b border-[rgb(var(--studio-surface))] text-xs">
            <h4 className="text-xs font-semibold tracking-wider text-[rgb(var(--studio-muted))] uppercase">
              요청사항 및 참고정보
            </h4>
            {formData.shootRequestNotes && (
              <div>
                <span className="font-semibold text-[rgb(var(--studio-muted))] block mb-0.5">촬영 시 요청사항</span>
                <p className="text-[rgb(var(--studio-primary))] whitespace-pre-wrap leading-relaxed bg-[rgb(var(--studio-background))] p-2.5 rounded-lg border border-[rgb(var(--studio-soft-border))]">
                  {formData.shootRequestNotes}
                </p>
              </div>
            )}
            {formData.retouchRequestNotes && (
              <div>
                <span className="font-semibold text-[rgb(var(--studio-muted))] block mb-0.5">후보정 시 요청사항</span>
                <p className="text-[rgb(var(--studio-primary))] whitespace-pre-wrap leading-relaxed bg-[rgb(var(--studio-background))] p-2.5 rounded-lg border border-[rgb(var(--studio-soft-border))]">
                  {formData.retouchRequestNotes}
                </p>
              </div>
            )}
            {formData.requestNotes && (
              <div>
                <span className="font-semibold text-[rgb(var(--studio-muted))] block mb-0.5">기타 요청사항</span>
                <p className="text-[rgb(var(--studio-primary))] whitespace-pre-wrap leading-relaxed bg-[rgb(var(--studio-background))] p-2.5 rounded-lg border border-[rgb(var(--studio-soft-border))]">
                  {formData.requestNotes}
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[rgb(var(--studio-body))]">
              {formData.referralSource && (
                <div>
                  <span className="text-[rgb(var(--studio-muted))]">알게 된 경로: </span>
                  <span className="font-medium text-[rgb(var(--studio-primary))]">{formData.referralSource}</span>
                </div>
              )}
              {(formData.instagramId || formData.blogUrl) && (
                <div>
                  <span className="text-[rgb(var(--studio-muted))]">SNS: </span>
                  <span className="font-medium text-[rgb(var(--studio-primary))]">
                    {[formData.instagramId && `인스타 @${formData.instagramId.replace(/^@/, '')}`, formData.blogUrl && `블로그 ${formData.blogUrl}`].filter(Boolean).join(' / ')}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6. 최종 계약금액 강조 */}
        <div className="p-4 bg-[rgb(var(--studio-background))] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-xs text-[rgb(var(--studio-muted))]">최종 계약 예정금액</span>
            <span className="block text-[11px] text-[rgb(var(--studio-body))]">
              계약금: {formatKRW(pricing.depositAmount)} | 잔금: {formatKRW(pricing.balanceAmount)}
            </span>
          </div>
          <span className="text-2xl font-serif font-bold text-[rgb(var(--studio-primary))] tabular-nums whitespace-nowrap shrink-0">
            {formatKRW(pricing.contractTotal)}
          </span>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="h-12 px-5 border border-[rgb(var(--studio-border))] rounded-xl text-xs sm:text-sm font-medium text-[rgb(var(--studio-body))] hover:bg-[#FFFFFF] transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>수정하기</span>
        </button>

        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || isVerifyingCode}
          className="flex-1 h-12 bg-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))] rounded-xl text-xs sm:text-sm font-semibold hover:bg-[rgb(var(--studio-hover))] transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
        >
          {isVerifyingCode ? <span role="status">할인코드 확인 중…</span> : isSubmitting ? (
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-[rgb(var(--studio-background))] border-t-transparent rounded-full animate-spin" />
              <span>전달 중...</span>
            </div>
          ) : (
            <>
              <span>계약정보 제출하기</span>
              <Send className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
