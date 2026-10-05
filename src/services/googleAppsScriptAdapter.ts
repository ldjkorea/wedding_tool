import { getStudioConfig, getClientCompatibility, getConfigurationRuntime } from '@/services/configuration';
import { getOwnerReview, reviewIdentity } from './ownerReviewContext';
import { verifyContractPartner } from './verifiedPartnerDiscount';
import crypto from 'crypto';
import { signedGasCall, type GasResult } from './gasTransport';
import { IBackendAdapter } from './backendAdapter';
import { SubmitContractRequest, SubmitContractResponse, ApproveAndSendRequest, ApproveAndSendResponse, ValidatePartnerCodeResponse, ReviewContractResponse } from '@/types/backend';
import { ContractSnapshot } from '@/types/contract';
import { MockBackendAdapter } from './mockBackendAdapter';
import { getAppSecret, getServerConfig, getBackendMode } from '@/lib/serverConfig';
import { canonicalForm } from '@/lib/contractValidation';
import { createApprovalToken, verifyApprovalToken } from '@/lib/token';
import { createSnapshot, sha256, snapshotBinding, validatePdf, configurationBinding } from '@/lib/contractWorkflow';
import { calculateContractPrice } from '@/lib/pricing';
import { generateRepresentativeNotificationEmail, generateCustomerContractEmail, generateRepresentativeSentConfirmationEmail } from '@/lib/emailTemplates';

export class GoogleAppsScriptAdapter implements IBackendAdapter {
  constructor(private webAppUrl: string) {}
  private async call(action: string, payload: unknown): Promise<GasResult> {
    const scope = getConfigurationRuntime();
    return signedGasCall(action, { ...(payload as Record<string, unknown>),
      ...(['review_contract', 'prepare_contract', 'approve_and_send'].includes(action) && getOwnerReview() ? { ownerSessionId: getOwnerReview()!.sessionId } : {}),
      ...(scope.settingsHash || scope.revision ? { settingsRevision: scope.revision, settingsHash: scope.settingsHash } : {}) }, this.webAppUrl);
  }

