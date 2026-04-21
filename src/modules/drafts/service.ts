import { HAIKU_MODEL, callHaiku, parseHaikuJson } from '../../ai/client';
import { buildDraftPrompt } from '../../ai/prompts';
import { DbClient, ensureFound, generateId, query, withTransaction } from '../../db/client';
import { Campaign, Company, Contact, Draft, Lead } from '../../db/types';
import { HttpError } from '../../api/utils';
import { logEvent } from '../observability/service';

const DEFAULT_PROMPT_VERSION = 'drafts-v1';

interface LeadDraftContext {
  lead: Lead;
  company: Company;
  contact: Contact;
  campaign: Campaign;
}

interface GeneratedDraftPayload {
  subject: string;
  body: string;
  signals_used: string[];
}

function getRecentSignals(company: Company): Array<{ description: string; confidence: number }> {
  const enrichment = company.raw_enrichment ?? {};
  const signals = Array.isArray(enrichment.recent_signals)
    ? enrichment.recent_signals
    : [];

  return signals
    .filter((item): item is { description: string; confidence: number } => {
      return (
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).description === 'string'
      );
    })
    .map((item) => ({
      description: item.description,
      confidence:
        typeof item.confidence === 'number' && Number.isFinite(item.confidence)
          ? item.confidence
          : 0
    }));
}

function computeTextDiff(original: string | null, edited: string): string {
  const before = (original ?? '').split('\n');
  const after = edited.split('\n');
  const lines: string[] = [];
  const max = Math.max(before.length, after.length);

  for (let index = 0; index < max; index += 1) {
    const oldLine = before[index] ?? '';
    const newLine = after[index] ?? '';
    if (oldLine === newLine) {
      if (oldLine) {
        lines.push(`  ${oldLine}`);
      }
      continue;
    }

    if (oldLine) {
      lines.push(`- ${oldLine}`);
    }

    if (newLine) {
      lines.push(`+ ${newLine}`);
    }
  }

  return lines.join('\n').trim();
}

async function getLeadContextByLeadId(leadId: string, client?: DbClient): Promise<LeadDraftContext> {
  const result = await query<
    Lead &
      { company: Company; contact: Contact; campaign: Campaign }
  >(
    `
      SELECT
        l.*,
        row_to_json(c) AS company,
        row_to_json(ct) AS contact,
        row_to_json(cp) AS campaign
      FROM leads l
      INNER JOIN companies c ON c.id = l.company_id
      INNER JOIN contacts ct ON ct.id = l.contact_id
      INNER JOIN campaigns cp ON cp.id = l.campaign_id
      WHERE l.id = $1
    `,
    [leadId],
    client
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error(`Lead ${leadId} not found.`);
  }

  return {
    lead: {
      id: row.id,
      company_id: row.company_id,
      contact_id: row.contact_id,
      campaign_id: row.campaign_id,
      icp_score_at_creation: row.icp_score_at_creation,
      status: row.status,
      rejection_reason: row.rejection_reason,
      rejection_notes: row.rejection_notes,
      reviewed_by: row.reviewed_by,
      reviewed_at: row.reviewed_at,
      sequence_step: row.sequence_step,
      next_step_at: row.next_step_at,
      created_at: row.created_at,
      updated_at: row.updated_at
    },
    company: row.company,
    contact: row.contact,
    campaign: row.campaign
  };
}

async function getDraftById(draftId: string, client?: DbClient): Promise<Draft> {
  const result = await query<Draft>('SELECT * FROM drafts WHERE id = $1', [draftId], client);
  const draft = result.rows[0];
  if (!draft) {
    throw new Error(`Draft ${draftId} not found.`);
  }

  return draft;
}

async function ensureSendReadyAllowed(leadId: string, client: DbClient, triggeredBy: string): Promise<void> {
  const context = await getLeadContextByLeadId(leadId, client);
  const blocked =
    context.contact.opted_out || context.contact.bounced || context.company.suppressed;

  if (!blocked) {
    return;
  }

  await query(
    `
      UPDATE leads
      SET status = 'suppressed', updated_at = NOW()
      WHERE id = $1
    `,
    [leadId],
    client
  );

  await logEvent(
    {
      eventType: 'lead.send_ready_blocked',
      entityType: 'lead',
      entityId: leadId,
      payload: {
        contact_opted_out: context.contact.opted_out,
        contact_bounced: context.contact.bounced,
        company_suppressed: context.company.suppressed
      },
      triggeredBy
    },
    client
  );

  throw new HttpError(409, 'Lead cannot enter send_ready because it is suppressed.');
}

