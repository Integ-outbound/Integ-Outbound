import { HttpError } from '../../api/utils';
import { ensureFound, generateId, query, withTransaction } from '../../db/client';
import { Client } from '../../db/types';
import type { MailboxStatusView } from '../mailboxes/operations';
import { logEvent } from '../observability/service';
import { DEFAULT_CLIENT_ID } from './scope';

export interface CreateClientInput {
  name: string;
  slug?: string;
  company_domain?: string | null;
  operator_name?: string | null;
  operator_email?: string | null;
  service_type?: string | null;
  target_icp_notes?: string | null;
  is_active?: boolean;
}

export interface CreateSignupClientInput {
  company_name: string;
  domain: string;
  founder_operator_name: string;
  email: string;
  service_type: string;
  target_icp_notes: string;
}

export interface ClientFilters {
  is_active?: boolean;
}

export interface ClientOnboardingStatus {
  client: Client;
  checklist: {
    client_profile_created: boolean;
    gmail_connected: boolean;
    calendar_connected: boolean;
    first_campaign_not_started: boolean;
    operator_review_pending: boolean;
  };
  counts: {
    total_campaigns: number;
    active_campaigns: number;
    drafts_pending_review: number;
    replies_pending_review: number;
    send_ready: number;
    failed_send_attempts: number;
  };
  mailboxes: MailboxStatusView[];
}

function computeSyncHealth(mailbox: {
  sync_status: string | null;
  last_sync_completed_at: string | null;
  last_error: string | null;
}): MailboxStatusView['sync_health'] {
  if (mailbox.sync_status === 'running') {
    return 'running';
  }

  if (mailbox.sync_status === 'failed' || mailbox.last_error) {
    return 'error';
  }

  if (!mailbox.last_sync_completed_at) {
    return 'never_synced';
  }

  const ageMs = Date.now() - Date.parse(mailbox.last_sync_completed_at);
  if (Number.isFinite(ageMs) && ageMs > 15 * 60 * 1000) {
    return 'stale';
  }

  return 'healthy';
}

async function listClientMailboxStatuses(clientId: string): Promise<MailboxStatusView[]> {
  const result = await query<
    MailboxStatusView & {
      provider: 'google';
      last_sync_completed_at: string | null;
      sync_status: string | null;
      last_error: string | null;
      daily_send_count: string;
    }
  >(
    `
      SELECT
        m.id,
        m.client_id,
        m.email,
        m.provider,
        m.status,
        m.is_active,
        m.daily_send_limit,
        m.consecutive_auth_failures,
        m.last_auth_failed_at,
        gs.last_sync_completed_at,
        gs.sync_status,
        gs.last_error,
        COALESCE(today_sends.daily_send_count, '0') AS daily_send_count
      FROM mailboxes m
      LEFT JOIN gmail_sync_state gs ON gs.mailbox_id = m.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::text AS daily_send_count
        FROM mailbox_send_attempts msa
        WHERE msa.mailbox_id = m.id
          AND msa.status = 'sent'
          AND timezone('UTC', msa.attempted_at)::date = timezone('UTC', NOW())::date
      ) today_sends ON true
      WHERE m.client_id = $1
      ORDER BY m.created_at ASC
    `,
    [clientId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    client_id: row.client_id,
    email: row.email,
    provider: row.provider,
    status: row.status,
    is_active: row.is_active,
    last_sync_time: row.last_sync_completed_at,
    sync_health: computeSyncHealth(row),
    daily_send_count: Number(row.daily_send_count ?? 0),
    daily_send_limit: row.daily_send_limit,
    consecutive_auth_failures: row.consecutive_auth_failures,
    last_auth_failed_at: row.last_auth_failed_at
  }));
}

function slugifyClientName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function getClient(clientId: string): Promise<Client | null> {
  const result = await query<Client>(
    `
      SELECT *
      FROM clients
      WHERE id = $1
    `,
    [clientId]
  );

  return result.rows[0] ?? null;
}

export async function ensureClientExists(clientId?: string | null): Promise<Client> {
  const resolvedClientId = clientId?.trim() || DEFAULT_CLIENT_ID;
  const client = await getClient(resolvedClientId);
  if (!client) {
    throw new HttpError(404, `Client ${resolvedClientId} not found.`);
  }

  if (!client.is_active) {
    throw new HttpError(409, `Client ${resolvedClientId} is inactive.`);
  }

  return client;
}

