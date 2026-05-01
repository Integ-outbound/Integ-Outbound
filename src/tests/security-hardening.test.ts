import assert from 'node:assert/strict';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import test from 'node:test';

import type { Mailbox } from '../db/types';

process.env.DATABASE_URL ??= 'postgresql://user:password@127.0.0.1:5432/integ_test';

const { google } = require('googleapis') as typeof import('googleapis');
const { HttpError } = require('../api/utils') as typeof import('../api/utils');
const dbClient = require('../db/client') as typeof import('../db/client');
const { approveDraft } = require('../modules/drafts/service') as typeof import('../modules/drafts/service');
const {
  assertMailboxCanSend,
  assertMailboxCanSync,
  assertMailboxTokenEncryptionConfigured,
  sendMailboxTestEmail
} = require('../modules/mailboxes/service') as typeof import('../modules/mailboxes/service');
const { syncMailbox } = require('../modules/mailboxes/sync') as typeof import('../modules/mailboxes/sync');
const observability = require('../modules/observability/service') as typeof import('../modules/observability/service');
const { markHandled } = require('../modules/replies/service') as typeof import('../modules/replies/service');
const { markBounced } = require('../modules/sending/service') as typeof import('../modules/sending/service');

const CLIENT_A = '11111111-1111-1111-1111-111111111111';
const CLIENT_B = '22222222-2222-2222-2222-222222222222';
const MAILBOX_ID = '33333333-3333-4333-8333-333333333333';
const DRAFT_ID = '44444444-4444-4444-8444-444444444444';
const REPLY_ID = '55555555-5555-4555-8555-555555555555';
const SENT_MESSAGE_ID = '66666666-6666-4666-8666-666666666666';

