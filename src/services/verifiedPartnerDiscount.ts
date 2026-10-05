import type { ContractFormData } from '@/types/contract';
import type { ValidatePartnerCodeResponse } from '@/types/backend';
import { isDiscountActive } from './configuration';
import { normalizePartnerCode } from '@/lib/partnerCode';
import { calculateContractPrice } from '@/lib/pricing';

/** Customer-supplied amounts never enter canonicalForm. Resolve the code again on every submit/prepare. */
export async function verifyContractPartner(data: ContractFormData, validate: (code: string) => Promise<ValidatePartnerCodeResponse>) {
  if (!data.partnerDiscount) return data;
  if (!isDiscountActive('partner')) { data.partnerDiscount = false; data.partnerName = ''; return data; }
  const result = await validate(data.partnerName);
  if (!result.success || !result.valid || !Number.isSafeInteger(result.discountAmount) || result.discountAmount <= 0 || result.code !== normalizePartnerCode(data.partnerName)) {
    throw new Error('짝꿍 할인코드를 확인하지 못했습니다. 코드를 다시 확인해 주세요.');
  }
  data.partnerName = result.code;
  data.partnerDiscountAmount = result.discountAmount;
  const price = calculateContractPrice(data);
  if (price.contractTotal < price.depositAmount) throw new Error('계약 총액은 계약금 이상이어야 합니다.');
  return data;
}
