import ReviewContractPage from '@/components/runtime/ReviewContractPage';
import { RuntimeContractScreen } from '@/components/runtime/RuntimeContractScreen';
import { withRuntimeConfiguration } from '@/services/serverRuntimeConfiguration';
import { getConfigurationRuntime } from '@/services/configuration';
import { editableSections } from '@/services/settingsValidation';
import { settingsEnabled } from '@/services/studioSettingsStore';
import { configurationBinding } from '@/lib/contractWorkflow';
import type { StudioSettings } from '@/types/studioSettings';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page() {
  if (!settingsEnabled()) return <ReviewContractPage />;
  return withRuntimeConfiguration(async () => {
    const { config } = getConfigurationRuntime();
    const settings = Object.fromEntries(editableSections.map(key => [key, config[key]])) as unknown as StudioSettings;
    return <RuntimeContractScreen screen="review" settings={settings} binding={configurationBinding()} />;
  });
}
