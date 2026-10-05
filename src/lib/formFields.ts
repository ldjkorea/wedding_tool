import { CONFIGURABLE_FORM_FIELD_IDS } from '@/types/config';
import type { FormSchemaConfig } from '@/types/config';
import type { ContractFormData } from '@/types/contract';
import { getFormSchema } from '@/services/configuration';
import { isValidPhone } from './contactValidation';

/** These workflow identifiers are always present and required; the client schema cannot disable them. */
export const PROTECTED_CONTRACT_FIELDS = [
  'groomName', 'brideName', 'weddingDate', 'weddingTime', 'weddingVenue', 'email', 'productId',
] as const;

/** Do not collect disabled information, including stale values from an older UI or a crafted request. */
export function clearDisabledFormFields<T extends Partial<ContractFormData>>(data: T, schema = getFormSchema()): T {
  const result = { ...data };
  for (const key of CONFIGURABLE_FORM_FIELD_IDS) {
    if (!schema[key].enabled) result[key] = '';
  }
  return result;
}

export function getConfiguredFieldErrors(
  data: Partial<ContractFormData>,
  schema: FormSchemaConfig = getFormSchema(),
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const key of CONFIGURABLE_FORM_FIELD_IDS) {
    const field = schema[key];
    if (!field.enabled) continue;
    const value = data[key];
    if (value !== undefined && typeof value !== 'string') {
      errors[key] = field.label + '의 입력 형식이 올바르지 않습니다.';
      continue;
    }
    const text = value?.trim() || '';
    if (field.required && !text) errors[key] = field.label + '를 입력해 주세요.';
    else if (text.length > (key.includes('Notes') ? 2000 : 300) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) {
      errors[key] = field.label + '의 입력 길이 또는 문자를 확인해 주세요.';
    } else if ((key === 'groomPhone' || key === 'bridePhone') && text && !isValidPhone(text)) {
      errors[key] = field.label + '의 연락처 형식을 확인해 주세요.';
    }
  }
  return errors;
}
