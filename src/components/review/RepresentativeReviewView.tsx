import { clearDisabledFormFields, getConfiguredFieldErrors } from '@/lib/formFields';
import { usePartnerCodeVerification } from '@/components/contract-form/usePartnerCodeVerification';
import { FieldRequirement } from '@/components/contract-form/FieldRequirement';
import { getProductById, getProducts, getOptionById, getOptions, getDiscountAmount, getStudioConfig, getDiscountLabel, getDiscountById, isDiscountActive, getFormField, isFormFieldEnabled, isFormFieldRequired } from '@/services/configuration';
import React, { useState, useEffect, useRef } from 'react';
import { ContractFormData, PriceCalculationResult, ContractSnapshot } from '@/types/contract';
import { calculateContractPrice, formatKRW } from '@/lib/pricing';
import {
  CheckCircle,
  Edit3,
  Send,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  SlidersHorizontal,
  FileCheck,
  Download,
  Tag,
  Calculator,
} from 'lucide-react';
import { ContractDocument } from '@/components/pdf/ContractDocument';
import { exportContractToPdfAndJpg, triggerFileDownload } from '@/lib/pdfGenerator';


interface RepresentativeReviewViewProps {
  token: string;
  ownerContractId?: string;
  contractId: string;
  initialData: ContractFormData;
  initialPricing: PriceCalculationResult;
  isAlreadySent: boolean;
  sentAt?: string;
  contractNumber?: string;
  initialSnapshot?: ContractSnapshot;
  initialRevision?: number;
}

interface ManualAdjustmentControlProps {
  manualAmount: number;
  manualReason: string;
  targetTotalInput: string;
  basePlusOptionsMinusDiscounts: number;
  contractTotal: number;
  onAmountChange: (amount: number) => void;
  onReasonChange: (reason: string) => void;
  onTargetTotalChange: (target: string) => void;
  onReset: () => void;
}

const ManualAdjustmentControl: React.FC<ManualAdjustmentControlProps> = ({
  manualAmount,
  manualReason,
  targetTotalInput,
  basePlusOptionsMinusDiscounts,
  contractTotal,
  onAmountChange,
  onReasonChange,
  onTargetTotalChange,
  onReset,
}) => {
  return (
    <div className="p-4 bg-[rgb(var(--studio-background))] border border-[rgb(var(--studio-line))] rounded-2xl space-y-3.5 text-xs shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-[rgb(var(--studio-muted))]" />
          <span className="font-bold text-[rgb(var(--studio-primary))] text-xs sm:text-sm">
            대표 특별 할인 및 금액 직접 조정
          </span>
        </div>
        {manualAmount !== 0 && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-red-600 hover:text-red-700 font-semibold underline cursor-pointer"
          >
            조정 초기화
          </button>
        )}
      </div>

      <p className="text-[11.5px] text-[rgb(var(--studio-muted))] leading-relaxed">
        대체공휴일 할인, 지인 할인 등 대표 재량으로 계약 총액을 직접 할인하거나 변경할 수 있습니다.
      </p>

      {/* 추천 사유 빠른 선택 */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] text-[rgb(var(--studio-muted))] font-medium mr-1">빠른 사유:</span>
        {['지인 특별 할인', '대체공휴일 할인', '프로모션 추가 할인', '일정 조정 감사'].map((reason) => (
          <button
            key={reason}
            type="button"
            onClick={() => onReasonChange(reason)}
            className={`px-2.5 py-1 rounded-lg text-[11px] border transition-all cursor-pointer ${
              manualReason === reason
                ? 'bg-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))] border-[rgb(var(--studio-primary))] font-semibold'
                : 'bg-white text-[rgb(var(--studio-body))] border-[rgb(var(--studio-line))] hover:bg-[rgb(var(--studio-surface))]'
            }`}
          >
            {reason}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* 사유 직접 입력 */}
        <div>
          <label className="block text-[11px] font-semibold text-[rgb(var(--studio-body))] mb-1">
            할인 / 조정 사유 (계약서 표기)
          </label>
          <input
            type="text"
            placeholder="예: 지인 특별 할인, 대체공휴일 등"
            value={manualReason}
            onChange={(e) => onReasonChange(e.target.value)}
            className="w-full h-10 px-3 bg-white border border-[rgb(var(--studio-line))] focus:border-[rgb(var(--studio-primary))] rounded-xl text-xs text-[rgb(var(--studio-primary))] font-medium"
          />
        </div>

        {/* 조정 금액 직접 입력 */}
        <div>
          <label className="block text-[11px] font-semibold text-[rgb(var(--studio-body))] mb-1">
            할인 / 조정 금액 (원, 할인은 마이너스)
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="예: -50000, -100000"
              value={manualAmount ? String(manualAmount) : ''}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9-]/g, '');
                const val = parseInt(raw, 10) || 0;
                onAmountChange(val);
                if (!manualReason) onReasonChange('대표 특별 할인');
              }}
              className="w-full h-10 px-3 bg-white border border-[rgb(var(--studio-line))] focus:border-[rgb(var(--studio-primary))] rounded-xl text-xs text-[rgb(var(--studio-primary))] font-bold tabular-nums"
            />
          </div>
        </div>
      </div>

      {/* 최종 계약금액 직접 지정으로 맞추기 */}
      <div className="pt-2 border-t border-[rgb(var(--studio-border))] flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-1.5 text-[11px] text-[rgb(var(--studio-body))]">
          <Calculator className="w-3.5 h-3.5 text-[rgb(var(--studio-muted))]" />
          <span>또는 <strong>최종 계약금액을 직접 입력</strong>하여 맞추기:</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="text"
            placeholder="예: 1100000"
            value={targetTotalInput}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, '');
              onTargetTotalChange(raw);
              if (raw) {
                const targetNum = parseInt(raw, 10);
                const diff = targetNum - basePlusOptionsMinusDiscounts;
                onAmountChange(diff);
                if (!manualReason) onReasonChange('대표 특별 금액 조정');
              }
            }}
            className="w-36 h-9 px-2.5 bg-white border border-[rgb(var(--studio-line))] focus:border-[rgb(var(--studio-primary))] rounded-lg text-xs font-bold text-right tabular-nums text-[rgb(var(--studio-primary))]"
          />
          <span className="text-xs font-semibold text-[rgb(var(--studio-primary))]">원</span>
        </div>
      </div>

      {/* 현재 적용 상태 피드백 */}
      {manualAmount !== 0 && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between font-medium animate-fade-in">
          <span>
            ✓ {manualReason || '특별 조정'}: <strong>{manualAmount > 0 ? `+${formatKRW(manualAmount)}` : formatKRW(manualAmount)}</strong> 적용 중
          </span>
          <span className="text-emerald-700 font-bold">최종 {formatKRW(contractTotal)}</span>
        </div>
      )}
    </div>
  );
};

