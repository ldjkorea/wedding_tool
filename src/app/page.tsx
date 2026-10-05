import CustomerContractPage from '@/components/runtime/CustomerContractPage';
import { RuntimeContractScreen } from '@/components/runtime/RuntimeContractScreen';
import { withRuntimeConfiguration } from '@/services/serverRuntimeConfiguration';
import { getConfigurationRuntime } from '@/services/configuration';
import { editableSections } from '@/services/settingsValidation';
import { settingsEnabled } from '@/services/studioSettingsStore';
import { configurationBinding } from '@/lib/contractWorkflow';
import type { StudioSettings } from '@/types/studioSettings';
export const dynamic = 'force-dynamic';
import { loadRuntimeConfiguration } from '@/services/serverRuntimeConfiguration';
export async function generateMetadata() {
  const { config } = await loadRuntimeConfiguration();
  return { ...config.content.metadata, icons: { icon: config.studioConfig.logo } };
}
export default async function Page() {
  if (!settingsEnabled()) return <CustomerContractPage />;
  return withRuntimeConfiguration(async () => {
    const { config } = getConfigurationRuntime();
    const settings = Object.fromEntries(editableSections.map(key => [key, config[key]])) as unknown as StudioSettings;
    return <RuntimeContractScreen screen="customer" settings={settings} binding={configurationBinding()} />;
  });
}
