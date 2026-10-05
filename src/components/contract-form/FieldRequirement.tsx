import React from 'react';
import { getFormField } from '@/services/configuration';
import type { ConfigurableFormFieldId } from '@/types/config';

/** A small label marker for the existing inputs; this does not build or arrange fields. */
export function FieldRequirement({ field, showOptional = true }: { field: ConfigurableFormFieldId; showOptional?: boolean }) {
  return getFormField(field).required
    ? <span className="text-red-500">*</span>
    : showOptional ? <span className="text-[rgb(var(--studio-muted))] font-normal text-xs">(선택)</span> : null;
}
