import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { gmail_v1, google } from 'googleapis';

import { HttpError } from '../../api/utils';
import { ensureFound, generateId, query, withTransaction } from '../../db/client';
import { Mailbox, MailboxOauthToken } from '../../db/types';
import { logEvent } from '../observability/service';

const GOOGLE_PROVIDER = 'google';
const STATE_MAX_AGE_MS = 10 * 60 * 1000;
const DEFAULT_GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify'
];

interface GoogleOAuthStatePayload {
  provider: typeof GOOGLE_PROVIDER;
  nonce: string;
  issuedAt: number;
}

interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

interface GmailProfile {
  emailAddress: string;
  messagesTotal?: number | null;
  threadsTotal?: number | null;
  historyId?: string | null;
}

interface MailboxUpsertResult extends Mailbox {
  inserted: boolean;
}

interface MailboxTokenRow extends MailboxOauthToken {}

export interface GoogleOAuthStartResult {
  authorizationUrl: string;
  state: string;
  scopes: string[];
}

export interface GoogleOAuthCallbackResult {
  mailbox: Mailbox;
  scopes: string[];
}

export interface TestSendInput {
  to: string;
  subject: string;
  body: string;
  sentMessageId?: string;
}

export interface TestSendResult {
  mailboxId: string;
  messageId: string | null;
  threadId: string | null;
}

export interface SendMailboxEmailInput {
  to: string;
  subject: string;
  body: string;
  sentMessageId?: string;
}

export interface SendMailboxEmailResult {
  mailboxId: string;
  messageId: string | null;
  threadId: string | null;
}

export interface AuthenticatedMailboxContext {
  mailbox: Mailbox;
  oauthToken: MailboxOauthToken;
  oauthClient: InstanceType<typeof google.auth.OAuth2>;
  gmail: gmail_v1.Gmail;
}

function getGoogleConfig(): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  const scopesValue = process.env.GOOGLE_GMAIL_SCOPES?.trim();

  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID is required.');
  }

  if (!clientSecret) {
    throw new Error('GOOGLE_CLIENT_SECRET is required.');
  }

  if (!redirectUri) {
    throw new Error('GOOGLE_REDIRECT_URI is required.');
  }

  const scopes = scopesValue
    ? scopesValue
        .split(/[,\s]+/)
        .map((value) => value.trim())
        .filter(Boolean)
    : DEFAULT_GMAIL_SCOPES;

  if (scopes.length === 0) {
    throw new Error('GOOGLE_GMAIL_SCOPES must include at least one scope.');
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    scopes
  };
}

function getOAuthStateSecret(): string {
  const secret = process.env.INTERNAL_API_KEY?.trim();
  if (!secret) {
    throw new Error('INTERNAL_API_KEY is required for OAuth state signing.');
  }

  return secret;
}

function getEncryptionKey(): Buffer {
  const secret =
    process.env.MAILBOX_TOKEN_ENCRYPTION_KEY?.trim() || process.env.INTERNAL_API_KEY?.trim();

  if (!secret) {
    throw new Error('MAILBOX_TOKEN_ENCRYPTION_KEY or INTERNAL_API_KEY is required for mailbox token encryption.');
  }

  return createHash('sha256').update(secret).digest();
}

function createOAuthClient() {
  const config = getGoogleConfig();
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}

function signStatePayload(encodedPayload: string): Buffer {
  return createHmac('sha256', getOAuthStateSecret()).update(encodedPayload).digest();
}

function createOAuthState(): string {
  const payload: GoogleOAuthStatePayload = {
    provider: GOOGLE_PROVIDER,
    nonce: generateId(),
    issuedAt: Date.now()
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = signStatePayload(encodedPayload).toString('base64url');
  return `${encodedPayload}.${signature}`;
}

function validateOAuthState(state: string): GoogleOAuthStatePayload {
  const [encodedPayload, encodedSignature] = state.split('.');
  if (!encodedPayload || !encodedSignature) {
    throw new HttpError(400, 'Invalid OAuth state.');
  }

  const expectedSignature = signStatePayload(encodedPayload);
  const providedSignature = Buffer.from(encodedSignature, 'base64url');
  if (
    expectedSignature.length !== providedSignature.length ||
    !timingSafeEqual(expectedSignature, providedSignature)
  ) {
    throw new HttpError(400, 'Invalid OAuth state.');
  }

  let payload: GoogleOAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as GoogleOAuthStatePayload;
  } catch {
    throw new HttpError(400, 'Invalid OAuth state.');
  }

  if (payload.provider !== GOOGLE_PROVIDER) {
    throw new HttpError(400, 'Invalid OAuth state.');
  }

  if (!payload.issuedAt || Date.now() - payload.issuedAt > STATE_MAX_AGE_MS) {
    throw new HttpError(400, 'OAuth state has expired.');
  }

  return payload;
}