export const RepresentativeReviewView: React.FC<RepresentativeReviewViewProps> = ({
  token,
  ownerContractId,
  contractId,
  initialData,
  initialPricing,
  isAlreadySent: initialAlreadySent,
  sentAt: initialSentAt,
  contractNumber: initialContractNumber,
  initialSnapshot,
  initialRevision = 1,
}) => {
  const PRODUCTS_CONFIG = getProducts();
  const OPTIONS_CONFIG = getOptions();
  const [formData, setFormData] = useState<ContractFormData>(() =>
    initialAlreadySent ? initialData : clearDisabledFormFields(initialData)
  );
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const fieldErrors = showFieldErrors ? getConfiguredFieldErrors(formData) : {};
  const [isEditing, setIsEditing] = useState(false);
  const [isAlreadySent, setIsAlreadySent] = useState(initialAlreadySent);
  const [sentAt, setSentAt] = useState(initialSentAt);
  const [contractNumber, setContractNumber] = useState(initialContractNumber || getStudioConfig().contractPrefix + '-TEMP');

  const [documentSnapshot, setDocumentSnapshot] = useState<ContractSnapshot | undefined>(initialSnapshot);
  const submittingRef = useRef(false);
  const revisionRef = useRef(initialRevision);

  // 수동 조정 모달/인풋 토글
  const [showManualAdjustment, setShowManualAdjustment] = useState(
    !!initialData.manualAdjustment && initialData.manualAdjustment.amount !== 0
  );
  const [manualAmount, setManualAmount] = useState<number>(initialData.manualAdjustment?.amount || 0);
  const [manualReason, setManualReason] = useState<string>(initialData.manualAdjustment?.reason || '');
  const [targetTotalInput, setTargetTotalInput] = useState<string>('');

  // 실시간 재계산
  const [pricing, setPricing] = useState<PriceCalculationResult>(initialPricing);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const partnerVerification = usePartnerCodeVerification(formData.partnerName, !isAlreadySent && isDiscountActive('partner'), (valid, amount) => {
    setFormData(previous => ({ ...previous, partnerDiscount: valid, partnerDiscountAmount: amount }));
  });

  // 데이터 변경 시 가격 자동 재계산 (Acceptance Test #62 대표 수정 시 자동 재계산)
  useEffect(() => {
    if (isAlreadySent && documentSnapshot) {
      setPricing(documentSnapshot.pricing);
      return;
    }
    const updatedPricing = calculateContractPrice({
      productId: formData.productId,
      optionIds: formData.optionIds,
      weddingDate: formData.weddingDate,
      partnerDiscount: formData.partnerDiscount,
      partnerName: formData.partnerName,
      partnerDiscountAmount: formData.partnerDiscountAmount ?? 0,
      portfolioConsent: formData.portfolioConsent,
      reviewContractCashback: formData.reviewContractCashback,
      reviewMainCashback: formData.reviewMainCashback,
      manualAdjustment:
        manualAmount !== 0
          ? {
              amount: manualAmount,
              reason: manualReason.trim() || (manualAmount < 0 ? '지인 특별 할인' : '대표 특약 금액 조정'),
            }
          : undefined,
    });
    setPricing(updatedPricing);
  }, [formData, manualAmount, manualReason, isAlreadySent, documentSnapshot]);

  // Freeze one canonical server snapshot before rendering its PDF.
  const handleApproveAndSend = async () => {
    if (isAlreadySent || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      if (isDiscountActive('partner') && formData.partnerName.trim() && !formData.partnerDiscount) throw new Error('할인코드를 확인하거나 입력한 코드를 지워 주세요.');
      const validationErrors = getConfiguredFieldErrors(formData);
      setShowFieldErrors(true);
      if (Object.keys(validationErrors).length) {
        setIsEditing(true);
        throw new Error(Object.values(validationErrors).join(' '));
      }
      const updatedData = {
        ...clearDisabledFormFields(formData),
        manualAdjustment: manualAmount !== 0 ? { amount: manualAmount, reason: manualReason.trim() || '대표 특별 금액 조정' } : undefined,
      };
      const preparedResponse = await fetch(ownerContractId ? '/api/owner-control/contract' : '/api/approve-and-send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(ownerContractId ? { contractId: ownerContractId } : { token }), phase: 'prepare', expectedRevision: revisionRef.current, updatedData }),
      });
      const prepared = await preparedResponse.json();
      if (!preparedResponse.ok || !prepared.success || !prepared.snapshotHash) throw new Error(prepared.error || '계약정보 확정에 실패했습니다.');
      setDocumentSnapshot(prepared.snapshot);
      revisionRef.current = prepared.revision;
      setContractNumber(prepared.contractNumber);
      // Wait for React to commit the frozen document; live edits cannot change this capture.
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const doc = prepared.documentStored ? undefined : await exportContractToPdfAndJpg('review-contract-doc-preview', prepared.contractNumber, prepared.snapshotHash);
      const response = await fetch(ownerContractId ? '/api/owner-control/contract' : '/api/approve-and-send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(ownerContractId ? { contractId: ownerContractId } : { token }), phase: 'send', snapshotHash: prepared.snapshotHash, pdfBase64: doc?.pdfBase64 }),
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.customerEmailSent || !result.representativeEmailSent) throw new Error(result.error || '발송 상태를 확인하지 못했습니다. 대표에게 확인해 주세요.');
      setDocumentSnapshot(result.snapshot);
      setFormData(result.snapshot.data);
      setPricing(result.snapshot.pricing);
      setContractNumber(result.contractNumber);
      setIsAlreadySent(true);
      setSentAt(result.snapshot.sentAt);
      setSendSuccess(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '발송 처리에 실패했습니다.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const weddingDateFormatted = formData.weddingDate.replace(/-/g, '.');
  const product = isAlreadySent && documentSnapshot?.product ? documentSnapshot.product : getProductById(formData.productId);
  const selectedOptionObjects = (isAlreadySent && documentSnapshot?.options) || formData.optionIds
    .map((id) => getOptionById(id))
    .filter(Boolean);
  const selectedOptions = selectedOptionObjects.map((opt) => opt!.name);
  const basePlusOptionsMinusDiscounts = (pricing.basePrice || 0) + (pricing.optionTotal || 0) - (pricing.immediateDiscountTotal || 0);

  return (
    <fieldset disabled={isSubmitting} className="contents">
      {isAlreadySent && !sendSuccess ? (
        <div className="max-w-xl mx-auto my-12 p-8 bg-[#FFFFFF] border border-[rgb(var(--studio-border))] rounded-3xl text-center space-y-5 shadow-sm animate-fade-in">
          <div className="w-14 h-14 rounded-full bg-[rgb(var(--studio-surface))] text-[rgb(var(--studio-muted))] flex items-center justify-center mx-auto">
            <FileCheck className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-serif font-bold text-[rgb(var(--studio-primary))]">
            이미 발송이 완료된 계약건입니다
          </h2>
          <p className="text-xs text-[rgb(var(--studio-body))] leading-relaxed">
            계약번호: <strong>{contractNumber}</strong><br />
            발송일시: {sentAt ? new Date(sentAt).toLocaleString('ko-KR') : '확인 완료'}
          </p>
          <p className="text-xs text-[rgb(var(--studio-muted))]">
            고객({formData.email}) 및 대표 이메일로 계약서 PDF가 이미 발송되었습니다. 중복 발송을 방지하기 위해 추가 발송이 제한됩니다.
          </p>
        </div>
      ) : sendSuccess ? (
        <div className="max-w-xl mx-auto my-12 p-8 bg-[#FFFFFF] border border-[rgb(var(--studio-border))] rounded-3xl text-center space-y-6 shadow-sm animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-[rgb(var(--studio-background))] border border-[rgb(var(--studio-line))] text-[rgb(var(--studio-muted))] flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8" />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wider text-[rgb(var(--studio-muted))] uppercase">
              {getStudioConfig(documentSnapshot).displayName}
            </p>
            <h2 className="text-2xl font-serif font-bold text-[rgb(var(--studio-primary))] mt-1">
              최종 계약서 발송 완료
            </h2>
            <p className="text-xs sm:text-sm text-[rgb(var(--studio-body))] mt-2">
              고객(<strong className="text-[rgb(var(--studio-primary))]">{formData.email}</strong>) 및 대표 메일로 계약서 PDF가 정상 발송되었습니다.
            </p>
          </div>

          <div className="p-4 bg-[rgb(var(--studio-background))] border border-[rgb(var(--studio-border))] rounded-2xl text-xs space-y-1.5 text-left text-[rgb(var(--studio-body))]">
            <div className="flex justify-between">
              <span className="text-[rgb(var(--studio-muted))]">계약번호:</span>
              <span className="font-semibold text-[rgb(var(--studio-primary))]">{contractNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[rgb(var(--studio-muted))]">예식일자:</span>
              <span>{weddingDateFormatted} {formData.weddingTime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[rgb(var(--studio-muted))]">신랑/신부:</span>
              <span>{formData.groomName} · {formData.brideName}</span>
            </div>
            <div className="flex justify-between border-t border-[rgb(var(--studio-border))] pt-1.5 font-medium">
              <span>최종 계약금액:</span>
              <span className="text-[rgb(var(--studio-primary))] font-bold">{formatKRW(pricing.contractTotal)}</span>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await exportContractToPdfAndJpg('review-contract-doc-preview', contractNumber);
                  triggerFileDownload(res.pdfBlob, `${contractNumber}_${formData.groomName}_${formData.brideName}_촬영계약서.pdf`);
                } catch (e) {
                  alert('PDF 다운로드 중 오류가 발생했습니다.');
                }
              }}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))] rounded-xl text-xs font-semibold hover:bg-[rgb(var(--studio-hover))] transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>계약서 PDF 다운로드 보관</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* 상단 액션 바 */}
      <div className="flex items-center justify-between border-b border-[rgb(var(--studio-border))] pb-4">
        <div>
          <span className="text-[11px] font-semibold tracking-wider text-[rgb(var(--studio-muted))] uppercase">
            REPRESENTATIVE REVIEW
          </span>
          <h2 className="text-lg sm:text-xl font-serif font-bold text-[rgb(var(--studio-primary))]">
            계약서 발송 확인 및 검토
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setIsEditing(!isEditing)}
          className={`px-3.5 py-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all ${
            isEditing
              ? 'bg-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))] border-[rgb(var(--studio-primary))]'
              : 'bg-white text-[rgb(var(--studio-body))] border-[rgb(var(--studio-line))] hover:bg-[rgb(var(--studio-background))]'
          }`}
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>{isEditing ? '수정 완료' : '내용 수정'}</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 대표 검토 카드 */}
      <div className="bg-[#FFFFFF] border border-[rgb(var(--studio-border))] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">

        {/* 헤더: 고객명 및 예식정보 */}
        <div className="text-center pb-5 border-b border-[rgb(var(--studio-surface))]">
          <h3 className="text-xl sm:text-2xl font-serif font-bold text-[rgb(var(--studio-primary))]">
            {formData.groomName} ♥ {formData.brideName}
          </h3>
          <p className="text-sm font-medium text-[rgb(var(--studio-body))] mt-1">
            {weddingDateFormatted} {formData.weddingTime}
          </p>
          <p className="text-xs text-[rgb(var(--studio-muted))] mt-0.5">
            {formData.weddingVenue} {formData.weddingHall}
          </p>
        </div>

        {/* 1. 내용 수정 모드 폼 (대표가 수정할 수 있는 입력란들) */}
        {isEditing ? (
          <div className="p-4 bg-[rgb(var(--studio-background))] border border-[rgb(var(--studio-border))] rounded-2xl space-y-4 text-xs">
            <h4 className="font-semibold text-[rgb(var(--studio-primary))] text-sm flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4 text-[rgb(var(--studio-muted))]" />
              <span>계약 내용 수정 (수정 시 금액 자동 재계산)</span>
            </h4>

            {/* 신랑/신부/이메일 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[rgb(var(--studio-muted))] mb-1">신랑 성명</label>
                <input
                  type="text"
                  value={formData.groomName}
                  onChange={(e) => setFormData({ ...formData, groomName: e.target.value })}
                  className="w-full h-9 px-2.5 bg-white border border-[rgb(var(--studio-line))] rounded-lg text-xs"
                />
              </div>
              {isFormFieldEnabled('groomPhone') && (<div>
                <label htmlFor="contract-field-groomPhone" className="block text-[rgb(var(--studio-muted))] mb-1">{getFormField('groomPhone').label} <FieldRequirement field="groomPhone" showOptional={false} /></label>
                <input
                  id="contract-field-groomPhone"
                  required={isFormFieldRequired('groomPhone')}
                  aria-required={isFormFieldRequired('groomPhone')}
                  aria-invalid={!!fieldErrors.groomPhone}
                  placeholder={getFormField('groomPhone').placeholder}
                  type="text"
                  value={formData.groomPhone}
                  onChange={(e) => setFormData({ ...formData, groomPhone: e.target.value })}
                  className="w-full h-9 px-2.5 bg-white border border-[rgb(var(--studio-line))] rounded-lg text-xs"
                />
                {fieldErrors.groomPhone && (
                  <p className="text-xs text-red-500 mt-1.5 font-medium">{fieldErrors.groomPhone}</p>
                )}
              </div>)}
              {isFormFieldEnabled('groomFamilyMembers') && (<div className="col-span-1 sm:col-span-2">
                <label htmlFor="contract-field-groomFamilyMembers" className="block text-[rgb(var(--studio-muted))] mb-1">{getFormField('groomFamilyMembers').label} <FieldRequirement field="groomFamilyMembers" showOptional={false} /></label>
                <input
                  id="contract-field-groomFamilyMembers"
                  required={isFormFieldRequired('groomFamilyMembers')}
                  aria-required={isFormFieldRequired('groomFamilyMembers')}
                  aria-invalid={!!fieldErrors.groomFamilyMembers}
                  type="text"
                  value={formData.groomFamilyMembers || ''}
                  onChange={(e) => setFormData({ ...formData, groomFamilyMembers: e.target.value })}
                  placeholder={getFormField('groomFamilyMembers').placeholder}
                  className="w-full h-9 px-2.5 bg-white border border-[rgb(var(--studio-line))] rounded-lg text-xs"
                />
                {fieldErrors.groomFamilyMembers && (
                  <p className="text-xs text-red-500 mt-1.5 font-medium">{fieldErrors.groomFamilyMembers}</p>
                )}
              </div>)}
              <div>
                <label className="block text-[rgb(var(--studio-muted))] mb-1">신부 성명</label>
                <input
                  type="text"
                  value={formData.brideName}
                  onChange={(e) => setFormData({ ...formData, brideName: e.target.value })}
                  className="w-full h-9 px-2.5 bg-white border border-[rgb(var(--studio-line))] rounded-lg text-xs"
                />
              </div>
              {isFormFieldEnabled('bridePhone') && (<div>
                <label htmlFor="contract-field-bridePhone" className="block text-[rgb(var(--studio-muted))] mb-1">{getFormField('bridePhone').label} <FieldRequirement field="bridePhone" showOptional={false} /></label>
                <input
                  id="contract-field-bridePhone"
                  required={isFormFieldRequired('bridePhone')}
                  aria-required={isFormFieldRequired('bridePhone')}
                  aria-invalid={!!fieldErrors.bridePhone}
                  placeholder={getFormField('bridePhone').placeholder}
                  type="text"
                  value={formData.bridePhone}
                  onChange={(e) => setFormData({ ...formData, bridePhone: e.target.value })}
                  className="w-full h-9 px-2.5 bg-white border border-[rgb(var(--studio-line))] rounded-lg text-xs"
                />
                {fieldErrors.bridePhone && (
                  <p className="text-xs text-red-500 mt-1.5 font-medium">{fieldErrors.bridePhone}</p>
                )}
              </div>)}
              {isFormFieldEnabled('brideFamilyMembers') && (<div className="col-span-1 sm:col-span-2">
                <label htmlFor="contract-field-brideFamilyMembers" className="block text-[rgb(var(--studio-muted))] mb-1">{getFormField('brideFamilyMembers').label} <FieldRequirement field="brideFamilyMembers" showOptional={false} /></label>
                <input
                  id="contract-field-brideFamilyMembers"
                  required={isFormFieldRequired('brideFamilyMembers')}
                  aria-required={isFormFieldRequired('brideFamilyMembers')}
                  aria-invalid={!!fieldErrors.brideFamilyMembers}
                  type="text"
                  value={formData.brideFamilyMembers || ''}
                  onChange={(e) => setFormData({ ...formData, brideFamilyMembers: e.target.value })}
                  placeholder={getFormField('brideFamilyMembers').placeholder}
                  className="w-full h-9 px-2.5 bg-white border border-[rgb(var(--studio-line))] rounded-lg text-xs"
                />
                {fieldErrors.brideFamilyMembers && (
                  <p className="text-xs text-red-500 mt-1.5 font-medium">{fieldErrors.brideFamilyMembers}</p>
                )}
              </div>)}
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-[rgb(var(--studio-muted))] mb-1">계약서 수신 이메일</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full h-9 px-2.5 bg-white border border-[rgb(var(--studio-line))] rounded-lg font-medium text-xs"
                />
              </div>
            </div>

            {/* 예식 일시 및 웨딩홀 & 메이크업 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[rgb(var(--studio-line))]">
              <div>
                <label className="block text-[rgb(var(--studio-muted))] mb-1">예식일자</label>
                <input
                  type="date"
                  value={formData.weddingDate}
                  onChange={(e) => setFormData({ ...formData, weddingDate: e.target.value })}
                  className="w-full h-9 px-2.5 bg-white border border-[rgb(var(--studio-line))] rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-[rgb(var(--studio-muted))] mb-1">예식시간</label>
                <input
                  type="time"
                  value={formData.weddingTime}
                  onChange={(e) => setFormData({ ...formData, weddingTime: e.target.value })}
                  className="w-full h-9 px-2.5 bg-white border border-[rgb(var(--studio-line))] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[rgb(var(--studio-muted))] mb-1">웨딩홀</label>
                <input
                  type="text"
                  value={formData.weddingVenue}
                  onChange={(e) => setFormData({ ...formData, weddingVenue: e.target.value })}
                  className="w-full h-9 px-2.5 bg-white border border-[rgb(var(--studio-line))] rounded-lg"
                />
              </div>
              {isFormFieldEnabled('weddingHall') && (<div>
                <label htmlFor="contract-field-weddingHall" className="block text-[rgb(var(--studio-muted))] mb-1">{getFormField('weddingHall').label} <FieldRequirement field="weddingHall" showOptional={false} /></label>
                <input
                  id="contract-field-weddingHall"
                  required={isFormFieldRequired('weddingHall')}
                  aria-required={isFormFieldRequired('weddingHall')}
                  aria-invalid={!!fieldErrors.weddingHall}
                  placeholder={getFormField('weddingHall').placeholder}
                  type="text"
                  value={formData.weddingHall}
                  onChange={(e) => setFormData({ ...formData, weddingHall: e.target.value })}
                  className="w-full h-9 px-2.5 bg-white border border-[rgb(var(--studio-line))] rounded-lg"
                />
                {fieldErrors.weddingHall && (
                  <p className="text-xs text-red-500 mt-1.5 font-medium">{fieldErrors.weddingHall}</p>
                )}
              </div>)}
              {isFormFieldEnabled('makeupLocation') && (<div className="col-span-1 sm:col-span-2">
                <label htmlFor="contract-field-makeupLocation" className="block text-[rgb(var(--studio-muted))] mb-1">{getFormField('makeupLocation').label} <FieldRequirement field="makeupLocation" showOptional={false} /></label>
                <input
                  id="contract-field-makeupLocation"
                  required={isFormFieldRequired('makeupLocation')}
                  aria-required={isFormFieldRequired('makeupLocation')}
                  aria-invalid={!!fieldErrors.makeupLocation}
                  type="text"
                  value={formData.makeupLocation || ''}
                  onChange={(e) => setFormData({ ...formData, makeupLocation: e.target.value })}
                  placeholder={getFormField('makeupLocation').placeholder}
                  className="w-full h-9 px-2.5 bg-white border border-[rgb(var(--studio-line))] rounded-lg text-xs"
                />
                {fieldErrors.makeupLocation && (
                  <p className="text-xs text-red-500 mt-1.5 font-medium">{fieldErrors.makeupLocation}</p>
                )}
              </div>)}
            </div>

            {/* 상품 선택 변경 (기본 상품 / 상위 상품) */}
            <div className="pt-2 border-t border-[rgb(var(--studio-line))]">
              <label className="block text-[rgb(var(--studio-muted))] mb-1.5 font-medium">촬영 상품 변경</label>
              <div className="grid grid-cols-2 gap-2">
                {PRODUCTS_CONFIG.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, productId: p.id })}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      formData.productId === p.id
                        ? 'bg-white border-[rgb(var(--studio-primary))] ring-1 ring-[rgb(var(--studio-primary))]'
                        : 'bg-white/60 border-[rgb(var(--studio-line))]'
                    }`}
                  >
                    <div className="font-semibold text-[rgb(var(--studio-primary))]">{p.name}</div>
                    <div className="text-[11px] text-[rgb(var(--studio-muted))]">{formatKRW(p.basePrice)}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 옵션 토글 */}
            <div className="pt-2 border-t border-[rgb(var(--studio-line))]">
              <label className="block text-[rgb(var(--studio-muted))] mb-1.5 font-medium">추가 옵션</label>
              <div className="grid grid-cols-2 gap-2">
                {OPTIONS_CONFIG.map((opt) => {
                  const hasOpt = formData.optionIds.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        const newOpts = hasOpt
                          ? formData.optionIds.filter((id) => id !== opt.id)
                          : [...formData.optionIds, opt.id];
                        setFormData({ ...formData, optionIds: newOpts });
                      }}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        hasOpt
                          ? 'bg-white border-[rgb(var(--studio-primary))] ring-1 ring-[rgb(var(--studio-primary))]'
                          : 'bg-white/60 border-[rgb(var(--studio-line))]'
                      }`}
                    >
                      <div className="font-medium text-[rgb(var(--studio-primary))]">{opt.name}</div>
                      <div className="text-[11px] text-[rgb(var(--studio-muted))]">+{formatKRW(opt.price)}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 할인 옵션 */}
            <div className="pt-2 border-t border-[rgb(var(--studio-line))] space-y-2">
              <label className="block text-[rgb(var(--studio-muted))] mb-1 font-medium">할인 및 동의</label>
              {isDiscountActive('partner') && (<label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.partnerDiscount}
                  onChange={() => setFormData({ ...formData, partnerDiscount: false, partnerName: '', partnerDiscountAmount: 0 })}
                  className="rounded"
                />
                <span>{getDiscountLabel('partner', 'form')} ({formatKRW(formData.partnerDiscountAmount ?? 0)} · 서버 확인 후 적용)</span>
              </label>)}
              {isDiscountActive('partner') && (
                <input
                  type="text"
                  aria-label="짝꿍 할인코드"
                  placeholder="업체에서 안내받은 할인코드"
                  value={formData.partnerName}
                  onChange={(e) => setFormData({ ...formData, partnerName: e.target.value, partnerDiscount: false, partnerDiscountAmount: 0 })}
                  className="w-full h-8 px-2 bg-white border border-[rgb(var(--studio-line))] rounded text-xs"
                />
              )}
              {partnerVerification.message && <p role="status" className="text-xs">{partnerVerification.message}</p>}

              {isDiscountActive('portfolio') && (<label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.portfolioConsent}
                  onChange={(e) => setFormData({ ...formData, portfolioConsent: e.target.checked })}
                  className="rounded"
                />
                <span>{getDiscountLabel('portfolio', 'form')} ({getDiscountById('portfolio')?.type === 'immediate' ? '-' : ''}{formatKRW(getDiscountAmount('portfolio'))})</span>
              </label>)}
            </div>

            {/* 대표 특별 할인 및 금액 직접 조정 */}
            <div className="pt-2 border-t border-[rgb(var(--studio-line))]">
              <ManualAdjustmentControl
                manualAmount={manualAmount}
                manualReason={manualReason}
                targetTotalInput={targetTotalInput}
                basePlusOptionsMinusDiscounts={basePlusOptionsMinusDiscounts}
                contractTotal={pricing.contractTotal}
                onAmountChange={(amt) => setManualAmount(amt)}
                onReasonChange={(rsn) => setManualReason(rsn)}
                onTargetTotalChange={(tgt) => setTargetTotalInput(tgt)}
                onReset={() => {
                  setManualAmount(0);
                  setManualReason('');
                  setTargetTotalInput('');
                }}
              />
            </div>

            {/* 요청사항 및 SNS */}
            <div className="pt-2 border-t border-[rgb(var(--studio-line))] space-y-3">
              <label className="block text-[rgb(var(--studio-muted))] font-medium">세부 요청사항 및 참고정보</label>
              {isFormFieldEnabled('shootRequestNotes') && (<div>
                <label htmlFor="contract-field-shootRequestNotes" className="block text-[rgb(var(--studio-muted))] mb-1">{getFormField('shootRequestNotes').label} <FieldRequirement field="shootRequestNotes" showOptional={false} /></label>
                <textarea
                  id="contract-field-shootRequestNotes"
                  required={isFormFieldRequired('shootRequestNotes')}
                  aria-required={isFormFieldRequired('shootRequestNotes')}
                  aria-invalid={!!fieldErrors.shootRequestNotes}
                  rows={2}
                  value={formData.shootRequestNotes || ''}
                  onChange={(e) => setFormData({ ...formData, shootRequestNotes: e.target.value })}
                  placeholder={getFormField('shootRequestNotes').placeholder}
                  className="w-full p-2 bg-white border border-[rgb(var(--studio-line))] rounded-lg text-xs"
                />
                {fieldErrors.shootRequestNotes && (
                  <p className="text-xs text-red-500 mt-1.5 font-medium">{fieldErrors.shootRequestNotes}</p>
                )}
              </div>)}
              {isFormFieldEnabled('retouchRequestNotes') && (<div>
                <label htmlFor="contract-field-retouchRequestNotes" className="block text-[rgb(var(--studio-muted))] mb-1">{getFormField('retouchRequestNotes').label} <FieldRequirement field="retouchRequestNotes" showOptional={false} /></label>
                <textarea
                  id="contract-field-retouchRequestNotes"
                  required={isFormFieldRequired('retouchRequestNotes')}
                  aria-required={isFormFieldRequired('retouchRequestNotes')}
                  aria-invalid={!!fieldErrors.retouchRequestNotes}
                  rows={2}
                  value={formData.retouchRequestNotes || ''}
                  onChange={(e) => setFormData({ ...formData, retouchRequestNotes: e.target.value })}
                  placeholder={getFormField('retouchRequestNotes').placeholder}
                  className="w-full p-2 bg-white border border-[rgb(var(--studio-line))] rounded-lg text-xs"
                />
                {fieldErrors.retouchRequestNotes && (
                  <p className="text-xs text-red-500 mt-1.5 font-medium">{fieldErrors.retouchRequestNotes}</p>
                )}
              </div>)}
              {isFormFieldEnabled('requestNotes') && (<div>
                <label htmlFor="contract-field-requestNotes" className="block text-[rgb(var(--studio-muted))] mb-1">{getFormField('requestNotes').label} <FieldRequirement field="requestNotes" showOptional={false} /></label>
                <textarea
                  id="contract-field-requestNotes"
                  required={isFormFieldRequired('requestNotes')}
                  aria-required={isFormFieldRequired('requestNotes')}
                  aria-invalid={!!fieldErrors.requestNotes}
                  rows={2}
                  value={formData.requestNotes || ''}
                  onChange={(e) => setFormData({ ...formData, requestNotes: e.target.value })}
                  placeholder={getFormField('requestNotes').placeholder}
                  className="w-full p-2 bg-white border border-[rgb(var(--studio-line))] rounded-lg text-xs"
                />
                {fieldErrors.requestNotes && (
                  <p className="text-xs text-red-500 mt-1.5 font-medium">{fieldErrors.requestNotes}</p>
                )}
              </div>)}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {isFormFieldEnabled('referralSource') && (<div>
                  <label htmlFor="contract-field-referralSource" className="block text-[rgb(var(--studio-muted))] mb-1">{getFormField('referralSource').label} <FieldRequirement field="referralSource" showOptional={false} /></label>
                  <input
                    id="contract-field-referralSource"
                    required={isFormFieldRequired('referralSource')}
                    aria-required={isFormFieldRequired('referralSource')}
                    aria-invalid={!!fieldErrors.referralSource}
                    type="text"
                    value={formData.referralSource || ''}
                    onChange={(e) => setFormData({ ...formData, referralSource: e.target.value })}
                    placeholder={getFormField('referralSource').placeholder}
                    className="w-full h-8 px-2 bg-white border border-[rgb(var(--studio-line))] rounded text-xs"
                  />
                  {fieldErrors.referralSource && (
                    <p className="text-xs text-red-500 mt-1.5 font-medium">{fieldErrors.referralSource}</p>
                  )}
                </div>)}
                {isFormFieldEnabled('instagramId') && (<div>
                  <label htmlFor="contract-field-instagramId" className="block text-[rgb(var(--studio-muted))] mb-1">{getFormField('instagramId').label} <FieldRequirement field="instagramId" showOptional={false} /></label>
                  <input
                    id="contract-field-instagramId"
                    required={isFormFieldRequired('instagramId')}
                    aria-required={isFormFieldRequired('instagramId')}
                    aria-invalid={!!fieldErrors.instagramId}
                    type="text"
                    value={formData.instagramId || ''}
                    onChange={(e) => setFormData({ ...formData, instagramId: e.target.value })}
                    placeholder={getFormField('instagramId').placeholder}
                    className="w-full h-8 px-2 bg-white border border-[rgb(var(--studio-line))] rounded text-xs"
                  />
                  {fieldErrors.instagramId && (
                    <p className="text-xs text-red-500 mt-1.5 font-medium">{fieldErrors.instagramId}</p>
                  )}
                </div>)}
                {isFormFieldEnabled('blogUrl') && (<div>
                  <label htmlFor="contract-field-blogUrl" className="block text-[rgb(var(--studio-muted))] mb-1">{getFormField('blogUrl').label} <FieldRequirement field="blogUrl" showOptional={false} /></label>
                  <input
                    id="contract-field-blogUrl"
                    required={isFormFieldRequired('blogUrl')}
                    aria-required={isFormFieldRequired('blogUrl')}
                    aria-invalid={!!fieldErrors.blogUrl}
                    type="text"
                    value={formData.blogUrl || ''}
                    onChange={(e) => setFormData({ ...formData, blogUrl: e.target.value })}
                    placeholder={getFormField('blogUrl').placeholder}
                    className="w-full h-8 px-2 bg-white border border-[rgb(var(--studio-line))] rounded text-xs"
                  />
                  {fieldErrors.blogUrl && (
                    <p className="text-xs text-red-500 mt-1.5 font-medium">{fieldErrors.blogUrl}</p>
                  )}
                </div>)}
              </div>
            </div>
          </div>
        ) : null}

        {/* 2. 일반 뷰: 선택 상품 및 정산 내역 */}
        <div className="space-y-3 text-xs sm:text-sm">
          <div className="p-4 bg-[rgb(var(--studio-background))] border border-[rgb(var(--studio-border))] rounded-2xl space-y-2.5">
            <div className="flex justify-between font-medium pb-1.5 border-b border-[rgb(var(--studio-border))]">
              <span className="text-[rgb(var(--studio-muted))]">기본 상품</span>
              <span className="font-semibold text-[rgb(var(--studio-primary))] tabular-nums">{product?.name} ({formatKRW(pricing.basePrice)})</span>
            </div>

            {/* 추가 옵션 개별 내역 및 금액 */}
            {selectedOptionObjects.length > 0 ? (
              <div className="space-y-1.5 py-0.5">
                {selectedOptionObjects.map((opt) => (
                  <div key={opt!.id} className="flex justify-between text-xs sm:text-sm">
                    <span className="text-[rgb(var(--studio-body))]">+ {opt!.name}</span>
                    <span className="font-semibold text-[rgb(var(--studio-body))] tabular-nums">+{formatKRW(opt!.price)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex justify-between text-xs text-[rgb(var(--studio-muted))]">
                <span>추가 옵션</span>
                <span>없음</span>
              </div>
            )}

            {/* 즉시 할인 상세 개별 분리 */}
            {pricing.immediateDiscountTotal > 0 && (
              <div className="space-y-1.5 py-1 border-t border-[rgb(var(--studio-border))] text-xs sm:text-sm text-[rgb(var(--studio-accent))]">
                {pricing.breakdown.filter(item => item.category === 'immediate_discount').map(item => (
                  <div key={item.policyId} className="flex justify-between">
                    <span>{getDiscountLabel(item.policyId || '', 'review', documentSnapshot) || item.name} {getDiscountById(item.policyId || '', documentSnapshot)?.eligibility.kind === 'partner' && formData.partnerName ? '(' + formData.partnerName + ')' : ''}</span>
                    <span className="font-semibold tabular-nums">-{formatKRW(Math.abs(item.amount))}</span>
                  </div>
                ))}
              </div>
            )}

            {pricing.manualAdjustmentAmount !== 0 && (
              <div className={`flex justify-between py-1 border-t border-[rgb(var(--studio-border))] ${pricing.manualAdjustmentAmount < 0 ? 'text-[rgb(var(--studio-accent))]' : 'text-[rgb(var(--studio-body))]'}`}>
                <span>{manualReason.trim() || (pricing.manualAdjustmentAmount < 0 ? '지인 특별 할인' : '수동 금액 조정')}</span>
                <span className="tabular-nums font-semibold">
                  {pricing.manualAdjustmentAmount > 0 ? '+' : ''}
                  {formatKRW(pricing.manualAdjustmentAmount)}
                </span>
              </div>
            )}

            <div className="pt-3 border-t border-[rgb(var(--studio-line))] flex justify-between items-baseline">
              <span className="font-bold text-[rgb(var(--studio-primary))] text-sm shrink-0">최종 계약금액</span>
              <span className="text-2xl font-serif font-bold text-[rgb(var(--studio-primary))] tabular-nums whitespace-nowrap shrink-0">
                {formatKRW(pricing.contractTotal)}
              </span>
            </div>
          </div>

          {/* 후기 이벤트 요약 */}
          {pricing.futureCashbackTotal > 0 && (
            <div className="p-3 bg-[rgb(var(--studio-surface))] border border-[rgb(var(--studio-line))] rounded-xl text-xs flex justify-between items-center text-[rgb(var(--studio-body))]">
              <span className="break-keep">후기 작성 확인 후 추후 캐시백 (계약금액·잔금 미차감)</span>
              <span className="font-bold text-[rgb(var(--studio-primary))] tabular-nums whitespace-nowrap shrink-0">최대 {formatKRW(pricing.futureCashbackTotal)}</span>
            </div>
          )}

          {/* 대표 수동 특약 금액 조정 카드 (상시 노출) */}
          {!isEditing && (
            <ManualAdjustmentControl
              manualAmount={manualAmount}
              manualReason={manualReason}
              targetTotalInput={targetTotalInput}
              basePlusOptionsMinusDiscounts={basePlusOptionsMinusDiscounts}
              contractTotal={pricing.contractTotal}
              onAmountChange={(amt) => setManualAmount(amt)}
              onReasonChange={(rsn) => setManualReason(rsn)}
              onTargetTotalChange={(tgt) => setTargetTotalInput(tgt)}
              onReset={() => {
                setManualAmount(0);
                setManualReason('');
                setTargetTotalInput('');
              }}
            />
          )}

          {/* 고객 입력 상세 정보 카드 (메이크업, 가족구성, 세부 요청사항, SNS) */}
          <div className="p-4 bg-[#FFFFFF] border border-[rgb(var(--studio-border))] rounded-2xl text-xs space-y-3 text-[rgb(var(--studio-body))]">
            <h4 className="font-semibold text-[rgb(var(--studio-primary))] border-b border-[rgb(var(--studio-surface))] pb-2">고객 신청 세부 정보</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {formData.makeupLocation && (
                <div className="sm:col-span-2">
                  <span className="text-[rgb(var(--studio-muted))] font-medium">메이크업: </span>
                  <span className="text-[rgb(var(--studio-primary))]">{formData.makeupLocation}</span>
                </div>
              )}
              {formData.groomFamilyMembers && (
                <div>
                  <span className="text-[rgb(var(--studio-muted))] font-medium">신랑 직계가족: </span>
                  <span className="text-[rgb(var(--studio-primary))]">{formData.groomFamilyMembers}</span>
                </div>
              )}
              {formData.brideFamilyMembers && (
                <div>
                  <span className="text-[rgb(var(--studio-muted))] font-medium">신부 직계가족: </span>
                  <span className="text-[rgb(var(--studio-primary))]">{formData.brideFamilyMembers}</span>
                </div>
              )}
              {formData.referralSource && (
                <div>
                  <span className="text-[rgb(var(--studio-muted))] font-medium">알게 된 경로: </span>
                  <span className="text-[rgb(var(--studio-primary))]">{formData.referralSource}</span>
                </div>
              )}
              {(formData.instagramId || formData.blogUrl) && (
                <div>
                  <span className="text-[rgb(var(--studio-muted))] font-medium">SNS: </span>
                  <span className="text-[rgb(var(--studio-primary))]">
                    {[formData.instagramId && `인스타 @${formData.instagramId.replace(/^@/, '')}`, formData.blogUrl && `블로그 ${formData.blogUrl}`].filter(Boolean).join(' / ')}
                  </span>
                </div>
              )}
            </div>

            {formData.shootRequestNotes && (
              <div className="pt-1">
                <span className="text-[rgb(var(--studio-muted))] font-medium block mb-0.5">촬영 시 요청사항:</span>
                <p className="bg-[rgb(var(--studio-background))] p-2 rounded border border-[rgb(var(--studio-soft-border))] text-[rgb(var(--studio-primary))] whitespace-pre-wrap">{formData.shootRequestNotes}</p>
              </div>
            )}
            {formData.retouchRequestNotes && (
              <div className="pt-1">
                <span className="text-[rgb(var(--studio-muted))] font-medium block mb-0.5">후보정 시 요청사항:</span>
                <p className="bg-[rgb(var(--studio-background))] p-2 rounded border border-[rgb(var(--studio-soft-border))] text-[rgb(var(--studio-primary))] whitespace-pre-wrap">{formData.retouchRequestNotes}</p>
              </div>
            )}
            {formData.requestNotes && (
              <div className="pt-1">
                <span className="text-[rgb(var(--studio-muted))] font-medium block mb-0.5">기타 요청사항:</span>
                <p className="bg-[rgb(var(--studio-background))] p-2 rounded border border-[rgb(var(--studio-soft-border))] text-[rgb(var(--studio-primary))] whitespace-pre-wrap">{formData.requestNotes}</p>
              </div>
            )}
          </div>
        </div>



      </div>

      {/* 발송 액션 버튼 */}
      <div className="pt-2">
        {!isEditing && !isAlreadySent && partnerVerification.message && <p role="status" className="text-sm mb-3">{partnerVerification.message}</p>}
        <button
          type="button"
          onClick={handleApproveAndSend}
          disabled={isSubmitting || isAlreadySent || (isDiscountActive('partner') && !!formData.partnerName.trim() && !formData.partnerDiscount)}
          className="w-full h-14 bg-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))] rounded-2xl text-sm font-semibold hover:bg-[rgb(var(--studio-hover))] transition-colors flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-[rgb(var(--studio-background))] border-t-transparent rounded-full animate-spin" />
              <span>계약서 PDF 생성 및 발송 중...</span>
            </div>
          ) : (
            <>
              <span>최종 계약서 발송하기</span>
              <Send className="w-4 h-4" />
            </>
          )}
        </button>
        <p className="text-center text-[11px] text-[rgb(var(--studio-muted))] mt-2">
          * 최종 발송 버튼 클릭 시 PDF가 생성되어 고객 및 대표 메일로 즉시 자동 전송됩니다.
        </p>
      </div>

        </div>
      )}

      {/* 백그라운드 계약서 렌더링 (PDF/JPG 캡처 소스: DOM 상에 상시 존재하되 화면 밖 배치) */}
      <div
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          zIndex: -100,
          pointerEvents: 'none',
          opacity: 1, // 화면 밖 배치 상태에서 100% 원본 선명도 및 텍스트 안티앨리어싱 보장
        }}
        aria-hidden="true"
      >
        <ContractDocument
          id="review-contract-doc-preview"
          contractNumber={contractNumber}
          snapshot={documentSnapshot}
          data={documentSnapshot?.data || {
            ...formData,
            manualAdjustment:
              manualAmount !== 0
                ? {
                    amount: manualAmount,
                    reason: manualReason.trim() || (manualAmount < 0 ? '지인 특별 할인' : '대표 특약 금액 조정'),
                  }
                : undefined,
          }}
          pricing={documentSnapshot?.pricing || pricing}
        />
      </div>
    </fieldset>
  );
};
