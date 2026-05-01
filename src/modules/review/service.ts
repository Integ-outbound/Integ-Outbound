import { query, withTransaction } from '../../db/client';
import { Lead } from '../../db/types';
import { appendClientScope, assertLeadIdsBelongToClient, requireClientContext } from '../clients/scope';
import { logEvent } from '../observability/service';

export interface ReviewQueueFilters {
  client_id?: string;
  campaign_id?: string;
  min_icp_score?: number;
  limit?: number;
}

export async function getReviewQueue(filters: ReviewQueueFilters): Promise<unknown[]> {
  const conditions = [`l.status = 'pending_review'`];
  const params: unknown[] = [];

  appendClientScope(conditions, params, 'l.client_id', filters.client_id);

  if (filters.campaign_id) {
    params.push(filters.campaign_id);
    conditions.push(`l.campaign_id = $${params.length}`);
  }

  if (filters.min_icp_score !== undefined) {
    params.push(filters.min_icp_score);
    conditions.push(`COALESCE(l.icp_score_at_creation, 0) >= $${params.length}`);
  }

  const limit = filters.limit ?? 50;
  params.push(limit);

  const result = await query(
    `
      SELECT
        l.*,
        row_to_json(c) AS company,
        row_to_json(ct) AS contact,
        row_to_json(d) AS draft
      FROM leads l
      INNER JOIN companies c ON c.id = l.company_id
      INNER JOIN contacts ct ON ct.id = l.contact_id
      LEFT JOIN LATERAL (
        SELECT *
        FROM drafts d
        WHERE d.lead_id = l.id
        ORDER BY d.created_at DESC
        LIMIT 1
      ) d ON true
      WHERE ${conditions.join(' AND ')}
      ORDER BY COALESCE(l.icp_score_at_creation, 0) DESC, l.created_at ASC
      LIMIT $${params.length}
    `,
    params
  );

  return result.rows;
}

export async function getReviewStats(): Promise<{
  countsByStatus: Record<string, number>;
  rejectionReasons: Record<string, number>;
  averageReviewTimeSeconds: number;
}> {
  return getReviewStatsForClient();
}

export async function getReviewStatsForClient(clientId?: string): Promise<{
  countsByStatus: Record<string, number>;
  rejectionReasons: Record<string, number>;
  averageReviewTimeSeconds: number;
}> {
  const countsConditions: string[] = [];
  const countsParams: unknown[] = [];
  appendClientScope(countsConditions, countsParams, 'client_id', clientId);

  const rejectionConditions: string[] = ['rejection_reason IS NOT NULL'];
  const rejectionParams: unknown[] = [];
  appendClientScope(rejectionConditions, rejectionParams, 'client_id', clientId);

  const averageConditions: string[] = ['reviewed_at IS NOT NULL'];
  const averageParams: unknown[] = [];
  appendClientScope(averageConditions, averageParams, 'client_id', clientId);

  const countsWhere = countsConditions.length > 0 ? `WHERE ${countsConditions.join(' AND ')}` : '';
  const rejectionWhere =
    rejectionConditions.length > 0 ? `WHERE ${rejectionConditions.join(' AND ')}` : '';
  const averageWhere = averageConditions.length > 0 ? `WHERE ${averageConditions.join(' AND ')}` : '';

  const [countsResult, rejectionResult, averageResult] = await Promise.all([
    query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count FROM leads ${countsWhere} GROUP BY status`,
      countsParams
    ),
    query<{ rejection_reason: string; count: string }>(
      `
        SELECT rejection_reason, COUNT(*)::text AS count
        FROM leads
        ${rejectionWhere}
        GROUP BY rejection_reason
      `,
      rejectionParams
    ),
    query<{ average_seconds: number | null }>(
      `
        SELECT AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at))) AS average_seconds
        FROM leads
        ${averageWhere}
      `,
      averageParams
    )
  ]);

  return {
    countsByStatus: Object.fromEntries(
      countsResult.rows.map((row) => [row.status, Number(row.count)])
    ),
    rejectionReasons: Object.fromEntries(
      rejectionResult.rows.map((row) => [row.rejection_reason, Number(row.count)])
    ),
    averageReviewTimeSeconds: Number(averageResult.rows[0]?.average_seconds ?? 0)
  };
}

export async function bulkReject(
  leadIds: string[],
  reason: Lead['rejection_reason'],
  triggeredBy = 'operator',
  clientId?: string
): Promise<{ rejected: number }> {
  return withTransaction(async (client) => {
    await assertLeadIdsBelongToClient(
      leadIds,
      requireClientContext(clientId, 'Bulk lead rejection'),
      client
    );

    const result = await query<{ id: string }>(
      `
        UPDATE leads
        SET
          status = 'rejected',
          rejection_reason = $2,
          reviewed_by = 'operator',
          reviewed_at = NOW(),
          updated_at = NOW()
        WHERE id = ANY($1::uuid[])
        RETURNING id
      `,
      [leadIds, reason],
      client
    );

    const draftsResult = await query<{ id: string; lead_id: string }>(
      `
        UPDATE drafts
        SET operator_decision = 'rejected', decided_at = NOW()
        WHERE lead_id = ANY($1::uuid[])
          AND operator_decision IS DISTINCT FROM 'approved'
        RETURNING id, lead_id
      `,
      [leadIds],
      client
    );

    for (const row of result.rows) {
      await logEvent(
        {
          eventType: 'lead.rejected',
          entityType: 'lead',
          entityId: row.id,
          payload: { reason, source: 'bulk_reject' },
          triggeredBy
        },
        client
      );
    }

    for (const row of draftsResult.rows) {
      await logEvent(
        {
          eventType: 'draft.rejected',
          entityType: 'draft',
          entityId: row.id,
          payload: { lead_id: row.lead_id, source: 'bulk_reject', reason },
          triggeredBy
        },
        client
      );
    }

    return { rejected: result.rowCount ?? 0 };
  });
}
