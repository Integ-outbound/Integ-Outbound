import { DbClient, ensureFound, generateId, query, withTransaction } from '../../db/client';
import { Company, IcpDefinition } from '../../db/types';
import { logEvent } from '../observability/service';
import { BatchJobSummary, finalizeBatchJob } from '../shared/batch';

interface IcpFilters {
  industries?: string[];
  countries?: string[];
  employee_count_min?: number;
  employee_count_max?: number;
  required_signals?: string[];
}

export interface IcpDefinitionInput {
  name: string;
  filters: IcpFilters;
  scoring_weights: Record<string, number>;
}

export interface CompanyScoreRationale {
  matched: boolean;
  weight: number;
  value: unknown;
  reason: string;
}

export interface CompanyScoreResult {
  score: number;
  rationale: Record<string, CompanyScoreRationale>;
}

function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(weights)) {
    normalized[key] = Number.isFinite(value) && value > 0 ? value : 0;
  }

  return normalized;
}

function extractSignalTexts(company: Company): string[] {
  const enrichment = company.raw_enrichment ?? {};
  const recentSignals = Array.isArray(enrichment.recent_signals)
    ? enrichment.recent_signals
    : [];

  return recentSignals
    .map((signal) => {
      if (typeof signal === 'object' && signal !== null && 'type' in signal) {
        return String((signal as Record<string, unknown>).type ?? '').toLowerCase();
      }

      return '';
    })
    .filter(Boolean);
}

export async function getActiveICP(): Promise<IcpDefinition | null> {
  const result = await query<IcpDefinition>(
    `
      SELECT *
      FROM icp_definitions
      WHERE active = true
      ORDER BY created_at DESC
      LIMIT 1
    `
  );

  return result.rows[0] ?? null;
}

export function scoreCompany(company: Company, icpDefinition: IcpDefinition): CompanyScoreResult {
  const filters = icpDefinition.filters as IcpFilters;
  const weights = normalizeWeights(icpDefinition.scoring_weights);
  const rationale: Record<string, CompanyScoreRationale> = {};

  const signalTexts = extractSignalTexts(company);

  const industryMatched =
    !filters.industries || filters.industries.length === 0
      ? true
      : filters.industries.map((value) => value.toLowerCase()).includes((company.industry ?? '').toLowerCase());

  rationale.industry = {
    matched: industryMatched,
    weight: weights.industry ?? 0,
    value: company.industry,
    reason: industryMatched ? 'Industry matches ICP industries.' : 'Industry is outside ICP industries.'
  };

  const countryMatched =
    !filters.countries || filters.countries.length === 0
      ? true
      : filters.countries.map((value) => value.toLowerCase()).includes((company.country ?? '').toLowerCase());

  rationale.country = {
    matched: countryMatched,
    weight: weights.country ?? 0,
    value: company.country,
    reason: countryMatched ? 'Country matches ICP countries.' : 'Country is outside ICP countries.'
  };

  const employeeCount = company.employee_count ?? 0;
  const minSize = filters.employee_count_min;
  const maxSize = filters.employee_count_max;
  const sizeMatched =
    (minSize === undefined || employeeCount >= minSize) &&
    (maxSize === undefined || employeeCount <= maxSize);

  rationale.employee_count = {
    matched: sizeMatched,
    weight: weights.employee_count ?? 0,
    value: company.employee_count,
    reason: sizeMatched ? 'Employee count falls within ICP range.' : 'Employee count is outside ICP range.'
  };

  const requiredSignals = filters.required_signals ?? [];
  const matchedSignals = requiredSignals.filter((signal) =>
    signalTexts.includes(signal.toLowerCase())
  );
  const signalsMatched =
    requiredSignals.length === 0 ? true : matchedSignals.length === requiredSignals.length;

  rationale.required_signals = {
    matched: signalsMatched,
    weight: weights.required_signals ?? 0,
    value: matchedSignals,
    reason:
      requiredSignals.length === 0
        ? 'No required enrichment signals.'
        : signalsMatched
          ? 'All required enrichment signals are present.'
          : 'Required enrichment signals are missing.'
  };

  const totalWeight = Object.values(rationale).reduce((sum, item) => sum + item.weight, 0);
  const matchedWeight = Object.values(rationale).reduce(
    (sum, item) => sum + (item.matched ? item.weight : 0),
    0
  );

  const score = totalWeight > 0 ? Number((matchedWeight / totalWeight).toFixed(4)) : 0;

  return { score, rationale };
}

