import { HttpError } from '../../api/utils';
import { ensureFound, generateId, query, withTransaction } from '../../db/client';
import { Client } from '../../db/types';
import { logEvent } from '../observability/service';
import { DEFAULT_CLIENT_ID } from './scope';

export interface CreateClientInput {
  name: string;
  slug?: string;
  is_active?: boolean;
}

export interface ClientFilters {
  is_active?: boolean;
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
          is_active
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [generateId(), slug, data.name.trim(), data.is_active ?? true],
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
          is_active: created.is_active
        },
        triggeredBy
      },
      client
    );

    return created;
  });
}
