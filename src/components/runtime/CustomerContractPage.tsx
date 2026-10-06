'use client';
import { clearDisabledFormFields, getConfiguredFieldErrors } from '@/lib/formFields';
import { getStudioConfig, getDefaultProductId, isDiscountActive, getBrowserConfigurationBinding } from '@/services/configuration';

import React, { useState, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Header } from '@/components/ui/Header';
import { MasterEntry } from '@/components/ui/MasterEntry';
import { OwnerEntry } from '@/components/ui/OwnerEntry';
import { TermsAgreementStep } from '@/components/contract-form/TermsAgreementStep';
import { WeddingInfoSection } from '@/components/contract-form/WeddingInfoSection';
import { CustomerInfoSection } from '@/components/contract-form/CustomerInfoSection';
import { ProductSelectSection } from '@/components/contract-form/ProductSelectSection';
import { OptionSelectSection } from '@/components/contract-form/OptionSelectSection';
import { DiscountBenefitSection } from '@/components/contract-form/DiscountBenefitSection';
import { RequestNotesSection } from '@/components/contract-form/RequestNotesSection';
import { PriceSummarySticky } from '@/components/contract-form/PriceSummarySticky';
import { FinalConfirmStep } from '@/components/contract-form/FinalConfirmStep';
import { ContractFormData } from '@/types/contract';
import { calculateContractPrice } from '@/lib/pricing';
import { ArrowLeft } from 'lucide-react';
import { usePartnerCodeVerification } from '@/components/contract-form/usePartnerCodeVerification';


type ViewMode = 'home' | 'catalog' | 'terms' | 'form' | 'confirm' | 'success';
const HomeLandingView = dynamic(() => import('@/components/home/HomeLandingView').then(module => module.HomeLandingView));
const ProductCatalogView = dynamic(() => import('@/components/catalog/ProductCatalogView').then(module => module.ProductCatalogView));
const SubmissionSuccessView = dynamic(() => import('@/components/contract-form/SubmissionSuccessView').then(module => module.SubmissionSuccessView));
const TermsModal = dynamic(() => import('@/components/ui/TermsModal').then(module => module.TermsModal));

