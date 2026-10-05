import { mirrorDemoCalendar, demoCalendarBookingStates } from './demoCalendarIntegration';
import { getOwnerReview, reviewIdentity } from './ownerReviewContext';
import type { OwnerBooking } from '@/types/ownerBooking';
import { getContractPolicy, getStudioConfig, getClientContent, getDiscounts, isDiscountActive, getFormSchema, getConfigurationRuntime } from '@/services/configuration';
import { normalizePartnerCode } from '@/lib/partnerCode';
import { demoSettingsCall } from './demoStudioSettings';
import { verifyContractPartner } from './verifiedPartnerDiscount';
import { mirrorDemoContract } from './demoSheetIntegration';
import { IBackendAdapter } from './backendAdapter';
import {
  SubmitContractRequest,
  SubmitContractResponse,
  ApproveAndSendRequest,
  ApproveAndSendResponse,
  SentEmailRecord,
} from '@/types/backend';
import { calculateContractPrice } from '@/lib/pricing';
import { createApprovalToken } from '@/lib/token';
import { generateContractNumber } from '@/lib/contractNumber';
import {
  isContractAlreadySent,
  getSentRecord,
  markContractAsSent,
  acquireSendLock,
  releaseSendLock,
} from '@/lib/idempotency';
import {
  generateRepresentativeNotificationEmail,
  generateCustomerContractEmail,
  generateRepresentativeSentConfirmationEmail,
} from '@/lib/emailTemplates';
import { ContractSnapshot } from '@/types/contract';
import { isDemoMode, getDemoServerConfig } from '@/lib/serverConfig';
import { canonicalForm } from '@/lib/contractValidation';
import { createSnapshot, sha256, snapshotBinding, validatePdf, configurationBinding } from '@/lib/contractWorkflow';

type DemoContract = { studioId: string; data: import('@/types/contract').ContractFormData; token: string; contractNumber: string; snapshot?: ContractSnapshot; revision: number; configurationHash: string; submittedAt: string; pricing?: import('@/types/contract').PriceCalculationResult };
// Keep the explicitly enabled Demo consistent when Next compiles another route.
// Production never reads this process-local fixture store.
const demoRuntime = globalThis as typeof globalThis & { weddingDemoContracts?: Map<string, DemoContract>; weddingDemoMailbox?: SentEmailRecord[] };
const demoContracts = demoRuntime.weddingDemoContracts ??= new Map<string, DemoContract>();
function requireDemo() {
  if (!isDemoMode()) throw new Error('서버 설정 오류: Mock은 명시적 로컬 Demo에서만 사용할 수 있습니다.');
}

// 인메모리 가상 메일함
const mockMailbox = demoRuntime.weddingDemoMailbox ??= [];

export class MockBackendAdapter implements IBackendAdapter {
  private configuration = getDemoServerConfig();
  private get repEmail() {
    return getConfigurationRuntime().revision ? getStudioConfig().representativeEmail : this.configuration.repEmail;
  }
  private appUrl = this.configuration.appUrl;

