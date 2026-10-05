import crypto from 'node:crypto';
export function installCalendarHarness(context: any, lockHeld: () => boolean) {
  type Calendar = { id: string; summary: string; description: string; timeZone: string; events: Map<string, any>; deleted: boolean; public: boolean };
  const calendars = new Map<string, Calendar>(), calls: string[] = []; let fault = '', hook: (() => void) | undefined;
  context.ScriptApp.getOAuthToken = () => 'FAKE-TEST-OAUTH';
  context.UrlFetchApp = { fetch(url: string, options: any) {
    if (lockHeld()) throw new Error('Calendar I/O under Core lock');
    calls.push(options.method + ' ' + new URL(url).pathname); hook?.();
    if (fault === 'network') throw new Error('Synthetic network loss');
    const respond = (code: number, value: any) => ({ getResponseCode: () => code, getContentText: () => fault === 'malformed' ? 'invalid' : JSON.stringify(value) });
    if (fault === 'permission') return respond(403, {});
    if (fault === '500') return respond(500, {});
    const parsed = new URL(url), segments = parsed.pathname.replace('/calendar/v3/', '').split('/').map(decodeURIComponent), body = options.payload ? JSON.parse(options.payload) : null;
    if (segments.join('/') === 'users/me/calendarList') return respond(200, { items: [...calendars.values()].filter(value => !value.deleted).map(value => ({ ...value, events: undefined, accessRole: 'owner' })) });
    if (segments[0] !== 'calendars') throw new Error('Unexpected Google endpoint');
    if (segments.length === 1 && options.method === 'post') {
      const calendar: Calendar = { id: crypto.randomUUID() + '@group.calendar.google.com', ...body, events: new Map(), deleted: false, public: false }; calendars.set(calendar.id, calendar);
      if (fault === 'create-after') throw new Error('Synthetic lost calendar response'); return respond(200, calendar);
    }
    const calendar = calendars.get(segments[1]); if (!calendar || calendar.deleted) return respond(404, {});
    if (segments.length === 2) return respond(200, calendar);
    if (segments[2] === 'acl') return respond(200, { items: [{ role: 'owner', scope: { type: 'user' } }, ...(calendar.public ? [{ role: 'reader', scope: { type: 'default' } }] : [])] });
    if (segments[2] !== 'events') throw new Error('Unexpected calendar operation');
    const id = segments[3];
    if (!id && options.method === 'get') {
      if (fault === 'empty-items') return respond(200, {});
      const marker = parsed.searchParams.get('privateExtendedProperty')?.slice('wbContract='.length);
      return respond(200, { items: [...calendar.events.values()].filter(event => event.status !== 'cancelled' && event.extendedProperties?.private?.wbContract === marker) });
    }
    if (id && options.method === 'get') return respond(calendar.events.has(id) ? 200 : 404, calendar.events.get(id) || {});
    if (options.method === 'post') {
      if (calendar.events.has(body.id)) return respond(409, {});
      calendar.events.set(body.id, body); if (fault === 'insert-after') throw new Error('Synthetic lost insert response'); return respond(200, body);
    }
    if (options.method === 'patch') {
      if (!calendar.events.has(id)) return respond(404, {});
      const value = { ...calendar.events.get(id), ...body }; calendar.events.set(id, value);
      if (fault === 'patch-after') throw new Error('Synthetic lost patch response'); return respond(200, value);
    }
    throw new Error('Unexpected calendar method');
  } };
  return { calendars, calls, calendar: () => [...calendars.values()][0], fault(value: string) { fault = value; }, duringRequest(callback?: () => void) { hook = callback; } };
}
