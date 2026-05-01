import { HAIKU_MODEL, callHaiku, parseHaikuJson } from '../../ai/client';
import {
  buildReplyClassificationPrompt,
  buildSuggestedReplyPrompt
} from '../../ai/prompts';
import { HttpError } from '../../api/utils';
import { DbClient, ensureFound, generateId, query, withTransaction } from '../../db/client';
import { Reply, SentMessage } from '../../db/types';
import {
  appendClientScope,
  assertReplyBelongsToClient,
  assertSentMessageBelongsToClient,
  requireClientContext,
  shouldGenerateSuggestedReply
} from '../clients/scope';
import { logEvent } from '../observability/service';

export interface ReplyIngestInput {
  sent_message_id: string;
  raw_content: string;
  received_at?: string;
}

interface ReplyClassificationPayload {
  classification: NonNullable<Reply['classification']>;
  confidence: number;
  reasoning: string;
  suggested_response: string | null;
}

interface SuggestedReplyPayload {
  subject: string;
  body: string;
  rationale: string;
}

export interface ReplyQueueFilters {
  client_id?: string;
  limit?: number;
}

export interface ReviewSuggestedReplyInput {
  action: 'approved' | 'edited' | 'rejected';
  subject?: string | null;
  body?: string | null;
  notes?: string | null;
}

async function getReply(replyId: string, client?: DbClient): Promise<Reply> {
  const result = await query<Reply>('SELECT * FROM replies WHERE id = $1', [replyId], client);
  const reply = result.rows[0];
  if (!reply) {
    throw new Error(`Reply ${replyId} not found.`);
  }

  return reply;
}

async function getSentMessage(
  sentMessageId: string,
  client?: DbClient
): Promise<
  SentMessage & {
    company_id: string;
    campaign_id: string;
    sequence_step: number;
  }
> {
  const result = await query<
    SentMessage & {
      company_id: string;
      campaign_id: string;
      sequence_step: number;
    }
  >(
    `
      SELECT sm.*, l.company_id, l.campaign_id, l.sequence_step
      FROM sent_messages sm
      INNER JOIN leads l ON l.id = sm.lead_id
      WHERE sm.id = $1
    `,
    [sentMessageId],
    client
  );

  const sentMessage = result.rows[0];
  if (!sentMessage) {
    throw new Error(`Sent message ${sentMessageId} not found.`);
  }

  return sentMessage;
}

async function getReplySuggestionContext(
  replyId: string,
  client?: DbClient
): Promise<{
  reply: Reply;
  sent_message: SentMessage;
  campaign: { name: string; angle: string; persona: string };
  company: { name: string | null };
  contact: {
    first_name: string | null;
    last_name: string | null;
    title: string | null;
  };
}> {
  const result = await query<
    Reply & {
      sent_message: SentMessage;
      campaign: { name: string; angle: string; persona: string };
      company: { name: string | null };
      contact: {
        first_name: string | null;
        last_name: string | null;
        title: string | null;
      };
    }
  >(
    `
      SELECT
        r.*,
        row_to_json(sm) AS sent_message,
        row_to_json(cp) AS campaign,
        row_to_json(co) AS company,
        json_build_object(
          'first_name', ct.first_name,
          'last_name', ct.last_name,
          'title', ct.title
        ) AS contact
      FROM replies r
      INNER JOIN sent_messages sm ON sm.id = r.sent_message_id
      INNER JOIN leads l ON l.id = sm.lead_id
      INNER JOIN campaigns cp ON cp.id = l.campaign_id
      INNER JOIN companies co ON co.id = r.company_id
      INNER JOIN contacts ct ON ct.id = r.contact_id
      WHERE r.id = $1
    `,
    [replyId],
    client
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error(`Reply ${replyId} not found.`);
  }

  return {
    reply: row,
    sent_message: row.sent_message,
    campaign: row.campaign,
    company: row.company,
    contact: row.contact
  };
}

