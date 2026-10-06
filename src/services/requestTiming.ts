import { AsyncLocalStorage } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';

type Timing = { calls: number; gasMs: number; phases: string[] };
const timings = new AsyncLocalStorage<Timing>();

/** Request-local counters only. No action payload, identity, token or provider error is retained. */
export function recordGasTiming(start: number, action: string, provider?: Record<string, unknown>) {
  const timing = timings.getStore();
  if (timing) {
    timing.calls++; timing.gasMs += performance.now() - start;
    if (/^[a-z_]{1,40}$/.test(action)) timing.phases.push(`rpc${timing.calls}_${action};dur=${(performance.now() - start).toFixed(1)}`);
    for (const name of ['total', 'lock', 'hmac', 'properties', 'drive_folder', 'settings_pointer', 'settings_read', 'auth_state_read', 'auth_state_write', 'credential_read', 'bookings_read']) {
      const value = provider?.[name + '_ms'];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 120000)
        timing.phases.push(`rpc${timing.calls}_provider_${name};dur=${value.toFixed(1)}`);
    }
  }
}
export function measureRoute<T extends Request>(handler: (request: T) => Promise<Response>) {
  return (request: T) => timings.run({ calls: 0, gasMs: 0, phases: [] }, async () => {
    const start = performance.now(), response = await handler(request), timing = timings.getStore()!;
    response.headers.set('Server-Timing', `app;dur=${(performance.now() - start).toFixed(1)}, gas;dur=${timing.gasMs.toFixed(1)}, gas_calls;desc="${timing.calls}"` + (timing.phases.length ? ', ' + timing.phases.join(', ') : ''));
    return response;
  });
}
