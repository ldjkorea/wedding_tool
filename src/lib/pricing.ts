import { getProductById, getOptionById, getDefaultProductId, getDiscounts, getContractPolicy, isPromotionDate } from '@/services/configuration';
import type { PriceCalculationResult, PriceBreakdownItem } from '@/types/contract';

export interface CalculatePriceParams {
  productId: string;
  optionIds?: string[];
  weddingDate?: string;
  partnerDiscount?: boolean;
  partnerName?: string;
  partnerDiscountAmount?: number;
  portfolioConsent?: boolean;
  reviewContractCashback?: boolean;
  reviewMainCashback?: boolean;
  manualAdjustment?: { amount: number; reason: string };
}
export function checkIsSunday(dateString?: string): boolean {
  if (!dateString) return false;
  const parts = dateString.split('-');
  if (parts.length !== 3) return false;
  const [year, month, day] = parts.map(Number);
  return new Date(year, month - 1, day).getDay() === 0;
}

/** One pricing engine for the client catalog. Cashback never reduces the contract. */
export function calculateContractPrice(params: CalculatePriceParams): PriceCalculationResult {
  const product = getProductById(params.productId) || getProductById(getDefaultProductId())!;
  const basePrice = product.basePrice;
  const breakdown: PriceBreakdownItem[] = [{ category: 'base', name: product.name, amount: basePrice, description: product.subtitle }];
  let optionTotal = 0;
  for (const id of params.optionIds || []) {
    const option = getOptionById(id);
    if (option?.active) {
      optionTotal += option.price;
      breakdown.push({ category: 'option', name: option.name, amount: option.price, description: option.description });
    }
  }
  const dateDiscountEligible = isPromotionDate(params.weddingDate);
  const eligible = {
    weekday: dateDiscountEligible, partner: !!params.partnerDiscount, portfolio: !!params.portfolioConsent,
    review_contract: !!params.reviewContractCashback, review_main: !!params.reviewMainCashback,
  };
  let immediateDiscountTotal = 0;
  let futureCashbackTotal = 0;
  const cashbackLines: PriceBreakdownItem[] = [];
  for (const discount of getDiscounts()) {
    if (!eligible[discount.eligibility.kind]) continue;
    const cashback = discount.type === 'cashback';
    // Historical callers without this field retain v1 calculations. New contract data
    // receives this amount only after server verification; customer input is ignored.
    const discountAmount = discount.eligibility.kind === 'partner' && params.partnerDiscountAmount !== undefined
      ? params.partnerDiscountAmount : discount.amount;
    if (!Number.isSafeInteger(discountAmount) || discountAmount < 0) throw new Error('할인 금액이 올바르지 않습니다.');
    const line: PriceBreakdownItem = {
      category: cashback ? 'future_cashback' : 'immediate_discount', name: discount.pricingName,
      policyId: discount.id, amount: cashback ? discountAmount : -discountAmount, description: discount.pricingDescription,
    };
    if (cashback) { futureCashbackTotal += discountAmount; cashbackLines.push(line); }
    else { immediateDiscountTotal += discountAmount; breakdown.push(line); }
  }
  const manualAdjustmentAmount = params.manualAdjustment?.amount || 0;
  if (manualAdjustmentAmount !== 0) breakdown.push({
    category: 'manual_adjustment', name: params.manualAdjustment?.reason || '대표 수동 금액 조정',
    amount: manualAdjustmentAmount, description: params.manualAdjustment?.reason,
  });
  breakdown.push(...cashbackLines);
  const contractTotal = Math.max(0, basePrice + optionTotal - immediateDiscountTotal + manualAdjustmentAmount);
  const depositAmount = getContractPolicy().deposit.amount;
  return {
    basePrice, optionTotal, immediateDiscountTotal, manualAdjustmentAmount, contractTotal, depositAmount,
    balanceAmount: Math.max(0, contractTotal - depositAmount), futureCashbackTotal, breakdown,
    isSunday: checkIsSunday(params.weddingDate), dateDiscountEligible,
  };
}
export function formatKRW(amount: number): string { return amount.toLocaleString('ko-KR') + '원'; }
