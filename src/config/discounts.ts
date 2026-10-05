import { getDiscounts } from '@/services/configuration';
export { getDiscountById, getDiscountAmount, discountLabel } from '@/services/configuration';
export const DISCOUNTS_CONFIG = getDiscounts().map(item => ({ ...item, isImmediate: item.type === 'immediate', requiresPartnerName: item.eligibility.kind === 'partner' }));
