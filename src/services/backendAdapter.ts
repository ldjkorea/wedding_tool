import {
  SubmitContractRequest,
  SubmitContractResponse,
  ApproveAndSendRequest,
  ApproveAndSendResponse,
  SentEmailRecord,
} from '@/types/backend';

export interface IBackendAdapter {
  /**
   * 고객이 작성한 계약 정보 제출
   * - 대표에게 알림 메일 발송
   * - 보안 승인 토큰 및 리뷰 URL 생성
   */
  submitContract(req: SubmitContractRequest): Promise<SubmitContractResponse>;

  /**
   * 대표가 최종 검토 후 승인 및 계약서 발송
   * - 중복 발송 여부 확인 (Idempotency)
   * - 고객에게 계약서 PDF 첨부 메일 발송
   * - 대표에게 확인 메일 발송
   * - Google Drive에 PDF/JPG 자동 백업 (선택적)
   */
  approveAndSendContract(req: ApproveAndSendRequest): Promise<ApproveAndSendResponse>;
  reviewContract(token: string): Promise<import('@/types/backend').ReviewContractResponse>;

  /**
   * 짝꿍 코드 유효성 검증
   * - Google Sheet 또는 사전 정의된 짝꿍 목록에서 코드 확인
   */
  validatePartnerCode(code: string): Promise<import('@/types/backend').ValidatePartnerCodeResponse>;

  /**
   * 데모 및 테스트용: 가상 발송된 이메일 목록 확인
   */
  getMockMailbox?(): Promise<SentEmailRecord[]>;
}
