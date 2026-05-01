import { gmail_v1 } from 'googleapis';

import { HttpError } from '../../api/utils';
import { DbClient, ensureFound, generateId, query, withTransaction } from '../../db/client';
import {
  EmailMessage,
  EmailThread,
  GmailSyncState,
  InboundMessageProcessing,
  Mailbox,
  SentMessage
} from '../../db/types';
import { normalizeEmail } from '../shared/normalization';
import { getAuthenticatedMailboxContext } from './service';
import { logEvent } from '../observability/service';
import { ingestReply } from '../replies/service';

const DEFAULT_SYNC_MAX_RESULTS = 50;
const MAX_SYNC_RESULTS = 200;

export interface MailboxSyncInput {
  maxResults?: number;
}

export interface MailboxSyncResult {
  mailboxId: string;
  syncStateId: string;
  scannedMessages: number;
  insertedMessages: number;
  updatedMessages: number;
  inboundRepliesDetected: number;
  repliesIngested: number;
  repliesSkipped: number;
  lastHistoryId: string | null;
}

interface GmailHeaderMap {
  [key: string]: string;
}

interface ParsedGmailMessage {
  gmailMessageId: string;
  gmailThreadId: string;
  direction: EmailMessage['direction'];
  fromAddress: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  subject: string | null;
  snippet: string | null;
  textBody: string | null;
  htmlBody: string | null;
  internalDate: string | null;
  headers: GmailHeaderMap;
  participants: string[];
}

interface LinkedStoredMessage {
  emailMessage: EmailMessage;
  matchedSentMessageId: string | null;
  matchedBy: string | null;
  inserted: boolean;
}

interface SentMessageCandidate extends SentMessage {
  company_id: string;
  campaign_id: string;
  sequence_step: number;
  contact_email: string | null;
}

function normalizeMailboxEmail(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return normalizeEmail(value);
  } catch {
    return null;
  }
}

function normalizeSubjectForMatching(subject: string | null | undefined): string {
  return (subject ?? '')
    .trim()
    .toLowerCase()
    .replace(/^(?:(?:re|fw|fwd)\s*:\s*)+/i, '')
    .replace(/\s+/g, ' ');
}

