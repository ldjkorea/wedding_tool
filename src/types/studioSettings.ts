import type { ClientConfiguration } from './config';

/** Whole editable document. Infrastructure and client compatibility never cross this boundary. */
export type PublicStudioSettings = Pick<ClientConfiguration,
  'studioConfig' | 'productsConfig' | 'optionsConfig' | 'discountsConfig' | 'contractPolicy' | 'formSchema' | 'content'>;
export type StudioSettings = PublicStudioSettings & {
    /** Private administrator data. Never compose into the public ClientConfiguration. */
    partnerCodes?: PartnerDiscountCode[];
  };
export interface PartnerDiscountCode {
  id: string;
  code: string;
  amount: number;
  active: boolean;
}
export interface SettingsRevision {
  schemaVersion: 1;
  studioId: string;
  revision: number;
  updatedAt: string;
  actor?: 'owner' | 'master' | 'legacy';
  hash: string;
  settings: StudioSettings;
}
export interface SettingsHead {
  recoveryRequired?: boolean;
  revision?: number;
  current: SettingsRevision | null;
  history: { revision: number; updatedAt: string; hash: string; actor?: 'owner' | 'master' | 'legacy' }[];
}
