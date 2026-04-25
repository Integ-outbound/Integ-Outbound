import { HttpError } from '../../api/utils';
import { ensureFound, generateId, query, withTransaction } from '../../db/client';
import { Campaign, Company, Contact, Draft, Lead, Mailbox, MailboxSendAttempt } from '../../db/types';
import { logEvent } from '../observability/service';
import { sendMailboxEmail } from './service';
import { syncMailbox } from './sync';
import { markSent } from '../sending/service';

const DEFAULT_SYNC_JOB_LIMIT = 25;
const DEFAULT_SEND_READY_LIMIT = 10;
const AUTH_FAILURE_THRESHOLD = 3;
const LEAD_SEND_FAILURE_THRESHOLD = 3;

export interface MailboxStatusView {
  id: string;
  email: string;
  provider: Mailbox['provider'];
  status: Mailbox['status'];
  is_active: boolean;
  last_sync_time: string | null;
  sync_health: 'healthy' | 'stale' | 'error' | 'never_synced' | 'running';
  daily_send_count: number;
  daily_send_limit: number;
  consecutive_auth_failures: number;
  last_auth_failed_at: string | null;
}

export interface ProcessSendReadyResult {
  attempted: number;
  sent: number;
  blocked: number;
  failed: number;
  results: Array<{
    leadId: string;
    status: 'sent' | 'blocked' | 'failed';
    reason?: string;
    mailboxId?: string | null;
    sentMessageId?: string | null;
    gmailMessageId?: string | null;
    gmailThreadId?: string | null;
  }>;
}

type GmailFailureCategory = NonNullable<MailboxSendAttempt['failure_category']>;

interface LeadSendContext {
  lead: Lead;
  campaign: Campaign;
  company: {
    id: string;
    suppressed: boolean;
    outreach_status: string;
  };
  contact: Contact;
  latestDraft: Draft | null;
}

interface AvailableMailbox extends MailboxStatusView {}

interface BlockLeadSendOptions {
  leadStatus?: Lead['status'];
  companyOutreachStatus?: Company['outreach_status'];
  clearNextStepAt?: boolean;
}

