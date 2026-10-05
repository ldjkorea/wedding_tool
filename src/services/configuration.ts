import { CONFIGURABLE_FORM_FIELD_IDS } from '@/types/config';
import type { ConfigurableFormFieldId, FormSchemaConfig } from '@/types/config';
import { clientConfiguration } from '@/config/client';
import type { ClientConfiguration, ConfiguredContractPolicy, ContractPolicyConfig, DiscountConfig, DiscountItem, OptionItem, ProductItem, StudioConfig } from '@/types/config';
import type { ContractSnapshot, PriceCalculationResult } from '@/types/contract';

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(child => freeze(child));
    Object.freeze(value);
  }
  return value;
}
function unique(items: { id: string }[], label: string): void {
  if (items.some(item => !item.id.trim()) || new Set(items.map(item => item.id)).size !== items.length) throw new Error('업체 설정 오류: ' + label + ' ID');
}
function amount(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('업체 설정 오류: ' + label);
}
export function validateClientConfiguration(config: ClientConfiguration): ClientConfiguration {
  if (!config.formSchema || Object.keys(config.formSchema).some(key => !CONFIGURABLE_FORM_FIELD_IDS.includes(key as ConfigurableFormFieldId))) throw new Error('업체 설정 오류: 허용되지 않은 폼 필드');
  for (const key of CONFIGURABLE_FORM_FIELD_IDS) {
    const field = config.formSchema[key];
    if (!field || typeof field.enabled !== 'boolean' || typeof field.required !== 'boolean' ||
        typeof field.label !== 'string' || !field.label.trim() || typeof field.placeholder !== 'string' || (!field.enabled && field.required)) {
      throw new Error('업체 설정 오류: 폼 필드 ' + key);
    }
  }
  const studio = config.studioConfig;
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(studio.studioId)) throw new Error('업체 설정 오류: 업체 ID');
  try {
    const website = new URL(studio.website);
    if (website.protocol !== 'https:' || website.username || website.password) throw new Error();
  } catch { throw new Error('업체 설정 오류: HTTPS 홈페이지 주소'); }
  if (config.compatibility?.snapshots && config.compatibility.snapshots.studio.studioId !== studio.studioId) throw new Error('업체 설정 오류: 다른 업체의 과거 설정');
  if (!studio.studioId || !studio.studioName || !studio.displayName || !studio.representativeName ||
      !studio.emailSenderName || !/^[A-Z0-9][A-Z0-9_-]{0,19}$/.test(studio.contractPrefix)) throw new Error('업체 설정 오류: 업체 정보');
  for (const color of [...Object.values(studio.colors.warm), studio.colors.primary, studio.colors.secondary,
    studio.colors.primaryHover, studio.colors.subtleText, studio.colors.softBorder, studio.colors.paleBorder, studio.colors.pdfAccent]) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('업체 설정 오류: 색상');
  }
  for (const asset of [studio.logo, studio.seal]) {
    if (!asset || !(/^(\/(?!\/)|https:\/\/|data:image\/(?:png|jpeg|webp);base64,)/.test(asset))) throw new Error('업체 설정 오류: 이미지');
  }
  unique(config.productsConfig, '상품'); unique(config.optionsConfig, '옵션'); unique(config.discountsConfig, '할인');
  if (!config.productsConfig.some(item => item.active)) throw new Error('업체 설정 오류: 활성 상품');
  config.productsConfig.forEach(item => { amount(item.price, '상품 금액'); if (!Number.isFinite(item.displayOrder)) throw new Error('업체 설정 오류: 상품 순서'); });
  config.optionsConfig.forEach(item => {
    amount(item.price, '옵션 금액');
    if (item.displayOrder !== undefined && !Number.isFinite(item.displayOrder)) throw new Error('업체 설정 오류: 옵션 순서');
  });
  const conditions = new Set<string>();
  const allowedConditions = ['weekday', 'partner', 'portfolio', 'review_contract', 'review_main'];
  for (const discount of config.discountsConfig) {
    amount(discount.amount, '할인 금액');
    const reservedKind = discount.id === 'sunday' ? 'weekday' : allowedConditions.includes(discount.id) ? discount.id : undefined;
    if (reservedKind && reservedKind !== discount.eligibility.kind) throw new Error('업체 설정 오류: 할인 ID와 조건의 충돌');
    for (const order of [discount.displayOrder, discount.catalogOrder]) if (order !== undefined && !Number.isFinite(order)) throw new Error('업체 설정 오류: 할인 순서');
    if (!allowedConditions.includes(discount.eligibility.kind) || !['immediate', 'cashback'].includes(discount.type)) throw new Error('업체 설정 오류: 할인 조건/유형');
    if (conditions.has(discount.eligibility.kind)) throw new Error('업체 설정 오류: 같은 할인 조건의 중복');
    conditions.add(discount.eligibility.kind);
    if (discount.eligibility.kind === 'weekday' && (!Number.isInteger(discount.eligibility.weekday) || discount.eligibility.weekday! < 0 || discount.eligibility.weekday! > 6)) throw new Error('업체 설정 오류: 할인 요일');
    if (discount.eligibility.kind.startsWith('review_') && discount.type !== 'cashback') throw new Error('업체 설정 오류: 후기 혜택은 추후 Cashback이어야 합니다.');
  }
  const policy = config.contractPolicy;
  amount(policy.deposit.amount, '계약금');
  amount(policy.cancellation.dateChangeFee, '일정 변경 수수료');
  amount(policy.cancellation.disasterCancellationFee, '재해 취소 수수료');
  for (const tier of policy.cancellation.tiers) if (tier.rate !== null && (!Number.isFinite(tier.rate) || tier.rate < 0 || tier.rate > 100)) throw new Error('업체 설정 오류: 취소 위약금 비율');
  for (const value of [policy.payment.depositDueHours, policy.payment.balanceDueDaysBeforeWedding, policy.refund.fullRefundWindowHours,
    policy.delivery.longEdgePixels, policy.delivery.revisionRequestDays, policy.retention.months, policy.retention.backupCopies]) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error('업체 설정 오류: 계약 정책 기간/규격');
  }
  if (!policy.version || !policy.terms.length) throw new Error('업체 설정 오류: 약관');
  return freeze(config);
}
export interface ConfigurationRuntime {
  config: ClientConfiguration;
  products: ProductItem[];
  options: OptionItem[];
  discounts: DiscountConfig[];
  policy: ContractPolicyConfig & ConfiguredContractPolicy;
  revision: number;
  settingsHash: string;
}
export function createConfigurationRuntime(config: ClientConfiguration, revision = 0, settingsHash = ''): ConfigurationRuntime {
  validateClientConfiguration(config);
  const products: ProductItem[] = freeze(config.productsConfig.map(item => ({
    subtitle: '', originalCount: '', retouchedCount: 0, albumSpec: '',
    ...item, basePrice: item.price,
  })));
  const options: OptionItem[] = freeze(config.optionsConfig.map((item, index) => ({ ...item, displayOrder: item.displayOrder ?? index })));
  const discounts: DiscountConfig[] = freeze(config.discountsConfig.map((item, index) => ({
    ...item, displayOrder: item.displayOrder ?? index, description: item.description ?? item.eligibility.description ?? '',
    eligibility: { ...item.eligibility, description: item.eligibility.description ?? item.description ?? '' },
    pricingName: item.pricingName ?? item.name, pricingDescription: item.pricingDescription ?? item.description ?? '',
    labels: { form: item.name, review: item.name, pdf: item.name, summary: item.name, catalog: item.name, ...item.labels },
  })));
  return { config, products, options, discounts, policy: freeze(normalizePolicy(config.contractPolicy, config.studioConfig)), revision, settingsHash };
}
let baseRuntime: ConfigurationRuntime;
let browserRuntime: ConfigurationRuntime | undefined;
let browserBinding = '';
export function getBrowserConfigurationBinding() { return browserBinding; }
let serverResolver: (() => ConfigurationRuntime | undefined) | undefined;
export function installServerConfigurationResolver(resolver: () => ConfigurationRuntime | undefined) { serverResolver = resolver; }
export function installBrowserConfiguration(config: ClientConfiguration, binding = '') {
  if (typeof window === 'undefined') throw new Error('Browser configuration only');
  browserRuntime = createConfigurationRuntime(config);
  browserBinding = binding;
}
export function getBaseClientConfiguration() { return baseRuntime.config; }
export function getConfigurationRuntime() { return serverResolver?.() || (typeof window !== 'undefined' ? browserRuntime : undefined) || baseRuntime; }
export const formatPolicyMoney = (value: number) => value % 10000 === 0 ? value / 10000 + '만원' : value.toLocaleString('ko-KR') + '원';
export const formatPolicyDays = (value: number) => value % 7 === 0 ? value / 7 + '주일' : value + '일';

