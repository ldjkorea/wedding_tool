import { createConfigurationRuntime, getBaseClientConfiguration, renderConfigText } from './configuration';
import type { StudioSettings } from '@/types/studioSettings';
import type { ClientConfiguration, ProductConfig, OptionConfig, DiscountDefinition } from '@/types/config';
import { normalizePartnerCode, isPartnerCodeFormat } from '@/lib/partnerCode';

export const editableSections = ['studioConfig', 'productsConfig', 'optionsConfig', 'discountsConfig', 'contractPolicy', 'formSchema', 'content'] as const;
export function baseSettings(): StudioSettings {
  const base = getBaseClientConfiguration();
  const document = Object.fromEntries(editableSections.map(key => [key, base[key]])) as unknown as StudioSettings;
  return JSON.parse(JSON.stringify({ ...document, discountsConfig: createConfigurationRuntime(base).discounts, partnerCodes: [] }));
}
export function composeConfiguration(settings: StudioSettings): ClientConfiguration {
  const publicSettings = Object.fromEntries(editableSections.map(key => [key, settings[key]]));
  return { ...getBaseClientConfiguration(), ...publicSettings } as ClientConfiguration;
}
function fail(message: string): never { throw new Error('설정 검증: ' + message); }
function text(value: unknown, label: string, required = true, max = 10000): asserts value is string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail(label);
}
function money(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 100000000) fail(label);
}
/** Reject unexpected nested keys as well as infrastructure injected at the root. */
function shape(value: unknown, sample: unknown, path: string): void {
  if (Array.isArray(sample)) {
    if (!Array.isArray(value) || value.length > 100) fail(path + ' 목록');
    value.forEach(item => shape(item, sample[0], path)); return;
  }
  if (sample && typeof sample === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path);
    let required = Object.keys(sample);
    if (path === '설정') required = required.filter(key => key !== 'partnerCodes'); // Existing revisions remain readable.
    if (path === '설정.studioConfig') required = Object.keys(getBaseClientConfiguration().studioConfig).filter(key => key !== 'friendlyName' && key !== 'businessInformation');
    if (path === '설정.productsConfig') required = ['id', 'name', 'price', 'description', 'includedItems', 'active', 'displayOrder'];
    if (path === '설정.optionsConfig') required = ['id', 'name', 'price', 'description', 'active'];
    if (path === '설정.discountsConfig') required = ['id', 'name', 'amount', 'type', 'eligibility', 'active'];
    if (path === '설정.discountsConfig.eligibility') required = ['kind'];
    if (path === '설정.discountsConfig.labels' || path === '설정.productsConfig.plusBenefits') required = path.endsWith('plusBenefits') ? ['title', 'detail'] : [];
    if (required.some(key => !Object.hasOwn(value, key))) fail(path + ' 필수 설정 항목 누락');
    for (const [key, child] of Object.entries(value)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype' || !Object.hasOwn(sample, key)) fail(path + '.' + key + ' 허용되지 않은 항목');
      shape(child, (sample as Record<string, unknown>)[key], path + '.' + key);
    }
    return;
  }
  if (path.endsWith('.rate') && value === null) return;
  if (sample === null && (value === null || (typeof value === 'number' && Number.isFinite(value)))) return;
  if (typeof value !== typeof sample || (typeof value === 'number' && !Number.isFinite(value))) fail(path + ' 자료형');
  if (typeof value === 'string') text(value, path, false, /\.(logo|seal)$/.test(path) ? 420000 : 10000);
}
const productShape: ProductConfig = {
  id: '', name: '', price: 0, description: '', includedItems: [''], active: true, displayOrder: 0,
  shortName: '', catalogTag: '', includedHeading: '', premiumHeading: '', upgradeHeading: '', subtitle: '',
  originalCount: '', retouchedCount: 0, additionalRetouchedCount: 0, additionalOriginalCount: 0,
  coupleAlbumSummary: '', parentAlbumSummary: '', mobilePlusItems: [''], albumSpec: '', badge: '',
  isPlusPackage: false, baseIncludedNotice: '', shootScope: '', plusBenefits: [{ title: '', detail: '', badge: '' }],
};
const optionShape: OptionConfig = { id: '', name: '', shortName: '', subtitle: '', price: 0, description: '', active: true, displayOrder: 0 };
const discountShape: DiscountDefinition = {
  id: '', name: '', amount: 0, type: 'immediate', eligibility: { kind: 'weekday', weekday: 0, description: '' }, active: true,
  displayOrder: 0, description: '', catalogOrder: 0, pricingName: '', pricingDescription: '',
  labels: { form: '', review: '', pdf: '', summary: '', catalog: '', email: '' },
};
export function validateStudioSettings(input: unknown, previous: StudioSettings = baseSettings()): StudioSettings {
  const base = baseSettings();
  const template = { ...base, studioConfig: { ...base.studioConfig, businessInformation: '', friendlyName: '' },
    productsConfig: [productShape], optionsConfig: [optionShape], discountsConfig: [discountShape],
    partnerCodes: [{ id: '', code: '', amount: 0, active: true }] };
  shape(input, template, '설정');
  if (!input || typeof input !== 'object' || editableSections.some(key => !Object.hasOwn(input, key))) fail('전체 설정 문서가 필요합니다.');
  const value = JSON.parse(JSON.stringify(input)) as StudioSettings;
  value.partnerCodes ??= [];
  const codeIds = new Set<string>(), normalizedCodes = new Set<string>();
  for (const entry of value.partnerCodes) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(entry.id) || codeIds.has(entry.id)) fail('할인코드 내부 번호 중복/형식');
    const normalized = normalizePartnerCode(entry.code);
    if (!isPartnerCodeFormat(normalized) || normalizedCodes.has(normalized)) fail('할인코드는 2~64자 한글·영문·숫자·하이픈·밑줄만 사용하며 중복할 수 없습니다.');
    money(entry.amount, '코드 할인금액'); if (entry.amount === 0) fail('코드 할인금액은 0원보다 커야 합니다.');
    entry.code = normalized; codeIds.add(entry.id); normalizedCodes.add(normalized);
  }
  for (const old of previous.partnerCodes || []) if (!value.partnerCodes.some(entry => entry.id === old.id)) fail('할인코드는 삭제 대신 비활성화해 주세요.');
  if (value.discountsConfig.some(rule => rule.eligibility.kind === 'partner' && rule.type !== 'immediate')) fail('할인코드는 즉시 할인으로만 적용됩니다.');
  const studio = value.studioConfig;
  for (const locked of ['studioId', 'contractPrefix', 'driveFolderName'] as const) {
    if (studio[locked] !== base.studioConfig[locked]) fail(locked + '은 배포 시 고정되는 보호 항목입니다.');
  }
  for (const key of ['studioName', 'displayName', 'representativeName', 'representativeEmail', 'representativePhone', 'emailSenderName', 'bookingName', 'photographyLabel', 'contactChannel'] as const) text(studio[key], key, true, 200);
  for (const key of ['studioName', 'displayName', 'representativeName', 'emailSenderName', 'bookingName'] as const) if (/[\r\n]/.test(studio[key])) fail(key + ' 줄바꿈');
  if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(studio.representativeEmail)) fail('대표 이메일');
  if (!/^\+?[\d ()-]{8,30}$/.test(studio.representativePhone) || studio.representativePhone.replace(/\D/g, '').length < 8) fail('대표 전화번호');
  for (const asset of [studio.logo, studio.seal]) {
    // Keep logo/seal private to this document, without remote tracking or SVG scripts.
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(asset) || asset.length > 420000) fail('로고/직인은 PNG, JPEG, WebP 이미지(각 300KB 이하)만 허용합니다.');
    const bytes = atob(asset.split(',')[1]);
    if (!(bytes.startsWith('\x89PNG\r\n\x1a\n') || bytes.startsWith('\xff\xd8\xff') || (bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WEBP'))) fail('이미지 실제 형식');
  }
  for (const [items, label] of [[value.productsConfig, '상품'], [value.optionsConfig, '옵션'], [value.discountsConfig, '할인']] as const) {
    if (items.length > 30) fail(label + ' 최대 30개');
    for (const item of items) {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(item.id)) fail(label + ' ID');
      text(item.name, label + '명', true, 100);
      if (/[\r\n]/.test(item.name)) fail(label + ' 이름에는 줄바꿈을 넣을 수 없습니다.');
      if (item.description !== undefined) text(item.description, label + ' 설명', false, 2000);
      if (typeof item.active !== 'boolean') fail(label + ' 활성 여부');
    }
  }
  for (const product of value.productsConfig) {
    money(product.price, '상품가격');
    for (const count of [product.retouchedCount, product.additionalRetouchedCount, product.additionalOriginalCount]) if (count !== undefined) money(count, '제공 수량');
  }
  value.optionsConfig.forEach(option => money(option.price, '옵션가격'));
  value.discountsConfig.forEach(discount => money(discount.amount, '할인금액'));
  // Stable IDs are never physically removed or re-used for another eligibility rule.
  for (const key of ['productsConfig', 'optionsConfig', 'discountsConfig'] as const) {
    for (const old of previous[key]) if (!value[key].some(item => item.id === old.id)) fail(old.id + ' 삭제 대신 비활성화해 주세요.');
  }
  for (const old of previous.discountsConfig) {
    const next = value.discountsConfig.find(item => item.id === old.id)!;
    if (next.eligibility.kind !== old.eligibility.kind) fail('할인 조건 ID 변경 금지');
  }
  const policy = value.contractPolicy;
  money(policy.deposit.amount, '계약금');
  text(policy.version, '약관 버전', true, 100);
  text(policy.privacyNotice, '개인정보 안내');
  if (!policy.terms.length || new Set(policy.terms.map(term => term.id)).size !== policy.terms.length) fail('약관');
  policy.terms.forEach(term => { text(term.id, '약관 ID', true, 80); text(term.title, '약관 제목', true, 200); text(term.content, '약관 본문'); });
  // Minimum achievable total across all immediate benefits must still cover the deposit.
  const maximumCode = Math.max(0, ...value.partnerCodes.filter(entry => entry.active).map(entry => entry.amount));
  const maximumDiscount = value.discountsConfig.filter(rule => rule.active && rule.type === 'immediate').reduce((total, rule) => total + (rule.eligibility.kind === 'partner' ? maximumCode : rule.amount), 0);
  for (const product of value.productsConfig.filter(item => item.active)) {
    if (product.price - maximumDiscount < policy.deposit.amount) fail('모든 즉시할인 적용 후 상품 금액이 계약금보다 작습니다.');
  }
  if (!value.formSchema.weddingHall.enabled || (base.formSchema.weddingHall.required && !value.formSchema.weddingHall.required)) fail('웨딩홀 상세는 필수 핵심 필드입니다.');
  if (!value.formSchema.groomPhone.enabled && !value.formSchema.bridePhone.enabled) fail('고객 연락처는 최소 하나 사용해야 합니다.');
  createConfigurationRuntime(composeConfiguration(value));
  // Check every templated customer/contract text before publishing.
  function checkText(node: unknown): void {
    if (typeof node === 'string') renderConfigText(node, studio, policy);
    else if (node && typeof node === 'object') Object.values(node).forEach(checkText);
  }
  checkText(value.content); checkText(policy);
  return value;
}
