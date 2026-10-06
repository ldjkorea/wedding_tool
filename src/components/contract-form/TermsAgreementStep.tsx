import { getContractPolicy, getStudioConfig, formatPolicyMoney, formatPolicyDays } from '@/services/configuration';
import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Check, AlertCircle, ChevronDown, ChevronUp, FileText } from 'lucide-react';


interface TermsAgreementStepProps {
  termsAgreed: boolean;
  onAgreeChange: (agreed: boolean) => void;
  onProceed: () => void;
  onBackToHome?: () => void;
}

export const TermsAgreementStep: React.FC<TermsAgreementStepProps> = ({
  termsAgreed,
  onAgreeChange,
  onProceed,
}) => {
  const CONTRACT_POLICY_CONFIG = getContractPolicy();
  const [showAllArticles, setShowAllArticles] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [showScrollWarning, setShowScrollWarning] = useState(false);
  const [showValidationError, setShowValidationError] = useState(false);

  const bottomAnchorRef = useRef<HTMLDivElement>(null);
  const termsBoxRef = useRef<HTMLDivElement>(null);

  // 1. IntersectionObserver를 통한 모바일 스크롤 끝 도달 100% 자동 감지
  useEffect(() => {
    if (!showAllArticles || hasScrolledToBottom) return;

    const anchorEl = bottomAnchorRef.current;
    const boxEl = termsBoxRef.current;
    if (!anchorEl || !boxEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setHasScrolledToBottom(true);
          setShowScrollWarning(false);
        }
      },
      {
        root: boxEl,
        rootMargin: '0px 0px 80px 0px', // 80px 여유 마진 (모바일 서브픽셀 및 오차 완전 방어)
        threshold: 0.1,
      }
    );

    observer.observe(anchorEl);
    return () => observer.disconnect();
  }, [showAllArticles, hasScrolledToBottom]);

  // 2. 약관 전문 스크롤 감지 핸들러 (이중 안전장치: 여유 마진 80px)
  const handleTermsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 80) {
      setHasScrolledToBottom(true);
      setShowScrollWarning(false);
    }
  };

  // 3. 약관 확인 완료 수동 처리 핸들러 (삼중 안전장치: 버튼 터치 시 즉시 해제)
  const handleMarkAsRead = () => {
    setHasScrolledToBottom(true);
    setShowScrollWarning(false);
  };

  // 체크박스 클릭 핸들러
  const handleCheckboxClick = () => {
    if (!hasScrolledToBottom) {
      setShowScrollWarning(true);
      if (!showAllArticles) {
        setShowAllArticles(true);
      }
      setTimeout(() => {
        termsBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
      return;
    }
    onAgreeChange(!termsAgreed);
    if (!termsAgreed) {
      setShowValidationError(false);
      setShowScrollWarning(false);
    }
  };

  const handleNext = () => {
    if (!hasScrolledToBottom) {
      setShowScrollWarning(true);
      if (!showAllArticles) {
        setShowAllArticles(true);
      }
      return;
    }
    if (!termsAgreed) {
      setShowValidationError(true);
      return;
    }
    setShowValidationError(false);
    onProceed();
  };

  return (
    <div className="max-w-3xl mx-auto py-6 sm:py-10 space-y-8 animate-fade-in">
      {/* 헤더 */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[rgb(var(--studio-primary))] break-keep">
          계약 약관 및 운영 정책 동의
        </h2>
        <div className="text-xs sm:text-sm text-[rgb(var(--studio-body))] max-w-md mx-auto leading-relaxed pt-1 break-keep space-y-1">
          <p>
            {getStudioConfig().studioName}는 상호 신뢰를 바탕으로<br className="sm:hidden" /> 투명하고 정직한 촬영 계약을 체결합니다.
          </p>
          <p className="text-[rgb(var(--studio-muted))]">
            계약정보 작성에 앞서<br className="sm:hidden" /> 표준 약관 전문을 먼저 확인해 주세요.
          </p>
        </div>
      </div>

      {/* 1. 핵심 규정 요약 카드 */}
      <div className="bg-white border border-[rgb(var(--studio-border))] rounded-3xl p-6 sm:p-8 space-y-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-[rgb(var(--studio-surface))] pb-3">
          <h3 className="font-semibold text-base sm:text-lg text-[rgb(var(--studio-primary))] flex items-center gap-2">
            <FileText className="w-5 h-5 text-[rgb(var(--studio-muted))]" />
            <span>핵심 계약 규정 요약</span>
          </h3>
          <span className="text-xs text-[rgb(var(--studio-muted))]">
            약관 버전: {CONTRACT_POLICY_CONFIG.version}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm items-stretch">
          {/* 계약금 */}
          <div className="p-4 bg-[rgb(var(--studio-background))] rounded-2xl border border-[rgb(var(--studio-border))] space-y-1.5 flex flex-col justify-start">
            <span className="font-bold text-[rgb(var(--studio-primary))] text-sm sm:text-base block">
              1. 계약금 및 입금 기한
            </span>
            <p className="text-[rgb(var(--studio-body))] leading-relaxed break-keep">
              계약금은 <strong>{formatPolicyMoney(CONTRACT_POLICY_CONFIG.deposit.amount)}</strong> 입금을 원칙으로 하며, 계약 신청서 제출 이후 <strong>{CONTRACT_POLICY_CONFIG.payment.depositDueHours}시간 이내</strong> 입금 시 스케줄이 최종 확정됩니다.
            </p>
          </div>

          {/* 환불/취소 */}
          <div className="p-4 bg-[rgb(var(--studio-background))] rounded-2xl border border-[rgb(var(--studio-border))] space-y-1.5 flex flex-col justify-start">
            <span className="font-bold text-[rgb(var(--studio-primary))] text-sm sm:text-base block">
              2. 환불 규정
            </span>
            <p className="text-[rgb(var(--studio-body))] leading-relaxed break-keep">
              계약금 입금 후 <strong>{CONTRACT_POLICY_CONFIG.refund.fullRefundWindowHours}시간 이내</strong> 취소 요청 시 계약금 전액을 환불해 드립니다. 단, {CONTRACT_POLICY_CONFIG.refund.fullRefundWindowHours}시간 경과 후에는 {CONTRACT_POLICY_CONFIG.refund.afterWindowNotice}
            </p>
          </div>

          {/* 데이터 보관 */}
          <div className="p-4 bg-[rgb(var(--studio-background))] rounded-2xl border border-[rgb(var(--studio-border))] space-y-1.5 flex flex-col justify-start">
            <span className="font-bold text-[rgb(var(--studio-primary))] text-sm sm:text-base block">
              3. 원본 {CONTRACT_POLICY_CONFIG.retention.backupCopies}중 백업 및 보관
            </span>
            <p className="text-[rgb(var(--studio-body))] leading-relaxed break-keep">
              원본 데이터는 {CONTRACT_POLICY_CONFIG.retention.backupCopies}중 백업으로 안전하게 관리되며, 원본 전달 후 <strong>{CONTRACT_POLICY_CONFIG.retention.months}개월간 보관</strong>되므로 수령 즉시 개인 백업을 권장드립니다.
            </p>
          </div>

          {/* 제공 사양 */}
          <div className="p-4 bg-[rgb(var(--studio-background))] rounded-2xl border border-[rgb(var(--studio-border))] space-y-1.5 flex flex-col justify-start">
            <span className="font-bold text-[rgb(var(--studio-primary))] text-sm sm:text-base block">
              4. 원본 사진
            </span>
            <p className="text-[rgb(var(--studio-body))] leading-relaxed break-keep">
              사진은 {CONTRACT_POLICY_CONFIG.delivery.format} 파일(장축 {CONTRACT_POLICY_CONFIG.delivery.longEdgePixels.toLocaleString("ko-KR")}픽셀)로 {CONTRACT_POLICY_CONFIG.delivery.channel}을 통해 제공되며, 추후 {CONTRACT_POLICY_CONFIG.delivery.summaryTrigger} <strong>{formatPolicyDays(CONTRACT_POLICY_CONFIG.delivery.revisionRequestDays)} 이내</strong>로 수정 요청이 가능합니다.
            </p>
          </div>
        </div>

        {/* 위약금 단계 안내 */}
        <div className="p-4 bg-[rgb(var(--studio-background))]/70 rounded-2xl border border-[rgb(var(--studio-border))] text-xs sm:text-sm space-y-1 text-[rgb(var(--studio-body))]">
          <strong className="text-[rgb(var(--studio-primary))] block font-semibold text-sm">촬영 취소 시 위약금 규정:</strong>
          <p className="break-keep">&bull; {CONTRACT_POLICY_CONFIG.cancellation.summary[0]}</p>
          <p className="break-keep">&bull; {CONTRACT_POLICY_CONFIG.cancellation.summary[1]}</p>
        </div>

        {/* 약관 전문 전체 펼쳐보기 (가운데 정렬, 폰트 확대, 스크롤 확인 연동) */}
        <div className="pt-3 border-t border-[rgb(var(--studio-surface))]">
          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setShowAllArticles(!showAllArticles);
                if (showScrollWarning) setShowScrollWarning(false);
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 sm:px-8 py-3 sm:py-3.5 bg-[rgb(var(--studio-background))] border-2 border-[rgb(var(--studio-muted))] hover:bg-[rgb(var(--studio-surface))] text-[rgb(var(--studio-primary))] rounded-2xl text-[13px] sm:text-base font-bold transition-all shadow-sm cursor-pointer"
            >
              <span className="break-keep">
                {showAllArticles
                  ? '약관 전문 (제1조 ~ 제' + CONTRACT_POLICY_CONFIG.sections.length + '조) 닫기'
                  : '약관 전문 (제1조 ~ 제' + CONTRACT_POLICY_CONFIG.sections.length + '조) 전체 펼쳐보기'}
              </span>
              {showAllArticles ? (
                <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-[rgb(var(--studio-muted))] shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-[rgb(var(--studio-muted))] shrink-0" />
              )}
            </button>
          </div>

          {/* 펼쳐진 약관 전문 박스 (스크롤 끝까지 내려야 활성화) */}
          {showAllArticles && (
            <div className="mt-4 space-y-2 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 text-xs text-[rgb(var(--studio-muted))]">
                <span className="break-keep font-medium">
                  * 약관 내용을 아래로 끝까지 스크롤하여 확인해 주세요.
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold self-start sm:self-auto shrink-0 transition-colors ${
                    hasScrolledToBottom
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-[rgb(var(--studio-surface))] text-[rgb(var(--studio-muted))] border border-[rgb(var(--studio-line))]'
                  }`}
                >
                  {hasScrolledToBottom ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>약관 전문 확인 완료</span>
                    </>
                  ) : (
                    <span>스크롤 진행 중...</span>
                  )}
                </span>
              </div>

              <div
                ref={termsBoxRef}
                onScroll={handleTermsScroll}
                className="p-5 bg-[rgb(var(--studio-background))] rounded-2xl border-2 border-[rgb(var(--studio-line))] max-h-80 overflow-y-auto space-y-4 text-xs sm:text-sm text-[rgb(var(--studio-deep))] leading-relaxed shadow-inner"
              >
                {CONTRACT_POLICY_CONFIG.sections.map((sec) => (
                  <div key={sec.id} className="pb-3.5 border-b border-[rgb(var(--studio-border))] last:border-none">
                    <h4 className="font-bold text-[rgb(var(--studio-primary))] text-sm sm:text-base mb-1.5">{sec.title}</h4>
                    <p className="whitespace-pre-line text-[rgb(var(--studio-body))] leading-relaxed break-keep">{sec.content}</p>
                  </div>
                ))}

                {/* 약관 맨 끝 도달 확인 앵커 및 원터치 확인 완료 버튼 */}
                <div
                  ref={bottomAnchorRef}
                  className="p-4 bg-[rgb(var(--studio-border))]/50 border border-[rgb(var(--studio-line))] rounded-xl text-center space-y-2 mt-2"
                >
                  <p className="text-xs font-semibold text-[rgb(var(--studio-primary))]">
                    약관 전문(제1조 ~ 제{CONTRACT_POLICY_CONFIG.sections.length}조)의 끝입니다.
                  </p>
                  <button
                    type="button"
                    onClick={handleMarkAsRead}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      hasScrolledToBottom
                        ? 'bg-emerald-600 text-white cursor-default'
                        : 'bg-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))] hover:bg-[rgb(var(--studio-hover))] cursor-pointer shadow-sm'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>{hasScrolledToBottom ? '약관 확인 완료됨' : '약관 내용 확인 완료하기'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. 필수 동의 체크박스 및 다음 버튼 */}
      <div className="bg-white border border-[rgb(var(--studio-border))] rounded-3xl p-6 sm:p-8 space-y-5 shadow-sm">
        {/* 스크롤 미완료 시 경고 배너 */}
        {showScrollWarning && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs sm:text-sm text-amber-800 flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
            <span className="font-medium">
              상단의 <strong>[약관 전문 전체 펼쳐보기]</strong>를 누르신 후, 약관을 아래로 끝까지 스크롤하여 읽어주셔야 동의 체크가 활성화됩니다.
            </span>
          </div>
        )}

        <div
          role="checkbox"
          tabIndex={0}
          aria-checked={termsAgreed}
          aria-disabled={!hasScrolledToBottom}
          aria-label="계약 약관 및 운영 정책 동의"
          onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); handleCheckboxClick(); } }}
          onClick={handleCheckboxClick}
          className={`p-4 sm:p-5 rounded-2xl border transition-all flex items-start gap-3.5 select-none ${
            !hasScrolledToBottom
              ? 'bg-[rgb(var(--studio-background))]/50 border-[rgb(var(--studio-line))] opacity-60 cursor-not-allowed'
              : termsAgreed
              ? 'bg-[#FFFFFF] border-[rgb(var(--studio-primary))] ring-2 ring-[rgb(var(--studio-primary))]/15 shadow-sm cursor-pointer'
              : 'bg-[rgb(var(--studio-background))] border-[rgb(var(--studio-line))] hover:border-[rgb(var(--studio-muted))] cursor-pointer'
          }`}
        >
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors shrink-0 mt-0.5 ${
              termsAgreed
                ? 'bg-[rgb(var(--studio-primary))] border-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))]'
                : hasScrolledToBottom
                ? 'border-[rgb(var(--studio-muted))] bg-[#FFFFFF]'
                : 'border-[rgb(var(--studio-line))] bg-[rgb(var(--studio-surface))]'
            }`}
          >
            {termsAgreed && <Check className="w-4 h-4 stroke-[3]" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm sm:text-base font-semibold text-[rgb(var(--studio-primary))] break-keep leading-relaxed">
              <span className="text-red-500 font-bold mr-1.5 whitespace-nowrap shrink-0">[필수]</span>
              본식스냅 계약 약관 및 운영 정책의 내용을 모두 확인하였으며 이에 동의합니다.
            </p>

            {!hasScrolledToBottom && (
              <p className="text-xs text-[rgb(var(--studio-muted))] mt-1 break-keep leading-relaxed">
                (약관 전문을 끝까지 스크롤하여 확인하시면 체크할 수 있습니다.)
              </p>
            )}
          </div>
        </div>

        {showValidationError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs sm:text-sm text-red-600 flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="break-keep leading-relaxed">계약정보 작성을 진행하시려면 <span className="whitespace-nowrap font-medium">필수 약관 동의</span>에 체크해 주셔야 합니다.</span>
          </div>
        )}

        <div className="pt-2">
          <button
            type="button"
            onClick={handleNext}
            className="w-full h-14 sm:h-16 bg-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))] rounded-2xl text-base sm:text-lg font-semibold hover:bg-[rgb(var(--studio-hover))] transition-colors flex items-center justify-center gap-2 shadow-md"
          >
            <span>동의하고 계약정보 작성 시작하기</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
