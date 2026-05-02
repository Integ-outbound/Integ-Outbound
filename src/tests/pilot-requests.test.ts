import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ??= 'postgresql://user:password@127.0.0.1:5432/integ_test';

const db = require('../db/client') as typeof import('../db/client');
const observability = require('../modules/observability/service') as typeof import('../modules/observability/service');
const pilotRequests = require('../modules/pilot-requests/service') as typeof import('../modules/pilot-requests/service');

test('createPilotRequest stores structured pilot request data and logs an event', async (t) => {
  const fakeClient = {} as never;
  let capturedParams: unknown[] | undefined;

  t.mock.method(db, 'withTransaction', async (fn: (client: never) => Promise<unknown>) => fn(fakeClient));
  t.mock.method(db, 'generateId', () => 'pilot-request-id');
  t.mock.method(db, 'query', async (text: string, params?: unknown[]) => {
    if (text.includes('INSERT INTO pilot_requests')) {
      capturedParams = params;
      return {
        rows: [
          {
            id: 'pilot-request-id',
            contact_name: 'Ava Founder',
            contact_email: 'ava@example.com',
            company_name: 'Signal Growth',
            website: 'signalgrowth.com',
            offer: 'Paid media management',
            desired_client_type: 'B2B SaaS founders',
            notes: 'Strong case studies in SaaS.',
            status: 'new',
            reviewed_by: null,
            reviewed_at: null,
            created_at: '2026-05-02T18:00:00.000Z',
            updated_at: '2026-05-02T18:00:00.000Z'
          }
        ]
      } as never;
    }

    throw new Error(`Unexpected query: ${text}`);
  });
  const logEventMock = t.mock.method(observability, 'logEvent', async () => undefined);

  const result = await pilotRequests.createPilotRequest({
    name: ' Ava Founder ',
    email: 'AVA@example.com ',
    company: ' Signal Growth ',
    website: 'signalgrowth.com ',
    offer: ' Paid media management ',
    desired_client_type: ' B2B SaaS founders ',
    notes: ' Strong case studies in SaaS. '
  });

  assert.equal(result.id, 'pilot-request-id');
  assert.deepEqual(capturedParams, [
    'pilot-request-id',
    'Ava Founder',
    'ava@example.com',
    'Signal Growth',
    'signalgrowth.com',
    'Paid media management',
    'B2B SaaS founders',
    'Strong case studies in SaaS.'
  ]);
  assert.equal(logEventMock.mock.calls.length, 1);
  assert.deepEqual(logEventMock.mock.calls[0]?.arguments[0], {
    eventType: 'pilot_request.created',
    entityType: 'pilot_request',
    entityId: 'pilot-request-id',
    payload: {
      contact_email: 'ava@example.com',
      company_name: 'Signal Growth',
      website: 'signalgrowth.com',
      status: 'new'
    },
    triggeredBy: 'website_signup'
  });
});

test('listPilotRequests applies status and limit filters', async (t) => {
  let capturedSql = '';
  let capturedParams: unknown[] = [];

  t.mock.method(db, 'query', async (text: string, params?: unknown[]) => {
    capturedSql = text;
    capturedParams = params ?? [];
    return {
      rows: [
        {
          id: 'pilot-request-id',
          contact_name: 'Ava Founder',
          contact_email: 'ava@example.com',
          company_name: 'Signal Growth',
          website: 'signalgrowth.com',
          offer: 'Paid media management',
          desired_client_type: 'B2B SaaS founders',
          notes: null,
          status: 'new',
          reviewed_by: null,
          reviewed_at: null,
          created_at: '2026-05-02T18:00:00.000Z',
          updated_at: '2026-05-02T18:00:00.000Z'
        }
      ]
    } as never;
  });

  const result = await pilotRequests.listPilotRequests({ status: 'new', limit: 5 });

  assert.equal(result.length, 1);
  assert.match(capturedSql, /WHERE status = \$1/);
  assert.match(capturedSql, /LIMIT \$2/);
  assert.deepEqual(capturedParams, ['new', 5]);
});

test('countPilotRequestsByStatus returns the numeric count', async (t) => {
  t.mock.method(db, 'query', async () => ({
    rows: [{ count: '3' }]
  }) as never);

  const count = await pilotRequests.countPilotRequestsByStatus('new');
  assert.equal(count, 3);
});
