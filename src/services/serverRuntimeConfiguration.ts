import { AsyncLocalStorage } from 'node:async_hooks';
import { createConfigurationRuntime, getBaseClientConfiguration, installServerConfigurationResolver, type ConfigurationRuntime } from './configuration';
import { composeConfiguration } from './settingsValidation';
import { readRuntimeSettings } from './studioSettingsStore';

const contexts = new AsyncLocalStorage<ConfigurationRuntime>();
installServerConfigurationResolver(() => contexts.getStore());
export async function loadRuntimeConfiguration() {
  const revision = await readRuntimeSettings();
  return createConfigurationRuntime(revision ? composeConfiguration(revision.settings) : getBaseClientConfiguration(), revision?.revision, revision?.hash);
}
export async function withRuntimeConfiguration<T>(work: () => Promise<T>): Promise<T> {
  return contexts.run(await loadRuntimeConfiguration(), work);
}
