import { getContractPolicy, formatPolicyDays } from '@/services/configuration';
import React, { useEffect, useRef } from 'react';
import { X, FileText } from 'lucide-react';


interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose }) => {
  const CONTRACT_POLICY_CONFIG = getContractPolicy();
  const modal = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    modal.current?.showModal(); document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, [isOpen]);
  if (!isOpen) return null;

  return (
    <dialog ref={modal} aria-label="본식스냅 촬영 계약 약관" className="customer-terms-dialog" onCancel={event => { event.preventDefault(); onClose(); }}>
      <div className="bg-[#FFFFFF] border border-[rgb(var(--studio-border))] rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* 모달 헤더 */}
        <div className="px-6 py-5 border-b border-[rgb(var(--studio-surface))] flex items-center justify-between bg-[rgb(var(--studio-background))]">
          <div className="flex items-center space-x-2.5">
            <FileText className="w-5 h-5 text-[rgb(var(--studio-muted))]" />
            <div>
              <h3 className="text-base font-semibold text-[rgb(var(--studio-primary))]">본식스냅 촬영 계약 약관</h3>
              <p className="text-xs text-[rgb(var(--studio-muted))]">버전: {CONTRACT_POLICY_CONFIG.version}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[rgb(var(--studio-muted))] hover:bg-[rgb(var(--studio-border))] transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 모달 본문 */}
        <div className="px-6 py-6 overflow-y-auto space-y-6 text-sm text-[rgb(var(--studio-deep))] leading-relaxed">
          {/* 핵심 요약 배너 */}
          <div className="p-4 bg-[rgb(var(--studio-background))] border border-[rgb(var(--studio-border))] rounded-xl space-y-2 text-xs text-[rgb(var(--studio-body))]">
            <p className="font-semibold text-[rgb(var(--studio-primary))] text-sm mb-1">핵심 안내사항</p>
            <p>&bull; <strong>계약금:</strong> {CONTRACT_POLICY_CONFIG.deposit.amount.toLocaleString("ko-KR")}원 (신청서 제출 후 {CONTRACT_POLICY_CONFIG.payment.depositDueHours}시간 이내 입금, {CONTRACT_POLICY_CONFIG.refund.fullRefundWindowHours}시간 이내 취소 시 전액 환불)</p>
            <p>&bull; <strong>잔금:</strong> 예식 {formatPolicyDays(CONTRACT_POLICY_CONFIG.payment.balanceDueDaysBeforeWedding)} 전까지 완납 원칙</p>
            <p>&bull; <strong>제공 규격:</strong> {CONTRACT_POLICY_CONFIG.imageSpec}</p>
            <p>&bull; <strong>원본 보관:</strong> {CONTRACT_POLICY_CONFIG.backupRetention}</p>
          </div>

          {/* 12개 조항 전문 */}
          <div className="space-y-5">
            {CONTRACT_POLICY_CONFIG.sections.map((section) => (
              <div key={section.id} className="border-b border-[rgb(var(--studio-surface))] pb-4 last:border-none">
                <h4 className="font-semibold text-[rgb(var(--studio-primary))] mb-1.5 text-[13px]">
                  {section.title}
                </h4>
                <p className="text-xs text-[rgb(var(--studio-body))] whitespace-pre-line leading-relaxed">
                  {section.content}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 모달 푸터 */}
        <div className="px-6 py-4 border-t border-[rgb(var(--studio-surface))] bg-[rgb(var(--studio-background))] flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))] text-xs font-medium rounded-lg hover:bg-[rgb(var(--studio-hover))] transition-colors"
          >
            약관 확인 완료
          </button>
        </div>
      </div>
    </dialog>
  );
};
