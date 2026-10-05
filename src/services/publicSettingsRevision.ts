import crypto from 'node:crypto';
import { editableSections } from './settingsValidation';
import type { SettingsRevision, StudioSettings } from '@/types/studioSettings';

/** Project before crossing any runtime HTTP/render boundary, including dev Flight IO traces.
 * The full settings hash remains the contract revision guard; publicHash verifies the projection. */
export function publicSettingsRevision(revision: SettingsRevision) {
  const settings = Object.fromEntries(editableSections.map(key => [key, revision.settings[key]])) as unknown as StudioSettings;
  return { ...revision, settings, publicHash: crypto.createHash('sha256').update(JSON.stringify(settings)).digest('hex') };
}
