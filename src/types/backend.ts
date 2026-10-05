/**
 * Backend Adapter 및 API 응답 타입 정의
 */

import { ContractFormData, ContractSnapshot } from './contract';

export interface SubmitContractRequest {
  formData: ContractFormData;
}

export interface ValidatePartnerCodeRequest {
  code: string;
}

export interface ValidatePartnerCodeResponse {
  success: boolean;
  valid: boolean;
  code: string;
  discountAmount: number;
  message?: string;
  error?: string;
}

export interface SubmitContractResponse {
  success: boolean;
  contractId: string;
  approvalToken: string;
  reviewUrl: string;
  message?: string;
  error?: string;
}

export interface ReviewContractResponse {
  success: boolean;
  contractId: string;
  data: ContractFormData;
  pricing: import('./contract').PriceCalculationResult;
  isAlreadySent: boolean;
  sentAt?: string;
  contractNumber: string;
  snapshot?: ContractSnapshot;
  documentStored?: boolean;
  revision: number;
  error?: string;
}

export interface ApproveAndSendRequest {
  token: string;
  phase?: 'prepare' | 'send';
  snapshotHash?: string;
  expectedRevision?: number;
  updatedData?: ContractFormData; // 대표가 수정한 경우
  pdfBase64?: string; // 클라이언트에서 고품질 생성된 PDF
  jpgBase64?: string; // 클라이언트에서 생성된 JPG (선택적)
}

export interface ApproveAndSendResponse {
  success: boolean;
  contractNumber: string;
  snapshot: ContractSnapshot;
  customerEmailSent: boolean;
  representativeEmailSent: boolean;
  driveSaved: boolean;
  driveFolderUrl?: string;
  snapshotHash?: string;
  message?: string;
  documentStored?: boolean;
  revision?: number;
  error?: string;
}

export interface SentEmailRecord {
  id: string;
  to: string;
  subject: string;
  html: string;
  hasAttachment: boolean;
  sentAt: string;
  type: 'rep_notification' | 'customer_contract' | 'rep_confirmation';
}