async function stopFutureSequenceSteps(
  sentMessage: SentMessage & { company_id: string; campaign_id: string; sequence_step: number },
  replyId: string,
  triggeredBy: string,
  client: DbClient
): Promise<void> {
  const result = await query<{ id: string }>(
    `
      UPDATE leads
      SET
        status = 'suppressed',
        next_step_at = NULL,
        updated_at = NOW()
      WHERE campaign_id = $1
        AND company_id = $2
        AND contact_id = $3
        AND sequence_step > $4
        AND status IN ('pending_review', 'approved', 'send_ready')
      RETURNING id
    `,
    [
      sentMessage.campaign_id,
      sentMessage.company_id,
      sentMessage.contact_id,
      sentMessage.sequence_step
    ],
    client
  );

  if (result.rows.length === 0) {
    return;
  }

  await logEvent(
    {
      eventType: 'lead.sequence_stopped_on_reply',
      entityType: 'lead',
      entityId: sentMessage.lead_id,
      payload: {
        reply_id: replyId,
        affected_lead_ids: result.rows.map((row) => row.id),
        campaign_id: sentMessage.campaign_id
      },
      triggeredBy
    },
    client
  );
}

export async function ingestReply(
  data: ReplyIngestInput,
  triggeredBy = 'operator',
  clientId?: string
): Promise<Reply> {
  if (clientId) {
    await assertSentMessageBelongsToClient(
      data.sent_message_id,
      requireClientContext(clientId, 'Reply ingest')
    );
  }

  const sentMessage = await getSentMessage(data.sent_message_id);
  const reply = await withTransaction(async (client) => {
    const result = await query<Reply>(
      `
        INSERT INTO replies (
          id,
          client_id,
          sent_message_id,
          contact_id,
          company_id,
          raw_content,
          received_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [
        generateId(),
        sentMessage.client_id,
        sentMessage.id,
        sentMessage.contact_id,
        sentMessage.company_id,
        data.raw_content,
        data.received_at ?? new Date().toISOString()
      ],
      client
    );

    await logEvent(
      {
        eventType: 'reply.ingested',
        entityType: 'reply',
        entityId: ensureFound(result.rows[0], 'Reply insert failed.').id,
        payload: {
          client_id: sentMessage.client_id,
          sent_message_id: sentMessage.id
        },
        triggeredBy
      },
      client
    );

    await stopFutureSequenceSteps(sentMessage, ensureFound(result.rows[0], 'Reply insert failed.').id, triggeredBy, client);

    return ensureFound(result.rows[0], 'Reply insert failed.');
  });

  try {
    const [{ JOB_NAMES }, { getQueue }] = await Promise.all([
      import('../../queue/jobs'),
      import('../../queue/worker')
    ]);

    await getQueue().send(JOB_NAMES.CLASSIFY_REPLY, { replyId: reply.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Reply classification enqueue failed', {
      replyId: reply.id,
      sentMessageId: sentMessage.id,
      message
    });

    await logEvent({
      eventType: 'reply.classify_enqueue_failed',
      entityType: 'reply',
      entityId: reply.id,
      payload: {
        sent_message_id: sentMessage.id,
        error: message
      },
      triggeredBy
    });
  }

  return reply;
}

export async function classifyReply(
  replyId: string,
  triggeredBy = 'system',
  clientId?: string
): Promise<Reply> {
  if (clientId) {
    await assertReplyBelongsToClient(replyId, requireClientContext(clientId, 'Reply classification'));
  }

  const reply = await getReply(replyId);
  const prompt = buildReplyClassificationPrompt(reply.raw_content);
  const raw = await callHaiku(prompt);
  const classification = parseHaikuJson<ReplyClassificationPayload>(raw, 'reply classification');

  await withTransaction(async (client) => {
    await query(
      `
        UPDATE replies
        SET
          classification = $2,
          classification_confidence = $3,
          classification_model = $4,
          suggested_response = $5
        WHERE id = $1
      `,
      [
        replyId,
        classification.classification,
        classification.confidence,
        HAIKU_MODEL,
        classification.suggested_response
      ],
      client
    );

    await logEvent(
      {
        eventType: 'reply.classified',
        entityType: 'reply',
        entityId: replyId,
        payload: {
          classification: classification.classification,
          confidence: classification.confidence,
          reasoning: classification.reasoning
        },
        triggeredBy
      },
      client
    );
  });

  return routeReply(replyId, triggeredBy, clientId);
}

export async function routeReply(
  replyId: string,
  triggeredBy = 'system',
  clientId?: string
): Promise<Reply> {
  const routedReply = await withTransaction(async (client) => {
    if (clientId) {
      await assertReplyBelongsToClient(replyId, requireClientContext(clientId, 'Reply routing'), client);
    }

    const reply = await getReply(replyId, client);
    const sentMessage = await getSentMessage(reply.sent_message_id, client);
    const classification = reply.classification;

    if (!classification) {
      throw new Error(`Reply ${replyId} has not been classified yet.`);
    }

    let routingDecision: Reply['routing_decision'] = 'human_review';
    let handled = false;
    let operatorAction: string | null = null;

    if (classification === 'opt_out') {
      routingDecision = 'auto_handled';
      handled = true;
      operatorAction = 'auto_opt_out';

      await query(
        `
          UPDATE contacts
          SET opted_out = true, opted_out_at = NOW(), updated_at = NOW()
          WHERE id = $1
        `,
        [reply.contact_id],
        client
      );
      await logEvent(
        {
          eventType: 'contact.opted_out',
          entityType: 'contact',
          entityId: reply.contact_id,
          payload: { reply_id: replyId, source: 'reply_route' },
          triggeredBy
        },
        client
      );

      await query(
        `
          UPDATE leads
          SET status = 'suppressed', updated_at = NOW()
          WHERE id = $1
        `,
        [sentMessage.lead_id],
        client
      );
      await logEvent(
        {
          eventType: 'lead.suppressed',
          entityType: 'lead',
          entityId: sentMessage.lead_id,
          payload: { reply_id: replyId, source: 'reply_route' },
          triggeredBy
        },
        client
      );
    } else if (classification === 'out_of_office') {
      routingDecision = 'auto_handled';
      handled = true;
      operatorAction = 'delay_14_days';

      await query(
        `
          UPDATE leads
          SET next_step_at = COALESCE(next_step_at, NOW()) + INTERVAL '14 days', updated_at = NOW()
          WHERE id = $1
        `,
        [sentMessage.lead_id],
        client
      );
      await logEvent(
        {
          eventType: 'lead.delayed',
          entityType: 'lead',
          entityId: sentMessage.lead_id,
          payload: { reply_id: replyId, delay_days: 14, source: 'reply_route' },
          triggeredBy
        },
        client
      );
    } else if (classification === 'negative') {
      routingDecision = 'auto_handled';
      handled = true;
      operatorAction = 'negative_auto_closed';

      await query(
        `
          UPDATE leads
          SET status = 'replied', updated_at = NOW()
          WHERE id = $1
        `,
        [sentMessage.lead_id],
        client
      );
      await logEvent(
        {
          eventType: 'lead.replied',
          entityType: 'lead',
          entityId: sentMessage.lead_id,
          payload: { reply_id: replyId, classification, source: 'reply_route' },
          triggeredBy
        },
        client
      );

      await query(
        `
          UPDATE companies
          SET outreach_status = 'replied', updated_at = NOW()
          WHERE id = $1
        `,
        [reply.company_id],
        client
      );
      await logEvent(
        {
          eventType: 'company.replied',
          entityType: 'company',
          entityId: reply.company_id,
          payload: { reply_id: replyId, classification, source: 'reply_route' },
          triggeredBy
        },
        client
      );
    } else if (
      classification === 'positive' ||
      classification === 'question' ||
      classification === 'referral' ||
      classification === 'neutral'
    ) {
      routingDecision = 'human_review';
      handled = false;

      await query(
        `
          UPDATE leads
          SET status = 'replied', updated_at = NOW()
          WHERE id = $1
        `,
        [sentMessage.lead_id],
        client
      );
      await logEvent(
        {
          eventType: 'lead.replied',
          entityType: 'lead',
          entityId: sentMessage.lead_id,
          payload: { reply_id: replyId, classification, source: 'reply_route' },
          triggeredBy
        },
        client
      );

      await query(
        `
          UPDATE companies
          SET outreach_status = 'replied', updated_at = NOW()
          WHERE id = $1
        `,
        [reply.company_id],
        client
      );
      await logEvent(
        {
          eventType: 'company.replied',
          entityType: 'company',
          entityId: reply.company_id,
          payload: { reply_id: replyId, classification, source: 'reply_route' },
          triggeredBy
        },
        client
      );
    }

    const result = await query<Reply>(
      `
        UPDATE replies
        SET
          routing_decision = $2,
          handled = $3,
          handled_at = CASE WHEN $3 THEN NOW() ELSE handled_at END,
          operator_action = COALESCE($4, operator_action)
        WHERE id = $1
        RETURNING *
      `,
      [replyId, routingDecision, handled, operatorAction],
      client
    );

    await logEvent(
      {
        eventType: 'reply.routed',
        entityType: 'reply',
        entityId: replyId,
        payload: {
          classification,
          routing_decision: routingDecision,
          handled,
          operator_action: operatorAction
        },
        triggeredBy
      },
      client
    );

    return ensureFound(result.rows[0], `Reply routing failed for ${replyId}.`);
  });

  if (shouldGenerateSuggestedReply(routedReply.classification, routedReply.routing_decision)) {
    try {
      return await generateSuggestedReply(replyId, triggeredBy, clientId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await logEvent({
        eventType: 'reply.suggested_response_generation_failed',
        entityType: 'reply',
        entityId: replyId,
        payload: { error: message },
        triggeredBy
      });
    }
  }

  return routedReply;
}

export async function generateSuggestedReply(
  replyId: string,
  triggeredBy = 'operator',
  clientId?: string
): Promise<Reply> {
  if (clientId) {
    await assertReplyBelongsToClient(
      replyId,
      requireClientContext(clientId, 'Suggested reply generation')
    );
  }

  const context = await getReplySuggestionContext(replyId);
  const classification = context.reply.classification;
  if (
    !classification ||
    !shouldGenerateSuggestedReply(classification, context.reply.routing_decision)
  ) {
    throw new HttpError(
      409,
      `Reply ${replyId} is not eligible for suggested reply generation.`
    );
  }

  const contactName = [context.contact.first_name, context.contact.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  const prompt = buildSuggestedReplyPrompt({
    classification: classification as 'positive' | 'question' | 'referral' | 'neutral',
    outboundSubject: context.sent_message.subject,
    outboundBody: context.sent_message.body,
    replyContent: context.reply.raw_content,
    companyName: context.company.name,
    contactName: contactName || null,
    contactTitle: context.contact.title,
    campaignAngle: context.campaign.angle,
    senderPersona: context.campaign.persona
  });
  const raw = await callHaiku(prompt);
  const generated = parseHaikuJson<SuggestedReplyPayload>(raw, 'suggested reply generation');

  return withTransaction(async (client) => {
    const result = await query<Reply>(
      `
        UPDATE replies
        SET
          suggested_response_subject = $2,
          suggested_response = $3,
          suggested_response_model = $4,
          suggested_response_generated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [replyId, generated.subject.trim(), generated.body.trim(), HAIKU_MODEL],
      client
    );

    await logEvent(
      {
        eventType: 'reply.suggested_response_generated',
        entityType: 'reply',
        entityId: replyId,
        payload: {
          rationale: generated.rationale,
          model: HAIKU_MODEL
        },
        triggeredBy
      },
      client
    );

    return ensureFound(result.rows[0], `Suggested reply update failed for ${replyId}.`);
  });
}

