import { AsyncLocalStorage } from 'node:async_hooks';
import { createConfigurationRuntime, getBaseClientConfiguration, installServerConfigurationResolver, type ConfigurationRuntime } from './configuration';
import { composeConfiguration } from './settingsValidation';
import { readRuntimeSettings, settingsEnabled } from './studioSettingsStore';
import { readPublicPageSettings } from './publicPageSettingsCache';

const contexts = new AsyncLocalStorage<ConfigurationRuntime>();
installServerConfigurationResolver(() => contexts.getStore());
export async function loadRuntimeConfiguration() {
  const revision = await readRuntimeSettings();
  return createConfigurationRuntime(revision ? composeConfiguration(revision.settings) : getBaseClientConfiguration(), revision?.revision, revision?.hash);
}
export async function loadPublicPageConfiguration() {
  if (!settingsEnabled()) return loadRuntimeConfiguration();
  const revision = await readPublicPageSettings(readRuntimeSettings);
  return createConfigurationRuntime(revision ? composeConfiguration(revision.settings) : getBaseClientConfiguration(), revision?.revision, revision?.hash);
}
export async function withRuntimeConfiguration<T>(work: () => Promise<T>, runtime?: ConfigurationRuntime): Promise<T> {
  return contexts.run(runtime || await loadRuntimeConfiguration(), work);
}
