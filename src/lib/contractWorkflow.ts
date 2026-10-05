import { getContractPolicy, getProductById, getOptionById, getProducts, getOptions, getStudioConfig, getClientContent, getDiscounts, getFormSchema, getConfigurationRuntime } from '@/services/configuration';
import crypto from 'crypto';
import { ContractFormData, ContractSnapshot } from '@/types/contract';
import { calculateContractPrice } from './pricing';


export const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
export function configurationBinding(): string {
  return sha256(JSON.stringify({ studio: getStudioConfig(), products: getProducts(), options: getOptions(),
    policy: getContractPolicy(), content: getClientContent(), discounts: getDiscounts(), schema: getFormSchema(), ...(getConfigurationRuntime().revision ? { settingsRevision: getConfigurationRuntime().revision } : {}) }));
}

export function createSnapshot(id: string, contractNumber: string, data: ContractFormData): ContractSnapshot {
  const CONTRACT_POLICY_CONFIG = getContractPolicy();
  const now = new Date().toISOString();
  const snapshot: ContractSnapshot = {
    ...(getConfigurationRuntime().revision ? { settingsRevision: getConfigurationRuntime().revision, settingsHash: getConfigurationRuntime().settingsHash } : {}),
    id, contractNumber, data, pricing: calculateContractPrice(data),
    termsVersion: CONTRACT_POLICY_CONFIG.version,
    terms: JSON.parse(JSON.stringify(CONTRACT_POLICY_CONFIG)),
    product: getProductById(data.productId)!,
    options: data.optionIds.map(id => getOptionById(id)!),
    formSchema: getFormSchema(), studio: getStudioConfig(), content: getClientContent(), discounts: getDiscounts(),
    generatedAt: now, approvedAt: now, status: 'approved',
  };
  return JSON.parse(JSON.stringify(snapshot)) as ContractSnapshot;
}

export function snapshotBinding(snapshot: ContractSnapshot): string {
  // Sending state/timestamps must not change the approved document identity.
  const { sentAt: _sentAt, status: _status, ...document } = snapshot;
  return sha256(JSON.stringify(document));
}

export function validatePdf(pdf: unknown, binding: string): string {
  if (typeof pdf !== 'string' || pdf.length > 14000000) throw new Error('PDF가 누락되었거나 너무 큽니다.');
  const raw = pdf.replace(/^data:application\/pdf;(?:filename=[^;]+;)?base64,/, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) throw new Error('PDF 인코딩 오류');
  const bytes = Buffer.from(raw, 'base64');
  const text = bytes.toString('latin1');
  if (!text.startsWith('%PDF-') || !text.includes('%%EOF') || !text.includes(`contract-snapshot:${binding}`)) throw new Error('확정 계약정보와 PDF가 일치하지 않습니다. PDF를 다시 생성해 주세요.');
  return raw;
}
