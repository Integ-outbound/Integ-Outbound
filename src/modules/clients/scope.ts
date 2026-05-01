import { HttpError } from '../../api/utils';
import { DbClient, query } from '../../db/client';
import { Campaign, Draft, Lead, Mailbox, Reply, SentMessage } from '../../db/types';

export const DEFAULT_CLIENT_ID = '00000000-0000-0000-0000-000000000001';

const HUMAN_REVIEW_REPLY_CLASSIFICATIONS = new Set<
  NonNullable<Reply['classification']>
>(['positive', 'question', 'referral', 'neutral']);

export function resolveClientId(clientId?: string | null): string {
  return clientId?.trim() || DEFAULT_CLIENT_ID;
}

export function requireClientContext(clientId: string | null | undefined, operation: string): string {
  const resolvedClientId = clientId?.trim();
  if (!resolvedClientId) {
    throw new HttpError(400, `${operation} requires client_id.`);
  }

  return resolvedClientId;
}

export function appendClientScope(
  conditions: string[],
  params: unknown[],
  qualifiedColumn: string,
  clientId?: string
): void {
  if (!clientId) {
    return;
  }

  params.push(resolveClientId(clientId));
  conditions.push(`${qualifiedColumn} = $${params.length}`);
}

export function canReassignOwnedRecord(
  currentClientId: string,
  nextClientId: string
): boolean {
  return currentClientId === nextClientId || currentClientId === DEFAULT_CLIENT_ID;
}

export function shouldGenerateSuggestedReply(
  classification: Reply['classification'],
  routingDecision: Reply['routing_decision']
): classification is NonNullable<Reply['classification']> {
  return (
    routingDecision === 'human_review' &&
    classification !== null &&
    HUMAN_REVIEW_REPLY_CLASSIFICATIONS.has(classification)
  );
}

function assertMatchingClientOwnership(
  actualClientId: string,
  expectedClientId: string,
  entityLabel: string,
  entityId: string
): void {
  if (actualClientId !== expectedClientId) {
    throw new HttpError(
      403,
      `${entityLabel} ${entityId} does not belong to client ${expectedClientId}.`
    );
  }
}

async function assertOwnedRecord<T extends { client_id: string }>(
  entityLabel: string,
  entityId: string,
  expectedClientId: string,
  sql: string,
  dbClient?: DbClient
): Promise<T> {
  const result = await query<T>(sql, [entityId], dbClient);
  const record = result.rows[0];
  if (!record) {
    throw new HttpError(404, `${entityLabel} ${entityId} not found.`);
  }

  assertMatchingClientOwnership(record.client_id, expectedClientId, entityLabel, entityId);
  return record;
}

export async function assertMailboxBelongsToClient(
  mailboxId: string,
  clientId: string,
  dbClient?: DbClient
): Promise<Mailbox> {
  return assertOwnedRecord<Mailbox>(
    'Mailbox',
    mailboxId,
    clientId,
    'SELECT * FROM mailboxes WHERE id = $1',
    dbClient
  );
}

export async function assertCampaignBelongsToClient(
  campaignId: string,
  clientId: string,
  dbClient?: DbClient
): Promise<Campaign> {
  return assertOwnedRecord<Campaign>(
    'Campaign',
    campaignId,
    clientId,
    'SELECT * FROM campaigns WHERE id = $1',
    dbClient
  );
}

export async function assertLeadBelongsToClient(
  leadId: string,
  clientId: string,
  dbClient?: DbClient
): Promise<Lead> {
  return assertOwnedRecord<Lead>(
    'Lead',
    leadId,
    clientId,
    'SELECT * FROM leads WHERE id = $1',
    dbClient
  );
}

export async function assertDraftBelongsToClient(
  draftId: string,
  clientId: string,
  dbClient?: DbClient
): Promise<Draft & { client_id: string }> {
  return assertOwnedRecord<Draft & { client_id: string }>(
    'Draft',
    draftId,
    clientId,
    `
      SELECT d.*, l.client_id
      FROM drafts d
      INNER JOIN leads l ON l.id = d.lead_id
      WHERE d.id = $1
    `,
    dbClient
  );
}

export async function assertReplyBelongsToClient(
  replyId: string,
  clientId: string,
  dbClient?: DbClient
): Promise<Reply> {
  return assertOwnedRecord<Reply>(
    'Reply',
    replyId,
    clientId,
    'SELECT * FROM replies WHERE id = $1',
    dbClient
  );
}

export async function assertSentMessageBelongsToClient(
  sentMessageId: string,
  clientId: string,
  dbClient?: DbClient
): Promise<SentMessage> {
  return assertOwnedRecord<SentMessage>(
    'Sent message',
    sentMessageId,
    clientId,
    'SELECT * FROM sent_messages WHERE id = $1',
    dbClient
  );
}

export async function assertLeadIdsBelongToClient(
  leadIds: string[],
  clientId: string,
  dbClient?: DbClient
): Promise<Lead[]> {
  const result = await query<Lead>(
    `
      SELECT *
      FROM leads
      WHERE id = ANY($1::uuid[])
    `,
    [leadIds],
    dbClient
  );

  if (result.rows.length !== leadIds.length) {
    const foundLeadIds = new Set(result.rows.map((row) => row.id));
    const missingLeadId = leadIds.find((leadId) => !foundLeadIds.has(leadId));
    throw new HttpError(404, `Lead ${missingLeadId ?? 'unknown'} not found.`);
  }

  for (const lead of result.rows) {
    assertMatchingClientOwnership(lead.client_id, clientId, 'Lead', lead.id);
  }

  return result.rows;
}