function encryptRefreshToken(refreshToken: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(refreshToken, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

function decryptRefreshToken(encryptedRefreshToken: string): string {
  const [ivPart, tagPart, cipherPart] = encryptedRefreshToken.split('.');
  if (!ivPart || !tagPart || !cipherPart) {
    throw new Error('Stored mailbox refresh token is invalid.');
  }

  const key = getEncryptionKey();
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivPart, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(cipherPart, 'base64url')),
    decipher.final()
  ]);

  return plaintext.toString('utf8');
}

function parseExpiryDate(expiryDate: number | null | undefined): string | null {
  if (!expiryDate || !Number.isFinite(expiryDate)) {
    return null;
  }

  return new Date(expiryDate).toISOString();
}

async function fetchGmailProfile(authClient: ReturnType<typeof createOAuthClient>): Promise<GmailProfile> {
  const gmail = google.gmail({ version: 'v1', auth: authClient });
  const response = await gmail.users.getProfile({ userId: 'me' });
  if (!response.data.emailAddress) {
    throw new Error('Google OAuth succeeded but Gmail profile email was missing.');
  }

  return {
    emailAddress: response.data.emailAddress,
    messagesTotal: response.data.messagesTotal ?? null,
    threadsTotal: response.data.threadsTotal ?? null,
    historyId: response.data.historyId ?? null
  };
}

async function getMailboxWithToken(
  mailboxId: string
): Promise<(Mailbox & { oauth_token: MailboxTokenRow }) | null> {
  const result = await query<
    Mailbox & {
      oauth_token: MailboxTokenRow;
    }
  >(
    `
      SELECT
        m.*,
        row_to_json(t) AS oauth_token
      FROM mailboxes m
      INNER JOIN mailbox_oauth_tokens t ON t.mailbox_id = m.id
      WHERE m.id = $1
    `,
    [mailboxId]
  );

  return result.rows[0] ?? null;
}

export async function getAuthenticatedMailboxContext(
  mailboxId: string
): Promise<AuthenticatedMailboxContext> {
  const mailboxWithToken = await getMailboxWithToken(mailboxId);
  if (!mailboxWithToken) {
    throw new HttpError(404, `Mailbox ${mailboxId} not found.`);
  }

  const refreshToken = decryptRefreshToken(mailboxWithToken.oauth_token.refresh_token_encrypted);
  const oauthClient = createOAuthClient();
  oauthClient.setCredentials({
    refresh_token: refreshToken
  });

  return {
    mailbox: mailboxWithToken,
    oauthToken: mailboxWithToken.oauth_token,
    oauthClient,
    gmail: google.gmail({ version: 'v1', auth: oauthClient })
  };
}

function requireSafeHeaderValue(value: string, fieldName: string): string {
  if (/[\r\n]/.test(value)) {
    throw new HttpError(400, `${fieldName} contains invalid characters.`);
  }

  return value;
}

export function startGoogleOAuth(): GoogleOAuthStartResult {
  const config = getGoogleConfig();
  const state = createOAuthState();
  const oauthClient = createOAuthClient();
  const authorizationUrl = oauthClient.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: config.scopes,
    state
  });

  return {
    authorizationUrl,
    state,
    scopes: config.scopes
  };
}

