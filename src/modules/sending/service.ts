import { DbClient, ensureFound, generateId, query, withTransaction } from '../../db/client';
import { Campaign, Draft, Lead, SentMessage } from '../../db/types';
import { appendClientScope } from '../clients/scope';
import { logEvent } from '../observability/service';

export interface MarkSentInput {
  leadId: string;
  draftId: string;
  mailboxId?: string;
  fromAddress: string;
  subject?: string;
  body?: string;
  sendingProvider: string;
  sentAt?: string;
  gmailMessageId?: string;
  gmailThreadId?: string;
  deliveryStatus?: SentMessage['delivery_status'];
}

async function getLeadForSequence(leadId: string, client?: DbClient): Promise<Lead & { campaign: Campaign }> {
  const result = await query<Lead & { campaign: Campaign }>(
    `
      SELECT l.*, row_to_json(c) AS campaign
      FROM leads l
      INNER JOIN campaigns c ON c.id = l.campaign_id
      WHERE l.id = $1
    `,
    [leadId],
    client
  );

  const lead = result.rows[0];
  if (!lead) {
    throw new Error(`Lead ${leadId} not found.`);
  }

  return lead;
}

async function scheduleNextStepInternal(
  leadId: string,
  triggeredBy: string,
  client: DbClient,
  sentAtIso?: string
): Promise<Lead | null> {
  const lead = await getLeadForSequence(leadId, client);
  if (lead.sequence_step >= lead.campaign.sequence_steps) {
    return null;
  }

  const nextStep = lead.sequence_step + 1;
  const existingResult = await query<Lead>(
    `
      SELECT *
      FROM leads
      WHERE campaign_id = $1
        AND company_id = $2
        AND contact_id = $3
        AND sequence_step = $4
      LIMIT 1
    `,
    [lead.campaign_id, lead.company_id, lead.contact_id, nextStep],
    client
  );

  if (existingResult.rows[0]) {
    return existingResult.rows[0];
  }

  const baseDate = sentAtIso ?? new Date().toISOString();
  const nextStepResult = await query<Lead>(
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
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        'pending_review',
        $7,
        $8::timestamptz + ($9 || ' days')::interval
      )
      RETURNING *
    `,
    [
      generateId(),
      lead.client_id,
      lead.company_id,
      lead.contact_id,
      lead.campaign_id,
      lead.icp_score_at_creation,
      nextStep,
      baseDate,
      lead.campaign.sequence_delay_days
    ],
    client
  );

  const nextLead = ensureFound(nextStepResult.rows[0], `Next sequence step creation failed for ${leadId}.`);
  await logEvent(
    {
      eventType: 'lead.sequence_scheduled',
      entityType: 'lead',
      entityId: nextLead.id,
      payload: {
        parent_lead_id: leadId,
        sequence_step: nextStep,
        next_step_at: nextLead.next_step_at
      },
      triggeredBy
    },
    client
  );

  return nextLead;
}

export async function getSendReadyQueue(limit: number, clientId?: string): Promise<unknown[]> {
  const conditions = [`l.status = 'send_ready'`];
  const params: unknown[] = [];
  appendClientScope(conditions, params, 'l.client_id', clientId);
  params.push(limit);

  const result = await query(
    `
      SELECT
        l.*,
        row_to_json(c) AS company,
        row_to_json(ct) AS contact,
        row_to_json(cp) AS campaign,
        row_to_json(d) AS draft
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
      WHERE ${conditions.join(' AND ')}
      ORDER BY l.reviewed_at ASC NULLS LAST, l.created_at ASC
      LIMIT $${params.length}
    `,
    params
  );

  return result.rows;
}

export async function markSent(input: MarkSentInput, triggeredBy = 'operator'): Promise<SentMessage> {
  return withTransaction(async (client) => {
    const leadResult = await query<Lead>(
      'SELECT * FROM leads WHERE id = $1',
      [input.leadId],
      client
    );
    const draftResult = await query<Draft>(
      'SELECT * FROM drafts WHERE id = $1',
      [input.draftId],
      client
    );

    const lead = leadResult.rows[0];
    const draft = draftResult.rows[0];

    if (!lead) {
      throw new Error(`Lead ${input.leadId} not found.`);
    }

    if (!draft) {
      throw new Error(`Draft ${input.draftId} not found.`);
    }

    const sentAt = input.sentAt ?? new Date().toISOString();
    const finalSubject = input.subject ?? draft.edited_subject ?? draft.subject ?? '';
    const finalBody = input.body ?? draft.edited_body ?? draft.body ?? '';
    const result = await query<SentMessage>(
      `
        INSERT INTO sent_messages (
          id,
          client_id,
          lead_id,
          draft_id,
          contact_id,
          mailbox_id,
          from_address,
          subject,
          body,
          sending_provider,
          sent_at,
          gmail_message_id,
          gmail_thread_id,
          delivery_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `,
      [
        generateId(),
        lead.client_id,
        lead.id,
        draft.id,
        lead.contact_id,
        input.mailboxId ?? null,
        input.fromAddress,
        finalSubject,
        finalBody,
        input.sendingProvider,
        sentAt,
        input.gmailMessageId ?? null,
        input.gmailThreadId ?? null,
        input.deliveryStatus ?? 'sent'
      ],
      client
    );
    const sentMessage = ensureFound(
      result.rows[0],
      `Sent message insert failed for lead ${input.leadId}.`
    );

    await query(
      `
        UPDATE leads
        SET status = 'sent', updated_at = NOW()
        WHERE id = $1
      `,
      [lead.id],
      client
    );

    await query(
      `
        UPDATE companies
        SET outreach_status = 'in_sequence', updated_at = NOW()
        WHERE id = $1
      `,
      [lead.company_id],
      client
    );

    await logEvent(
      {
        eventType: 'message.sent_marked',
        entityType: 'sent_message',
        entityId: sentMessage.id,
        payload: {
          lead_id: lead.id,
          draft_id: draft.id,
          mailbox_id: input.mailboxId ?? null,
          sending_provider: input.sendingProvider,
          gmail_message_id: input.gmailMessageId ?? null,
          gmail_thread_id: input.gmailThreadId ?? null
        },
        triggeredBy
      },
      client
    );

    await logEvent(
      {
        eventType: 'lead.sent',
        entityType: 'lead',
        entityId: lead.id,
        payload: { sent_message_id: sentMessage.id },
        triggeredBy
      },
      client
    );

    await logEvent(
      {
        eventType: 'company.sequence_started',
        entityType: 'company',
        entityId: lead.company_id,
        payload: { lead_id: lead.id },
        triggeredBy
      },
      client
    );

    await scheduleNextStepInternal(lead.id, 'system', client, sentAt);

    return sentMessage;
  });
}

export async function markBounced(sentMessageId: string, triggeredBy = 'operator'): Promise<SentMessage> {
  return withTransaction(async (client) => {
    const messageResult = await query<SentMessage>(
      'SELECT * FROM sent_messages WHERE id = $1',
      [sentMessageId],
      client
    );
    const message = messageResult.rows[0];
    if (!message) {
      throw new Error(`Sent message ${sentMessageId} not found.`);
    }

    const result = await query<SentMessage>(
      `
        UPDATE sent_messages
        SET delivery_status = 'bounced'
        WHERE id = $1
        RETURNING *
      `,
      [sentMessageId],
      client
    );

    await query(
      `
        UPDATE contacts
        SET bounced = true, bounced_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
      [message.contact_id],
      client
    );

    await query(
      `
        UPDATE leads
        SET status = 'bounced', updated_at = NOW()
        WHERE id = $1
      `,
      [message.lead_id],
      client
    );

    await logEvent(
      {
        eventType: 'message.bounced',
        entityType: 'sent_message',
        entityId: sentMessageId,
        payload: { lead_id: message.lead_id, contact_id: message.contact_id },
        triggeredBy
      },
      client
    );

    await logEvent(
      {
        eventType: 'contact.bounced',
        entityType: 'contact',
        entityId: message.contact_id,
        payload: { sent_message_id: sentMessageId },
        triggeredBy
      },
      client
    );

    await logEvent(
      {
        eventType: 'lead.bounced',
        entityType: 'lead',
        entityId: message.lead_id,
        payload: { sent_message_id: sentMessageId },
        triggeredBy
      },
      client
    );

    return ensureFound(result.rows[0], `Bounce update failed for ${sentMessageId}.`);
  });
}