export function getStudioConfig(snapshot?: ContractSnapshot): StudioConfig {
  if (!snapshot) return getConfigurationRuntime().config.studioConfig;
  const studio = snapshot.studio || getConfigurationRuntime().config.compatibility?.snapshots?.studio;
  if (!studio || studio.studioId !== getConfigurationRuntime().config.studioConfig.studioId) throw new Error('다른 업체 또는 소유자를 확인할 수 없는 계약입니다.');
  return studio;
}
function historical<T>(snapshot: ContractSnapshot, stored: T | undefined, fallback: T | undefined): T {
  getStudioConfig(snapshot);
  if (stored === undefined && fallback === undefined) throw new Error('계약 당시 업체 설정이 없습니다. 상태 확인이 필요합니다.');
  return (stored ?? fallback)!;
}
export function getClientCompatibility() { return getConfigurationRuntime().config.compatibility; }
export function getClientContent(snapshot?: ContractSnapshot): ClientConfiguration['content'] {
  return snapshot ? historical(snapshot, snapshot.content, getConfigurationRuntime().config.compatibility?.snapshots?.content) : getConfigurationRuntime().config.content;
}
export function getFormSchema(snapshot?: ContractSnapshot): FormSchemaConfig {
  return snapshot ? historical(snapshot, snapshot.formSchema, getConfigurationRuntime().config.compatibility?.snapshots?.formSchema) : getConfigurationRuntime().config.formSchema;
}
export function getFormField(key: ConfigurableFormFieldId) { return getFormSchema()[key]; }
export function isFormFieldEnabled(key: ConfigurableFormFieldId) { return getFormField(key).enabled; }
export function isFormFieldRequired(key: ConfigurableFormFieldId) { return getFormField(key).enabled && getFormField(key).required; }
export function getDemoConfig() { return getConfigurationRuntime().config.demo; }
export function getProducts() { return getConfigurationRuntime().products.filter(item => item.active).sort((a, b) => a.displayOrder - b.displayOrder); }
export function getOptions() { return getConfigurationRuntime().options.filter(item => item.active).sort((a, b) => a.displayOrder - b.displayOrder); }
export function getDefaultProductId() { return getProducts()[0].id; }
export function getProductById(id: string) { return getConfigurationRuntime().products.find(item => item.id === id); }
export function getOptionById(id: string) { return getConfigurationRuntime().options.find(item => item.id === id); }
export function getDiscounts(snapshot?: ContractSnapshot, channel?: 'catalog'): DiscountConfig[] {
  return (snapshot ? historical(snapshot, snapshot.discounts, getConfigurationRuntime().config.compatibility?.snapshots?.discounts) : getConfigurationRuntime().discounts).filter(item => item.active).slice().sort((a, b) => channel === 'catalog' ? (a.catalogOrder ?? a.displayOrder) - (b.catalogOrder ?? b.displayOrder) : a.displayOrder - b.displayOrder);
}
export function getDiscountById(id: string, snapshot?: ContractSnapshot): DiscountItem & DiscountConfig | undefined {
  const items = snapshot ? historical(snapshot, snapshot.discounts, getConfigurationRuntime().config.compatibility?.snapshots?.discounts) : getConfigurationRuntime().discounts;
  const item = items.find(item => item.id === id) || items.find(item => item.eligibility.kind === (id === 'sunday' ? 'weekday' : id));
  return item ? { ...item, isImmediate: item.type === 'immediate', requiresPartnerName: item.eligibility.kind === 'partner' } : undefined;
}
export function getDiscountAmount(id: string, pricing?: PriceCalculationResult): number {
  const item = getDiscountById(id);
  if (pricing) {
    const line = pricing.breakdown.find(line => line.policyId === id || line.policyId === item?.id);
    return Math.abs(line?.amount || 0);
  }
  return item?.active ? item.amount : 0;
}
export function discountLabel(id: string, short = false): string {
  const value = getDiscountAmount(id);
  return short ? formatPolicyMoney(value) : value.toLocaleString('ko-KR') + '원';
}
export function getDiscountLabel(id: string, channel: keyof DiscountConfig['labels'], snapshot?: ContractSnapshot): string {
  return getDiscountById(id, snapshot)?.labels[channel] || getDiscountById(id, snapshot)?.name || '';
}
export function isDiscountActive(id: string): boolean { return !!getDiscountById(id)?.active; }
export function getPromotionDayName(): string {
  const day = getDiscountById('sunday')?.eligibility.weekday;
  return day === undefined ? '' : ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][day];
}
export function isPromotionDate(dateString?: string): boolean {
  const rule = getDiscountById('sunday');
  if (!dateString || !rule?.active) return false;
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day).getDay() === rule.eligibility.weekday;
}
export function renderConfigText(text: string, studio = getStudioConfig(), policy = getConfigurationRuntime().config.contractPolicy): string {
  const values: Record<string, string> = {
    studioName: studio.studioName, displayName: studio.displayName, friendlyName: studio.friendlyName || studio.displayName, websiteHost: studio.website.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    depositLabel: formatPolicyMoney(policy.deposit.amount), depositDueHours: String(policy.payment.depositDueHours),
    refundHours: String(policy.refund.fullRefundWindowHours), dateChangeFeeLabel: formatPolicyMoney(policy.cancellation.dateChangeFee),
    disasterFeeLabel: formatPolicyMoney(policy.cancellation.disasterCancellationFee).replace('만원', '만 원'),
    balanceDeadline: formatPolicyDays(policy.payment.balanceDueDaysBeforeWedding).replace('주일', '주'),
    retentionMonths: String(policy.retention.months), backupCopies: String(policy.retention.backupCopies),
    longEdgePixelsLabel: policy.delivery.longEdgePixels % 1000 === 0 ? policy.delivery.longEdgePixels / 1000 + '천' : policy.delivery.longEdgePixels.toLocaleString('ko-KR'),
    revisionWindow: formatPolicyDays(policy.delivery.revisionRequestDays),
    deliveryFormat: policy.delivery.format, deliveryFormatLower: policy.delivery.format.toLowerCase(),
    deliveryChannel: policy.delivery.channel, longEdgePixels: policy.delivery.longEdgePixels.toLocaleString('ko-KR'),
    cancellationTiers: policy.cancellation.tiers.map(tier => '- ' + tier.label + ' : ' + (tier.rate === null ? '계약금을 위약금으로 함' : '총 상품 금액의 ' + tier.rate + '%')).join('\n'),
  };
  const interpolate = (source: string) => source.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!(key in values)) throw new Error('업체 설정 오류: 알 수 없는 문구 변수 ' + key);
    return values[key];
  });
  values.portfolioNotice = interpolate(policy.portfolio.notice);
  values.copyrightNotice = interpolate(policy.copyright.notice);
  return interpolate(text);
}
function normalizePolicy(raw: ConfiguredContractPolicy, studio: StudioConfig): ContractPolicyConfig & ConfiguredContractPolicy {
  return {
    ...raw,
    copyright: { notice: renderConfigText(raw.copyright.notice, studio, raw) },
    portfolio: { notice: renderConfigText(raw.portfolio.notice, studio, raw) },
    defaultDepositAmount: raw.deposit.amount, imageSpec: renderConfigText(raw.delivery.imageSpec, studio, raw),
    rawFilePolicy: renderConfigText(raw.delivery.rawFilePolicy, studio, raw), deliveryTimeline: renderConfigText(raw.delivery.timeline, studio, raw),
    backupRetention: renderConfigText(raw.retention.notice, studio, raw),
    sections: raw.terms.map(section => ({ ...section, content: renderConfigText(section.content, studio, raw) })),
    privacyNotice: renderConfigText(raw.privacyNotice, studio, raw),
  };
}

