import { PROTECTED_CONTRACT_FIELDS } from './formFields';
import { isValidPhone } from './contactValidation';
import type { ConfigurableFormFieldId } from '@/types/config';
import { getProductById, getOptionById, isDiscountActive, getFormSchema } from '@/services/configuration';
import { ContractFormData } from '@/types/contract';
import { calculateContractPrice, checkIsSunday } from './pricing';

export function canonicalForm(input: unknown, representative = false): ContractFormData {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('계약정보 형식이 올바르지 않습니다.');
  const source = input as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  const schema = getFormSchema();
  // Preserve canonical field order so the default client retains existing submission IDs.
  const baseFields = ['weddingDate', 'weddingTime', 'weddingVenue', 'weddingHall', 'groomName', 'groomPhone', 'brideName', 'bridePhone', 'email', 'productId'];
  const extraFields = ['makeupLocation', 'groomFamilyMembers', 'brideFamilyMembers', 'partnerName', 'shootRequestNotes', 'retouchRequestNotes', 'requestNotes', 'referralSource', 'instagramId', 'blogUrl'];
  for (const key of [...baseFields, ...extraFields]) {
    const field = schema[key as ConfigurableFormFieldId];
    const value = field?.enabled === false ? undefined : source[key];
    if (value !== undefined && typeof value !== 'string') throw new Error(`입력 형식 오류: ${key}`);
    const text = (value as string | undefined)?.trim() || '';
    if ((PROTECTED_CONTRACT_FIELDS.some(field => field === key) || (field?.enabled && field.required)) && !text) throw new Error(`필수 항목 누락: ${key}`);
    if (text.length > (key.includes('Notes') ? 2000 : 300) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) throw new Error(`입력 길이/문자 오류: ${key}`);
    result[key] = text;
  }
  const date = result.weddingDate as string;
  const parsed = new Date(date + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error('예식일이 올바르지 않습니다.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(result.weddingTime as string)) throw new Error('예식 시간이 올바르지 않습니다.');
  if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(result.email as string)) throw new Error('수신 이메일이 올바르지 않습니다.');
  for (const key of ['groomPhone', 'bridePhone']) {
    if (result[key] && !isValidPhone(result[key] as string)) throw new Error('연락처가 올바르지 않습니다.');
  }
  if (!getProductById(result.productId as string)?.active) throw new Error('유효하지 않은 상품입니다.');
  if (!Array.isArray(source.optionIds) || source.optionIds.some(id => typeof id !== 'string' || !getOptionById(id)?.active) || new Set(source.optionIds).size !== source.optionIds.length) throw new Error('유효하지 않은 옵션입니다.');
  result.optionIds = [...source.optionIds].sort();
  for (const key of ['partnerDiscount', 'portfolioConsent', 'reviewContractCashback', 'reviewMainCashback', 'termsAgreed']) {
    if (typeof source[key] !== 'boolean') throw new Error(`입력 형식 오류: ${key}`);
    result[key] = source[key];
  }
  if (source.termsAgreed !== true) throw new Error('약관 동의가 필요합니다.');
  if (!result.partnerDiscount) result.partnerName = '';
  result.sundayDiscount = checkIsSunday(date);
  if (result.partnerDiscount && isDiscountActive('partner') && !result.partnerName) throw new Error('짝꿍 정보가 필요합니다.');
  if (source.manualAdjustment !== undefined) {
    if (!representative) throw new Error('고객 제출에 대표 금액 조정을 포함할 수 없습니다.');
    const adjustment = source.manualAdjustment as { amount?: unknown; reason?: unknown };
    if (!adjustment || !Number.isSafeInteger(adjustment.amount) || Math.abs(adjustment.amount as number) > 10000000 || typeof adjustment.reason !== 'string' || !adjustment.reason.trim() || adjustment.reason.length > 300) throw new Error('금액 조정 정보가 올바르지 않습니다.');
    result.manualAdjustment = { amount: adjustment.amount, reason: adjustment.reason.trim() };
  }
  const data = result as unknown as ContractFormData;
  // Code amounts are trusted only after server verification; validate other amounts first.
  const pricing = calculateContractPrice({ ...data, partnerDiscountAmount: 0 });
  if (!Number.isSafeInteger(pricing.contractTotal) || pricing.contractTotal < pricing.depositAmount) throw new Error('계약 총액은 계약금 이상이어야 합니다.');
  return data;
}
