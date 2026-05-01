import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, parseWithSchema } from '../utils';
import {
  getDailyStats,
  getDailyStatsForClient,
  getSendReadyQueue,
  markBounced,
  markSent
} from '../../modules/sending/service';
import { processSendReadyLeads } from '../../modules/mailboxes/operations';

const router = Router();

const queueQuerySchema = z.object({
  client_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().default(50)
});

const clientMutationBodySchema = z.object({
  client_id: z.string().uuid()
});

const markSentBodySchema = clientMutationBodySchema.extend({
  leadId: z.string().uuid(),
  draftId: z.string().uuid(),
  fromAddress: z.string().email(),
  subject: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  sendingProvider: z.string().min(1),
  sentAt: z.string().datetime().optional(),
  deliveryStatus: z.enum(['queued', 'sent', 'delivered', 'bounced', 'failed']).optional()
});

const markBouncedBodySchema = clientMutationBodySchema.extend({
  sentMessageId: z.string().uuid()
});

const processSendReadyBodySchema = clientMutationBodySchema.extend({
  limit: z.number().int().positive().max(100).optional()
});

const statsQuerySchema = z.object({
  client_id: z.string().uuid().optional()
});

router.get(
  '/sending/queue',
  asyncHandler(async (req, res) => {
    const query = parseWithSchema(queueQuerySchema, req.query, 'Invalid sending queue query.');
    const queue = await getSendReadyQueue(query.limit ?? 50, query.client_id);
    res.status(200).json(queue);
  })
);

router.post(
  '/sending/mark-sent',
  asyncHandler(async (req, res) => {
    const body = parseWithSchema(markSentBodySchema, req.body, 'Invalid mark-sent payload.');
    const sentMessage = await markSent(body, 'operator', body.client_id);
    res.status(200).json(sentMessage);
  })
);

router.post(
  '/sending/mark-bounced',
  asyncHandler(async (req, res) => {
    const body = parseWithSchema(markBouncedBodySchema, req.body, 'Invalid mark-bounced payload.');
    const sentMessage = await markBounced(body.sentMessageId, 'operator', body.client_id);
    res.status(200).json(sentMessage);
  })
);

router.post(
  '/sending/process-send-ready',
  asyncHandler(async (req, res) => {
    const body = parseWithSchema(
      processSendReadyBodySchema,
      req.body ?? {},
      'Invalid process-send-ready payload.'
    );
    const result = await processSendReadyLeads(body.limit ?? 10, 'operator', body.client_id);
    res.status(200).json(result);
  })
);

router.get(
  '/sending/stats',
  asyncHandler(async (req, res) => {
    const query = parseWithSchema(statsQuerySchema, req.query, 'Invalid sending stats query.');
    const stats = query.client_id ? await getDailyStatsForClient(query.client_id) : await getDailyStats();
    res.status(200).json(stats);
  })
);

export default router;
