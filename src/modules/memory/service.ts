import { ensureFound, generateId, query, withTransaction } from '../../db/client';
import { Outcome } from '../../db/types';
import { logEvent } from '../observability/service';

export interface OutcomeInput {
  lead_id: string;
  contact_id: string;
  company_id: string;
  campaign_id: string;
  outcome_type: Outcome['outcome_type'];
  notes?: string | null;
  occurred_at?: string | null;
}

export async function logOutcome(data: OutcomeInput, triggeredBy = 'operator'): Promise<Outcome> {
  return withTransaction(async (client) => {
    const result = await query<Outcome>(
      `
        INSERT INTO outcomes (
          id,
          lead_id,
          contact_id,
          company_id,
          campaign_id,
          outcome_type,
          notes,
          occurred_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        generateId(),
        data.lead_id,
        data.contact_id,
        data.company_id,
        data.campaign_id,
        data.outcome_type,
        data.notes ?? null,
        data.occurred_at ?? new Date().toISOString()
      ],
      client
    );

    const outcome = ensureFound(result.rows[0], `Outcome insert failed for lead ${data.lead_id}.`);
    await logEvent(
      {
        eventType: 'outcome.logged',
        entityType: 'outcome',
        entityId: outcome.id,
        payload: {
          lead_id: outcome.lead_id,
          campaign_id: outcome.campaign_id,
          outcome_type: outcome.outcome_type
        },
        triggeredBy
      },
      client
    );

    return outcome;
  });
}

export async function getRejectionPatternReport(): Promise<unknown[]> {
  const result = await query(
    `
      SELECT
        campaign_id,
        CASE
          WHEN COALESCE(icp_score_at_creation, 0) < 0.4 THEN '0-0.4'
          WHEN COALESCE(icp_score_at_creation, 0) < 0.7 THEN '0.4-0.7'
          ELSE '0.7-1.0'
        END AS icp_segment,
        rejection_reason,
        COUNT(*)::int AS count
      FROM leads
      WHERE status = 'rejected'
        AND reviewed_at >= NOW() - INTERVAL '30 days'
        AND rejection_reason IS NOT NULL
      GROUP BY campaign_id, icp_segment, rejection_reason
      ORDER BY campaign_id, icp_segment, count DESC
    `
  );

  return result.rows;
}

export async function getPerformanceReport(): Promise<unknown[]> {
  const result = await query(
    `
      WITH lead_stats AS (
        SELECT
          l.campaign_id,
          CASE
            WHEN COALESCE(l.icp_score_at_creation, 0) < 0.4 THEN '0-0.4'
            WHEN COALESCE(l.icp_score_at_creation, 0) < 0.7 THEN '0.4-0.7'
            ELSE '0.7-1.0'
          END AS icp_bucket,
          COUNT(*)::int AS leads_generated,
          COUNT(*) FILTER (WHERE l.status = 'send_ready' OR l.status = 'sent' OR l.status = 'replied')::int AS approved,
          COUNT(*) FILTER (WHERE l.status = 'rejected')::int AS rejected,
          COUNT(*) FILTER (WHERE l.status = 'sent' OR l.status = 'replied')::int AS sent,
          COUNT(*) FILTER (WHERE l.status = 'replied')::int AS replied
        FROM leads l
        GROUP BY l.campaign_id, icp_bucket
      ),
      booked_stats AS (
        SELECT
          o.campaign_id,
          CASE
            WHEN COALESCE(l.icp_score_at_creation, 0) < 0.4 THEN '0-0.4'
            WHEN COALESCE(l.icp_score_at_creation, 0) < 0.7 THEN '0.4-0.7'
            ELSE '0.7-1.0'
          END AS icp_bucket,
          COUNT(*) FILTER (WHERE o.outcome_type = 'meeting_booked')::int AS booked
        FROM outcomes o
        INNER JOIN leads l ON l.id = o.lead_id
        GROUP BY o.campaign_id, icp_bucket
      )
      SELECT
        c.id AS campaign_id,
        c.name AS campaign_name,
        ls.icp_bucket,
        ls.leads_generated,
        ls.approved,
        ls.rejected,
        ls.sent,
        ls.replied,
        COALESCE(bs.booked, 0) AS booked
      FROM lead_stats ls
      INNER JOIN campaigns c ON c.id = ls.campaign_id
      LEFT JOIN booked_stats bs
        ON bs.campaign_id = ls.campaign_id
       AND bs.icp_bucket = ls.icp_bucket
      ORDER BY c.name, ls.icp_bucket
    `
  );

  return result.rows;
}

export async function getDraftQualityReport(): Promise<{
  draftDecisionDistribution: Record<string, number>;
  draftRejectionReasons: Record<string, number>;
  campaignEditRates: unknown[];
}> {
  const [distributionResult, rejectionResult, editRateResult] = await Promise.all([
    query<{ operator_decision: string | null; count: string }>(
      `
        SELECT COALESCE(operator_decision, 'pending') AS operator_decision, COUNT(*)::text AS count
        FROM drafts
        GROUP BY COALESCE(operator_decision, 'pending')
      `
    ),
    query<{ rejection_reason: string; count: string }>(
      `
        SELECT rejection_reason, COUNT(*)::text AS count
        FROM leads
        WHERE rejection_reason IS NOT NULL
        GROUP BY rejection_reason
        ORDER BY count DESC
      `
    ),
    query(
      `
        SELECT
          c.id AS campaign_id,
          c.name AS campaign_name,
          COUNT(d.id)::int AS total_drafts,
          COUNT(*) FILTER (WHERE d.operator_decision = 'edited')::int AS edited_drafts,
          CASE
            WHEN COUNT(d.id) = 0 THEN 0
            ELSE ROUND((COUNT(*) FILTER (WHERE d.operator_decision = 'edited')::numeric / COUNT(d.id)::numeric), 4)
          END AS edit_rate
        FROM campaigns c
        LEFT JOIN leads l ON l.campaign_id = c.id
        LEFT JOIN drafts d ON d.lead_id = l.id
        GROUP BY c.id, c.name
        ORDER BY edit_rate DESC, c.name ASC
      `
    )
  ]);

  return {
    draftDecisionDistribution: Object.fromEntries(
      distributionResult.rows.map((row) => [row.operator_decision ?? 'pending', Number(row.count)])
    ),
    draftRejectionReasons: Object.fromEntries(
      rejectionResult.rows.map((row) => [row.rejection_reason, Number(row.count)])
    ),
    campaignEditRates: editRateResult.rows
  };
}

export async function getOutcomesByCampaign(campaignId: string): Promise<{
  summary: Record<string, number>;
  outcomes: Outcome[];
}> {
  const [summaryResult, outcomesResult] = await Promise.all([
    query<{ outcome_type: string; count: string }>(
      `
        SELECT outcome_type, COUNT(*)::text AS count
        FROM outcomes
        WHERE campaign_id = $1
        GROUP BY outcome_type
      `,
      [campaignId]
    ),
    query<Outcome>(
      `
        SELECT *
        FROM outcomes
        WHERE campaign_id = $1
        ORDER BY occurred_at DESC NULLS LAST, created_at DESC
      `,
      [campaignId]
    )
  ]);

  return {
    summary: Object.fromEntries(
      summaryResult.rows.map((row) => [row.outcome_type, Number(row.count)])
    ),
    outcomes: outcomesResult.rows
  };
}
