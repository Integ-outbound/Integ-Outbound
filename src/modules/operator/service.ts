import { query } from '../../db/client';
import { ensureClientExists } from '../clients/service';
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
