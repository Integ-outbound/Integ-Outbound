import { callHaiku, parseHaikuJson } from '../../ai/client';
import { buildEnrichmentPrompt } from '../../ai/prompts';
import { query, withTransaction } from '../../db/client';
import { Company } from '../../db/types';
import { logEvent } from '../observability/service';
import { BatchJobSummary, finalizeBatchJob } from '../shared/batch';

export interface EnrichmentPayload {
  recent_signals: Array<{ type: string; description: string; confidence: number }>;
  pain_point_proxies: Array<{ signal: string; confidence: number }>;
  growth_indicators: Array<{ signal: string; confidence: number }>;
  enrichment_quality: 'high' | 'medium' | 'low';
}

async function getCompanyById(companyId: string): Promise<Company> {
  const result = await query<Company>('SELECT * FROM companies WHERE id = $1', [companyId]);
  const company = result.rows[0];
  if (!company) {
    throw new Error(`Company ${companyId} not found.`);
  }

  return company;
}

export async function enrichCompany(companyId: string, triggeredBy = 'operator'): Promise<EnrichmentPayload> {
  const company = await getCompanyById(companyId);
  const prompt = buildEnrichmentPrompt({
    domain: company.domain,
    name: company.name,
    industry: company.industry,
    employeeCount: company.employee_count,
    country: company.country
  });

  const raw = await callHaiku(prompt);
  const enrichment = parseHaikuJson<EnrichmentPayload>(raw, 'company enrichment');

  await withTransaction(async (client) => {
    await query(
      `
        UPDATE companies
        SET raw_enrichment = $2::jsonb, enriched_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
      [companyId, JSON.stringify(enrichment)],
      client
    );

    await logEvent(
      {
        eventType: 'company.enriched',
        entityType: 'company',
        entityId: companyId,
        payload: {
          enrichment_quality: enrichment.enrichment_quality,
          recent_signals: enrichment.recent_signals.length
        },
        triggeredBy
      },
      client
    );
  });

  return enrichment;
}

export async function enrichBatch(limit: number, triggeredBy = 'system'): Promise<BatchJobSummary> {
  const result = await query<Company>(
    `
      SELECT *
      FROM companies
      WHERE COALESCE(icp_score, 0) > 0.5
        AND (enriched_at IS NULL OR enriched_at < NOW() - INTERVAL '30 days')
      ORDER BY icp_score DESC NULLS LAST, created_at ASC
      LIMIT $1
    `,
    [limit]
  );

  const summary: BatchJobSummary = {
    attempted: result.rows.length,
    succeeded: 0,
    failed: 0,
    failures: []
  };

  for (const company of result.rows) {
    try {
      await enrichCompany(company.id, triggeredBy);
      summary.succeeded += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.failed += 1;
      summary.failures.push({
        itemType: 'company',
        itemId: company.id,
        message
      });

      console.error('Company enrichment failed', {
        companyId: company.id,
        message
      });

      await logEvent({
        eventType: 'company.enrichment_failed',
        entityType: 'company',
        entityId: company.id,
        payload: {
          error: message,
          batch: true
        },
        triggeredBy
      });
    }
  }

  return finalizeBatchJob('enrich-batch', summary);
}

export async function getEnrichmentSummary(companyId: string): Promise<EnrichmentPayload | null> {
  const company = await getCompanyById(companyId);
  return (company.raw_enrichment as EnrichmentPayload | null) ?? null;
}