function truncateMessage(value: string | null | undefined, max = 500): string | null {
  if (!value) {
    return null;
  }

  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function utcDayCondition(column: string): string {
  return `timezone('UTC', ${column})::date = timezone('UTC', NOW())::date`;
}

function classifyGmailError(error: unknown): {
  category: GmailFailureCategory;
  code: string | null;
  message: string;
} {
  if (error instanceof HttpError) {
    return {
      category: 'validation_error',
      code: String(error.statusCode),
      message: error.message
    };
  }

  if (typeof error === 'object' && error !== null) {
    const maybeError = error as {
      code?: number | string;
      message?: string;
      response?: { status?: number; data?: unknown };
      errors?: Array<{ reason?: string; message?: string }>;
    };
    const status = maybeError.response?.status;
    const reason = maybeError.errors?.[0]?.reason ?? null;
    const message =
      maybeError.message ??
      (typeof maybeError.response?.data === 'string' ? maybeError.response.data : null) ??
      'Unknown Gmail error';

    if (status === 401 || status === 403 && reason === 'authError') {
      return { category: 'auth_failure', code: String(status), message };
    }

    if (status === 429 || reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded') {
      return { category: 'rate_limit', code: String(status ?? reason), message };
    }

    if (status === 400) {
      return { category: 'validation_error', code: String(status), message };
    }

    if (status) {
      return { category: 'unknown', code: String(status), message };
    }
  }

  return {
    category: 'unknown',
    code: null,
    message: error instanceof Error ? error.message : String(error)
  };
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

async function getMailboxStatusRows(mailboxId?: string): Promise<Array<Mailbox & {
  last_sync_completed_at: string | null;
  sync_status: string | null;
  last_error: string | null;
  daily_send_count: string;
}>> {
  const params: unknown[] = [];
  const whereClause = mailboxId ? 'WHERE m.id = $1' : '';
  if (mailboxId) {
    params.push(mailboxId);
  }

  const result = await query<
    Mailbox & {
      last_sync_completed_at: string | null;
      sync_status: string | null;
      last_error: string | null;
      daily_send_count: string;
    }
  >(
    `
      SELECT
        m.*,
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
          AND ${utcDayCondition('msa.attempted_at')}
      ) today_sends ON true
      ${whereClause}
      ORDER BY m.created_at ASC
    `,
    params
  );

  return result.rows;
}

function toMailboxStatusView(row: Mailbox & {
  last_sync_completed_at: string | null;
  sync_status: string | null;
  last_error: string | null;
  daily_send_count: string;
}): MailboxStatusView {
  return {
    id: row.id,
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
  };
}

export async function listMailboxes(): Promise<MailboxStatusView[]> {
  const rows = await getMailboxStatusRows();
  return rows.map(toMailboxStatusView);
}

export async function getMailboxStatus(mailboxId: string): Promise<MailboxStatusView | null> {
  const rows = await getMailboxStatusRows(mailboxId);
  const row = rows[0];
  return row ? toMailboxStatusView(row) : null;
}

async function recordSendAttempt(
  input: {
    mailboxId?: string | null;
    leadId: string;
    contactId: string;
    campaignId: string;
    sentMessageId?: string | null;
    status: MailboxSendAttempt['status'];
    failureCategory?: MailboxSendAttempt['failure_category'];
    errorCode?: string | null;
    errorMessage?: string | null;
  },
  client?: Parameters<typeof query>[2]
): Promise<MailboxSendAttempt> {
  const result = await query<MailboxSendAttempt>(
    `
      INSERT INTO mailbox_send_attempts (
        id,
        mailbox_id,
        lead_id,
        contact_id,
        campaign_id,
        sent_message_id,
        status,
        failure_category,
        error_code,
        error_message
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `,
    [
      generateId(),
      input.mailboxId ?? null,
      input.leadId,
      input.contactId,
      input.campaignId,
      input.sentMessageId ?? null,
      input.status,
      input.failureCategory ?? null,
      input.errorCode ?? null,
      truncateMessage(input.errorMessage)
    ],
    client
  );

  return ensureFound(result.rows[0], `Send attempt insert failed for lead ${input.leadId}.`);
}

async function getLeadSendContext(leadId: string, client?: Parameters<typeof query>[2]): Promise<LeadSendContext> {
  const result = await query<
    Lead & {
      campaign: Campaign;
      company: { id: string; suppressed: boolean; outreach_status: string };
      contact: Contact;
      latest_draft: Draft | null;
    }
  >(
    `
      SELECT
        l.*,
        row_to_json(cp) AS campaign,
        row_to_json(c) AS company,
        row_to_json(ct) AS contact,
        row_to_json(d) AS latest_draft
      FROM leads l
      INNER JOIN campaigns cp ON cp.id = l.campaign_id
      INNER JOIN companies c ON c.id = l.company_id
      INNER JOIN contacts ct ON ct.id = l.contact_id
      LEFT JOIN LATERAL (
        SELECT *
        FROM drafts d
        WHERE d.lead_id = l.id
        ORDER BY d.created_at DESC
        LIMIT 1
      ) d ON true
      WHERE l.id = $1
    `,
    [leadId],
    client
  );

  const row = ensureFound(result.rows[0], `Lead ${leadId} not found.`);
  return {
    lead: {
      id: row.id,
      company_id: row.company_id,
      contact_id: row.contact_id,
      campaign_id: row.campaign_id,
      icp_score_at_creation: row.icp_score_at_creation,
      status: row.status,
      rejection_reason: row.rejection_reason,
      rejection_notes: row.rejection_notes,
      reviewed_by: row.reviewed_by,
      reviewed_at: row.reviewed_at,
      sequence_step: row.sequence_step,
      next_step_at: row.next_step_at,
      created_at: row.created_at,
      updated_at: row.updated_at
    },
    campaign: row.campaign,
    company: row.company,
    contact: row.contact,
    latestDraft: row.latest_draft
  };
}

async function getDailyCampaignSendCount(campaignId: string, client?: Parameters<typeof query>[2]): Promise<number> {
  const result = await query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM mailbox_send_attempts
      WHERE campaign_id = $1
        AND status = 'sent'
        AND ${utcDayCondition('attempted_at')}
    `,
    [campaignId],
    client
  );

  return Number(result.rows[0]?.count ?? 0);
}

async function getAvailableMailbox(client?: Parameters<typeof query>[2]): Promise<AvailableMailbox | null> {
  const result = await query<
    Mailbox & {
      last_sync_completed_at: string | null;
      sync_status: string | null;
      last_error: string | null;
      daily_send_count: string;
    }
  >(
    `
      SELECT
        m.*,
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
          AND ${utcDayCondition('msa.attempted_at')}
      ) today_sends ON true
      WHERE m.provider = 'google'
        AND m.is_active = true
        AND m.status = 'connected'
        AND COALESCE(today_sends.daily_send_count, '0')::int < m.daily_send_limit
      ORDER BY COALESCE(today_sends.daily_send_count, '0')::int ASC, m.last_send_at ASC NULLS FIRST, m.created_at ASC
      LIMIT 1
    `,
    [],
    client
  );

  const row = result.rows[0];
  return row ? toMailboxStatusView(row) : null;
}

async function markMailboxSendSuccess(mailboxId: string, client: Parameters<typeof query>[2]): Promise<void> {
  await query(
    `
      UPDATE mailboxes
      SET
        consecutive_auth_failures = 0,
        last_auth_failed_at = NULL,
        last_send_at = NOW(),
        status = CASE WHEN status = 'disabled' THEN status ELSE 'connected' END,
        updated_at = NOW()
      WHERE id = $1
    `,
    [mailboxId],
    client
  );
}

async function markMailboxFailure(
  mailboxId: string,
  category: GmailFailureCategory,
  client: Parameters<typeof query>[2]
): Promise<void> {
  if (category !== 'auth_failure') {
    return;
  }

  await query(
    `
      UPDATE mailboxes
      SET
        consecutive_auth_failures = consecutive_auth_failures + 1,
        last_auth_failed_at = NOW(),
        status = CASE
          WHEN consecutive_auth_failures + 1 >= $2 THEN 'unhealthy'
          ELSE status
        END,
        updated_at = NOW()
      WHERE id = $1
    `,
    [mailboxId, AUTH_FAILURE_THRESHOLD],
    client
  );
}

async function hasExistingSendForLead(leadId: string, client?: Parameters<typeof query>[2]): Promise<boolean> {
  const result = await query<{ id: string }>(
    `
      SELECT id
      FROM sent_messages
      WHERE lead_id = $1
      LIMIT 1
    `,
    [leadId],
    client
  );

  return Boolean(result.rows[0]);
}

async function blockLeadSend(
  context: LeadSendContext,
  reason: string,
  triggeredBy: string,
  options: BlockLeadSendOptions = {}
): Promise<void> {
  await withTransaction(async (client) => {
    await recordSendAttempt(
      {
        leadId: context.lead.id,
        contactId: context.contact.id,
        campaignId: context.campaign.id,
        status: 'blocked',
        failureCategory: 'governance',
        errorCode: 'governance_block',
        errorMessage: reason
      },
      client
    );

    if (options.leadStatus) {
      await query(
        `
          UPDATE leads
          SET
            status = $2,
            next_step_at = CASE WHEN $3 THEN NULL ELSE next_step_at END,
            updated_at = NOW()
          WHERE id = $1
        `,
        [context.lead.id, options.leadStatus, options.clearNextStepAt ?? false],
        client
      );
    }

    if (options.companyOutreachStatus) {
      await query(
        `
          UPDATE companies
          SET
            outreach_status = $2,
            updated_at = NOW()
          WHERE id = $1
        `,
        [context.company.id, options.companyOutreachStatus],
        client
      );
    }

    await logEvent(
      {
        eventType: 'lead.send_blocked',
        entityType: 'lead',
        entityId: context.lead.id,
        payload: {
          reason,
          contact_id: context.contact.id,
          company_id: context.company.id,
          campaign_id: context.campaign.id,
          lead_status_updated_to: options.leadStatus ?? null,
          company_outreach_status_updated_to: options.companyOutreachStatus ?? null
        },
        triggeredBy
      },
      client
    );
  });
}

async function processSingleSendReadyLead(leadId: string, triggeredBy: string): Promise<ProcessSendReadyResult['results'][number]> {
  const context = await getLeadSendContext(leadId);

  if (context.lead.status !== 'send_ready') {
    return { leadId, status: 'blocked', reason: `Lead status is ${context.lead.status}.` };
  }

  if (context.campaign.status !== 'active') {
    await blockLeadSend(context, `Campaign status ${context.campaign.status} blocks sending.`, triggeredBy);
    return { leadId, status: 'blocked', reason: `Campaign status is ${context.campaign.status}.` };
  }

  if (context.contact.opted_out || context.contact.bounced || context.company.suppressed) {
    await blockLeadSend(context, 'Suppression or contact state blocks sending.', triggeredBy, {
      leadStatus: 'suppressed',
      companyOutreachStatus: context.company.suppressed ? 'suppressed' : undefined,
      clearNextStepAt: true
    });
    return { leadId, status: 'blocked', reason: 'Suppression or contact state blocks sending.' };
  }

  if (!context.latestDraft) {
    await blockLeadSend(context, 'Lead has no draft to send.', triggeredBy);
    return { leadId, status: 'blocked', reason: 'No draft available.' };
  }

  if (await hasExistingSendForLead(leadId)) {
    await blockLeadSend(context, 'Lead already has an associated sent message.', triggeredBy, {
      leadStatus: 'sent'
    });
    return { leadId, status: 'blocked', reason: 'Lead already sent.' };
  }

  const campaignDailyCount = await getDailyCampaignSendCount(context.campaign.id);
  if (
    context.campaign.daily_send_limit !== null &&
    campaignDailyCount >= context.campaign.daily_send_limit
  ) {
    await blockLeadSend(context, 'Campaign daily send limit reached.', triggeredBy);
    return { leadId, status: 'blocked', reason: 'Campaign daily send limit reached.' };
  }

  const mailbox = await getAvailableMailbox();
  if (!mailbox) {
    await blockLeadSend(context, 'No healthy active mailbox is currently available.', triggeredBy);
    return { leadId, status: 'blocked', reason: 'No mailbox available.' };
  }

  try {
    const subject =
      context.latestDraft.edited_subject ?? context.latestDraft.subject ?? '';
    const body =
      context.latestDraft.edited_body ?? context.latestDraft.body ?? '';

    const gmailSend = await sendMailboxEmail(
      mailbox.id,
      {
        to: ensureFound(context.contact.email, `Lead ${leadId} contact email is missing.`),
        subject,
        body
      },
      triggeredBy
    );

    const sentMessage = await markSent(
      {
        leadId: context.lead.id,
        draftId: context.latestDraft.id,
        mailboxId: mailbox.id,
        fromAddress: mailbox.email,
        subject,
        body,
        sendingProvider: 'gmail',
        gmailMessageId: gmailSend.messageId ?? undefined,
        gmailThreadId: gmailSend.threadId ?? undefined,
        deliveryStatus: 'sent'
      },
      triggeredBy
    );

    await withTransaction(async (client) => {
      await recordSendAttempt(
        {
          mailboxId: mailbox.id,
          leadId: context.lead.id,
          contactId: context.contact.id,
          campaignId: context.campaign.id,
          sentMessageId: sentMessage.id,
          status: 'sent'
        },
        client
      );

      await markMailboxSendSuccess(mailbox.id, client);
    });

    return {
      leadId,
      status: 'sent',
      mailboxId: mailbox.id,
      sentMessageId: sentMessage.id,
      gmailMessageId: gmailSend.messageId,
      gmailThreadId: gmailSend.threadId
    };
  } catch (error) {
    const failure = classifyGmailError(error);
    await withTransaction(async (client) => {
      await recordSendAttempt(
        {
          mailboxId: mailbox.id,
          leadId: context.lead.id,
          contactId: context.contact.id,
          campaignId: context.campaign.id,
          status: 'failed',
          failureCategory: failure.category,
          errorCode: failure.code,
          errorMessage: failure.message
        },
        client
      );

      await markMailboxFailure(mailbox.id, failure.category, client);

      const failedAttemptsResult = await query<{ count: string }>(
        `
          SELECT COUNT(*)::text AS count
          FROM mailbox_send_attempts
          WHERE lead_id = $1
            AND status = 'failed'
        `,
        [context.lead.id],
        client
      );
      const failedAttempts = Number(failedAttemptsResult.rows[0]?.count ?? 0);

      if (failedAttempts >= LEAD_SEND_FAILURE_THRESHOLD) {
        await query(
          `
            UPDATE leads
            SET
              status = 'pending_review',
              updated_at = NOW()
            WHERE id = $1
          `,
          [context.lead.id],
          client
        );
      }

      await logEvent(
        {
          eventType: 'lead.send_failed',
          entityType: 'lead',
          entityId: context.lead.id,
          payload: {
            mailbox_id: mailbox.id,
            failure_category: failure.category,
            error_code: failure.code,
            error_message: truncateMessage(failure.message),
            failed_attempt_count: failedAttempts,
            paused_for_review: failedAttempts >= LEAD_SEND_FAILURE_THRESHOLD
          },
          triggeredBy
        },
        client
      );
    });

    return {
      leadId,
      status: 'failed',
      reason: failure.message,
      mailboxId: mailbox.id
    };
  }
}

export async function processSendReadyLeads(
  limit = DEFAULT_SEND_READY_LIMIT,
  triggeredBy = 'system'
): Promise<ProcessSendReadyResult> {
  const leadsResult = await query<{ id: string }>(
    `
      SELECT l.id
      FROM leads l
      INNER JOIN campaigns c ON c.id = l.campaign_id
      WHERE l.status = 'send_ready'
        AND c.status = 'active'
      ORDER BY l.reviewed_at ASC NULLS LAST, l.created_at ASC
      LIMIT $1
    `,
    [limit]
  );

  const summary: ProcessSendReadyResult = {
    attempted: leadsResult.rows.length,
    sent: 0,
    blocked: 0,
    failed: 0,
    results: []
  };

  for (const row of leadsResult.rows) {
    const result = await processSingleSendReadyLead(row.id, triggeredBy);
    summary.results.push(result);

    if (result.status === 'sent') {
      summary.sent += 1;
    } else if (result.status === 'blocked') {
      summary.blocked += 1;
    } else {
      summary.failed += 1;
    }
  }

  await logEvent({
    eventType: 'gmail.send_ready_batch_processed',
    entityType: 'job',
    entityId: null,
    payload: {
      attempted: summary.attempted,
      sent: summary.sent,
      blocked: summary.blocked,
      failed: summary.failed
    },
    triggeredBy
  });

  return summary;
}

export async function runScheduledMailboxSync(
  limit = DEFAULT_SYNC_JOB_LIMIT,
  triggeredBy = 'system'
): Promise<{
  attempted: number;
  succeeded: number;
  failed: number;
  results: Array<{ mailboxId: string; status: 'synced' | 'failed'; message?: string }>;
}> {
  const mailboxes = await listMailboxes();
  const activeMailboxes = mailboxes.filter(
    (mailbox) => mailbox.is_active && mailbox.status === 'connected'
  );

  const summary = {
    attempted: activeMailboxes.length,
    succeeded: 0,
    failed: 0,
    results: [] as Array<{ mailboxId: string; status: 'synced' | 'failed'; message?: string }>
  };

  for (const mailbox of activeMailboxes) {
    try {
      const result = await syncMailbox(mailbox.id, { maxResults: limit }, triggeredBy);
      summary.succeeded += 1;
      summary.results.push({ mailboxId: mailbox.id, status: 'synced', message: JSON.stringify(result) });
    } catch (error) {
      const failure = classifyGmailError(error);
      summary.failed += 1;
      summary.results.push({ mailboxId: mailbox.id, status: 'failed', message: failure.message });

      await withTransaction(async (client) => {
        await markMailboxFailure(mailbox.id, failure.category, client);
      });
    }
  }

  await logEvent({
    eventType: 'gmail.sync_batch_processed',
    entityType: 'job',
    entityId: null,
    payload: {
      attempted: summary.attempted,
      succeeded: summary.succeeded,
      failed: summary.failed,
      results: summary.results
    },
    triggeredBy
  });

  return summary;
}
