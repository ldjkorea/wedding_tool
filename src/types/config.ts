export const CONFIGURABLE_FORM_FIELD_IDS = [
  'groomPhone', 'bridePhone', 'weddingHall', 'makeupLocation',
  'groomFamilyMembers', 'brideFamilyMembers',
  'shootRequestNotes', 'retouchRequestNotes', 'requestNotes',
  'referralSource', 'instagramId', 'blogUrl',
] as const;
export type ConfigurableFormFieldId = typeof CONFIGURABLE_FORM_FIELD_IDS[number];
export interface FormFieldConfig {
  enabled: boolean;
  required: boolean;
  label: string;
  placeholder: string;
}
export type FormSchemaConfig = Record<ConfigurableFormFieldId, FormFieldConfig>;

/**
 * 업체 중앙 설정 관련 타입 정의
 */

export interface ProductPlusBenefit {
  title: string;
  detail: string;
  badge?: string;
}

export interface ProductItem {
  id: string;
  name: string;
  shortName?: string;
  catalogTag?: string;
  includedHeading?: string;
  premiumHeading?: string;
  upgradeHeading?: string;
  subtitle: string;
  basePrice: number;
  description: string;
  shootScope?: string;
  includedItems: string[];
  originalCount: string;
  retouchedCount: number;
  additionalRetouchedCount?: number;
  additionalOriginalCount?: number;
  coupleAlbumSummary?: string;
  parentAlbumSummary?: string;
  mobilePlusItems?: string[];
  albumSpec: string;
  active: boolean;
  displayOrder: number;
  badge?: string;
  isPlusPackage?: boolean;
  baseIncludedNotice?: string;
  plusBenefits?: ProductPlusBenefit[];
}

export interface OptionItem {
  id: string;
  name: string;
  shortName?: string;
  subtitle?: string;
  price: number;
  description: string;
  active: boolean;
  displayOrder: number;
}

export type DiscountType = string;

/** Public, build-time configuration. Server secrets and resource IDs stay in the environment. */
export interface StudioConfig {
  studioId: string;
  studioName: string;
  businessInformation?: string;
  displayName: string;
  friendlyName?: string;
  representativeName: string;
  representativeEmail: string;
  representativePhone: string;
  website: string;
  logo: string;
  seal: string;
  contractPrefix: string;
  brandTagline: string;
  emailSenderName: string;
  driveFolderName: string;
  bookingName: string;
  photographyLabel: string;
  contactChannel: string;
  colors: {
    primary: string;
    secondary: string;
    warm: Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, string>;
    primaryHover: string;
    subtleText: string;
    softBorder: string;
    paleBorder: string;
    pdfAccent: string;
  };
}

export type ProductConfig = Pick<ProductItem, 'id' | 'name' | 'description' | 'includedItems' | 'active' | 'displayOrder'>
  & Partial<Omit<ProductItem, 'id' | 'name' | 'description' | 'includedItems' | 'active' | 'displayOrder' | 'basePrice'>>
  & { price: number; shortName?: string; catalogTag?: string; includedHeading?: string; premiumHeading?: string; upgradeHeading?: string };

export type OptionConfig = Omit<OptionItem, 'displayOrder'> & { displayOrder?: number };

export type DiscountEligibility = 'weekday' | 'partner' | 'portfolio' | 'review_contract' | 'review_main';
export interface DiscountConfig {
  id: string;
  name: string;
  amount: number;
  type: 'immediate' | 'cashback';
  eligibility: { kind: DiscountEligibility; weekday?: number; description: string };
  active: boolean;
  displayOrder: number;
  description: string;
  catalogOrder?: number;
  pricingName: string;
  pricingDescription: string;
  labels: { form: string; review: string; pdf: string; summary: string; catalog: string; email?: string };
}
export type DiscountDefinition = Pick<DiscountConfig, 'id' | 'name' | 'amount' | 'type' | 'active'>
  & { eligibility: { kind: DiscountEligibility; weekday?: number; description?: string } }
  & Partial<Omit<DiscountConfig, 'id' | 'name' | 'amount' | 'type' | 'active' | 'eligibility' | 'labels'>>
  & { labels?: Partial<DiscountConfig['labels']> };

export interface ConfiguredContractPolicy {
  version: string;
  deposit: { amount: number };
  payment: { depositDueHours: number; balanceDueDaysBeforeWedding: number; taxLabel: string };
  cancellation: { dateChangeFee: number; disasterCancellationFee: number; tiers: { label: string; rate: number | null }[]; summary: string[] };
  refund: { fullRefundWindowHours: number; afterWindowNotice: string };
  delivery: { format: string; longEdgePixels: number; channel: string; revisionRequestDays: number; imageSpec: string; timeline: string; rawFilePolicy: string; summaryTrigger: string };
  retention: { months: number; backupCopies: number; notice: string };
  copyright: { notice: string };
  portfolio: { notice: string };
  terms: PolicySection[];
  privacyNotice: string;
}
export interface ClientConfiguration {
  /** Compatibility belongs to this client only; never load another client's history. */
  compatibility?: {
    legacySubmissionIds?: boolean;
    legacyApprovalTokens?: boolean;
    representativeEmailAliases?: string[];
    snapshots?: {
      studio: StudioConfig;
      policy: ConfiguredContractPolicy;
      terms: ContractPolicyConfig;
      content: ClientConfiguration['content'];
      formSchema: FormSchemaConfig;
      discounts: DiscountConfig[];
    };
  };
  formSchema: FormSchemaConfig;
  studioConfig: StudioConfig;
  productsConfig: ProductConfig[];
  optionsConfig: OptionConfig[];
  discountsConfig: DiscountDefinition[];
  contractPolicy: ConfiguredContractPolicy;
  content: {
    catalogIntro: [string, string];
    homeDiscountSummary: string;
    portfolioDescription: string;
    commonProductHeading: string;
    commonShootItems: [string, string];
    pdfShootScope: string;
    reviewProofChannel: string;
    reviewRetentionMonths: number;
    reviewContractChannelNotice: string;
    reviewMainNotice: string;
    cashbackPaymentNotice: string;
    referralOptions: string[];
    makeupNotice: string;
    manualDiscountReason: string;
    manualAdjustmentReason: string;
    metadata: { title: string; description: string };
  };
  demo: { representativeEmail: string; previewCoupleLabel: string };
}


export interface DiscountItem {
  id: DiscountType;
  name: string;
  amount: number;
  description: string;
  active: boolean;
  isImmediate: boolean; // 즉시 할인 여부 (true: 계약금액 차감, false: 사후 페이백)
  requiresPartnerName?: boolean;
}

export interface PolicySection {
  id: string;
  title: string;
  content: string;
}

export interface ContractPolicyConfig {
  version: string;
  defaultDepositAmount: number;
  imageSpec: string;
  rawFilePolicy: string;
  deliveryTimeline: string;
  backupRetention: string;
  sections: PolicySection[];
  privacyNotice?: string;
}