function createEncryptedRefreshToken(refreshToken: string, secret: string): string {
  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(refreshToken, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

function buildMailbox(overrides: Partial<Mailbox> = {}): Mailbox {
  return {
    id: MAILBOX_ID,
    client_id: CLIENT_A,
    provider: 'google',
    email: 'sender@example.com',
    display_name: 'Sender',
    is_active: true,
    status: 'connected',
    daily_send_limit: 100,
    consecutive_auth_failures: 0,
    last_auth_failed_at: null,
    last_send_at: null,
    gmail_history_id: null,
    messages_total: null,
    threads_total: null,
    last_connected_at: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    ...overrides
  };
}

function expectHttpError(error: unknown, statusCode: number, messageIncludes: string): void {
  assert.ok(error instanceof HttpError);
  assert.equal(error.statusCode, statusCode);
  assert.match(error.message, new RegExp(messageIncludes.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('client A cannot test-send from client B mailbox', async (t) => {
  t.mock.method(dbClient, 'query', async () => ({
    rows: [buildMailbox({ client_id: CLIENT_B })],
    rowCount: 1
  }));

  await assert.rejects(
    sendMailboxTestEmail(
      MAILBOX_ID,
      { to: 'recipient@example.com', subject: 'Test', body: 'Hello' },
      'operator',
      CLIENT_A
    ),
    (error) => {
      expectHttpError(error, 403, 'does not belong to client');
      return true;
    }
  );
});

test('client A cannot sync client B mailbox through the client-scoped path', async (t) => {
  t.mock.method(dbClient, 'query', async () => ({
    rows: [buildMailbox({ client_id: CLIENT_B })],
    rowCount: 1
  }));

  await assert.rejects(
    syncMailbox(MAILBOX_ID, { maxResults: 1 }, 'operator', CLIENT_A),
    (error) => {
      expectHttpError(error, 403, 'does not belong to client');
      return true;
    }
  );
});

test('client A cannot approve client B draft', async (t) => {
  t.mock.method(dbClient, 'withTransaction', async (callback: (client: unknown) => Promise<unknown>) =>
    callback({})
  );
  t.mock.method(dbClient, 'query', async () => ({
    rows: [{ id: DRAFT_ID, lead_id: '77777777-7777-4777-8777-777777777777', client_id: CLIENT_B }],
    rowCount: 1
  }));

  await assert.rejects(approveDraft(DRAFT_ID, CLIENT_A), (error) => {
    expectHttpError(error, 403, 'does not belong to client');
    return true;
  });
});

test('missing client_id blocks client-scoped draft approval', async (t) => {
  t.mock.method(dbClient, 'withTransaction', async (callback: (client: unknown) => Promise<unknown>) =>
    callback({})
  );

  await assert.rejects(approveDraft(DRAFT_ID, undefined), (error) => {
    expectHttpError(error, 400, 'requires client_id');
    return true;
  });
});

test('client A cannot mark client B reply handled', async (t) => {
  t.mock.method(dbClient, 'withTransaction', async (callback: (client: unknown) => Promise<unknown>) =>
    callback({})
  );
  t.mock.method(dbClient, 'query', async () => ({
    rows: [{ id: REPLY_ID, client_id: CLIENT_B }],
    rowCount: 1
  }));

  await assert.rejects(markHandled(REPLY_ID, 'done', 'operator', CLIENT_A), (error) => {
    expectHttpError(error, 403, 'does not belong to client');
    return true;
  });
});

test('client A cannot mutate client B send state', async (t) => {
  t.mock.method(dbClient, 'withTransaction', async (callback: (client: unknown) => Promise<unknown>) =>
    callback({})
  );
  t.mock.method(dbClient, 'query', async () => ({
    rows: [{ id: SENT_MESSAGE_ID, client_id: CLIENT_B }],
    rowCount: 1
  }));

  await assert.rejects(markBounced(SENT_MESSAGE_ID, 'operator', CLIENT_A), (error) => {
    expectHttpError(error, 403, 'does not belong to client');
    return true;
  });
});

test('missing MAILBOX_TOKEN_ENCRYPTION_KEY is a hard configuration error with no INTERNAL_API_KEY fallback', () => {
  const previousEncryptionKey = process.env.MAILBOX_TOKEN_ENCRYPTION_KEY;
  const previousInternalApiKey = process.env.INTERNAL_API_KEY;

  process.env.MAILBOX_TOKEN_ENCRYPTION_KEY = '';
  process.env.INTERNAL_API_KEY = 'this-is-a-long-internal-api-key-without-fallback';

  assert.throws(
    () => assertMailboxTokenEncryptionConfigured(),
    /MAILBOX_TOKEN_ENCRYPTION_KEY is required for mailbox token encryption/
  );

  process.env.MAILBOX_TOKEN_ENCRYPTION_KEY = previousEncryptionKey;
  process.env.INTERNAL_API_KEY = previousInternalApiKey;
});

test('disabled and unhealthy mailboxes are blocked from direct send while sync allows unhealthy recovery', () => {
  assert.throws(
    () => assertMailboxCanSend(buildMailbox({ is_active: false })),
    /cannot send email/
  );
  assert.throws(
    () => assertMailboxCanSend(buildMailbox({ status: 'disabled' })),
    /does not allow sending/
  );
  assert.throws(
    () => assertMailboxCanSend(buildMailbox({ status: 'unhealthy' })),
    /does not allow sending/
  );
  assert.throws(
    () => assertMailboxCanSend(buildMailbox({ consecutive_auth_failures: 3 })),
    /quarantined/
  );

  assert.doesNotThrow(() => assertMailboxCanSync(buildMailbox({ status: 'unhealthy' })));
  assert.throws(() => assertMailboxCanSync(buildMailbox({ status: 'disabled' })), /cannot sync/);
});

test('matching client_id allows mailbox test-send to reach the mocked Gmail send path', async (t) => {
  const previousEncryptionKey = process.env.MAILBOX_TOKEN_ENCRYPTION_KEY;
  process.env.MAILBOX_TOKEN_ENCRYPTION_KEY = 'mailbox-token-encryption-key-for-tests';

  t.mock.method(observability, 'logEvent', async () => undefined);
  t.mock.method(
    dbClient,
    'withTransaction',
    async (callback: (client: unknown) => Promise<unknown>) => callback({})
  );
  t.mock.method(dbClient, 'query', async (sql: string) => {
    if (sql.includes('SELECT * FROM mailboxes WHERE id = $1')) {
      return {
        rows: [buildMailbox({ client_id: CLIENT_A })],
        rowCount: 1
      };
    }

    if (sql.includes('FROM mailboxes m') && sql.includes('mailbox_oauth_tokens')) {
      return {
        rows: [
          {
            ...buildMailbox({ client_id: CLIENT_A }),
            oauth_token: {
              id: '88888888-8888-4888-8888-888888888888',
              mailbox_id: MAILBOX_ID,
              provider: 'google',
              refresh_token_encrypted: createEncryptedRefreshToken(
                'refresh-token',
                process.env.MAILBOX_TOKEN_ENCRYPTION_KEY as string
              ),
              scope: 'scope',
              token_type: 'Bearer',
              expiry_date: null,
              created_at: new Date(0).toISOString(),
              updated_at: new Date(0).toISOString()
            }
          }
        ],
        rowCount: 1
      };
    }

    return { rows: [], rowCount: 0 };
  });

  class FakeOAuth2 {
    setCredentials(): void {}
  }

  const sendMock = t.mock.fn(async () => ({
    data: {
      id: 'gmail-message-id',
      threadId: 'gmail-thread-id'
    }
  }));

  t.mock.method(google.auth, 'OAuth2', FakeOAuth2 as unknown as typeof google.auth.OAuth2);
  t.mock.method(
    google as unknown as { gmail: () => unknown },
    'gmail',
    (() => ({
      users: {
        messages: {
          send: sendMock
        }
      }
    })) as () => unknown
  );

  const result = await sendMailboxTestEmail(
    MAILBOX_ID,
    {
      to: 'recipient@example.com',
      subject: 'Hello',
      body: 'Testing'
    },
    'operator',
    CLIENT_A
  );

  assert.equal(result.messageId, 'gmail-message-id');
  assert.equal(result.threadId, 'gmail-thread-id');
  assert.equal(sendMock.mock.calls.length, 1);

  process.env.MAILBOX_TOKEN_ENCRYPTION_KEY = previousEncryptionKey;
});