export async function generateDraft(leadId: string, triggeredBy = 'operator'): Promise<Draft> {
  const context = await getLeadContextByLeadId(leadId);
  const recentSignals = getRecentSignals(context.company);
  const signalDescriptions = recentSignals
    .filter((signal) => signal.confidence > 0.6)
    .map((signal) => signal.description);

  const prompt = buildDraftPrompt({
    persona: context.campaign.persona,
    angle: context.campaign.angle,
    companyName: context.company.name,
    industry: context.company.industry,
    employeeCount: context.company.employee_count,
    country: context.company.country,
    signals: signalDescriptions,
    firstName: context.contact.first_name,
    lastName: context.contact.last_name,
    title: context.contact.title,
    department: context.contact.department
  });

  const raw = await callHaiku(prompt);
  const generated = parseHaikuJson<GeneratedDraftPayload>(raw, 'draft generation');

  return withTransaction(async (client) => {
    const result = await query<Draft>(
      `
        INSERT INTO drafts (
          id,
          lead_id,
          subject,
          body,
          model_version,
          prompt_version,
          signals_used
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        RETURNING *
      `,
      [
        generateId(),
        leadId,
        generated.subject,
        generated.body,
        HAIKU_MODEL,
        context.campaign.prompt_version ?? DEFAULT_PROMPT_VERSION,
        JSON.stringify(generated.signals_used ?? [])
      ],
      client
    );

    const draft = ensureFound(result.rows[0], `Draft generation failed for lead ${leadId}.`);
    await logEvent(
      {
        eventType: 'draft.generated',
        entityType: 'draft',
        entityId: draft.id,
        payload: {
          lead_id: leadId,
          prompt_version: draft.prompt_version,
          signals_used: generated.signals_used ?? []
        },
        triggeredBy
      },
      client
    );

    return draft;
  });
}

export async function generateBatchDrafts(
  campaignId: string,
  triggeredBy = 'system'
): Promise<{ generated: number }> {
  const result = await query<{ id: string }>(
    `
      SELECT l.id
      FROM leads l
      WHERE l.campaign_id = $1
        AND l.status = 'pending_review'
        AND NOT EXISTS (
          SELECT 1
          FROM drafts d
          WHERE d.lead_id = l.id
        )
      ORDER BY l.created_at ASC
    `,
    [campaignId]
  );

  let generated = 0;
  for (const row of result.rows) {
    try {
      await generateDraft(row.id, triggeredBy);
      generated += 1;
    } catch (error) {
      console.error('Draft generation failed', {
        leadId: row.id,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { generated };
}

export async function getDraft(leadId: string): Promise<Draft | null> {
  const result = await query<Draft>(
    `
      SELECT *
      FROM drafts
      WHERE lead_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [leadId]
  );

  return result.rows[0] ?? null;
}

export async function approveDraft(draftId: string, triggeredBy = 'operator'): Promise<Draft> {
  return withTransaction(async (client) => {
    const draft = await getDraftById(draftId, client);
    await ensureSendReadyAllowed(draft.lead_id, client, triggeredBy);

    const result = await query<Draft>(
      `
        UPDATE drafts
        SET operator_decision = 'approved', decided_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [draftId],
      client
    );

    await query(
      `
        UPDATE leads
        SET status = 'send_ready', reviewed_by = 'operator', reviewed_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
      [draft.lead_id],
      client
    );

    await logEvent(
      {
        eventType: 'draft.approved',
        entityType: 'draft',
        entityId: draftId,
        payload: { lead_id: draft.lead_id },
        triggeredBy
      },
      client
    );

    await logEvent(
      {
        eventType: 'lead.send_ready',
        entityType: 'lead',
        entityId: draft.lead_id,
        payload: { source: 'draft.approved' },
        triggeredBy
      },
      client
    );

    return ensureFound(result.rows[0], `Draft approval failed for ${draftId}.`);
  });
}

export async function rejectDraft(
  draftId: string,
  reason: Lead['rejection_reason'],
  notes: string | null,
  triggeredBy = 'operator'
): Promise<Draft> {
  return withTransaction(async (client) => {
    const draft = await getDraftById(draftId, client);
    const result = await query<Draft>(
      `
        UPDATE drafts
        SET operator_decision = 'rejected', decided_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [draftId],
      client
    );

    await query(
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
      `,
      [draft.lead_id, reason, notes],
      client
    );

    await logEvent(
      {
        eventType: 'draft.rejected',
        entityType: 'draft',
        entityId: draftId,
        payload: { lead_id: draft.lead_id, reason, notes },
        triggeredBy
      },
      client
    );

    await logEvent(
      {
        eventType: 'lead.rejected',
        entityType: 'lead',
        entityId: draft.lead_id,
        payload: { reason, notes, source: 'draft.rejected' },
        triggeredBy
      },
      client
    );

    return ensureFound(result.rows[0], `Draft rejection failed for ${draftId}.`);
  });
}

export async function editDraft(
  draftId: string,
  editedSubject: string,
  editedBody: string,
  triggeredBy = 'operator'
): Promise<Draft> {
  return withTransaction(async (client) => {
    const draft = await getDraftById(draftId, client);
    await ensureSendReadyAllowed(draft.lead_id, client, triggeredBy);

    const result = await query<Draft>(
      `
        UPDATE drafts
        SET
          operator_decision = 'edited',
          edited_subject = $2,
          edited_body = $3,
          edit_diff_subject = $4,
          edit_diff_body = $5,
          decided_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        draftId,
        editedSubject,
        editedBody,
        computeTextDiff(draft.subject, editedSubject),
        computeTextDiff(draft.body, editedBody)
      ],
      client
    );

    await query(
      `
        UPDATE leads
        SET status = 'send_ready', reviewed_by = 'operator', reviewed_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
      [draft.lead_id],
      client
    );

    await logEvent(
      {
        eventType: 'draft.edited',
        entityType: 'draft',
        entityId: draftId,
        payload: { lead_id: draft.lead_id },
        triggeredBy
      },
      client
    );

    await logEvent(
      {
        eventType: 'lead.send_ready',
        entityType: 'lead',
        entityId: draft.lead_id,
        payload: { source: 'draft.edited' },
        triggeredBy
      },
      client
    );

    return ensureFound(result.rows[0], `Draft edit failed for ${draftId}.`);
  });
}