export default function CustomerContractPage() {
  const studio = getStudioConfig();
  // 화면 네비게이션 상태 (링크 접속 시 바로 약관 동의 페이지 노출)
  const [viewMode, setViewMode] = useState<ViewMode>('terms');

  // 폼 상태
  const [formData, setFormData] = useState<ContractFormData>({
    weddingDate: '',
    weddingTime: '13:00',
    weddingVenue: '',
    weddingHall: '',
    makeupLocation: '',
    groomName: '',
    groomPhone: '',
    groomFamilyMembers: '',
    brideName: '',
    bridePhone: '',
    brideFamilyMembers: '',
    email: '',
    productId: getDefaultProductId(), // 활성 상품 중 첫 번째
    optionIds: [],
    partnerDiscount: false,
    partnerName: '',
    partnerDiscountAmount: 0,
    sundayDiscount: false,
    portfolioConsent: false,
    reviewContractCashback: false,
    reviewMainCashback: false,
    shootRequestNotes: '',
    retouchRequestNotes: '',
    requestNotes: '',
    referralSource: '',
    instagramId: '',
    blogUrl: '',
    termsAgreed: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionPending = useRef(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const partnerVerification = usePartnerCodeVerification(formData.partnerName, isDiscountActive('partner'), (valid, amount) => {
    setFormData(previous => ({ ...previous, partnerDiscount: valid, partnerDiscountAmount: amount }));
  });

  // 실시간 가격 계산
  const pricing = useMemo(() => {
    return calculateContractPrice({
      productId: formData.productId,
      optionIds: formData.optionIds,
      weddingDate: formData.weddingDate,
      partnerDiscount: formData.partnerDiscount,
      partnerName: formData.partnerName,
      partnerDiscountAmount: formData.partnerDiscountAmount,
      portfolioConsent: formData.portfolioConsent,
      reviewContractCashback: formData.reviewContractCashback,
      reviewMainCashback: formData.reviewMainCashback,
      manualAdjustment: formData.manualAdjustment,
    });
  }, [formData]);

  // 필드 변경
  const handleFieldChange = (fields: Partial<ContractFormData>) => {
    setFormData((prev) => ({ ...prev, ...fields }));
    const updatedKeys = Object.keys(fields);
    setErrors((prev) => {
      const next = { ...prev };
      updatedKeys.forEach((key) => delete next[key]);
      return next;
    });
  };

  // 옵션 토글
  const handleToggleOption = (optionId: string) => {
    setFormData((prev) => {
      const exists = prev.optionIds.includes(optionId);
      return {
        ...prev,
        optionIds: exists
          ? prev.optionIds.filter((id) => id !== optionId)
          : [...prev.optionIds, optionId],
      };
    });
  };

  // 고정 핵심 정보와 업체 Form Schema를 검증한다.
  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};

    if (!formData.weddingDate) errs.weddingDate = '예식일을 선택해 주세요.';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(formData.weddingTime)) errs.weddingTime = '예식 시간은 13:00처럼 24시간 형식으로 입력해 주세요.';
    if (!formData.weddingVenue.trim()) errs.weddingVenue = '웨딩홀 명을 입력해 주세요.';

    if (!formData.groomName.trim()) errs.groomName = '신랑 성명을 입력해 주세요.';

    if (!formData.brideName.trim()) errs.brideName = '신부 성명을 입력해 주세요.';

    if (!formData.email.trim()) {
      errs.email = '계약서를 받으실 이메일을 입력해 주세요.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errs.email = '올바른 이메일 형식이 아닙니다.';
    }

    if (isDiscountActive('partner') && formData.partnerDiscount && (!formData.partnerName || !formData.partnerName.trim())) {
      errs.partnerName = '짝꿍 할인코드를 입력하고 확인해 주세요.';
    }

    if (!formData.termsAgreed) {
      errs.termsAgreed = '계약 약관 확인 및 동의는 필수입니다.';
    }

    Object.assign(errs, getConfiguredFieldErrors(formData));
    if (isDiscountActive('partner') && formData.partnerName.trim() && !formData.partnerDiscount) errs.partnerName = '할인코드를 확인하거나 입력한 코드를 지워 주세요.';
    if (!Object.keys(errs).length) setFormData(clearDisabledFormFields(formData));
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // 최종 확인 화면으로 이동
  const handleGoToConfirm = () => {
    if (validateForm()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setViewMode('confirm');
    } else {
      requestAnimationFrame(() => {
        const invalid = document.querySelector<HTMLElement>('.customer-contract [aria-invalid="true"], .customer-contract [data-invalid="true"]');
        invalid?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        invalid?.focus({ preventScroll: true });
      });
    }
  };

  // 최종 제출 (POST /api/submit-contract)
  const handleSubmit = async () => {
    if (submissionPending.current || !validateForm()) return;
    submissionPending.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/submit-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Contract-Configuration': getBrowserConfigurationBinding() },
        body: JSON.stringify(clearDisabledFormFields(formData)),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || '계약정보 제출에 실패했습니다.');
      }

      setViewMode('success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setSubmitError(err.message || '네트워크 오류가 발생했습니다.');
    } finally {
      submissionPending.current = false;
      setIsSubmitting(false);
    }
  };

  // 전체 초기화
  const handleReset = () => {
    setFormData({
      weddingDate: '',
      weddingTime: '13:00',
      weddingVenue: '',
      weddingHall: '',
      makeupLocation: '',
      groomName: '',
      groomPhone: '',
      groomFamilyMembers: '',
      brideName: '',
      bridePhone: '',
      brideFamilyMembers: '',
      email: '',
      productId: getDefaultProductId(),
      optionIds: [],
      partnerDiscount: false,
      partnerName: '',
      partnerDiscountAmount: 0,
      sundayDiscount: false,
      portfolioConsent: false,
      reviewContractCashback: false,
      reviewMainCashback: false,
      shootRequestNotes: '',
      retouchRequestNotes: '',
      referralSource: '',
      instagramId: '',
      blogUrl: '',
      requestNotes: '',
      termsAgreed: false,
    });
    setErrors({});
    setViewMode('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="customer-contract min-h-screen flex flex-col bg-[rgb(var(--studio-background))]">
      {/* 고정 브랜드 헤더 */}
      <Header ownerEntry dirty={viewMode === 'form' || viewMode === 'confirm'} />

      {/* 메인 컨텐츠 영역 */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {viewMode !== 'home' && viewMode !== 'catalog' && <nav className="customer-progress" aria-label="계약 신청 단계">
          {['약관 확인', '정보 입력', '최종 확인', '접수 완료'].map((label, index) => <span key={label} aria-current={index === ({terms:0,form:1,confirm:2,success:3} as Partial<Record<ViewMode,number>>)[viewMode] ? 'step' : undefined}><b>{index + 1}</b>{label}</span>)}
        </nav>}
        {Object.keys(errors).length > 0 && <div className="customer-error-summary" role="alert"><strong>입력 내용을 확인해 주세요.</strong><ul>{Object.entries(errors).map(([key, value]) => <li key={key}>{value}</li>)}</ul></div>}
        {submitError && <p className="customer-error-summary" role="alert">{submitError}</p>}

        {/* ========================================================
            1. 홈 화면 (Home Landing View)
            - [계약상품 구경하기] vs [계약정보 작성하기] 2대 선택 카드
        ======================================================== */}
        {viewMode === 'home' && (
          <HomeLandingView
            onSelectCatalog={() => {
              setViewMode('catalog');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSelectApply={() => {
              setViewMode('terms');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* ========================================================
            2. 상품 구경하기 화면 (Product Catalog View)
        ======================================================== */}
        {viewMode === 'catalog' && (
          <ProductCatalogView
            onBackToHome={() => {
              setViewMode('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSelectProductAndApply={(productId) => {
              handleFieldChange({ productId });
              setViewMode('terms');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* ========================================================
            3. 약관 선동의 단계 (Terms Agreement Step)
        ======================================================== */}
        {viewMode === 'terms' && (
          <TermsAgreementStep
            termsAgreed={formData.termsAgreed}
            onAgreeChange={(agreed) => handleFieldChange({ termsAgreed: agreed })}
            onProceed={() => {
              setViewMode('form');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onBackToHome={() => {
              setViewMode('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* ========================================================
            4. 계약정보 입력 폼 화면 (Form View)
        ======================================================== */}
        {viewMode === 'form' && (
          <div className="space-y-6">

            {/* 상단 네비게이션 */}
            <div className="flex items-center justify-between border-b border-[rgb(var(--studio-border))] pb-3">
              <button
                type="button"
                onClick={() => {
                  setViewMode('terms');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-[rgb(var(--studio-body))] hover:text-[rgb(var(--studio-primary))] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>약관 동의 단계로 돌아가기</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

              {/* 좌측 메인 폼 (lg:col-span-8) */}
              <div className="lg:col-span-8 space-y-8 bg-[#FFFFFF] border border-[rgb(var(--studio-border))] rounded-3xl p-6 sm:p-8 shadow-sm">

                {/* 인트로 타이틀 */}
                <div className="border-b border-[rgb(var(--studio-surface))] pb-5">
                  <span className="text-[10px] sm:text-xs font-semibold tracking-wider text-[rgb(var(--studio-muted))] uppercase">
                    APPLICATION FORM
                  </span>
                  <h2 className="text-xl sm:text-2xl font-serif font-bold text-[rgb(var(--studio-primary))] mt-1">
                    본식스냅 계약정보 작성
                  </h2>
                  <p className="text-xs sm:text-sm text-[rgb(var(--studio-body))] mt-1.5 leading-relaxed">
                    상담이 완료된 고객님께 전달드리는 전용 페이지입니다.<br className="hidden sm:inline" />
                    상담에서 확인한 예식일과 계약정보를 작성해 주세요. 대표 확인 후 정식 계약서를 이메일로 보내드립니다.
                  </p>
                </div>

                {/* 1. 예식 정보 */}
                <WeddingInfoSection
                  weddingDate={formData.weddingDate}
                  weddingTime={formData.weddingTime}
                  weddingVenue={formData.weddingVenue}
                  weddingHall={formData.weddingHall}
                  makeupLocation={formData.makeupLocation}
                  onChange={handleFieldChange}
                  errors={errors}
                />

                {/* 2. 고객 정보 */}
                <CustomerInfoSection
                  groomName={formData.groomName}
                  groomPhone={formData.groomPhone}
                  groomFamilyMembers={formData.groomFamilyMembers}
                  brideName={formData.brideName}
                  bridePhone={formData.bridePhone}
                  brideFamilyMembers={formData.brideFamilyMembers}
                  email={formData.email}
                  onChange={handleFieldChange}
                  errors={errors}
                />

                {/* 3. 상품 선택 */}
                <ProductSelectSection
                  selectedProductId={formData.productId}
                  onSelect={(id) => handleFieldChange({ productId: id })}
                />

                {/* 4. 추가 옵션 */}
                <OptionSelectSection
                  selectedOptionIds={formData.optionIds}
                  onToggleOption={handleToggleOption}
                />

                {/* 5. 할인 및 혜택 */}
                <DiscountBenefitSection
                  isSunday={pricing.dateDiscountEligible ?? pricing.isSunday}
                  partnerDiscount={formData.partnerDiscount}
                  partnerName={formData.partnerName}
                  verification={partnerVerification}
                  portfolioConsent={formData.portfolioConsent}
                  reviewContractCashback={formData.reviewContractCashback}
                  reviewMainCashback={formData.reviewMainCashback}
                  onChange={handleFieldChange}
                  errors={errors}
                />

                {/* 6. 요청사항 */}
                <RequestNotesSection
                  shootRequestNotes={formData.shootRequestNotes}
                  retouchRequestNotes={formData.retouchRequestNotes}
                  referralSource={formData.referralSource}
                  instagramId={formData.instagramId}
                  blogUrl={formData.blogUrl}
                  requestNotes={formData.requestNotes}
                  termsAgreed={formData.termsAgreed}
                  onOpenTermsModal={() => setIsTermsOpen(true)}
                  onChange={handleFieldChange}
                  errors={errors}
                />

                {/* 다음 버튼 */}
                <div className="pt-4 border-t border-[rgb(var(--studio-surface))]">
                  <button
                    type="button"
                    onClick={handleGoToConfirm}
                    className="hidden sm:flex w-full h-14 bg-[rgb(var(--studio-primary))] text-[rgb(var(--studio-background))] rounded-2xl text-sm sm:text-base font-semibold hover:bg-[rgb(var(--studio-hover))] transition-colors shadow-sm items-center justify-center gap-2"
                  >
                    <span>계약 내용 최종 확인하기</span>
                    <span>&rarr;</span>
                  </button>
                </div>

              </div>

              {/* 우측 Sticky 실시간 금액 요약 */}
              <div className="hidden lg:block lg:col-span-4 sticky top-24">
                <PriceSummarySticky
                  pricing={pricing}
                  onProceed={handleGoToConfirm}
                  proceedLabel="최종 확인하기"
                />
              </div>

              {/* 모바일 전용 하단 고정 바 */}
              <div className="lg:hidden">
                <PriceSummarySticky
                  inlineAction={false}
                  pricing={pricing}
                  onProceed={handleGoToConfirm}
                  proceedLabel="최종 확인하기"
                />
              </div>

            </div>
          </div>
        )}

        {/* ========================================================
            5. 최종 확인 화면 (Confirm Step)
        ======================================================== */}
        {viewMode === 'confirm' && (
          <FinalConfirmStep
            formData={formData}
            pricing={pricing}
            onBack={() => {
              setViewMode('form');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            isVerifyingCode={partnerVerification.status === 'checking'}
          />
        )}

        {/* ========================================================
            6. 제출 완료 화면 (Success View)
        ======================================================== */}
        {viewMode === 'success' && (
          <SubmissionSuccessView
            email={formData.email}
            onHome={handleReset}
          />
        )}

      </main>

      {/* 공통 푸터 */}
      <footer className="border-t border-[rgb(var(--studio-border))] py-10 mt-12 bg-[rgb(var(--studio-background))] text-center text-xs text-[rgb(var(--studio-muted))]">
        <div className="max-w-3xl mx-auto px-4 flex flex-col items-center space-y-3">
          {/* 업체 로고 */}
          <OwnerEntry dirty={viewMode === 'form' || viewMode === 'confirm'}><img
            src={studio.logo}
            alt={studio.displayName + " Photography Logo"}
            className="h-9 sm:h-11 w-auto object-contain select-none opacity-85 hover:opacity-100 transition-opacity"
          /></OwnerEntry>
          <div className="space-y-1">
            <p className="font-semibold text-[rgb(var(--studio-primary))] text-xs sm:text-sm">{studio.brandTagline}</p>
            <div className="text-[11px] text-[rgb(var(--studio-subtle))]">
              <MasterEntry dirty={viewMode === 'form' || viewMode === 'confirm'}>Copyright &copy; {new Date().getFullYear()} {studio.displayName}. All rights reserved.</MasterEntry>
            </div>
          </div>
        </div>
      </footer>

      {/* 약관 전문 열람 모달 */}
      {isTermsOpen && <TermsModal isOpen onClose={() => setIsTermsOpen(false)} />}
    </div>
  );
}
