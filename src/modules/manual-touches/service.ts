import * as db from '../../db/client';
import type { ManualTouch } from '../../db/types';
import * as observability from '../observability/service';

export type ManualTouchChannel =
  | 'email'
  | 'linkedin'
  | 'instagram'
  | 'facebook'
  | 'contact_form'
  | 'whatsapp'
  | 'other';

export type ManualTouchStatus =
  | 'planned'
  | 'sent'
  | 'replied'
  | 'interested'
  | 'rejected'
  | 'booked_call'
  | 'closed';

export interface CreateManualTouchInput {
  client_id?: string | null;
  lead_id?: string | null;
  company_name?: string | null;
  person_name?: string | null;
  channel: ManualTouchChannel;
  message_body?: string | null;
  status?: ManualTouchStatus;
  sent_at?: string | null;
  reply_at?: string | null;
  notes?: string | null;
}

export interface UpdateManualTouchInput {
  client_id?: string | null;
  lead_id?: string | null;
  company_name?: string | null;
  person_name?: string | null;
  channel?: ManualTouchChannel;
  message_body?: string | null;
  status?: ManualTouchStatus;
  sent_at?: string | null;
  reply_at?: string | null;
  notes?: string | null;
}

export interface ManualTouchFilters {
  channel?: ManualTouchChannel;
  status?: ManualTouchStatus;
  client_id?: string;
  limit?: number;
}

const REPLY_LIKE_STATUSES = new Set<ManualTouchStatus>([
  'replied',
  'interested',
  'rejected',
  'booked_call',
  'closed'
]);

function normalizeOptional(value?: string | null): string | null {
  const normalized = value?.trim() ?? '';
  return normalized ? normalized : null;
}

function resolveSentAt(status: ManualTouchStatus, sentAt?: string | null, existing?: string | null): string | null {
  if (normalizeOptional(sentAt)) {
    return normalizeOptional(sentAt);
  }

  if (existing) {
    return existing;
  }

  return status === 'sent' || REPLY_LIKE_STATUSES.has(status) ? new Date().toISOString() : null;
}

function resolveReplyAt(status: ManualTouchStatus, replyAt?: string | null, existing?: string | null): string | null {
  if (normalizeOptional(replyAt)) {
    return normalizeOptional(replyAt);
  }

  if (existing) {
    return existing;
  }

  return REPLY_LIKE_STATUSES.has(status) ? new Date().toISOString() : null;
}

export async function createManualTouch(
  input: CreateManualTouchInput,
  triggeredBy = 'operator'
): Promise<ManualTouch> {
  const status = input.status ?? 'planned';
  const sentAt = resolveSentAt(status, input.sent_at);
  const replyAt = resolveReplyAt(status, input.reply_at);

  return db.withTransaction(async (client) => {
    const result = await db.query<ManualTouch>(
      `
        INSERT INTO manual_touches (
          id,
          client_id,
          lead_id,
          company_name,
          person_name,
          channel,
          message_body,
          status,
          sent_at,
          reply_at,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `,
      [
        db.generateId(),
        normalizeOptional(input.client_id),
        normalizeOptional(input.lead_id),
        normalizeOptional(input.company_name),
        normalizeOptional(input.person_name),
        input.channel,
        normalizeOptional(input.message_body),
        status,
        sentAt,
        replyAt,
        normalizeOptional(input.notes)
      ],
      client
    );

    const manualTouch = db.ensureFound(result.rows[0], 'Manual touch creation failed.');
    await observability.logEvent(
      {
        eventType: 'manual_touch.created',
        entityType: 'manual_touch',
        entityId: manualTouch.id,
        payload: {
          client_id: manualTouch.client_id,
          lead_id: manualTouch.lead_id,
          channel: manualTouch.channel,
          status: manualTouch.status
        },
        triggeredBy
      },
      client
    );

    return manualTouch;
  });
}

export async function listManualTouches(filters: ManualTouchFilters = {}): Promise<ManualTouch[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.channel) {
    params.push(filters.channel);
    conditions.push(`channel = $${params.length}`);
  }

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }

  if (filters.client_id) {
    params.push(filters.client_id);
    conditions.push(`client_id = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  if (filters.limit) {
    params.push(filters.limit);
  }
  const limitClause = filters.limit ? `LIMIT $${params.length}` : '';

  const result = await db.query<ManualTouch>(
    `
      SELECT *
      FROM manual_touches
      ${whereClause}
      ORDER BY COALESCE(sent_at, created_at) DESC, created_at DESC
      ${limitClause}
    `,
    params
  );

  return result.rows;
}

export async function updateManualTouch(
  id: string,
  input: UpdateManualTouchInput,
  triggeredBy = 'operator'
): Promise<ManualTouch> {
  return db.withTransaction(async (client) => {
    const existingResult = await db.query<ManualTouch>(
      `
        SELECT *
        FROM manual_touches
        WHERE id = $1
      `,
      [id],
      client
    );

    const existing = db.ensureFound(existingResult.rows[0], `Manual touch ${id} not found.`);
    const status = input.status ?? existing.status;
    const updated = {
      client_id: input.client_id !== undefined ? normalizeOptional(input.client_id) : existing.client_id,
      lead_id: input.lead_id !== undefined ? normalizeOptional(input.lead_id) : existing.lead_id,
      company_name:
        input.company_name !== undefined ? normalizeOptional(input.company_name) : existing.company_name,
      person_name:
        input.person_name !== undefined ? normalizeOptional(input.person_name) : existing.person_name,
      channel: input.channel ?? existing.channel,
      message_body:
        input.message_body !== undefined ? normalizeOptional(input.message_body) : existing.message_body,
      status,
      sent_at: resolveSentAt(status, input.sent_at, existing.sent_at),
      reply_at: resolveReplyAt(status, input.reply_at, existing.reply_at),
      notes: input.notes !== undefined ? normalizeOptional(input.notes) : existing.notes
    };

    const result = await db.query<ManualTouch>(
      `
        UPDATE manual_touches
        SET
          client_id = $2,
          lead_id = $3,
          company_name = $4,
          person_name = $5,
          channel = $6,
          message_body = $7,
          status = $8,
          sent_at = $9,
          reply_at = $10,
          notes = $11
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        updated.client_id,
        updated.lead_id,
        updated.company_name,
        updated.person_name,
        updated.channel,
        updated.message_body,
        updated.status,
        updated.sent_at,
        updated.reply_at,
        updated.notes
      ],
      client
    );

    const manualTouch = db.ensureFound(result.rows[0], `Manual touch ${id} update failed.`);
    await observability.logEvent(
      {
        eventType: 'manual_touch.updated',
        entityType: 'manual_touch',
        entityId: manualTouch.id,
        payload: {
          client_id: manualTouch.client_id,
          lead_id: manualTouch.lead_id,
          channel: manualTouch.channel,
          status: manualTouch.status
        },
        triggeredBy
      },
      client
    );

    return manualTouch;
  });
}
