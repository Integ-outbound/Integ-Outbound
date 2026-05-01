import { HttpError } from '../../api/utils';
import { ensureFound, generateId, query, withTransaction } from '../../db/client';
import { Campaign, Company, Contact, Draft, Lead } from '../../db/types';
import {
  appendClientScope,
  assertCampaignBelongsToClient,
  assertLeadBelongsToClient,
  requireClientContext
} from '../clients/scope';
import { logEvent } from '../observability/service';

export interface CreateLeadInput {
  client_id: string;
  company_id: string;
  contact_id: string;
  campaign_id: string;
  icp_score_at_creation?: number | null;
  next_step_at?: string | null;
}

export interface LeadFilters {
  client_id?: string;
  campaign_id?: string;
  company_id?: string;
  contact_id?: string;
  status?: Lead['status'];
}

export interface LeadRejectInput {
  rejection_reason: NonNullable<Lead['rejection_reason']>;
  rejection_notes?: string | null;
}

const OPEN_LEAD_STATUSES: Lead['status'][] = ['pending_review', 'approved', 'send_ready', 'sent'];

async function getLeadRow(
  leadId: string,
  client?: Parameters<typeof query>[2]
): Promise<
  | (Lead & {
      company: Company;
      contact: Contact;
      campaign: Campaign;
      latest_draft: Draft | null;
    })
  | null
> {
  const result = await query<
    Lead & {
      company: Company;
      contact: Contact;
      campaign: Campaign;
      latest_draft: Draft | null;
    }
  >(
    `
      SELECT
        l.*,
        row_to_json(c) AS company,
        row_to_json(ct) AS contact,
        row_to_json(cp) AS campaign,
        row_to_json(d) AS latest_draft
      FROM leads l
      INNER JOIN companies c ON c.id = l.company_id
      INNER JOIN contacts ct ON ct.id = l.contact_id
      INNER JOIN campaigns cp ON cp.id = l.campaign_id
      LEFT JOIN LATERAL (
        SELECT *
        FROM drafts d
        WHERE d.lead_id = l.id
        ORDER BY d.created_at DESC
        LIMIT 1
      ) d ON true
      WHERE l.id = $1
    `,
    [leadId],
    client
  );

  return result.rows[0] ?? null;
}

async function getCompanyForLead(companyId: string, client?: Parameters<typeof query>[2]): Promise<Company> {
  const result = await query<Company>('SELECT * FROM companies WHERE id = $1', [companyId], client);
  return ensureFound(result.rows[0], `Company ${companyId} not found.`);
}

async function getContactForLead(contactId: string, client?: Parameters<typeof query>[2]): Promise<Contact> {
  const result = await query<Contact>('SELECT * FROM contacts WHERE id = $1', [contactId], client);
  return ensureFound(result.rows[0], `Contact ${contactId} not found.`);
}

export async function createLead(data: CreateLeadInput, triggeredBy = 'operator'): Promise<unknown> {
  return withTransaction(async (client) => {
    const scopedClientId = requireClientContext(data.client_id, 'Lead creation');
    const company = await getCompanyForLead(data.company_id, client);
    const contact = await getContactForLead(data.contact_id, client);
    const campaign = await assertCampaignBelongsToClient(data.campaign_id, scopedClientId, client);

    if (contact.company_id !== company.id) {
      throw new HttpError(400, 'The contact does not belong to the selected company.');
    }

    const duplicateResult = await query<{ id: string }>(
      `
        SELECT id
        FROM leads
        WHERE campaign_id = $1
          AND company_id = $2
          AND contact_id = $3
          AND sequence_step = 1
          AND status = ANY($4::text[])
        LIMIT 1
      `,
      [data.campaign_id, data.company_id, data.contact_id, OPEN_LEAD_STATUSES],
      client
    );

    if (duplicateResult.rows[0]) {
      throw new HttpError(
        409,
        'An open lead already exists for this campaign, company, contact, and sequence step.'
      );
    }

    const insertResult = await query<Lead>(
      `
        INSERT INTO leads (
          id,
          client_id,
          company_id,
          contact_id,
          campaign_id,
          icp_score_at_creation,
          status,
          sequence_step,
          next_step_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'pending_review', 1, $7)
        RETURNING *
      `,
      [
        generateId(),
        campaign.client_id,
        data.company_id,
        data.contact_id,
        data.campaign_id,
        data.icp_score_at_creation ?? null,
        data.next_step_at ?? null
      ],
      client
    );

    const lead = ensureFound(insertResult.rows[0], 'Lead creation failed.');
    await logEvent(
      {
        eventType: 'lead.created',
        entityType: 'lead',
        entityId: lead.id,
        payload: {
          client_id: lead.client_id,
          company_id: lead.company_id,
          contact_id: lead.contact_id,
          campaign_id: lead.campaign_id,
          sequence_step: lead.sequence_step
        },
        triggeredBy
      },
      client
    );

    return ensureFound(await getLeadRow(lead.id, client), `Lead ${lead.id} could not be reloaded.`);
  });
}

