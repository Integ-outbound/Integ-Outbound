import { HttpError } from '../../api/utils';
import { ensureFound, generateId, query, withTransaction } from '../../db/client';
import { Campaign } from '../../db/types';
import { logEvent } from '../observability/service';

export interface CreateCampaignInput {
  name: string;
  angle: string;
  persona: string;
  icp_target: Record<string, unknown>;
  sequence_steps?: number;
  sequence_delay_days?: number;
  daily_send_limit?: number | null;
  status: Campaign['status'];
  prompt_version?: string | null;
}

export interface UpdateCampaignInput {
  name?: string;
  angle?: string;
  persona?: string;
  icp_target?: Record<string, unknown>;
  sequence_steps?: number;
  sequence_delay_days?: number;
  daily_send_limit?: number | null;
  status?: Campaign['status'];
  prompt_version?: string | null;
}

export interface CampaignFilters {
  status?: Campaign['status'];
}

export async function createCampaign(
  data: CreateCampaignInput,
  triggeredBy = 'operator'
): Promise<Campaign> {
  return withTransaction(async (client) => {
    const result = await query<Campaign>(
      `
        INSERT INTO campaigns (
          id,
          name,
          angle,
          persona,
          icp_target,
          sequence_steps,
          sequence_delay_days,
          daily_send_limit,
          status,
          prompt_version
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)
        RETURNING *
      `,
      [
        generateId(),
        data.name,
        data.angle,
        data.persona,
        JSON.stringify(data.icp_target),
        data.sequence_steps ?? 3,
        data.sequence_delay_days ?? 3,
        data.daily_send_limit ?? null,
        data.status,
        data.prompt_version ?? null
      ],
      client
    );

    const campaign = ensureFound(result.rows[0], 'Campaign creation failed.');
    await logEvent(
      {
        eventType: 'campaign.created',
        entityType: 'campaign',
        entityId: campaign.id,
        payload: {
          status: campaign.status,
          sequence_steps: campaign.sequence_steps,
          sequence_delay_days: campaign.sequence_delay_days
        },
        triggeredBy
      },
      client
    );

    return campaign;
  });
}

export async function listCampaigns(filters: CampaignFilters): Promise<Campaign[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query<Campaign>(
    `
      SELECT *
      FROM campaigns
      ${whereClause}
      ORDER BY created_at DESC
    `,
    params
  );

  return result.rows;
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const result = await query<Campaign>(
    `
      SELECT *
      FROM campaigns
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

export async function updateCampaign(
  id: string,
  data: UpdateCampaignInput,
  triggeredBy = 'operator'
): Promise<Campaign> {
  return withTransaction(async (client) => {
    const existing = await getCampaign(id);
    if (!existing) {
      throw new HttpError(404, `Campaign ${id} not found.`);
    }

    const result = await query<Campaign>(
      `
        UPDATE campaigns
        SET
          name = $2,
          angle = $3,
          persona = $4,
          icp_target = $5::jsonb,
          sequence_steps = $6,
          sequence_delay_days = $7,
          daily_send_limit = $8,
          status = $9,
          prompt_version = $10,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        data.name ?? existing.name,
        data.angle ?? existing.angle,
        data.persona ?? existing.persona,
        JSON.stringify(data.icp_target ?? existing.icp_target),
        data.sequence_steps ?? existing.sequence_steps,
        data.sequence_delay_days ?? existing.sequence_delay_days,
        data.daily_send_limit ?? existing.daily_send_limit,
        data.status ?? existing.status,
        data.prompt_version ?? existing.prompt_version
      ],
      client
    );

    const campaign = ensureFound(result.rows[0], `Campaign update failed for ${id}.`);
    await logEvent(
      {
        eventType: 'campaign.updated',
        entityType: 'campaign',
        entityId: campaign.id,
        payload: {
          status: campaign.status,
          sequence_steps: campaign.sequence_steps,
          sequence_delay_days: campaign.sequence_delay_days
        },
        triggeredBy
      },
      client
    );

    return campaign;
  });
}