export async function scheduleNextStep(leadId: string, triggeredBy = 'system'): Promise<Lead | null> {
  return withTransaction((client) => scheduleNextStepInternal(leadId, triggeredBy, client));
}

export async function getDailyStats(): Promise<{
  sendsToday: number;
  bouncesToday: number;
  queueDepth: number;
}> {
  return getDailyStatsForClient();
}

export async function getDailyStatsForClient(clientId?: string): Promise<{
  sendsToday: number;
  bouncesToday: number;
  queueDepth: number;
}> {
  const sentConditions: string[] = ['sent_at::date = CURRENT_DATE'];
  const sentParams: unknown[] = [];
  appendClientScope(sentConditions, sentParams, 'client_id', clientId);

  const queueConditions: string[] = [`status = 'send_ready'`];
  const queueParams: unknown[] = [];
  appendClientScope(queueConditions, queueParams, 'client_id', clientId);

  const bouncedConditions: string[] = ['c.bounced_at::date = CURRENT_DATE'];
  const bouncedParams: unknown[] = [];
  if (clientId) {
    bouncedParams.push(clientId);
    bouncedConditions.push(
      `EXISTS (
        SELECT 1
        FROM sent_messages sm
        WHERE sm.contact_id = c.id
          AND sm.client_id = $${bouncedParams.length}
      )`
    );
  }

  const [sendsResult, bouncesResult, queueResult] = await Promise.all([
    query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM sent_messages
        WHERE ${sentConditions.join(' AND ')}
      `,
      sentParams
    ),
    query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM contacts c
        WHERE ${bouncedConditions.join(' AND ')}
      `,
      bouncedParams
    ),
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM leads WHERE ${queueConditions.join(' AND ')}`,
      queueParams
    )
  ]);

  return {
    sendsToday: Number(sendsResult.rows[0]?.count ?? 0),
    bouncesToday: Number(bouncesResult.rows[0]?.count ?? 0),
    queueDepth: Number(queueResult.rows[0]?.count ?? 0)
  };
}
