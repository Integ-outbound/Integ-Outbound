import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, parseWithSchema } from '../utils';
import {
  classifyReply,
  generateSuggestedReply,
  getUnhandledReplies,
  ingestReply,
  markHandled,
  reviewSuggestedReply
} from '../../modules/replies/service';

const router = Router();

const emptyBodySchema = z.object({});

const ingestBodySchema = z.object({
  sent_message_id: z.string().uuid(),
  raw_content: z.string().min(1),
  received_at: z.string().datetime().optional()
});

const handledBodySchema = z.object({
  operatorAction: z.string().min(1)
});

const replyQueueQuerySchema = z.object({
  client_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(200).optional()
});

const reviewSuggestedReplyBodySchema = z.object({
  action: z.enum(['approved', 'edited', 'rejected']),
  subject: z.string().trim().min(1).nullable().optional(),
  body: z.string().trim().min(1).nullable().optional(),
  notes: z.string().trim().min(1).nullable().optional()
});

const replyIdParamsSchema = z.object({
  id: z.string().uuid()
});

router.post(
  '/replies/ingest',
  asyncHandler(async (req, res) => {
    const body = parseWithSchema(ingestBodySchema, req.body, 'Invalid reply ingest payload.');
    const reply = await ingestReply(body);
    res.status(201).json(reply);
  })
);

router.post(
  '/replies/:id/classify',
  asyncHandler(async (req, res) => {
    parseWithSchema(emptyBodySchema, req.body ?? {}, 'Invalid reply classify payload.');
    const params = parseWithSchema(replyIdParamsSchema, req.params, 'Invalid reply id.');
    const reply = await classifyReply(params.id);
    res.status(200).json(reply);
  })
);

router.get(
  '/replies/unhandled',
  asyncHandler(async (req, res) => {
    const query = parseWithSchema(replyQueueQuerySchema, req.query, 'Invalid reply review query.');
    const replies = await getUnhandledReplies(query);
    res.status(200).json(replies);
  })
);

router.post(
  '/replies/:id/suggested-reply',
  asyncHandler(async (req, res) => {
    parseWithSchema(emptyBodySchema, req.body ?? {}, 'Invalid suggested reply payload.');
    const params = parseWithSchema(replyIdParamsSchema, req.params, 'Invalid reply id.');
    const reply = await generateSuggestedReply(params.id);
    res.status(200).json(reply);
  })
);

router.post(
  '/replies/:id/handled',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(replyIdParamsSchema, req.params, 'Invalid reply id.');
    const body = parseWithSchema(handledBodySchema, req.body, 'Invalid handled reply payload.');
    const reply = await markHandled(params.id, body.operatorAction);
    res.status(200).json(reply);
  })
);

router.post(
  '/replies/:id/review-response',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(replyIdParamsSchema, req.params, 'Invalid reply id.');
    const body = parseWithSchema(
      reviewSuggestedReplyBodySchema,
      req.body,
      'Invalid reviewed reply payload.'
    );
    const reply = await reviewSuggestedReply(params.id, body);
    res.status(200).json(reply);
  })
);

export default router;
