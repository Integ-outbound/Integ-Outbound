import { HAIKU_MODEL, callHaiku, parseHaikuJson } from '../../ai/client';
import { buildReplyClassificationPrompt } from '../../ai/prompts';
import { DbClient, ensureFound, generateId, query, withTransaction } from '../../db/client';
import { Reply, SentMessage } from '../../db/types';
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

async function getReply(replyId: string, client?: DbClient): Promise<Reply> {
  const result = await query<Reply>('SELECT * FROM replies WHERE id = $1', [replyId], client);
  const reply = result.rows[0];
  if (!reply) {
    throw new Error(`Reply ${replyId} not found.`);
  }

  return reply;
}

async function getSentMessage(sentMessageId: string, client?: DbClient): Promise<SentMessage & { company_id: string }> {
  const result = await query<SentMessage & { company_id: string }>(
    `
      SELECT sm.*, l.company_id
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

export async function ingestReply(
  data: ReplyIngestInput,
  triggeredBy = 'operator'
): Promise<Reply> {
  const sentMessage = await getSentMessage(data.sent_message_id);
  const reply = await withTransaction(async (client) => {
    const result = await query<Reply>(
      `
        INSERT INTO replies (
          id,
          sent_message_id,
          contact_id,
          company_id,
          raw_content,
          received_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        generateId(),
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
        payload: { sent_message_id: sentMessage.id },
        triggeredBy
      },
      client
    );

    return ensureFound(result.rows[0], 'Reply insert failed.');
  });

  const [{ JOB_NAMES }, { getQueue }] = await Promise.all([
    import('../../queue/jobs'),
    import('../../queue/worker')
  ]);

  await getQueue().send(JOB_NAMES.CLASSIFY_REPLY, { replyId: reply.id });
  return reply;
}

export async function classifyReply(replyId: string, triggeredBy = 'system'): Promise<Reply> {
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

  return routeReply(replyId, triggeredBy);
}

export async function routeReply(replyId: string, triggeredBy = 'system'): Promise<Reply> {
  return withTransaction(async (client) => {
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
}

export async function getUnhandledReplies(): Promise<unknown[]> {
  const result = await query(
    `
      SELECT
        r.*,
        row_to_json(c) AS contact,
        row_to_json(co) AS company,
        row_to_json(sm) AS sent_message
      FROM replies r
      INNER JOIN contacts c ON c.id = r.contact_id
      INNER JOIN companies co ON co.id = r.company_id
      INNER JOIN sent_messages sm ON sm.id = r.sent_message_id
      WHERE r.handled = false
        AND r.routing_decision = 'human_review'
      ORDER BY r.received_at DESC NULLS LAST, r.created_at DESC
    `
  );

  return result.rows;
}

export async function markHandled(
  replyId: string,
  operatorAction: string,
  triggeredBy = 'operator'
): Promise<Reply> {
  return withTransaction(async (client) => {
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
