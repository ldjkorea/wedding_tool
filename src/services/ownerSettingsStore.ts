import crypto from 'node:crypto';
import { signedGasCall } from './gasTransport';
import { baseSettings, validateStudioSettings } from './settingsValidation';
import { settingsHash, verifySettingsRevision } from './studioSettingsStore';
import { ownerProductFields, ownerOptionFields, ownerDiscountFields, ownerCodeFields, type OwnerSettings } from '@/types/ownerSettings';
import type { StudioSettings } from '@/types/studioSettings';
import { getServerConfig, getDemoServerConfig, isDemoMode } from '@/lib/serverConfig';

const sections = { products: ['productsConfig', ownerProductFields], options: ['optionsConfig', ownerOptionFields], discounts: ['discountsConfig', ownerDiscountFields], codes: ['partnerCodes', ownerCodeFields] } as const;
function pick(item: object, keys: readonly string[]) { return Object.fromEntries(Object.entries(item).filter(([key]) => key === 'id' || keys.includes(key))); }
export function projectOwnerSettings(settings: StudioSettings): OwnerSettings {
  return Object.fromEntries(Object.entries(sections).map(([section, [key, fields]]) => [section, (settings[key] || []).map(item => pick(item, fields))])) as unknown as OwnerSettings;
}
function fail(): never { throw new Error('설정 검증: 변경할 수 없는 항목이 있거나 입력 형식이 올바르지 않습니다.'); }
/** Apply only explicit operational fields; client cannot supply a full config or new internal IDs. */
export function mergeOwnerSettings(previous: StudioSettings, input: unknown): StudioSettings {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 4 || Object.keys(input).some(key => !Object.hasOwn(sections, key))) fail();
  const merged = structuredClone(previous);
  for (const [section, [key, fields]] of Object.entries(sections)) {
    const incoming = (input as Record<string, unknown>)[section];
    const old = previous[key] || [];
    if (!Array.isArray(incoming) || incoming.length > (section === 'codes' ? 100 : 30)) fail();
    const seen = new Set<string>();
    const next = incoming.map((value: unknown) => {
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(name => name !== 'id' && !(fields as readonly string[]).includes(name))) fail();
      const item = value as Record<string, unknown>;
      const existing = old.find(entry => entry.id === item.id);
      if ((item.id !== undefined && !existing) || (!existing && section === 'discounts')) fail();
      const id = existing?.id || section.slice(0, -1) + '_' + crypto.randomUUID();
      if (seen.has(id)) fail(); seen.add(id);
      const patch = structuredClone(item); delete patch.id;
      const result = { ...existing, ...patch, id } as Record<string, unknown>;
      if (!existing) {
        for (const required of section === 'products' ? ['name','price','description','includedItems','active','displayOrder'] : section === 'options' ? ['name','price','description','active'] : ['code','amount','active']) if (!Object.hasOwn(result, required)) fail();
      }
      if (existing && item.name !== undefined && item.name !== (existing as { name?: string }).name) {
        if (section === 'products' || section === 'options') result.shortName = item.name;
        if (section === 'discounts') {
          result.pricingName = item.name;
          result.labels = Object.fromEntries(['form','review','pdf','summary','catalog','email'].map(channel => [channel, item.name]));
        }
      }
      if (section === 'discounts' && item.description !== undefined && item.description !== (existing as { description?: string }).description) result.pricingDescription = item.description;
      return result;
    });
    if (old.some(item => !seen.has(item.id))) throw new Error('설정 검증: 사용을 중단할 항목은 삭제하지 않고 사용 안 함으로 변경해 주세요.');
    (merged as unknown as Record<string, unknown>)[key] = next;
  }
  return validateStudioSettings(merged, previous);
}
export async function ownerSettingsHead(sessionId: string) {
  const result = await signedGasCall('owner_read', { sessionId });
  if (result.recoveryRequired) throw new Error('설정 충돌: 저장된 설정을 확인할 수 없습니다. 총관리자에게 복구를 요청해 주세요.');
  const current = result.current === null ? null : verifySettingsRevision(result.current);
  const settings = current?.settings || baseSettings();
  if (!current && !settings.studioConfig.representativeEmail) settings.studioConfig.representativeEmail = isDemoMode() ? getDemoServerConfig().repEmail : getServerConfig().repEmail;
  return { settings, revision: current?.revision || 0 };
}
export async function saveOwnerSettings(sessionId: string, input: unknown, expectedRevision: unknown) {
  if (!Number.isSafeInteger(expectedRevision) || Number(expectedRevision) < 0) fail();
  const head = await ownerSettingsHead(sessionId);
  if (head.revision !== expectedRevision) throw new Error('설정 충돌: 다른 곳에서 설정이 변경되었습니다. 최신 내용을 불러온 뒤 다시 저장해 주세요.');
  const settings = mergeOwnerSettings(head.settings, input);
  const result = await signedGasCall('owner_save', { sessionId, expectedRevision, settings, hash: settingsHash(settings), ...(head.revision === 0 ? { bootstrap: head.settings } : {}) });
  const saved = verifySettingsRevision(result.current);
  if (saved.revision !== Number(expectedRevision) + 1 || saved.hash !== settingsHash(settings)) throw new Error('서버 설정 오류: 저장 결과를 확인하지 못했습니다. 다시 조회해 주세요.');
  return saved;
}