export async function listClients(filters: ClientFilters = {}): Promise<Client[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.is_active !== undefined) {
    params.push(filters.is_active);
    conditions.push(`is_active = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query<Client>(
    `
      SELECT *
      FROM clients
      ${whereClause}
      ORDER BY created_at ASC
    `,
    params
  );

  return result.rows;
}

export async function createClient(
  data: CreateClientInput,
  triggeredBy = 'operator'
): Promise<Client> {
  const slug = data.slug?.trim() || slugifyClientName(data.name);
  if (!slug) {
    throw new HttpError(400, 'Client slug could not be generated from the provided name.');
  }

  return withTransaction(async (client) => {
    const normalizedDomain = data.company_domain?.trim().toLowerCase() || null;
    if (normalizedDomain) {
      const existingDomainResult = await query<Client>(
        `
          SELECT *
          FROM clients
          WHERE lower(company_domain) = lower($1)
          LIMIT 1
        `,
        [normalizedDomain],
        client
      );

      if (existingDomainResult.rows[0]) {
        throw new HttpError(409, `Client domain ${normalizedDomain} already exists.`);
      }
    }

    const existingResult = await query<Client>(
      `
        SELECT *
        FROM clients
        WHERE slug = $1
        LIMIT 1
      `,
      [slug],
      client
    );

    if (existingResult.rows[0]) {
      throw new HttpError(409, `Client slug ${slug} already exists.`);
    }

    const result = await query<Client>(
      `
        INSERT INTO clients (
          id,
          slug,
          name,
          company_domain,
          operator_name,
          operator_email,
          service_type,
          target_icp_notes,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `,
      [
        generateId(),
        slug,
        data.name.trim(),
        normalizedDomain,
        data.operator_name?.trim() || null,
        data.operator_email?.trim().toLowerCase() || null,
        data.service_type?.trim() || null,
        data.target_icp_notes?.trim() || null,
        data.is_active ?? true
      ],
      client
    );

    const created = ensureFound(result.rows[0], 'Client creation failed.');
    await logEvent(
      {
        eventType: 'client.created',
        entityType: 'client',
        entityId: created.id,
        payload: {
          slug: created.slug,
          company_domain: created.company_domain,
          operator_email: created.operator_email,
          is_active: created.is_active
        },
        triggeredBy
      },
      client
    );

    return created;
  });
}

export async function createSignupClient(
  data: CreateSignupClientInput,
  triggeredBy = 'signup'
): Promise<Client> {
  return createClient(
    {
      name: data.company_name,
      company_domain: data.domain,
      operator_name: data.founder_operator_name,
      operator_email: data.email,
      service_type: data.service_type,
      target_icp_notes: data.target_icp_notes,
      is_active: true
    },
    triggeredBy
  );
}

export async function getClientMailboxes(clientId: string): Promise<MailboxStatusView[]> {
  await ensureClientExists(clientId);
  return listClientMailboxStatuses(clientId);
}

export async function getClientOnboardingStatus(clientId: string): Promise<ClientOnboardingStatus> {
  const client = await ensureClientExists(clientId);
  const mailboxes = await listClientMailboxStatuses(clientId);

  const [
    campaignsResult,
    pendingDraftsResult,
    repliesResult,
    sendReadyResult,
    failedSendAttemptsResult
  ] = await Promise.all([
    query<{ total_count: string; active_count: string }>(
      `
        SELECT
          COUNT(*)::text AS total_count,
          COUNT(*) FILTER (WHERE status = 'active')::text AS active_count
        FROM campaigns
        WHERE client_id = $1
      `,
      [clientId]
    ),
    query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM leads l
        WHERE l.client_id = $1
          AND l.status = 'pending_review'
          AND EXISTS (
            SELECT 1
            FROM drafts d
            WHERE d.lead_id = l.id
          )
      `,
      [clientId]
    ),
    query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM replies
        WHERE client_id = $1
          AND handled = false
          AND routing_decision = 'human_review'
      `,
      [clientId]
    ),
    query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM leads
        WHERE client_id = $1
          AND status = 'send_ready'
      `,
      [clientId]
    ),
    query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM mailbox_send_attempts msa
        INNER JOIN leads l ON l.id = msa.lead_id
        WHERE l.client_id = $1
          AND msa.status = 'failed'
      `,
      [clientId]
    )
  ]);

  const totalCampaigns = Number(campaignsResult.rows[0]?.total_count ?? 0);
  const activeCampaigns = Number(campaignsResult.rows[0]?.active_count ?? 0);
  const connectedMailboxes = mailboxes.filter((mailbox) => mailbox.status === 'connected');
  const profileCreated = Boolean(
    client.name &&
      client.company_domain &&
      client.operator_name &&
      client.operator_email &&
      client.service_type &&
      client.target_icp_notes
  );

  return {
    client,
    checklist: {
      client_profile_created: profileCreated,
      gmail_connected: connectedMailboxes.length > 0,
      calendar_connected: false,
      first_campaign_not_started: totalCampaigns === 0,
      operator_review_pending: totalCampaigns === 0
    },
    counts: {
      total_campaigns: totalCampaigns,
      active_campaigns: activeCampaigns,
      drafts_pending_review: Number(pendingDraftsResult.rows[0]?.count ?? 0),
      replies_pending_review: Number(repliesResult.rows[0]?.count ?? 0),
      send_ready: Number(sendReadyResult.rows[0]?.count ?? 0),
      failed_send_attempts: Number(failedSendAttemptsResult.rows[0]?.count ?? 0)
    },
    mailboxes
  };
}