export async function scoreAllUnscored(triggeredBy = 'system'): Promise<BatchJobSummary> {
  const icpDefinition = await getActiveICP();
  if (!icpDefinition) {
    throw new Error('No active ICP definition found.');
  }

  const companiesResult = await query<Company>(
    `
      SELECT *
      FROM companies
      WHERE icp_score IS NULL
         OR icp_score_updated_at IS NULL
         OR icp_score_updated_at < NOW() - INTERVAL '7 days'
      ORDER BY created_at ASC
    `
  );

  const summary: BatchJobSummary = {
    attempted: companiesResult.rows.length,
    succeeded: 0,
    failed: 0,
    failures: []
  };

  for (const company of companiesResult.rows) {
    try {
      const result = scoreCompany(company, icpDefinition);
      await withTransaction(async (client) => {
        await query(
          `
            UPDATE companies
            SET icp_score = $2, icp_score_updated_at = NOW(), updated_at = NOW()
            WHERE id = $1
          `,
          [company.id, result.score],
          client
        );

        await logEvent(
          {
            eventType: 'company.icp_scored',
            entityType: 'company',
            entityId: company.id,
            payload: {
              icp_definition_id: icpDefinition.id,
              score: result.score,
              rationale: result.rationale
            },
            triggeredBy
          },
          client
        );
      });
      summary.succeeded += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.failed += 1;
      summary.failures.push({
        itemType: 'company',
        itemId: company.id,
        message
      });

      console.error('Company ICP scoring failed', {
        companyId: company.id,
        message
      });

      await logEvent({
        eventType: 'company.icp_scoring_failed',
        entityType: 'company',
        entityId: company.id,
        payload: {
          icp_definition_id: icpDefinition.id,
          error: message
        },
        triggeredBy
      });
    }
  }

  return finalizeBatchJob('score-companies', summary);
}

export async function generateShortlist(limit: number, minScore: number): Promise<Company[]> {
  const result = await query<Company>(
    `
      SELECT *
      FROM companies
      WHERE suppressed = false
        AND outreach_status = 'never_contacted'
        AND COALESCE(icp_score, 0) >= $1
      ORDER BY icp_score DESC NULLS LAST, created_at ASC
      LIMIT $2
    `,
    [minScore, limit]
  );

  return result.rows;
}

export async function createOrUpdateICP(
  definition: IcpDefinitionInput,
  triggeredBy = 'operator'
): Promise<IcpDefinition> {
  return withTransaction(async (client) => {
    const versionResult = await query<{ version: number }>(
      `
        SELECT COALESCE(MAX(version), 0)::int AS version
        FROM icp_definitions
        WHERE name = $1
      `,
      [definition.name],
      client
    );

    const activeDefinitionsResult = await query<{ id: string; name: string; version: number }>(
      `
        SELECT id, name, version
        FROM icp_definitions
        WHERE active = true
      `,
      [],
      client
    );

    await query('UPDATE icp_definitions SET active = false WHERE active = true', [], client);

    for (const activeDefinition of activeDefinitionsResult.rows) {
      await logEvent(
        {
          eventType: 'icp.deactivated',
          entityType: 'icp_definition',
          entityId: activeDefinition.id,
          payload: {
            name: activeDefinition.name,
            version: activeDefinition.version
          },
          triggeredBy
        },
        client
      );
    }

    const nextVersion = (versionResult.rows[0]?.version ?? 0) + 1;
    const result = await query<IcpDefinition>(
      `
        INSERT INTO icp_definitions (id, name, version, active, filters, scoring_weights)
        VALUES ($1, $2, $3, true, $4::jsonb, $5::jsonb)
        RETURNING *
      `,
      [
        generateId(),
        definition.name,
        nextVersion,
        JSON.stringify(definition.filters),
        JSON.stringify(definition.scoring_weights)
      ],
      client
    );

    const icp = ensureFound(result.rows[0], `ICP creation failed for ${definition.name}.`);
    await logEvent(
      {
        eventType: 'icp.updated',
        entityType: 'icp_definition',
        entityId: icp.id,
        payload: {
          name: icp.name,
          version: icp.version
        },
        triggeredBy
      },
      client
    );

    return icp;
  });
}
