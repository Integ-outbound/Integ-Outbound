import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ??= 'postgresql://user:password@127.0.0.1:5432/integ_test';

const db = require('../db/client') as typeof import('../db/client');
const observability = require('../modules/observability/service') as typeof import('../modules/observability/service');
const manualTouches = require('../modules/manual-touches/service') as typeof import('../modules/manual-touches/service');

test('createManualTouch stores a manual touch and auto-stamps sent/reply times for progressed statuses', async (t) => {
  const fakeClient = {} as never;
  let capturedParams: unknown[] | undefined;

  t.mock.method(db, 'withTransaction', async (fn: (client: never) => Promise<unknown>) => fn(fakeClient));
  t.mock.method(db, 'generateId', () => 'manual-touch-id');
  t.mock.method(db, 'query', async (text: string, params?: unknown[]) => {
    if (text.includes('INSERT INTO manual_touches')) {
      capturedParams = params;
      return {
        rows: [
          {
            id: 'manual-touch-id',
            client_id: null,
            lead_id: null,
            company_name: 'Northwind',
            person_name: 'Ava Founder',
            channel: 'linkedin',
            message_body: 'Quick note about your paid search growth.',
            status: 'interested',
            sent_at: '2026-05-02T18:00:00.000Z',
            reply_at: '2026-05-02T18:00:00.000Z',
            notes: 'Asked for a call next week.',
            created_at: '2026-05-02T18:00:00.000Z',
            updated_at: '2026-05-02T18:00:00.000Z'
          }
        ]
      } as never;
    }

    throw new Error(`Unexpected query: ${text}`);
  });
  const logEventMock = t.mock.method(observability, 'logEvent', async () => undefined);

  const result = await manualTouches.createManualTouch({
    company_name: ' Northwind ',
    person_name: ' Ava Founder ',
    channel: 'linkedin',
    message_body: ' Quick note about your paid search growth. ',
    status: 'interested',
    notes: ' Asked for a call next week. '
  });

  assert.equal(result.id, 'manual-touch-id');
  assert.equal(capturedParams?.[0], 'manual-touch-id');
  assert.equal(capturedParams?.[3], 'Northwind');
  assert.equal(capturedParams?.[4], 'Ava Founder');
  assert.equal(capturedParams?.[5], 'linkedin');
  assert.equal(capturedParams?.[6], 'Quick note about your paid search growth.');
  assert.equal(capturedParams?.[7], 'interested');
  assert.ok(typeof capturedParams?.[8] === 'string');
  assert.ok(typeof capturedParams?.[9] === 'string');
  assert.equal(capturedParams?.[10], 'Asked for a call next week.');
  assert.equal(logEventMock.mock.calls.length, 1);
});

test('listManualTouches applies channel, status, and limit filters', async (t) => {
  let capturedSql = '';
  let capturedParams: unknown[] = [];

  t.mock.method(db, 'query', async (text: string, params?: unknown[]) => {
    capturedSql = text;
    capturedParams = params ?? [];
    return { rows: [] } as never;
  });

  await manualTouches.listManualTouches({
    channel: 'linkedin',
    status: 'planned',
    limit: 25
  });

  assert.match(capturedSql, /channel = \$1/);
  assert.match(capturedSql, /status = \$2/);
  assert.match(capturedSql, /LIMIT \$3/);
  assert.deepEqual(capturedParams, ['linkedin', 'planned', 25]);
});

test('updateManualTouch preserves existing timestamps and updates status and notes', async (t) => {
  const fakeClient = {} as never;
  const capturedQueries: Array<{ text: string; params?: unknown[] }> = [];

  t.mock.method(db, 'withTransaction', async (fn: (client: never) => Promise<unknown>) => fn(fakeClient));
  t.mock.method(db, 'query', async (text: string, params?: unknown[]) => {
    capturedQueries.push({ text, params });

    if (text.includes('SELECT *') && text.includes('FROM manual_touches')) {
      return {
        rows: [
          {
            id: 'manual-touch-id',
            client_id: null,
            lead_id: null,
            company_name: 'Northwind',
            person_name: 'Ava Founder',
            channel: 'linkedin',
            message_body: 'Initial note',
            status: 'sent',
            sent_at: '2026-05-01T10:00:00.000Z',
            reply_at: null,
            notes: 'Initial note',
            created_at: '2026-05-01T10:00:00.000Z',
            updated_at: '2026-05-01T10:00:00.000Z'
          }
        ]
      } as never;
    }

    if (text.includes('UPDATE manual_touches')) {
      return {
        rows: [
          {
            id: 'manual-touch-id',
            client_id: null,
            lead_id: null,
            company_name: 'Northwind',
            person_name: 'Ava Founder',
            channel: 'linkedin',
            message_body: 'Initial note',
            status: 'replied',
            sent_at: '2026-05-01T10:00:00.000Z',
            reply_at: '2026-05-02T12:00:00.000Z',
            notes: 'Prospect replied with questions.',
            created_at: '2026-05-01T10:00:00.000Z',
            updated_at: '2026-05-02T12:00:00.000Z'
          }
        ]
      } as never;
    }

    throw new Error(`Unexpected query: ${text}`);
  });
  t.mock.method(observability, 'logEvent', async () => undefined);

  const result = await manualTouches.updateManualTouch('manual-touch-id', {
    status: 'replied',
    notes: ' Prospect replied with questions. '
  });

  assert.equal(result.status, 'replied');
  const updateQuery = capturedQueries.find((entry) => entry.text.includes('UPDATE manual_touches'));
  assert.equal(updateQuery?.params?.[8], '2026-05-01T10:00:00.000Z');
  assert.ok(typeof updateQuery?.params?.[9] === 'string');
  assert.equal(updateQuery?.params?.[10], 'Prospect replied with questions.');
});