export async function listLeads(filters: LeadFilters): Promise<unknown[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  appendClientScope(conditions, params, 'l.client_id', filters.client_id);

  if (filters.campaign_id) {
    params.push(filters.campaign_id);
    conditions.push(`l.campaign_id = $${params.length}`);
  }

  if (filters.company_id) {
    params.push(filters.company_id);
    conditions.push(`l.company_id = $${params.length}`);
  }

  if (filters.contact_id) {
    params.push(filters.contact_id);
    conditions.push(`l.contact_id = $${params.length}`);
  }

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`l.status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(
    `
      SELECT
        l.*,
        row_to_json(c) AS company,
        row_to_json(ct) AS contact,
        row_to_json(cp) AS campaign,
        row_to_json(d) AS latest_draft
      FROM leads l
      INNER JOIN companies c ON c.id = l.company_id
      INNER JOIN contacts ct ON ct.id = l.contact_id
      INNER JOIN campaigns cp ON cp.id = l.campaign_id
      LEFT JOIN LATERAL (
        SELECT *
        FROM drafts d
        WHERE d.lead_id = l.id
        ORDER BY d.created_at DESC
        LIMIT 1
      ) d ON true
      ${whereClause}
      ORDER BY l.created_at DESC
    `,
    params
  );

  return result.rows;
}

export async function getLead(leadId: string): Promise<unknown | null> {
  return getLeadRow(leadId);
}

export async function rejectLead(
  leadId: string,
  data: LeadRejectInput,
  triggeredBy = 'operator',
  clientId?: string
): Promise<unknown> {
  return withTransaction(async (client) => {
    const scopedClientId = requireClientContext(clientId, 'Lead rejection');
    await assertLeadBelongsToClient(leadId, scopedClientId, client);

    const leadResult = await query<Lead>(
      `
        UPDATE leads
        SET
          status = 'rejected',
          rejection_reason = $2,
          rejection_notes = $3,
          reviewed_by = 'operator',
          reviewed_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [leadId, data.rejection_reason, data.rejection_notes ?? null],
      client
    );

    const draftResult = await query<Draft>(
      `
        WITH latest_draft AS (
          SELECT id
          FROM drafts
          WHERE lead_id = $1
            AND operator_decision IS DISTINCT FROM 'approved'
          ORDER BY created_at DESC
          LIMIT 1
        )
        UPDATE drafts
        SET operator_decision = 'rejected', decided_at = NOW()
        WHERE id IN (SELECT id FROM latest_draft)
        RETURNING *
      `,
      [leadId],
      client
    );

    const lead = ensureFound(leadResult.rows[0], `Lead rejection failed for ${leadId}.`);
    await logEvent(
      {
        eventType: 'lead.rejected',
        entityType: 'lead',
        entityId: lead.id,
        payload: {
          reason: data.rejection_reason,
          notes: data.rejection_notes ?? null,
          source: 'lead.reject'
        },
        triggeredBy
      },
      client
    );

    const rejectedDraft = draftResult.rows[0];
    if (rejectedDraft) {
      await logEvent(
        {
          eventType: 'draft.rejected',
          entityType: 'draft',
          entityId: rejectedDraft.id,
          payload: {
            lead_id: lead.id,
            reason: data.rejection_reason,
            source: 'lead.reject'
          },
          triggeredBy
        },
        client
      );
    }

    return ensureFound(await getLeadRow(lead.id, client), `Lead ${lead.id} could not be reloaded.`);
  });
}

export async function suppressLead(
  leadId: string,
  notes: string,
  triggeredBy = 'operator',
  clientId?: string
): Promise<unknown> {
  return withTransaction(async (client) => {
    const scopedClientId = requireClientContext(clientId, 'Lead suppression');
    await assertLeadBelongsToClient(leadId, scopedClientId, client);
    const result = await query<Lead>(
      `
        UPDATE leads
        SET status = 'suppressed', updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [leadId],
      client
    );

    const lead = ensureFound(result.rows[0], `Lead ${leadId} not found.`);
    await logEvent(
      {
        eventType: 'lead.suppressed',
        entityType: 'lead',
        entityId: lead.id,
        payload: { notes },
        triggeredBy
      },
      client
    );

    return ensureFound(await getLeadRow(lead.id, client), `Lead ${lead.id} could not be reloaded.`);
  });
}

export async function rescheduleLead(
  leadId: string,
  nextStepAt: string,
  triggeredBy = 'operator',
  clientId?: string
): Promise<unknown> {
  return withTransaction(async (client) => {
    const scopedClientId = requireClientContext(clientId, 'Lead reschedule');
    await assertLeadBelongsToClient(leadId, scopedClientId, client);
    const result = await query<Lead>(
      `
        UPDATE leads
        SET next_step_at = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [leadId, nextStepAt],
      client
    );

    const lead = ensureFound(result.rows[0], `Lead ${leadId} not found.`);
    await logEvent(
      {
        eventType: 'lead.rescheduled',
        entityType: 'lead',
        entityId: lead.id,
        payload: { next_step_at: lead.next_step_at },
        triggeredBy
      },
      client
    );

    return ensureFound(await getLeadRow(lead.id, client), `Lead ${lead.id} could not be reloaded.`);
  });
}