export async function handleGoogleOAuthCallback(
  code: string,
  state: string,
  triggeredBy = 'operator'
): Promise<GoogleOAuthCallbackResult> {
  validateOAuthState(state);

  const oauthClient = createOAuthClient();
  const tokenResponse = await oauthClient.getToken(code);
  const tokens = tokenResponse.tokens;
  oauthClient.setCredentials(tokens);

  const profile = await fetchGmailProfile(oauthClient);

  const result = await withTransaction(async (client) => {
    const mailboxResult = await query<MailboxUpsertResult>(
      `
        INSERT INTO mailboxes (
          id,
          provider,
          email,
          display_name,
          gmail_history_id,
          messages_total,
          threads_total,
          last_connected_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (provider, email)
        DO UPDATE SET
          display_name = EXCLUDED.display_name,
          gmail_history_id = EXCLUDED.gmail_history_id,
          messages_total = EXCLUDED.messages_total,
          threads_total = EXCLUDED.threads_total,
          last_connected_at = NOW(),
          updated_at = NOW()
        RETURNING mailboxes.*, (xmax = 0) AS inserted
      `,
      [
        generateId(),
        GOOGLE_PROVIDER,
        profile.emailAddress.toLowerCase(),
        null,
        profile.historyId,
        profile.messagesTotal,
        profile.threadsTotal
      ],
      client
    );

    const mailbox = ensureFound(
      mailboxResult.rows[0],
      `Mailbox upsert failed for ${profile.emailAddress}.`
    );

    const existingTokenResult = await query<MailboxTokenRow>(
      `
        SELECT *
        FROM mailbox_oauth_tokens
        WHERE mailbox_id = $1
      `,
      [mailbox.id],
      client
    );
    const existingToken = existingTokenResult.rows[0] ?? null;

    const refreshToken = tokens.refresh_token ?? (existingToken ? decryptRefreshToken(existingToken.refresh_token_encrypted) : null);
    if (!refreshToken) {
      throw new HttpError(400, 'Google did not return a refresh token for this mailbox.');
    }

    const encryptedRefreshToken = encryptRefreshToken(refreshToken);
    const tokenResult = await query<MailboxTokenRow>(
      `
        INSERT INTO mailbox_oauth_tokens (
          id,
          mailbox_id,
          provider,
          refresh_token_encrypted,
          scope,
          token_type,
          expiry_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (mailbox_id)
        DO UPDATE SET
          refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
          scope = EXCLUDED.scope,
          token_type = EXCLUDED.token_type,
          expiry_date = EXCLUDED.expiry_date,
          updated_at = NOW()
        RETURNING *
      `,
      [
        existingToken?.id ?? generateId(),
        mailbox.id,
        GOOGLE_PROVIDER,
        encryptedRefreshToken,
        tokens.scope ?? getGoogleConfig().scopes.join(' '),
        tokens.token_type ?? null,
        parseExpiryDate(tokens.expiry_date)
      ],
      client
    );

    const token = ensureFound(tokenResult.rows[0], `Mailbox OAuth token upsert failed for ${mailbox.id}.`);

    await logEvent(
      {
        eventType: mailbox.inserted ? 'mailbox.created' : 'mailbox.updated',
        entityType: 'mailbox',
        entityId: mailbox.id,
        payload: {
          provider: mailbox.provider,
          email: mailbox.email
        },
        triggeredBy
      },
      client
    );

    await logEvent(
      {
        eventType: 'mailbox.oauth_token_stored',
        entityType: 'mailbox_oauth_token',
        entityId: token.id,
        payload: {
          mailbox_id: mailbox.id,
          provider: mailbox.provider,
          scopes: token.scope
        },
        triggeredBy
      },
      client
    );

    return {
      mailbox,
      scopes: (token.scope ?? '').split(/\s+/).filter(Boolean)
    };
  });

  return result;
}

export async function sendMailboxEmail(
  mailboxId: string,
  input: SendMailboxEmailInput,
  triggeredBy = 'operator'
): Promise<SendMailboxEmailResult> {
  const mailboxContext = await getAuthenticatedMailboxContext(mailboxId);

  const to = requireSafeHeaderValue(input.to.trim(), 'Recipient');
  const subject = requireSafeHeaderValue(input.subject.trim(), 'Subject');
  const from = requireSafeHeaderValue(mailboxContext.mailbox.email, 'Mailbox email');
  const body = input.body;

  const rawMessage = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    body
  ].join('\r\n');

  const sendResponse = await mailboxContext.gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: Buffer.from(rawMessage, 'utf8').toString('base64url')
    }
  });

  await withTransaction(async (client) => {
    if (input.sentMessageId) {
      await query(
        `
          UPDATE sent_messages
          SET
            gmail_message_id = COALESCE(gmail_message_id, $2),
            gmail_thread_id = COALESCE(gmail_thread_id, $3)
          WHERE id = $1
        `,
        [
          input.sentMessageId,
          sendResponse.data.id ?? null,
          sendResponse.data.threadId ?? null
        ],
        client
      );

      await logEvent(
        {
          eventType: 'sent_message.gmail_linked',
          entityType: 'sent_message',
          entityId: input.sentMessageId,
          payload: {
            mailbox_id: mailboxContext.mailbox.id,
            gmail_message_id: sendResponse.data.id ?? null,
            gmail_thread_id: sendResponse.data.threadId ?? null
          },
          triggeredBy
        },
        client
      );
    }

    await logEvent(
      {
        eventType: 'mailbox.test_email_sent',
        entityType: 'mailbox',
        entityId: mailboxContext.mailbox.id,
        payload: {
          to,
          sent_message_id: input.sentMessageId ?? null,
          message_id: sendResponse.data.id ?? null,
          thread_id: sendResponse.data.threadId ?? null
        },
        triggeredBy
      },
      client
    );
  });

  return {
    mailboxId: mailboxContext.mailbox.id,
    messageId: sendResponse.data.id ?? null,
    threadId: sendResponse.data.threadId ?? null
  };
}

export async function sendMailboxTestEmail(
  mailboxId: string,
  input: TestSendInput,
  triggeredBy = 'operator'
): Promise<TestSendResult> {
  return sendMailboxEmail(mailboxId, input, triggeredBy);
}
