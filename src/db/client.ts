import { randomUUID } from 'node:crypto';
import { Pool, PoolClient, QueryResult, QueryResultRow, types } from 'pg';

types.setTypeParser(1184, (value) => new Date(value).toISOString());
types.setTypeParser(1114, (value) => new Date(`${value}Z`).toISOString());
types.setTypeParser(1082, (value) => new Date(`${value}T00:00:00.000Z`).toISOString());
types.setTypeParser(1700, (value) => Number(value));

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required.');
}

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

export type DbClient = Pool | PoolClient;

export interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;
}

export interface AuditContext {
  triggeredBy?: string;
}

export function generateId(): string {
  return randomUUID();
}

export function getDb(client?: DbClient): Queryable {
  return client ?? pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
  client?: DbClient
): Promise<QueryResult<T>> {
  return getDb(client).query<T>(text, params);
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function ensureFound<T>(value: T | undefined | null, message: string): T {
  if (value === undefined || value === null) {
    throw new Error(message);
  }

  return value;
}

export function asIsoString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

export function nowIso(): string {
  return new Date().toISOString();
}
