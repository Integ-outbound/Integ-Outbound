import { query } from '../../db/client';
import { ensureClientExists, getClientOnboardingStatus, listClients } from '../clients/service';
import { appendClientScope } from '../clients/scope';
import { listMailboxes } from '../mailboxes/operations';
import { getUnhandledReplies } from '../replies/service';
import { getReviewQueue, getReviewStatsForClient } from '../review/service';
import { getDailyStatsForClient } from '../sending/service';

export async function getOperatorStatus(clientId?: string): Promise<{
  client_id: string | null;
  activeCampaigns: number;
  pendingLeadReview: number;
  sendReady: number;
  unhandledReplies: number;
  connectedMailboxes: number;
  unhealthyMailboxes: number;
  sendsToday: number;
  bouncesToday: number;
  reviewStats: Awaited<ReturnType<typeof getReviewStatsForClient>>;
}> {
  if (clientId) {
    await ensureClientExists(clientId);
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  appendClientScope(conditions, params, 'client_id', clientId);
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [campaignsResult, leadsResult, replyCountResult, mailboxes, sendingStats, reviewStats] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM campaigns ${whereClause ? `${whereClause} AND status = 'active'` : "WHERE status = 'active'"}`,
      params
    ),
    query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count FROM leads ${whereClause} GROUP BY status`,
      params
    ),
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM replies ${whereClause ? `${whereClause} AND handled = false AND routing_decision = 'human_review'` : "WHERE handled = false AND routing_decision = 'human_review'"}`,
      params
    ),
    listMailboxes(clientId),
    getDailyStatsForClient(clientId),
    getReviewStatsForClient(clientId)
  ]);

  const leadsByStatus = Object.fromEntries(
    leadsResult.rows.map((row) => [row.status, Number(row.count)])
  );

  return {
    client_id: clientId ?? null,
    activeCampaigns: Number(campaignsResult.rows[0]?.count ?? 0),
    pendingLeadReview: Number(leadsByStatus.pending_review ?? 0),
    sendReady: Number(leadsByStatus.send_ready ?? 0),
    unhandledReplies: Number(replyCountResult.rows[0]?.count ?? 0),
    connectedMailboxes: mailboxes.filter((mailbox) => mailbox.status === 'connected').length,
    unhealthyMailboxes: mailboxes.filter((mailbox) => mailbox.status !== 'connected').length,
    sendsToday: sendingStats.sendsToday,
    bouncesToday: sendingStats.bouncesToday,
    reviewStats
  };
}

export async function getOperatorReviewQueues(
  clientId?: string,
  leadLimit = 25,
  replyLimit = 25
): Promise<{
  client_id: string | null;
  lead_review_queue: unknown[];
  reply_review_queue: unknown[];
}> {
  if (clientId) {
    await ensureClientExists(clientId);
  }

  const [leadReviewQueue, replyReviewQueue] = await Promise.all([
    getReviewQueue({
      client_id: clientId,
      limit: leadLimit
    }),
    getUnhandledReplies({
      client_id: clientId,
      limit: replyLimit
    })
  ]);

  return {
    client_id: clientId ?? null,
    lead_review_queue: leadReviewQueue,
    reply_review_queue: replyReviewQueue
  };
}

export async function getOperatorClientStatuses(): Promise<{
  clients: Array<
    Awaited<ReturnType<typeof getClientOnboardingStatus>> & {
      connected_mailboxes: number;
    }
  >;
}> {
  const clients = await listClients();
  const statuses = await Promise.all(
    clients.map(async (client) => {
      const onboarding = await getClientOnboardingStatus(client.id);
      return {
        ...onboarding,
        connected_mailboxes: onboarding.mailboxes.filter((mailbox) => mailbox.status === 'connected').length
      };
    })
  );

  return { clients: statuses };
}

export async function getOperatorSafety(clientId?: string): Promise<{
  client_id: string | null;
  send_ready_count: number;
  active_campaigns: number;
  mailboxes_without_client_id: number;
  campaigns_without_client_id: number;
  unhealthy_mailboxes: number;
  failed_send_attempts: number;
  sync_health: {
    healthy: number;
    stale: number;
    error: number;
    never_synced: number;
    running: number;
  };
  worker: {
    enabled: boolean;
  };
}> {
  if (clientId) {
    await ensureClientExists(clientId);
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  appendClientScope(conditions, params, 'client_id', clientId);
  const campaignWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const leadWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const mailboxes = await listMailboxes(clientId);
  const [sendReadyResult, activeCampaignsResult, failedAttemptsResult, orphanResult] = await Promise.all([
    query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM leads
        ${leadWhere ? `${leadWhere} AND status = 'send_ready'` : "WHERE status = 'send_ready'"}
      `,
      params
    ),
    query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM campaigns
        ${campaignWhere ? `${campaignWhere} AND status = 'active'` : "WHERE status = 'active'"}
      `,
      params
    ),
    query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM mailbox_send_attempts msa
        INNER JOIN leads l ON l.id = msa.lead_id
        ${clientId ? 'WHERE l.client_id = $1 AND msa.status = \'failed\'' : "WHERE msa.status = 'failed'"}
      `,
      clientId ? [clientId] : []
    ),
    clientId
      ? Promise.resolve({
          rows: [{ mailboxes_without_client_id: '0', campaigns_without_client_id: '0' }]
        })
      : query<{ mailboxes_without_client_id: string; campaigns_without_client_id: string }>(
          `
            SELECT
              (SELECT COUNT(*)::text FROM mailboxes WHERE client_id IS NULL) AS mailboxes_without_client_id,
              (SELECT COUNT(*)::text FROM campaigns WHERE client_id IS NULL) AS campaigns_without_client_id
          `
        )
  ]);

  const syncHealth = {
    healthy: mailboxes.filter((mailbox) => mailbox.sync_health === 'healthy').length,
    stale: mailboxes.filter((mailbox) => mailbox.sync_health === 'stale').length,
    error: mailboxes.filter((mailbox) => mailbox.sync_health === 'error').length,
    never_synced: mailboxes.filter((mailbox) => mailbox.sync_health === 'never_synced').length,
    running: mailboxes.filter((mailbox) => mailbox.sync_health === 'running').length
  };

  return {
    client_id: clientId ?? null,
    send_ready_count: Number(sendReadyResult.rows[0]?.count ?? 0),
    active_campaigns: Number(activeCampaignsResult.rows[0]?.count ?? 0),
    mailboxes_without_client_id: Number(orphanResult.rows[0]?.mailboxes_without_client_id ?? 0),
    campaigns_without_client_id: Number(orphanResult.rows[0]?.campaigns_without_client_id ?? 0),
    unhealthy_mailboxes: mailboxes.filter((mailbox) => mailbox.status !== 'connected').length,
    failed_send_attempts: Number(failedAttemptsResult.rows[0]?.count ?? 0),
    sync_health: syncHealth,
    worker: {
      enabled: (process.env.START_WORKER ?? 'true').trim().toLowerCase() !== 'false'
    }
  };
}