export async function getUnhandledReplies(filters: ReplyQueueFilters = {}): Promise<unknown[]> {
  const conditions = [
    `r.handled = false`,
    `r.routing_decision = 'human_review'`
  ];
  const params: unknown[] = [];
  appendClientScope(conditions, params, 'r.client_id', filters.client_id);
  params.push(filters.limit ?? 50);

  const result = await query(
    `
      SELECT
        r.*,
        row_to_json(c) AS contact,
        row_to_json(co) AS company,
        row_to_json(sm) AS sent_message,
        row_to_json(cp) AS campaign
      FROM replies r
      INNER JOIN contacts c ON c.id = r.contact_id
      INNER JOIN companies co ON co.id = r.company_id
      INNER JOIN sent_messages sm ON sm.id = r.sent_message_id
      INNER JOIN leads l ON l.id = sm.lead_id
      INNER JOIN campaigns cp ON cp.id = l.campaign_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.received_at DESC NULLS LAST, r.created_at DESC
      LIMIT $${params.length}
    `
    ,
    params
  );

  return result.rows;
}

export async function markHandled(
  replyId: string,
  operatorAction: string,
  triggeredBy = 'operator',
  clientId?: string
): Promise<Reply> {
  return withTransaction(async (client) => {
    if (clientId) {
      await assertReplyBelongsToClient(replyId, requireClientContext(clientId, 'Reply handling'), client);
    }

    const result = await query<Reply>(
      `
        UPDATE replies
        SET handled = true, handled_at = NOW(), operator_action = $2
        WHERE id = $1
        RETURNING *
      `,
      [replyId, operatorAction],
      client
    );

    const reply = result.rows[0];
    if (!reply) {
      throw new Error(`Reply ${replyId} not found.`);
    }

    await logEvent(
      {
        eventType: 'reply.handled',
        entityType: 'reply',
        entityId: replyId,
        payload: { operator_action: operatorAction },
        triggeredBy
      },
      client
    );

    return reply;
  });
}

