import type { ProductConfig, OptionConfig, DiscountDefinition } from './config';
import type { PartnerDiscountCode } from './studioSettings';

export const ownerProductFields = ['name', 'price', 'description', 'subtitle', 'includedItems', 'retouchedCount', 'additionalRetouchedCount', 'originalCount', 'albumSpec', 'coupleAlbumSummary', 'parentAlbumSummary', 'active', 'displayOrder'] as const;
export const ownerOptionFields = ['name', 'price', 'description', 'active', 'displayOrder'] as const;
export const ownerDiscountFields = ['name', 'amount', 'description', 'active'] as const;
export const ownerCodeFields = ['code', 'amount', 'active'] as const;
export type OwnerProduct = Pick<ProductConfig, typeof ownerProductFields[number]> & { id?: string };
export type OwnerOption = Pick<OptionConfig, typeof ownerOptionFields[number]> & { id?: string };
export type OwnerDiscount = Pick<DiscountDefinition, typeof ownerDiscountFields[number]> & { id: string };
export type OwnerCode = Omit<PartnerDiscountCode, 'id'> & { id?: string };
export interface OwnerSettings {
  products: OwnerProduct[];
  options: OwnerOption[];
  discounts: OwnerDiscount[];
  codes: OwnerCode[];
}
