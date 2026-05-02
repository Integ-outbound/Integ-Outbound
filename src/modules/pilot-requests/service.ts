import * as db from '../../db/client';
import type { PilotRequest } from '../../db/types';
import * as observability from '../observability/service';

export interface CreatePilotRequestInput {
  name: string;
  email: string;
  company: string;
  website: string;
  offer: string;
  desired_client_type: string;
  notes?: string | null;
}

export interface PilotRequestFilters {
  status?: PilotRequest['status'];
  limit?: number;
}

function normalizeRequired(value: string): string {
  return value.trim();
}

function normalizeOptional(value?: string | null): string | null {
  const normalized = value?.trim() ?? '';
  return normalized ? normalized : null;
}

export async function createPilotRequest(
  input: CreatePilotRequestInput,
  triggeredBy = 'website_signup'
): Promise<PilotRequest> {
  return db.withTransaction(async (client) => {
    const result = await db.query<PilotRequest>(
      `
        INSERT INTO pilot_requests (
          id,
          contact_name,
          contact_email,
          company_name,
          website,
          offer,
          desired_client_type,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        db.generateId(),
        normalizeRequired(input.name),
        normalizeRequired(input.email).toLowerCase(),
        normalizeRequired(input.company),
        normalizeRequired(input.website),
        normalizeRequired(input.offer),
        normalizeRequired(input.desired_client_type),
        normalizeOptional(input.notes)
      ],
      client
    );

    const pilotRequest = db.ensureFound(result.rows[0], 'Pilot request creation failed.');
    await observability.logEvent(
      {
        eventType: 'pilot_request.created',
        entityType: 'pilot_request',
        entityId: pilotRequest.id,
        payload: {
          contact_email: pilotRequest.contact_email,
          company_name: pilotRequest.company_name,
          website: pilotRequest.website,
          status: pilotRequest.status
        },
        triggeredBy
      },
      client
    );

    return pilotRequest;
  });
}

export async function listPilotRequests(
  filters: PilotRequestFilters = {}
): Promise<PilotRequest[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  if (filters.limit) {
    params.push(filters.limit);
  }

  const limitClause = filters.limit ? `LIMIT $${params.length}` : '';
  const result = await db.query<PilotRequest>(
    `
      SELECT *
      FROM pilot_requests
      ${whereClause}
      ORDER BY created_at DESC
      ${limitClause}
    `,
    params
  );

  return result.rows;
}

export async function countPilotRequestsByStatus(
  status: PilotRequest['status']
): Promise<number> {
  const result = await db.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM pilot_requests
      WHERE status = $1
    `,
    [status]
  );

  return Number(result.rows[0]?.count ?? 0);
}
