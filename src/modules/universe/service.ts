import { DbClient, ensureFound, generateId, query, withTransaction } from '../../db/client';
import { Company } from '../../db/types';
import { logEvent } from '../observability/service';

export interface CompanyInput {
  domain: string;
  name?: string | null;
  industry?: string | null;
  employee_count?: number | null;
  country?: string | null;
  city?: string | null;
  website?: string | null;
  linkedin_url?: string | null;
  outreach_status?: Company['outreach_status'];
  suppressed?: boolean;
  suppression_reason?: string | null;
  raw_enrichment?: Record<string, unknown> | null;
}

export interface CompanyFilters {
  industry?: string;
  country?: string;
  minEmployeeCount?: number;
  maxEmployeeCount?: number;
  outreachStatus?: Company['outreach_status'];
  suppressed?: boolean;
}

export interface BulkImportResult {
  inserted: number;
  updated: number;
}

interface UpsertCompanyResult extends Company {
  inserted: boolean;
}

async function upsertCompanyInTransaction(
  data: CompanyInput,
  triggeredBy: string,
  client: DbClient
): Promise<UpsertCompanyResult> {
  const result = await query<UpsertCompanyResult>(
    `
      INSERT INTO companies (
        id,
        domain,
        name,
        industry,
        employee_count,
        country,
        city,
        website,
        linkedin_url,
        outreach_status,
        suppressed,
        suppression_reason,
        raw_enrichment
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, 'never_contacted'), COALESCE($11, false), $12, $13::jsonb)
      ON CONFLICT (domain)
      DO UPDATE SET
        name = EXCLUDED.name,
        industry = EXCLUDED.industry,
        employee_count = EXCLUDED.employee_count,
        country = EXCLUDED.country,
        city = EXCLUDED.city,
        website = EXCLUDED.website,
        linkedin_url = EXCLUDED.linkedin_url,
        outreach_status = EXCLUDED.outreach_status,
        suppressed = EXCLUDED.suppressed,
        suppression_reason = EXCLUDED.suppression_reason,
        raw_enrichment = COALESCE(EXCLUDED.raw_enrichment, companies.raw_enrichment),
        updated_at = NOW()
      RETURNING companies.*, (xmax = 0) AS inserted
    `,
    [
      generateId(),
      data.domain.toLowerCase(),
      data.name ?? null,
      data.industry ?? null,
      data.employee_count ?? null,
      data.country ?? null,
      data.city ?? null,
      data.website ?? null,
      data.linkedin_url ?? null,
      data.outreach_status ?? 'never_contacted',
      data.suppressed ?? false,
      data.suppression_reason ?? null,
      JSON.stringify(data.raw_enrichment ?? null)
    ],
    client
  );

  const company = ensureFound(result.rows[0], `Company ${data.domain} upsert failed.`);

  await logEvent(
    {
      eventType: company.inserted ? 'company.created' : 'company.updated',
      entityType: 'company',
      entityId: company.id,
      payload: { domain: company.domain },
      triggeredBy
    },
    client
  );

  return company;
}

export async function upsertCompany(data: CompanyInput, triggeredBy = 'operator'): Promise<Company> {
  return withTransaction((client) => upsertCompanyInTransaction(data, triggeredBy, client));
}

export async function getCompany(domain: string): Promise<Company | null> {
  const result = await query<Company>(
    'SELECT * FROM companies WHERE domain = $1',
    [domain.toLowerCase()]
  );

  return result.rows[0] ?? null;
}

export async function listCompanies(filters: CompanyFilters): Promise<Company[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.industry) {
    params.push(filters.industry);
    conditions.push(`industry = $${params.length}`);
  }

  if (filters.country) {
    params.push(filters.country);
    conditions.push(`country = $${params.length}`);
  }

  if (filters.minEmployeeCount !== undefined) {
    params.push(filters.minEmployeeCount);
    conditions.push(`employee_count >= $${params.length}`);
  }

  if (filters.maxEmployeeCount !== undefined) {
    params.push(filters.maxEmployeeCount);
    conditions.push(`employee_count <= $${params.length}`);
  }

  if (filters.outreachStatus) {
    params.push(filters.outreachStatus);
    conditions.push(`outreach_status = $${params.length}`);
  }

  if (filters.suppressed !== undefined) {
    params.push(filters.suppressed);
    conditions.push(`suppressed = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query<Company>(
    `
      SELECT *
      FROM companies
      ${whereClause}
      ORDER BY created_at DESC
    `,
    params
  );

  return result.rows;
}

export async function suppressCompany(
  id: string,
  reason: string,
  triggeredBy = 'operator'
): Promise<Company> {
  return withTransaction(async (client) => {
    const result = await query<Company>(
      `
        UPDATE companies
        SET
          suppressed = true,
          suppression_reason = $2,
          outreach_status = 'suppressed',
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [id, reason],
      client
    );

  const company = result.rows[0];
  if (!company) {
    throw new Error(`Company ${id} not found.`);
  }

    await logEvent(
      {
        eventType: 'company.suppressed',
        entityType: 'company',
        entityId: company.id,
        payload: { reason },
        triggeredBy
      },
      client
    );

    return company;
  });
}

export async function bulkImportCompanies(
  rows: CompanyInput[],
  triggeredBy = 'operator'
): Promise<BulkImportResult> {
  return withTransaction(async (client) => {
    let inserted = 0;
    let updated = 0;

    for (const row of rows) {
      const company = await upsertCompanyInTransaction(row, triggeredBy, client);
      if (company.inserted) {
        inserted += 1;
      } else {
        updated += 1;
      }
    }

    await logEvent(
      {
        eventType: 'company.bulk_imported',
        entityType: 'company',
        entityId: null,
        payload: { inserted, updated, count: rows.length },
        triggeredBy
      },
      client
    );

    return { inserted, updated };
  });
}