function decodeBody(data: string | null | undefined): string | null {
  if (!data) {
    return null;
  }

  try {
    return Buffer.from(data, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

function collectBodies(
  part: gmail_v1.Schema$MessagePart | undefined,
  bodies: { textBody: string | null; htmlBody: string | null }
): void {
  if (!part) {
    return;
  }

  const mimeType = part.mimeType ?? '';
  const body = decodeBody(part.body?.data);
  if (mimeType === 'text/plain' && body && !bodies.textBody) {
    bodies.textBody = body;
  }

  if (mimeType === 'text/html' && body && !bodies.htmlBody) {
    bodies.htmlBody = body;
  }

  for (const child of part.parts ?? []) {
    collectBodies(child, bodies);
  }
}

function toHeaderMap(headers: gmail_v1.Schema$MessagePartHeader[] | undefined): GmailHeaderMap {
  const map: GmailHeaderMap = {};
  for (const header of headers ?? []) {
    if (!header.name || !header.value) {
      continue;
    }

    map[header.name.toLowerCase()] = header.value;
  }

  return map;
}

function extractEmailAddress(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(/<([^>]+)>/);
  const raw = (match?.[1] ?? value).trim().replace(/^"+|"+$/g, '');
  return normalizeMailboxEmail(raw);
}

function extractAddressList(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((entry) => extractEmailAddress(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function extractReferenceIds(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(/\s+/)
        .map((entry) => entry.replace(/[<>]/g, '').trim())
        .filter(Boolean)
    )
  );
}

function parseGmailMessage(
  message: gmail_v1.Schema$Message,
  mailboxEmail: string
): ParsedGmailMessage {
  const payload = message.payload;
  const headers = toHeaderMap(payload?.headers);
  const bodies = { textBody: null as string | null, htmlBody: null as string | null };
  collectBodies(payload, bodies);

  const fromAddress = extractEmailAddress(headers.from);
  const toAddresses = extractAddressList(headers.to);
  const ccAddresses = extractAddressList(headers.cc);
  const bccAddresses = extractAddressList(headers.bcc);
  const participants = Array.from(
    new Set([fromAddress, ...toAddresses, ...ccAddresses, ...bccAddresses].filter(Boolean))
  ) as string[];

  return {
    gmailMessageId: ensureFound(message.id, 'Gmail message id missing.'),
    gmailThreadId: ensureFound(message.threadId, 'Gmail thread id missing.'),
    direction: fromAddress === mailboxEmail ? 'outbound' : 'inbound',
    fromAddress,
    toAddresses,
    ccAddresses,
    bccAddresses,
    subject: headers.subject ?? null,
    snippet: message.snippet ?? null,
    textBody: bodies.textBody,
    htmlBody: bodies.htmlBody,
    internalDate: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null,
    headers,
    participants
  };
}

async function getOrCreateSyncState(mailboxId: string, client?: DbClient): Promise<GmailSyncState> {
  const result = await query<GmailSyncState>(
    `
      INSERT INTO gmail_sync_state (
        id,
        mailbox_id,
        sync_status
      )
      VALUES ($1, $2, 'idle')
      ON CONFLICT (mailbox_id)
      DO UPDATE SET mailbox_id = EXCLUDED.mailbox_id
      RETURNING *
    `,
    [generateId(), mailboxId],
    client
  );

  return ensureFound(result.rows[0], `Sync state upsert failed for mailbox ${mailboxId}.`);
}

async function setSyncStateRunning(stateId: string, client: DbClient): Promise<void> {
  await query(
    `
      UPDATE gmail_sync_state
      SET
        sync_status = 'running',
        last_sync_started_at = NOW(),
        last_error = NULL
      WHERE id = $1
    `,
    [stateId],
    client
  );
}

async function completeSyncState(
  stateId: string,
  data: {
    status: GmailSyncState['sync_status'];
    lastHistoryId: string | null;
    lastMessageInternalAt: string | null;
    lastError?: string | null;
  },
  client: DbClient
): Promise<void> {
  await query(
    `
      UPDATE gmail_sync_state
      SET
        sync_status = $2,
        last_sync_completed_at = NOW(),
        last_history_id = COALESCE($3, last_history_id),
        last_message_internal_at = COALESCE($4, last_message_internal_at),
        last_error = $5
      WHERE id = $1
    `,
    [stateId, data.status, data.lastHistoryId, data.lastMessageInternalAt, data.lastError ?? null],
    client
  );
}

async function findSentMessageByHeaders(
  mailbox: Mailbox,
  fromAddress: string | null,
  toAddresses: string[],
  subject: string | null,
  sentAt: string | null,
  client: DbClient
): Promise<SentMessageCandidate | null> {
  const normalizedFrom = normalizeMailboxEmail(fromAddress);
  if (!normalizedFrom || normalizedFrom !== mailbox.email.toLowerCase() || toAddresses.length === 0) {
    return null;
  }

  const normalizedSubject = normalizeSubjectForMatching(subject);
  const result = await query<SentMessageCandidate>(
    `
      SELECT
        sm.*,
        l.company_id,
        l.campaign_id,
        l.sequence_step,
        c.email AS contact_email
      FROM sent_messages sm
      INNER JOIN leads l ON l.id = sm.lead_id
      INNER JOIN contacts c ON c.id = sm.contact_id
      WHERE lower(COALESCE(sm.from_address, '')) = $1
        AND lower(COALESCE(c.email, '')) = ANY($2::text[])
      ORDER BY sm.sent_at DESC NULLS LAST, sm.created_at DESC
      LIMIT 25
    `,
    [normalizedFrom, toAddresses.map((value) => value.toLowerCase())],
    client
  );

  const sentAtValue = sentAt ? Date.parse(sentAt) : null;
  const candidates = result.rows.filter((candidate) => {
    if (normalizeSubjectForMatching(candidate.subject) !== normalizedSubject) {
      return false;
    }

    if (!sentAtValue || !candidate.sent_at) {
      return true;
    }

    const candidateSentAt = Date.parse(candidate.sent_at);
    return Math.abs(candidateSentAt - sentAtValue) <= 2 * 24 * 60 * 60 * 1000;
  });

  return candidates[0] ?? null;
}

async function matchOutboundSentMessage(
  mailbox: Mailbox,
  message: ParsedGmailMessage,
  client: DbClient
): Promise<{ sentMessageId: string | null; matchedBy: string | null }> {
  const exactResult = await query<{ id: string }>(
    `
      SELECT id
      FROM sent_messages
      WHERE gmail_message_id = $1
         OR (gmail_thread_id = $2 AND lower(COALESCE(from_address, '')) = $3)
      ORDER BY sent_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    `,
    [message.gmailMessageId, message.gmailThreadId, mailbox.email.toLowerCase()],
    client
  );

  if (exactResult.rows[0]) {
    return { sentMessageId: exactResult.rows[0].id, matchedBy: 'gmail_ids' };
  }

  const headerMatch = await findSentMessageByHeaders(
    mailbox,
    message.fromAddress,
    message.toAddresses,
    message.subject,
    message.internalDate,
    client
  );

  if (!headerMatch) {
    return { sentMessageId: null, matchedBy: null };
  }

  return { sentMessageId: headerMatch.id, matchedBy: 'headers' };
}

async function matchInboundSentMessage(
  mailbox: Mailbox,
  message: ParsedGmailMessage,
  client: DbClient
): Promise<{ sentMessageId: string | null; matchedBy: string | null }> {
  const threadResult = await query<{ id: string }>(
    `
      SELECT sm.id
      FROM sent_messages sm
      INNER JOIN contacts c ON c.id = sm.contact_id
      WHERE sm.gmail_thread_id = $1
        AND lower(COALESCE(sm.from_address, '')) = $2
        AND lower(COALESCE(c.email, '')) = $3
      ORDER BY sm.sent_at DESC NULLS LAST, sm.created_at DESC
      LIMIT 1
    `,
    [message.gmailThreadId, mailbox.email.toLowerCase(), message.fromAddress?.toLowerCase() ?? ''],
    client
  );

  if (threadResult.rows[0]) {
    return { sentMessageId: threadResult.rows[0].id, matchedBy: 'gmail_thread' };
  }

  const referenceIds = Array.from(
    new Set([
      ...extractReferenceIds(message.headers['in-reply-to']),
      ...extractReferenceIds(message.headers.references)
    ])
  );

  if (referenceIds.length > 0) {
    const referenceResult = await query<{ id: string }>(
      `
        SELECT id
        FROM sent_messages
        WHERE gmail_message_id = ANY($1::text[])
        ORDER BY sent_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      `,
      [referenceIds],
      client
    );

    if (referenceResult.rows[0]) {
      return { sentMessageId: referenceResult.rows[0].id, matchedBy: 'headers_reference' };
    }
  }

  const sender = message.fromAddress ? [message.fromAddress] : [];
  const fallback = await findSentMessageByHeaders(
    mailbox,
    mailbox.email,
    sender,
    message.subject,
    message.internalDate,
    client
  );

  if (!fallback) {
    return { sentMessageId: null, matchedBy: null };
  }

  return { sentMessageId: fallback.id, matchedBy: 'headers_fallback' };
}

async function upsertThread(
  mailboxId: string,
  gmailThreadId: string,
  subject: string | null,
  participants: string[],
  internalDate: string | null,
  client: DbClient
): Promise<EmailThread> {
  const result = await query<EmailThread>(
    `
      INSERT INTO email_threads (
        id,
        mailbox_id,
        gmail_thread_id,
        subject,
        participants,
        first_message_at,
        last_message_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $6)
      ON CONFLICT (mailbox_id, gmail_thread_id)
      DO UPDATE SET
        subject = COALESCE(email_threads.subject, EXCLUDED.subject),
        participants = EXCLUDED.participants,
        first_message_at = COALESCE(email_threads.first_message_at, EXCLUDED.first_message_at),
        last_message_at = GREATEST(
          COALESCE(email_threads.last_message_at, EXCLUDED.last_message_at),
          EXCLUDED.last_message_at
        ),
        updated_at = NOW()
      RETURNING *
    `,
    [
      generateId(),
      mailboxId,
      gmailThreadId,
      subject,
      JSON.stringify(participants),
      internalDate
    ],
    client
  );

  return ensureFound(result.rows[0], `Email thread upsert failed for ${gmailThreadId}.`);
}

async function upsertEmailMessage(
  mailbox: Mailbox,
  emailThread: EmailThread,
  parsedMessage: ParsedGmailMessage,
  linkedSentMessageId: string | null,
  client: DbClient
): Promise<{ emailMessage: EmailMessage; inserted: boolean }> {
  const result = await query<EmailMessage & { inserted: boolean }>(
    `
      INSERT INTO email_messages (
        id,
        mailbox_id,
        email_thread_id,
        gmail_message_id,
        gmail_thread_id,
        direction,
        from_address,
        to_addresses,
        cc_addresses,
        bcc_addresses,
        subject,
        snippet,
        text_body,
        html_body,
        gmail_internal_date,
        headers,
        sent_message_id
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8::jsonb, $9::jsonb, $10::jsonb,
        $11, $12, $13, $14, $15, $16::jsonb, $17
      )
      ON CONFLICT (mailbox_id, gmail_message_id)
      DO UPDATE SET
        email_thread_id = EXCLUDED.email_thread_id,
        gmail_thread_id = EXCLUDED.gmail_thread_id,
        direction = EXCLUDED.direction,
        from_address = EXCLUDED.from_address,
        to_addresses = EXCLUDED.to_addresses,
        cc_addresses = EXCLUDED.cc_addresses,
        bcc_addresses = EXCLUDED.bcc_addresses,
        subject = EXCLUDED.subject,
        snippet = EXCLUDED.snippet,
        text_body = COALESCE(email_messages.text_body, EXCLUDED.text_body),
        html_body = COALESCE(email_messages.html_body, EXCLUDED.html_body),
        gmail_internal_date = EXCLUDED.gmail_internal_date,
        headers = EXCLUDED.headers,
        sent_message_id = COALESCE(email_messages.sent_message_id, EXCLUDED.sent_message_id),
        updated_at = NOW()
      RETURNING email_messages.*, (xmax = 0) AS inserted
    `,
    [
      generateId(),
      mailbox.id,
      emailThread.id,
      parsedMessage.gmailMessageId,
      parsedMessage.gmailThreadId,
      parsedMessage.direction,
      parsedMessage.fromAddress,
      JSON.stringify(parsedMessage.toAddresses),
      JSON.stringify(parsedMessage.ccAddresses),
      JSON.stringify(parsedMessage.bccAddresses),
      parsedMessage.subject,
      parsedMessage.snippet,
      parsedMessage.textBody,
      parsedMessage.htmlBody,
      parsedMessage.internalDate,
      JSON.stringify(parsedMessage.headers),
      linkedSentMessageId
    ],
    client
  );

  const row = ensureFound(result.rows[0], `Email message upsert failed for ${parsedMessage.gmailMessageId}.`);
  return {
    emailMessage: row,
    inserted: row.inserted
  };
}

async function upsertProcessingState(
  emailMessageId: string,
  input: {
    status: InboundMessageProcessing['status'];
    matchedSentMessageId?: string | null;
    matchedBy?: string | null;
    replyId?: string | null;
    notes?: string | null;
    errorMessage?: string | null;
  },
  client: DbClient
): Promise<InboundMessageProcessing> {
  const result = await query<InboundMessageProcessing>(
    `
      INSERT INTO inbound_message_processing (
        id,
        email_message_id,
        status,
        matched_sent_message_id,
        matched_by,
        reply_id,
        notes,
        error_message
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (email_message_id)
      DO UPDATE SET
        status = EXCLUDED.status,
        matched_sent_message_id = EXCLUDED.matched_sent_message_id,
        matched_by = EXCLUDED.matched_by,
        reply_id = EXCLUDED.reply_id,
        notes = EXCLUDED.notes,
        error_message = EXCLUDED.error_message,
        updated_at = NOW()
      RETURNING *
    `,
    [
      generateId(),
      emailMessageId,
      input.status,
      input.matchedSentMessageId ?? null,
      input.matchedBy ?? null,
      input.replyId ?? null,
      input.notes ?? null,
      input.errorMessage ?? null
    ],
    client
  );

  return ensureFound(result.rows[0], `Inbound processing upsert failed for ${emailMessageId}.`);
}

async function storeGmailMessage(
  mailbox: Mailbox,
  parsedMessage: ParsedGmailMessage,
  client: DbClient
): Promise<LinkedStoredMessage> {
  const match =
    parsedMessage.direction === 'outbound'
      ? await matchOutboundSentMessage(mailbox, parsedMessage, client)
      : await matchInboundSentMessage(mailbox, parsedMessage, client);

  const emailThread = await upsertThread(
    mailbox.id,
    parsedMessage.gmailThreadId,
    parsedMessage.subject,
    parsedMessage.participants,
    parsedMessage.internalDate,
    client
  );

  const { emailMessage, inserted } = await upsertEmailMessage(
    mailbox,
    emailThread,
    parsedMessage,
    match.sentMessageId,
    client
  );

  if (parsedMessage.direction === 'outbound' && match.sentMessageId) {
    await query(
      `
        UPDATE sent_messages
        SET
          gmail_message_id = COALESCE(gmail_message_id, $2),
          gmail_thread_id = COALESCE(gmail_thread_id, $3)
        WHERE id = $1
      `,
      [match.sentMessageId, parsedMessage.gmailMessageId, parsedMessage.gmailThreadId],
      client
    );
  }

  return {
    emailMessage,
    matchedSentMessageId: match.sentMessageId,
    matchedBy: match.matchedBy,
    inserted
  };
}

async function fetchRecentMessages(
  gmail: gmail_v1.Gmail,
  state: GmailSyncState,
  maxResults: number
): Promise<gmail_v1.Schema$Message[]> {
  const afterTimestamp =
    state.last_message_internal_at
      ? Math.max(0, Math.floor(Date.parse(state.last_message_internal_at) / 1000) - 300)
      : null;

  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    q: afterTimestamp ? `after:${afterTimestamp}` : undefined,
    includeSpamTrash: false
  });

  const messageRefs = listResponse.data.messages ?? [];
  const messages = await Promise.all(
    messageRefs.map(async (messageRef) => {
      const messageId = messageRef.id;
      if (!messageId) {
        return null;
      }

      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      return detail.data;
    })
  );

  return messages.filter((message): message is gmail_v1.Schema$Message => Boolean(message));
}

export async function syncMailbox(
  mailboxId: string,
  input: MailboxSyncInput = {},
  triggeredBy = 'operator',
  clientId?: string
): Promise<MailboxSyncResult> {
  const mailboxContext = await getAuthenticatedMailboxContext(mailboxId, {
    clientId,
    purpose: 'sync'
  });
  const syncState = await getOrCreateSyncState(mailboxId);
  const maxResults = Math.min(Math.max(input.maxResults ?? DEFAULT_SYNC_MAX_RESULTS, 1), MAX_SYNC_RESULTS);

  await withTransaction(async (client) => {
    await setSyncStateRunning(syncState.id, client);
    await logEvent(
      {
        eventType: 'mailbox.sync_started',
        entityType: 'mailbox',
        entityId: mailboxId,
        payload: { max_results: maxResults, sync_state_id: syncState.id },
        triggeredBy
      },
      client
    );
  });

  let scannedMessages = 0;
  let insertedMessages = 0;
  let updatedMessages = 0;
  let inboundRepliesDetected = 0;
  let repliesIngested = 0;
  let repliesSkipped = 0;
  let lastHistoryId: string | null = null;
  let lastMessageInternalAt: string | null = null;

  try {
    const messages = await fetchRecentMessages(mailboxContext.gmail, syncState, maxResults);
    scannedMessages = messages.length;

    for (const gmailMessage of messages) {
      const parsedMessage = parseGmailMessage(gmailMessage, mailboxContext.mailbox.email.toLowerCase());
      lastHistoryId = gmailMessage.historyId ?? lastHistoryId;
      if (parsedMessage.internalDate && (!lastMessageInternalAt || parsedMessage.internalDate > lastMessageInternalAt)) {
        lastMessageInternalAt = parsedMessage.internalDate;
      }

      const stored = await withTransaction(async (client) => {
        return storeGmailMessage(mailboxContext.mailbox, parsedMessage, client);
      });

      if (stored.inserted) {
        insertedMessages += 1;
      } else {
        updatedMessages += 1;
      }

      if (parsedMessage.direction !== 'inbound') {
        continue;
      }

      inboundRepliesDetected += 1;

      const processingResult = await query<InboundMessageProcessing>(
        `
          SELECT *
          FROM inbound_message_processing
          WHERE email_message_id = $1
        `,
        [stored.emailMessage.id]
      );
      const existingProcessing = processingResult.rows[0] ?? null;
      if (existingProcessing?.status === 'ingested') {
        repliesSkipped += 1;
        continue;
      }

      if (!stored.matchedSentMessageId) {
        await withTransaction(async (client) => {
          await upsertProcessingState(
            stored.emailMessage.id,
            {
              status: 'skipped',
              notes: 'No matching sent message found for inbound Gmail message.'
            },
            client
          );
        });
        repliesSkipped += 1;
        continue;
      }

      const replyBody =
        parsedMessage.textBody ??
        parsedMessage.snippet ??
        parsedMessage.subject ??
        '(empty Gmail reply body)';

      try {
        const reply = await ingestReply(
          {
            sent_message_id: stored.matchedSentMessageId,
            raw_content: replyBody,
            received_at: parsedMessage.internalDate ?? undefined
          },
          'system'
        );

        await withTransaction(async (client) => {
          await upsertProcessingState(
            stored.emailMessage.id,
            {
              status: 'ingested',
              matchedSentMessageId: stored.matchedSentMessageId,
              matchedBy: stored.matchedBy,
              replyId: reply.id,
              notes: 'Inbound Gmail reply ingested successfully.'
            },
            client
          );

          await logEvent(
            {
              eventType: 'mailbox.reply_detected',
              entityType: 'mailbox',
              entityId: mailboxId,
              payload: {
                email_message_id: stored.emailMessage.id,
                sent_message_id: stored.matchedSentMessageId,
                reply_id: reply.id,
                matched_by: stored.matchedBy
              },
              triggeredBy
            },
            client
          );
        });

        repliesIngested += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await withTransaction(async (client) => {
          await upsertProcessingState(
            stored.emailMessage.id,
            {
              status: 'error',
              matchedSentMessageId: stored.matchedSentMessageId,
              matchedBy: stored.matchedBy,
              errorMessage: message
            },
            client
          );
        });
        throw error;
      }
    }

    await withTransaction(async (client) => {
      await completeSyncState(
        syncState.id,
        {
          status: 'completed',
          lastHistoryId,
          lastMessageInternalAt
        },
        client
      );

      await logEvent(
        {
          eventType: 'mailbox.sync_completed',
          entityType: 'mailbox',
          entityId: mailboxId,
          payload: {
            sync_state_id: syncState.id,
            scanned_messages: scannedMessages,
            inserted_messages: insertedMessages,
            updated_messages: updatedMessages,
            inbound_replies_detected: inboundRepliesDetected,
            replies_ingested: repliesIngested,
            replies_skipped: repliesSkipped,
            last_history_id: lastHistoryId
          },
          triggeredBy
        },
        client
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await withTransaction(async (client) => {
      await completeSyncState(
        syncState.id,
        {
          status: 'failed',
          lastHistoryId,
          lastMessageInternalAt,
          lastError: message
        },
        client
      );

      await logEvent(
        {
          eventType: 'mailbox.sync_failed',
          entityType: 'mailbox',
          entityId: mailboxId,
          payload: {
            sync_state_id: syncState.id,
            error: message
          },
          triggeredBy
        },
        client
      );
    });

    throw error;
  }

  return {
    mailboxId,
    syncStateId: syncState.id,
    scannedMessages,
    insertedMessages,
    updatedMessages,
    inboundRepliesDetected,
    repliesIngested,
    repliesSkipped,
    lastHistoryId
  };
}