  private async checkPartner(data: SubmitContractRequest['formData']) {
    await verifyContractPartner(data, code => this.validatePartnerCode(code));
  }
  async submitContract(req: SubmitContractRequest): Promise<SubmitContractResponse> {
    const data = canonicalForm(req.formData);
    await this.checkPartner(data);
    const config = getServerConfig();
    // Only this client's opt-in preserves its previously issued IDs. New clients are namespaced.
    const identity = (getClientCompatibility()?.legacySubmissionIds ? '' : getStudioConfig().studioId + '\n') + JSON.stringify(data);
    const contractId = 'cnt_' + crypto.createHmac('sha256', getAppSecret()).update(identity).digest('hex').slice(0, 32);
    const lookup = await this.call('find_contract', { contractId });
    if (lookup.record) {
      const record = lookup.record as { accepted?: boolean; contractId?: string; status?: string; tokenExpiresAt?: number; studioId?: string; configurationHash?: string };
      if (record.studioId !== getStudioConfig().studioId) throw new Error('다른 업체의 접수 응답입니다.');
      if (record.status !== 'sent' && record.configurationHash !== configurationBinding()) throw new Error('접수 당시 업체 정책을 확인할 수 없거나 변경되었습니다. 대표에게 상태 확인을 요청해 주세요.');
      if (record.accepted !== true || record.contractId !== contractId) throw new Error('접수 조회 응답 오류');
      if (!record.status || !['submitted', 'approved', 'sent'].includes(record.status) || !Number.isFinite(record.tokenExpiresAt)) throw new Error('접수 상태 응답 오류');
      if (record.status !== 'sent' && Date.now() >= record.tokenExpiresAt!) throw new Error('기존 접수의 승인 기한이 만료되었습니다. 대표에게 상태 확인을 요청해 주세요.');
      return { success: true, contractId, approvalToken: '', reviewUrl: '', message: '이미 접수된 계약정보입니다.' };
    }
    const token = createApprovalToken(contractId, data);
    const reviewUrl = `${config.appUrl}/review?token=${encodeURIComponent(token)}`;
    const contractNumber = `${getStudioConfig().contractPrefix}-${data.weddingDate.replace(/-/g, '')}-${contractId.slice(4).toUpperCase()}`;
    const pricing = calculateContractPrice(data);
    const notification = generateRepresentativeNotificationEmail(data, pricing, reviewUrl);
    const result = await this.call('submit_contract', { contractId, formData: data, pricing, configurationHash: configurationBinding(), contractNumber, tokenHash: sha256(token), tokenExpiresAt: verifyApprovalToken(token).exp, repEmail: getConfigurationRuntime().revision ? getStudioConfig().representativeEmail : config.repEmail, studio: { ...getStudioConfig(), representativeEmail: getConfigurationRuntime().revision ? getStudioConfig().representativeEmail : config.repEmail }, notification });
    if (result.accepted !== true || result.contractId !== contractId) throw new Error('백엔드 접수 확인 실패');
    return { success: true, contractId, approvalToken: '', reviewUrl: '', message: '계약정보가 접수되었습니다.' };
  }
  async reviewContract(token: string): Promise<ReviewContractResponse> {
    const decoded = reviewIdentity(token);
    const result = await this.call('review_contract', { contractId: decoded.contractId, tokenHash: sha256(token) });
    const record = result.record as { studioId?: string; configurationHash?: string; formData: SubmitContractRequest['formData']; pricing: ReviewContractResponse['pricing']; contractNumber: string; snapshot?: ContractSnapshot; status: string; sentAt?: string; documentStored?: boolean; revision: number };
    if (record?.studioId !== getStudioConfig().studioId || (record.snapshot && getStudioConfig(record.snapshot).studioId !== record.studioId)) throw new Error('다른 업체의 계약 조회 응답입니다.');
    if (!record || !record.formData || !record.pricing || !record.contractNumber || !Number.isSafeInteger(record.revision)) throw new Error('계약 조회 응답 오류');
    if (!record.contractNumber.startsWith(getStudioConfig().contractPrefix + '-') || !/^[A-Z0-9_-]+-\d{8}-[A-Z0-9]{4,32}$/.test(record.contractNumber)) throw new Error('계약 업체 번호가 올바르지 않습니다.');
    if (record.status !== 'sent' && record.configurationHash !== configurationBinding()) throw new Error('접수 당시 업체 정책을 확인할 수 없거나 변경되었습니다. 기존 계약 상태를 확인해 주세요.');
    return { success: true, contractId: decoded.contractId, data: record.snapshot?.data || record.formData, pricing: record.snapshot?.pricing || record.pricing, snapshot: record.snapshot, contractNumber: record.contractNumber, isAlreadySent: record.status === 'sent', sentAt: record.sentAt, documentStored: record.documentStored === true, revision: record.revision };
  }
  async approveAndSendContract(req: ApproveAndSendRequest): Promise<ApproveAndSendResponse> {
    const decoded = reviewIdentity(req.token);
    const review = await this.reviewContract(req.token);
    if (review.isAlreadySent) throw new Error('이미 발송된 계약입니다.');
    const auth = { contractId: decoded.contractId, tokenHash: sha256(req.token) };
    if (req.phase === 'prepare') {
      const data = canonicalForm(req.updatedData || review.data, true);
      await this.checkPartner(data);
      const snapshot = createSnapshot(decoded.contractId, review.contractNumber, data);
      const result = await this.call('prepare_contract', { ...auth, expectedRevision: req.expectedRevision ?? review.revision, snapshot, snapshotHash: snapshotBinding(snapshot) });
      const stored = result.snapshot as ContractSnapshot;
      if (!stored || result.snapshotHash !== snapshotBinding(stored)) throw new Error('확정본 응답 오류');
      return { success: true, contractNumber: stored.contractNumber, snapshot: stored, snapshotHash: result.snapshotHash as string, revision: result.revision as number, documentStored: result.documentStored === true, customerEmailSent: false, representativeEmailSent: false, driveSaved: false };
    }
    const snapshot = review.snapshot;
    if (!snapshot || req.snapshotHash !== snapshotBinding(snapshot)) throw new Error('확정본이 변경되었습니다. 다시 확인해 주세요.');
    if (req.updatedData) {
      const finalData = canonicalForm(req.updatedData, true);
      await this.checkPartner(finalData);
      if (JSON.stringify(finalData) !== JSON.stringify(snapshot.data)) throw new Error('발송 데이터가 확정본과 다릅니다.');
    }
    const pdfBase64 = review.documentStored ? undefined : validatePdf(req.pdfBase64, req.snapshotHash);
    const result = await this.call('approve_and_send', {
      ...auth, snapshotHash: req.snapshotHash, pdfBase64,
      customerMail: generateCustomerContractEmail(snapshot.data, snapshot.pricing, snapshot.contractNumber, snapshot),
      representativeMail: generateRepresentativeSentConfirmationEmail(snapshot.data, snapshot.pricing, snapshot.contractNumber, snapshot),
    });
    const sentSnapshot = result.snapshot as ContractSnapshot | undefined;
    if (result.customerEmailSent !== true || result.representativeEmailSent !== true || result.driveSaved !== true || result.contractNumber !== snapshot.contractNumber ||
        !sentSnapshot || sentSnapshot.status !== 'sent' || !sentSnapshot.sentAt || snapshotBinding(sentSnapshot) !== req.snapshotHash) throw new Error('일부 처리가 완료되지 않았습니다. 발송 상태를 확인해 주세요.');
    return result as unknown as ApproveAndSendResponse;
  }
  async validatePartnerCode(code: string): Promise<ValidatePartnerCodeResponse> {
    try {
      const result = await this.call('validate_partner_code', { code });
      if (typeof result.valid !== 'boolean' || typeof result.discountAmount !== 'number') throw new Error('짝꿍 응답 오류');
      if (typeof result.code !== 'string' || !Number.isSafeInteger(result.discountAmount) || result.discountAmount < 0 || (!result.valid && result.discountAmount !== 0)) throw new Error('짝꿍 응답 오류');
      return { success: true, valid: result.valid, discountAmount: result.discountAmount, code: result.code };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('서버 설정')) throw error;
      return { success: false, valid: false, discountAmount: 0, code, error: '짝꿍 검증 서버에 연결하지 못했습니다.' };
    }
  }
}
let demoAdapter: IBackendAdapter | undefined;
export function getBackendAdapter(): IBackendAdapter {
  if (getBackendMode() === 'demo') return demoAdapter ??= new MockBackendAdapter();
  const config = getServerConfig();
  return new GoogleAppsScriptAdapter(config.gasUrl);
}