  async submitContract(req: SubmitContractRequest): Promise<SubmitContractResponse> {
    requireDemo();
    let { formData } = req;

    // 기본 필수 항목 검증
    if (!formData.groomName || !formData.brideName || !formData.email || !formData.weddingDate) {
      return {
        success: false,
        contractId: '',
        approvalToken: '',
        reviewUrl: '',
        error: '필수 예식 정보 또는 고객 정보가 누락되었습니다.',
      };
    }

    if (isDiscountActive('partner') && formData.partnerDiscount && (!formData.partnerName || !formData.partnerName.trim())) {
      return {
        success: false,
        contractId: '',
        approvalToken: '',
        reviewUrl: '',
        error: '짝꿍 할인을 선택하신 경우 짝꿍 성함을 반드시 입력해 주셔야 합니다.',
      };
    }

    // 계약 ID 생성
    let canonical;
    try { canonical = canonicalForm(formData); } catch (error) {
      return { success: false, contractId: '', approvalToken: '', reviewUrl: '', error: error instanceof Error ? error.message : '입력 오류' };
    }
    req.formData = canonical;
    await verifyContractPartner(canonical, code => this.validatePartnerCode(code));
    formData = canonical;
    const contractId = 'cnt_' + sha256(getStudioConfig().studioId + '\n' + JSON.stringify(canonical)).slice(0, 32);
    const existing = demoContracts.get(contractId);
    if (existing && existing.configurationHash !== configurationBinding()) throw new Error('접수 당시 업체 설정이 변경되었습니다.');
    if (existing) return { success: true, contractId, approvalToken: existing.token, reviewUrl: `${this.appUrl}/review?token=${existing.token}` };

    // 보안 승인 토큰 생성 (암호화 + HMAC 서명)
    const token = createApprovalToken(contractId, canonical);
    demoContracts.set(contractId, { studioId: getStudioConfig().studioId, data: canonical, token, contractNumber: generateContractNumber(canonical.weddingDate), revision: 1, configurationHash: configurationBinding(), submittedAt: new Date().toISOString() });
    const reviewUrl = `${this.appUrl}/review?token=${token}`;

    // 가격 계산
    const pricing = calculateContractPrice({
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

    // 대표 알림 이메일 렌더링 및 가상 메일함 저장
    const repMail = generateRepresentativeNotificationEmail(formData, pricing, reviewUrl);
    mockMailbox.unshift({
      id: `mail_${Date.now()}_rep`,
      to: this.repEmail,
      subject: repMail.subject,
      html: repMail.html,
      hasAttachment: false,
      sentAt: new Date().toISOString(),
      type: 'rep_notification',
    });
    const submitted = demoContracts.get(contractId)!; submitted.pricing = pricing;
    await mirrorDemoContract({ contractId, contractNumber: submitted.contractNumber, studioId: getStudioConfig().studioId, formData, pricing, submittedAt: submitted.submittedAt });

    return {
      success: true,
      contractId,
      approvalToken: token,
      reviewUrl,
      message: '신규 계약정보가 대표 메일로 정상 전달되었습니다.',
    };
  }

  async approveAndSendContract(req: ApproveAndSendRequest): Promise<ApproveAndSendResponse> {
    requireDemo();
    const { token, updatedData } = req;

    // 1. 토큰 검증 및 복호화
    let decoded;
    try {
      decoded = reviewIdentity(token);
    } catch (err: any) {
      return {
        success: false,
        contractNumber: '',
        snapshot: null as any,
        customerEmailSent: false,
        representativeEmailSent: false,
        driveSaved: false,
        error: `토큰 검증 오류: ${err.message}`,
      };
    }

    const { contractId, data: originalData } = decoded;
    const stored = demoContracts.get(contractId);
    if (stored && !isContractAlreadySent(contractId) && stored.configurationHash !== configurationBinding()) throw new Error('접수 당시 업체 설정이 변경되었습니다.');
    if (!stored || stored.studioId !== getStudioConfig().studioId || (!getOwnerReview() && stored.token !== token)) throw new Error('접수된 계약이 아닙니다.');

    // 2. 중복 발송 방지 (Idempotency 검사)
    if (isContractAlreadySent(contractId)) {
      const existing = getSentRecord(contractId)!;
      return {
        success: false,
        contractNumber: existing.contractNumber,
        snapshot: null as any,
        customerEmailSent: false,
        representativeEmailSent: false,
        driveSaved: false,
        error: `이미 발송이 완료된 계약건입니다. (발송일시: ${new Date(existing.sentAt).toLocaleString('ko-KR')}, 계약번호: ${existing.contractNumber})`,
      };
    }

    // 락 획득
    if (!acquireSendLock(contractId)) {
      return {
        success: false,
        contractNumber: '',
        snapshot: null as any,
        customerEmailSent: false,
        representativeEmailSent: false,
        driveSaved: false,
        error: '현재 발송 처리가 진행 중입니다. 잠시 후 다시 확인해 주세요.',
      };
    }

    try {
      // 3. 최종 데이터 확정 (대표가 수정한 경우 updatedData 적용)
      const finalData = canonicalForm(updatedData || (req.phase === 'send' ? stored.snapshot?.data : undefined) || stored.data || originalData, true);
      await verifyContractPartner(finalData, code => this.validatePartnerCode(code));
      if (req.phase === 'prepare') {
        if (!stored.snapshot || JSON.stringify(stored.snapshot.data) !== JSON.stringify(finalData) ||
            JSON.stringify(stored.snapshot.formSchema) !== JSON.stringify(getFormSchema())) {
          if (req.expectedRevision !== undefined && req.expectedRevision !== stored.revision) throw new Error('검토 버전이 변경되었습니다.');
          stored.snapshot = createSnapshot(contractId, stored.contractNumber, finalData);
          stored.revision++;
        }
        await mirrorDemoContract({ contractId, contractNumber: stored.contractNumber, studioId: getStudioConfig().studioId, formData: stored.data, pricing: stored.pricing!, submittedAt: stored.submittedAt, snapshot: stored.snapshot });
        await mirrorDemoCalendar({ contractId, contractNumber: stored.contractNumber, studioId: getStudioConfig().studioId, formData: stored.data, pricing: stored.pricing!, submittedAt: stored.submittedAt, snapshot: stored.snapshot }, true);
        return { success: true, contractNumber: stored.contractNumber, snapshot: stored.snapshot, snapshotHash: snapshotBinding(stored.snapshot), revision: stored.revision, customerEmailSent: false, representativeEmailSent: false, driveSaved: false };
      }
      if (req.phase === 'send') {
        if (!stored.snapshot || req.snapshotHash !== snapshotBinding(stored.snapshot)) throw new Error('확정본이 변경되었습니다.');
        if (JSON.stringify(finalData) !== JSON.stringify(stored.snapshot.data)) throw new Error('확정본과 데이터가 다릅니다.');
        validatePdf(req.pdfBase64, req.snapshotHash);
      }

      // 4. 가격 최종 계산
      const finalPricing = calculateContractPrice({
        productId: finalData.productId,
        optionIds: finalData.optionIds,
        weddingDate: finalData.weddingDate,
        partnerDiscount: finalData.partnerDiscount,
        partnerName: finalData.partnerName,
        partnerDiscountAmount: finalData.partnerDiscountAmount,
        portfolioConsent: finalData.portfolioConsent,
        reviewContractCashback: finalData.reviewContractCashback,
        reviewMainCashback: finalData.reviewMainCashback,
        manualAdjustment: finalData.manualAdjustment,
      });

      // 5. 업체 Prefix 기반 계약 식별번호 생성
      const contractNumber = stored.contractNumber;

      // 6. 계약 스냅샷 생성
      const snapshot: ContractSnapshot = req.phase === 'send' ? stored.snapshot! : {
        contractNumber,
        id: contractId,
        data: finalData,
        pricing: finalPricing,
        termsVersion: getContractPolicy().version,
        formSchema: getFormSchema(), studio: getStudioConfig(), content: getClientContent(), discounts: getDiscounts(),
        generatedAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        sentAt: new Date().toISOString(),
        status: 'sent',
      };
      snapshot.status = 'sent';
      snapshot.sentAt = new Date().toISOString();
      stored.snapshot = snapshot;

      // 7. 고객 이메일 발송 시뮬레이션 (PDF 첨부)
      const customerEmail = generateCustomerContractEmail(finalData, snapshot.pricing, contractNumber, snapshot);
      mockMailbox.unshift({
        id: `mail_${Date.now()}_cust`,
        to: finalData.email,
        subject: customerEmail.subject,
        html: customerEmail.html,
        hasAttachment: true,
        sentAt: new Date().toISOString(),
        type: 'customer_contract',
      });

      // 8. 대표 완료 이메일 발송 시뮬레이션 (PDF 첨부)
      const repConfirmEmail = generateRepresentativeSentConfirmationEmail(finalData, snapshot.pricing, contractNumber, snapshot);
      mockMailbox.unshift({
        id: `mail_${Date.now()}_rep_done`,
        to: this.repEmail,
        subject: repConfirmEmail.subject,
        html: repConfirmEmail.html,
        hasAttachment: true,
        sentAt: new Date().toISOString(),
        type: 'rep_confirmation',
      });

      // 9. 발송 완료 기록 (Idempotency 확정)
      markContractAsSent(contractId, contractNumber, finalData.email);
      await mirrorDemoContract({ contractId, contractNumber, studioId: getStudioConfig().studioId, formData: stored.data, pricing: stored.pricing!, submittedAt: stored.submittedAt, snapshot });
        await mirrorDemoCalendar({ contractId, contractNumber, studioId: getStudioConfig().studioId, formData: stored.data, pricing: stored.pricing!, submittedAt: stored.submittedAt, snapshot }, false);

      // [TODO: V1.1] Google Drive 자동 저장 및 JPG 생성 기능 활성화 예정
      // const weddingYear = finalData.weddingDate.substring(0, 4);
      // const driveFolder = `${getStudioConfig().driveFolderName}/${weddingYear}/${finalData.weddingDate}_${finalData.groomName}_${finalData.brideName}`;

      return {
        success: true,
        contractNumber,
        snapshot,
        customerEmailSent: true,
        representativeEmailSent: true,
        driveSaved: false, // V1.1에서 활성화
        message: '고객 및 대표 메일로 계약서 PDF 발송이 완료되었습니다.',
      };
    } finally {
      releaseSendLock(contractId);
    }
  }

  async getMockMailbox(): Promise<SentEmailRecord[]> {
    requireDemo();
    return [...mockMailbox];
  }

  async validatePartnerCode(code: string): Promise<import('@/types/backend').ValidatePartnerCodeResponse> {
    requireDemo();
    const trimmed = normalizePartnerCode(code || '');
    if (!trimmed) {
      return {
        success: true,
        valid: false,
        code: '',
        discountAmount: 0,
        message: '짝꿍 코드를 입력해 주세요.',
      };
    }

    const scope = getConfigurationRuntime();
    const result = await demoSettingsCall('validate_partner_code', { studioId: getStudioConfig().studioId, code: trimmed, settingsRevision: scope.revision, settingsHash: scope.settingsHash });
    return { success: true, valid: result.valid === true, code: String(result.code), discountAmount: Number(result.discountAmount) };
  }

  // 테스트 및 데모 편의 메서드
  static clearMailbox(): void {
    requireDemo();
    mockMailbox.length = 0;
    demoContracts.clear();
  }
  async reviewContract(token: string): Promise<import('@/types/backend').ReviewContractResponse> {
    requireDemo();
    const decoded = reviewIdentity(token);
    const stored = demoContracts.get(decoded.contractId);
    if (stored && !isContractAlreadySent(decoded.contractId) && stored.configurationHash !== configurationBinding()) throw new Error('접수 당시 업체 설정이 변경되었습니다.');
    if (!stored || stored.studioId !== getStudioConfig().studioId || (!getOwnerReview() && stored.token !== token)) throw new Error('접수된 계약이 아닙니다.');
    const sent = getSentRecord(decoded.contractId);
    const data = stored.snapshot?.data || stored.data;
    return { success: true, contractId: decoded.contractId, data, pricing: stored.snapshot?.pricing || calculateContractPrice(data), contractNumber: stored.contractNumber, snapshot: stored.snapshot, isAlreadySent: !!sent, sentAt: sent?.sentAt, revision: stored.revision };
  }
  static async ownerBookings(sessionId: string): Promise<OwnerBooking[]> {
    requireDemo();
    await demoSettingsCall('owner_read', { studioId: getStudioConfig().studioId, sessionId });
    const states = await demoCalendarBookingStates(getStudioConfig().studioId);
    return Array.from(demoContracts.entries()).filter(([, record]) => record.studioId === getStudioConfig().studioId).map(([contractId, record]) => {
      const data = record.snapshot?.data || record.data, pricing = record.snapshot?.pricing || record.pricing!;
      return { contractId, contractNumber: record.contractNumber, weddingDate: data.weddingDate, weddingTime: data.weddingTime, weddingVenue: data.weddingVenue, weddingHall: data.weddingHall,
        groomName: data.groomName, brideName: data.brideName, productName: record.snapshot?.product?.name || pricing.breakdown.find(line => line.category === 'base')?.name || '', contractTotal: pricing.contractTotal,
        status: isContractAlreadySent(contractId) ? 'sent' : record.snapshot ? 'approved' : 'submitted', calendarStatus: states[contractId] || 'disabled' };
    });
  }
}
