import { DbClient, generateId, query } from '../../db/client';
import { isWorkerRunning } from '../../queue/worker';

export interface SystemEventInput {
  eventType: string;
  entityType: string;
  entityId: string | null;
  payload: Record<string, unknown>;
  triggeredBy: string;
}

export interface SystemHealth {
  totalCompanies: number;
  totalContacts: number;
  contactsByVerificationStatus: Record<string, number>;
  leadsByStatus: Record<string, number>;
  unhandledReplies: number;
  sendQueueDepth: number;
  lastEnrichmentRun: string | null;
  lastScoringRun: string | null;
}

export interface ReadinessStatus {
  ready: boolean;
  database: 'ok';
  worker: 'ok' | 'disabled';
}

export async function logEvent(input: SystemEventInput, client?: DbClient): Promise<void> {
  await query(
    `
      INSERT INTO system_events (id, event_type, entity_type, entity_id, payload, triggered_by)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6)
    `,
    [
      generateId(),
      input.eventType,
      input.entityType,
      input.entityId,
      JSON.stringify(input.payload),
      input.triggeredBy
    ],
    client
  );
}

export async function getAuditTrail(
  entityType: string,
  entityId: string,
  limit = 50
): Promise<unknown[]> {
  const result = await query(
    `
      SELECT id, event_type, entity_type, entity_id, payload, triggered_by, created_at
      FROM system_events
      WHERE entity_type = $1 AND entity_id = $2
      ORDER BY created_at DESC
      LIMIT $3
    `,
    [entityType, entityId, limit]
  );

  return result.rows;
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const [
    companyResult,
    contactResult,
    contactsByStatusResult,
    leadsByStatusResult,
    unhandledRepliesResult,
    sendQueueResult,
    lastEnrichmentResult,
    lastScoringResult
  ] = await Promise.all([
    query<{ count: string }>('SELECT COUNT(*)::text AS count FROM companies'),
    query<{ count: string }>('SELECT COUNT(*)::text AS count FROM contacts'),
    query<{ verification_status: string; count: string }>(
      `
        SELECT verification_status, COUNT(*)::text AS count
        FROM contacts
        GROUP BY verification_status
      `
    ),
    query<{ status: string; count: string }>(
      `
        SELECT status, COUNT(*)::text AS count
        FROM leads
        GROUP BY status
      `
    ),
    query<{ count: string }>('SELECT COUNT(*)::text AS count FROM replies WHERE handled = false'),
    query<{ count: string }>("SELECT COUNT(*)::text AS count FROM leads WHERE status = 'send_ready'"),
    query<{ last_enrichment_run: string | null }>(
      'SELECT MAX(enriched_at) AS last_enrichment_run FROM companies'
    ),
    query<{ last_scoring_run: string | null }>(
      'SELECT MAX(icp_score_updated_at) AS last_scoring_run FROM companies'
    )
  ]);

  return {
    totalCompanies: Number(companyResult.rows[0]?.count ?? 0),
    totalContacts: Number(contactResult.rows[0]?.count ?? 0),
    contactsByVerificationStatus: Object.fromEntries(
      contactsByStatusResult.rows.map((row) => [row.verification_status, Number(row.count)])
    ),
    leadsByStatus: Object.fromEntries(
      leadsByStatusResult.rows.map((row) => [row.status, Number(row.count)])
    ),
    unhandledReplies: Number(unhandledRepliesResult.rows[0]?.count ?? 0),
    sendQueueDepth: Number(sendQueueResult.rows[0]?.count ?? 0),
    lastEnrichmentRun: lastEnrichmentResult.rows[0]?.last_enrichment_run ?? null,
    lastScoringRun: lastScoringResult.rows[0]?.last_scoring_run ?? null
  };
}

export async function getReadiness(expectWorker: boolean): Promise<ReadinessStatus> {
  await query('SELECT 1');

  if (expectWorker && !isWorkerRunning()) {
    throw new Error('Queue worker is not initialized.');
  }

  return {
    ready: true,
    database: 'ok',
    worker: expectWorker ? 'ok' : 'disabled'
  };
}