export async function reviewSuggestedReply(
  replyId: string,
  input: ReviewSuggestedReplyInput,
  triggeredBy = 'operator',
  clientId?: string
): Promise<Reply> {
  return withTransaction(async (client) => {
    if (clientId) {
      await assertReplyBelongsToClient(replyId, requireClientContext(clientId, 'Reply review'), client);
    }

    const reply = await getReply(replyId, client);
    const subject =
      input.subject?.trim() ||
      (input.action === 'approved' ? reply.suggested_response_subject?.trim() : null);
    const body =
      input.body?.trim() ||
      (input.action === 'approved' ? reply.suggested_response?.trim() : null);

    if ((input.action === 'approved' || input.action === 'edited') && (!subject || !body)) {
      throw new HttpError(
        400,
        'Reviewed reply approval requires both subject and body.'
      );
    }

    const operatorAction = `reply_review_${input.action}`;
    const result = await query<Reply>(
      `
        UPDATE replies
        SET
          reviewed_response_subject = $2,
          reviewed_response_body = $3,
          reviewed_response_status = $4,
          reviewed_response_notes = $5,
          reviewed_by = 'operator',
          reviewed_at = NOW(),
          handled = true,
          handled_at = NOW(),
          operator_action = $6
        WHERE id = $1
        RETURNING *
      `,
      [
        replyId,
        subject ?? null,
        body ?? null,
        input.action,
        input.notes?.trim() ?? null,
        operatorAction
      ],
      client
    );

    await logEvent(
      {
        eventType: 'reply.reviewed_response_recorded',
        entityType: 'reply',
        entityId: replyId,
        payload: {
          action: input.action,
          has_subject: Boolean(subject),
          has_body: Boolean(body)
        },
        triggeredBy
      },
      client
    );

    return ensureFound(result.rows[0], `Reply review save failed for ${replyId}.`);
  });
}