export function getContractPolicy(snapshot?: ContractSnapshot): ContractPolicyConfig & ConfiguredContractPolicy {
  if (!snapshot) return getConfigurationRuntime().policy;
  const studio = getStudioConfig(snapshot);
  const legacy = getConfigurationRuntime().config.compatibility?.snapshots;
  const stored = historical(snapshot, snapshot.terms, legacy?.terms);
  const historicalPolicy = legacy ? normalizePolicy(legacy.policy, studio) : getConfigurationRuntime().policy;
  // Do not mutate the snapshot/hash or rewrite old literal terms with today's company.
  return { ...historicalPolicy, ...stored, deposit: { amount: stored.defaultDepositAmount },
    payment: 'payment' in stored ? stored.payment as ConfiguredContractPolicy['payment'] : historicalPolicy.payment,
    refund: 'refund' in stored ? stored.refund as ConfiguredContractPolicy['refund'] : historicalPolicy.refund,
  };
}
export function getThemeStyle(studio = getStudioConfig()): Record<string, string> {
  const rgb = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)).join(' ');
  const colors = studio.colors;
  const values: Record<string, string> = {
    'primary': colors.primary, 'accent': colors.secondary, 'background': colors.warm[50], 'surface': colors.warm[100],
    'border': colors.warm[200], 'line': colors.warm[300], 'highlight': colors.warm[400], 'muted': colors.warm[600],
    'body': colors.warm[700], 'deep': colors.warm[800], 'hover': colors.primaryHover, 'subtle': colors.subtleText,
    'soft-border': colors.softBorder, 'pale-border': colors.paleBorder, 'pdf-accent': colors.pdfAccent,
  };
  return Object.fromEntries(Object.entries(values).map(([key, value]) => ['--studio-' + key, rgb(value)]));
}

baseRuntime = createConfigurationRuntime(clientConfiguration);
