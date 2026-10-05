import type { ConfigurableFormFieldId } from '@/types/config';
import { FieldRequirement } from '@/components/contract-form/FieldRequirement';
import { getClientContent, getFormField, isFormFieldEnabled, isFormFieldRequired } from '@/services/configuration';
import React, { useState } from 'react';
import { MessageSquare, ExternalLink, Check, Compass, Share2 } from 'lucide-react';

interface RequestNotesSectionProps {
  shootRequestNotes?: string;
  retouchRequestNotes?: string;
  requestNotes: string;
  referralSource?: string;
  instagramId?: string;
  blogUrl?: string;
  termsAgreed: boolean;
  onOpenTermsModal: () => void;
  onChange: (fields: Partial<{
    shootRequestNotes: string;
    retouchRequestNotes: string;
    requestNotes: string;
    referralSource: string;
    instagramId: string;
    blogUrl: string;
    termsAgreed: boolean;
  }>) => void;
  errors?: Record<string, string>;
}

const NOTES_AND_REFERENCE_FIELDS: ConfigurableFormFieldId[] = [
  'shootRequestNotes', 'retouchRequestNotes', 'requestNotes', 'referralSource', 'instagramId', 'blogUrl',
];

export const RequestNotesSection: React.FC<RequestNotesSectionProps> = ({
  shootRequestNotes = '',
  retouchRequestNotes = '',
  requestNotes = '',
  referralSource = '',
  instagramId = '',
  blogUrl = '',
  termsAgreed,
  onOpenTermsModal,
  onChange,
  errors = {},
}) => {
  const REFERRAL_BASE_OPTIONS = getClientContent().referralOptions;
  // 기타 경로 직접 입력 여부 및 텍스트 상태
  const isCustomReferral =
    referralSource === '기타 경로' ||
    (referralSource.startsWith('기타: ') && !REFERRAL_BASE_OPTIONS.slice(0, 4).includes(referralSource));

  const [customText, setCustomText] = useState(
    referralSource.startsWith('기타: ') ? referralSource.replace('기타: ', '') : ''
  );

  const handleSelectOption = (opt: string) => {
    if (referralSource === opt || (opt === '기타 경로' && isCustomReferral)) {
      onChange({ referralSource: '' });
      return;
    }
    if (opt === '기타 경로') {
      onChange({ referralSource: customText.trim() ? `기타: ${customText.trim()}` : '기타 경로' });
    } else {
      onChange({ referralSource: opt });
    }
  };

  const handleCustomChange = (val: string) => {
    setCustomText(val);
    onChange({ referralSource: val.trim() ? `기타: ${val.trim()}` : '기타 경로' });
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[rgb(var(--studio-surface))] pb-3">
        <h3 className="text-base sm:text-lg font-semibold text-[rgb(var(--studio-primary))] flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-[rgb(var(--studio-muted))]" />
          <span>{NOTES_AND_REFERENCE_FIELDS.some(isFormFieldRequired) ? '6. 요청사항 및 참고정보' : '6. 요청사항 및 선택정보'}</span>
        </h3>
        <p className="text-xs sm:text-sm text-[rgb(var(--studio-muted))] mt-1 break-keep leading-relaxed">
          {NOTES_AND_REFERENCE_FIELDS.some(isFormFieldRequired) ? '필수 표시된 정보를 입력해 주세요. 나머지 요청과 참고정보는 선택 사항입니다.' : '계약에 반영할 요청이나 특약이 있다면 적어주세요. 촬영 준비와 참고정보는 선택 사항이며 비워 두어도 됩니다.'}
        </p>
      </div>

      {/* 3. 기타 요청사항 */}
      {isFormFieldEnabled('requestNotes') && (<div>
        <label htmlFor="contract-request-notes" className="block text-xs sm:text-sm font-semibold text-[rgb(var(--studio-primary))] mb-2">{getFormField('requestNotes').label} <FieldRequirement field="requestNotes" /></label>
        <textarea
          required={isFormFieldRequired('requestNotes')}
          aria-required={isFormFieldRequired('requestNotes')}
          aria-invalid={!!errors.requestNotes}
          id="contract-request-notes"
          maxLength={2000}
          rows={2}
          placeholder={getFormField('requestNotes').placeholder}
          value={requestNotes}
          onChange={(e) => onChange({ requestNotes: e.target.value })}
          className="w-full p-4 bg-[#FFFFFF] border border-[rgb(var(--studio-line))] rounded-xl text-sm sm:text-base text-[rgb(var(--studio-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--studio-primary))]/10 focus:border-[rgb(var(--studio-primary))] transition-all placeholder:text-[rgb(var(--studio-muted))]/70 leading-relaxed font-medium resize-none"
        />
        {errors.requestNotes && (
          <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.requestNotes}</p>
        )}
      </div>)}
      {(isFormFieldEnabled('shootRequestNotes') || isFormFieldEnabled('retouchRequestNotes')) && (<details
        open={(isFormFieldRequired('shootRequestNotes') || isFormFieldRequired('retouchRequestNotes') || !!(errors.shootRequestNotes || errors.retouchRequestNotes)) || undefined}
        onToggle={(event) => {
          if ((isFormFieldRequired('shootRequestNotes') || isFormFieldRequired('retouchRequestNotes') || !!(errors.shootRequestNotes || errors.retouchRequestNotes)) && !event.currentTarget.open) {
            event.currentTarget.open = true;
          }
        }}
        className="rounded-2xl border border-[rgb(var(--studio-border))] p-4"
      >
        <summary className="cursor-pointer text-sm font-semibold text-[rgb(var(--studio-body))]">{(isFormFieldRequired('shootRequestNotes') || isFormFieldRequired('retouchRequestNotes')) ? "촬영·후보정 준비 정보 (필수 항목 포함)" : "촬영·후보정 준비 정보 (선택 · 나중에 확인)"}</summary>
        <div className="pt-4 space-y-5">
          <p className="text-xs text-[rgb(var(--studio-muted))]">{isFormFieldRequired('shootRequestNotes') || isFormFieldRequired('retouchRequestNotes') ? '필수 표시된 요청사항을 작성해 주세요. 대표가 검토하고 최종 계약서에 함께 반영합니다.' : '지금 확정할 필요는 없습니다. 작성한 요청은 대표가 검토하고 최종 계약서에 함께 반영합니다.'}</p>
          {/* 1. 촬영 시 요청사항 */}
          {isFormFieldEnabled('shootRequestNotes') && (<div>
            <label htmlFor="shoot-request-notes" className="block text-xs sm:text-sm font-semibold text-[rgb(var(--studio-primary))] mb-2">{getFormField('shootRequestNotes').label} <FieldRequirement field="shootRequestNotes" /></label>
            <textarea
              required={isFormFieldRequired('shootRequestNotes')}
              aria-required={isFormFieldRequired('shootRequestNotes')}
              aria-invalid={!!errors.shootRequestNotes}
              maxLength={2000}
              rows={3}
              placeholder={getFormField('shootRequestNotes').placeholder}
              id="shoot-request-notes"
              value={shootRequestNotes}
              onChange={(e) => onChange({ shootRequestNotes: e.target.value })}
              className={`w-full p-4 bg-[#FFFFFF] border ${
                errors.shootRequestNotes ? 'border-red-400 focus:ring-red-400' : 'border-[rgb(var(--studio-line))] focus:border-[rgb(var(--studio-primary))]'
              } rounded-xl text-sm sm:text-base text-[rgb(var(--studio-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--studio-primary))]/10 transition-all placeholder:text-[rgb(var(--studio-muted))]/70 leading-relaxed font-medium resize-none`}
            />
            {errors.shootRequestNotes && (
              <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.shootRequestNotes}</p>
            )}
          </div>)}
          {/* 2. 후보정 시 요청사항 */}
          {isFormFieldEnabled('retouchRequestNotes') && (<div>
            <label htmlFor="retouch-request-notes" className="block text-xs sm:text-sm font-semibold text-[rgb(var(--studio-primary))] mb-2">{getFormField('retouchRequestNotes').label} <FieldRequirement field="retouchRequestNotes" /></label>
            <textarea
              required={isFormFieldRequired('retouchRequestNotes')}
              aria-required={isFormFieldRequired('retouchRequestNotes')}
              aria-invalid={!!errors.retouchRequestNotes}
              maxLength={2000}
              rows={3}
              placeholder={getFormField('retouchRequestNotes').placeholder}
              id="retouch-request-notes"
              value={retouchRequestNotes}
              onChange={(e) => onChange({ retouchRequestNotes: e.target.value })}
              className={`w-full p-4 bg-[#FFFFFF] border ${
                errors.retouchRequestNotes ? 'border-red-400 focus:ring-red-400' : 'border-[rgb(var(--studio-line))] focus:border-[rgb(var(--studio-primary))]'
              } rounded-xl text-sm sm:text-base text-[rgb(var(--studio-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--studio-primary))]/10 transition-all placeholder:text-[rgb(var(--studio-muted))]/70 leading-relaxed font-medium resize-none`}
            />
            {errors.retouchRequestNotes && (
              <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.retouchRequestNotes}</p>
            )}
          </div>)}
        </div>
      </details>)}

      {(isFormFieldEnabled('referralSource') || isFormFieldEnabled('instagramId') || isFormFieldEnabled('blogUrl')) && (<details
        open={(isFormFieldRequired('referralSource') || isFormFieldRequired('instagramId') || isFormFieldRequired('blogUrl') || !!(errors.referralSource || errors.instagramId || errors.blogUrl)) || undefined}
        onToggle={(event) => {
          if ((isFormFieldRequired('referralSource') || isFormFieldRequired('instagramId') || isFormFieldRequired('blogUrl') || !!(errors.referralSource || errors.instagramId || errors.blogUrl)) && !event.currentTarget.open) {
            event.currentTarget.open = true;
          }
        }}
        className="rounded-2xl border border-[rgb(var(--studio-border))] p-4"
      >
        <summary className="cursor-pointer text-sm font-semibold text-[rgb(var(--studio-body))]">{(isFormFieldRequired('referralSource') || isFormFieldRequired('instagramId') || isFormFieldRequired('blogUrl')) ? "유입경로·후기 확인 정보 (필수 항목 포함)" : "유입경로·후기 확인 정보 (선택)"}</summary>
        <div className="pt-4 space-y-5">
          <p className="text-xs text-[rgb(var(--studio-muted))]">{isFormFieldRequired('referralSource') || isFormFieldRequired('instagramId') || isFormFieldRequired('blogUrl') ? '필수 표시된 참고정보를 입력해 주세요. 유입경로는 계약 금액에 영향을 주지 않습니다.' : '유입경로는 운영 참고용이며 계약 금액에 영향을 주지 않습니다. 후기 확인용 주소는 추후 전달하셔도 됩니다.'}</p>
          {/* 4. 알게 된 경로 (기타 선택 시 입력칸 활성화) */}
          {isFormFieldEnabled('referralSource') && (<div className="p-4 sm:p-5 bg-[rgb(var(--studio-background))] border border-[rgb(var(--studio-border))] rounded-2xl space-y-3.5 text-xs sm:text-sm">
            <div className="flex items-center gap-1.5 font-semibold text-[rgb(var(--studio-primary))]">
              <Compass className="w-4 h-4 text-[rgb(var(--studio-muted))]" />
              <span>{getFormField('referralSource').label} <FieldRequirement field="referralSource" /></span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {REFERRAL_BASE_OPTIONS.map((opt) => {
                const isSelected = opt === '기타 경로' ? isCustomReferral : referralSource === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleSelectOption(opt)}
                    className={`py-2 px-2.5 rounded-xl border text-center transition-all text-xs sm:text-sm min-h-[48px] flex flex-col items-center justify-center ${
                      isSelected
                        ? 'bg-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))] border-[rgb(var(--studio-primary))] font-bold shadow-sm'
                        : 'bg-white text-[rgb(var(--studio-body))] border-[rgb(var(--studio-line))] hover:border-[rgb(var(--studio-muted))] font-medium'
                    }`}
                  >
                    {opt === '블로그 후기' ? (
                      <div className="leading-snug">
                        <div>블로그</div>
                        <div>후기</div>
                      </div>
                    ) : opt === '카페 후기' ? (
                      <div className="leading-snug">
                        <div>카페</div>
                        <div>후기</div>
                      </div>
                    ) : (
                      <div className="whitespace-nowrap leading-snug">{opt}</div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 기타 경로 선택 시 빈칸 입력 활성화 */}
            {isCustomReferral && (
              <div className="pt-2 animate-fade-in space-y-1.5">
                <label className="block text-xs font-semibold text-[rgb(var(--studio-body))]">
                  어떤 경로로 알게 되셨나요? <span className="text-[rgb(var(--studio-muted))] font-normal text-xs">(선택)</span>
                </label>
                <input
                  type="text"
                  placeholder={getFormField('referralSource').placeholder}
                  value={customText}
                  onChange={(e) => handleCustomChange(e.target.value)}
                  className="w-full h-11 px-3.5 bg-white border border-[rgb(var(--studio-line))] focus:border-[rgb(var(--studio-primary))] rounded-xl text-sm text-[rgb(var(--studio-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--studio-primary))]/10 transition-all placeholder:text-[rgb(var(--studio-muted))]/70 font-medium"
                />
              </div>
            )}

            {errors.referralSource && (
              <p className="text-xs text-red-500 mt-1 font-medium">{errors.referralSource}</p>
            )}
          </div>)}
          {/* 5. SNS 계정 (후기 페이백 등 확인용) */}
          {(isFormFieldEnabled('instagramId') || isFormFieldEnabled('blogUrl')) && (<div className="p-4 sm:p-5 bg-[rgb(var(--studio-background))] border border-[rgb(var(--studio-border))] rounded-2xl space-y-3.5 text-xs sm:text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-[rgb(var(--studio-primary))]">
                <Share2 className="w-4 h-4 text-[rgb(var(--studio-muted))]" />
                <span>SNS 계정 <span className="text-[rgb(var(--studio-muted))] font-normal text-xs">{isFormFieldRequired('instagramId') || isFormFieldRequired('blogUrl') ? '(필수 항목 포함)' : '(선택 · 추후 후기 확인용)'}</span></span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {isFormFieldEnabled('instagramId') && (<div>
                <label htmlFor="contract-field-instagramId" className="block text-xs font-semibold text-[rgb(var(--studio-body))] mb-1.5">{getFormField('instagramId').label} <FieldRequirement field="instagramId" showOptional={false} /></label>
                <input
                  id="contract-field-instagramId"
                  required={isFormFieldRequired('instagramId')}
                  aria-required={isFormFieldRequired('instagramId')}
                  aria-invalid={!!errors.instagramId}
                  type="text"
                  placeholder={getFormField('instagramId').placeholder}
                  value={instagramId}
                  onChange={(e) => onChange({ instagramId: e.target.value })}
                  className="w-full h-11 px-3.5 bg-white border border-[rgb(var(--studio-line))] rounded-xl text-sm text-[rgb(var(--studio-primary))] focus:outline-none focus:border-[rgb(var(--studio-primary))] placeholder:text-[rgb(var(--studio-muted))]/70 font-medium"
                />
                {errors.instagramId && (
                  <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.instagramId}</p>
                )}
              </div>)}
              {isFormFieldEnabled('blogUrl') && (<div>
                <label htmlFor="contract-field-blogUrl" className="block text-xs font-semibold text-[rgb(var(--studio-body))] mb-1.5">{getFormField('blogUrl').label} <FieldRequirement field="blogUrl" showOptional={false} /></label>
                <input
                  id="contract-field-blogUrl"
                  required={isFormFieldRequired('blogUrl')}
                  aria-required={isFormFieldRequired('blogUrl')}
                  aria-invalid={!!errors.blogUrl}
                  type="text"
                  placeholder={getFormField('blogUrl').placeholder}
                  value={blogUrl}
                  onChange={(e) => onChange({ blogUrl: e.target.value })}
                  className="w-full h-11 px-3.5 bg-white border border-[rgb(var(--studio-line))] rounded-xl text-sm text-[rgb(var(--studio-primary))] focus:outline-none focus:border-[rgb(var(--studio-primary))] placeholder:text-[rgb(var(--studio-muted))]/70 font-medium"
                />
                {errors.blogUrl && (
                  <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.blogUrl}</p>
                )}
              </div>)}
            </div>
          </div>)}
        </div>
      </details>)}

      {/* 약관 동의 확인 뱃지 카드 */}
      <div className="p-4 bg-[rgb(var(--studio-background))] border border-[rgb(var(--studio-border))] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <div className="w-5 h-5 rounded-full bg-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))] flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
          <div className="min-w-0 break-keep leading-relaxed">
            <span className="font-semibold text-[rgb(var(--studio-primary))] block">
              계약 약관 및 개인정보 수집·이용 동의 완료
            </span>
            <span className="text-xs text-[rgb(var(--studio-muted))] block mt-0.5">
              작성 시작 전 <span className="whitespace-nowrap font-medium text-[rgb(var(--studio-body))]">필수 약관(제1조~제13조)</span>에 사전 동의하셨습니다.
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenTermsModal}
          className="self-end sm:self-auto text-[rgb(var(--studio-muted))] hover:text-[rgb(var(--studio-primary))] font-semibold flex items-center gap-1 underline underline-offset-4 transition-colors shrink-0 text-xs py-0.5"
        >
          <span>약관 다시보기</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
