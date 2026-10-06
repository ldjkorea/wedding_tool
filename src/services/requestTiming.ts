import { AsyncLocalStorage } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';

type Timing = { calls: number; gasMs: number };
const timings = new AsyncLocalStorage<Timing>();

/** Request-local counters only. No action payload, identity, token or provider error is retained. */
export function recordGasTiming(start: number) {
  const timing = timings.getStore();
  if (timing) { timing.calls++; timing.gasMs += performance.now() - start; }
}
export function measureRoute<T extends Request>(handler: (request: T) => Promise<Response>) {
  return (request: T) => timings.run({ calls: 0, gasMs: 0 }, async () => {
    const start = performance.now(), response = await handler(request), timing = timings.getStore()!;
    response.headers.set('Server-Timing', `app;dur=${(performance.now() - start).toFixed(1)}, gas;dur=${timing.gasMs.toFixed(1)}, gas_calls;desc="${timing.calls}"`);
    return response;
  });
}
