import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, parseWithSchema } from '../utils';
import {
  classifyReply,
  getUnhandledReplies,
  ingestReply,
  markHandled
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
  asyncHandler(async (_req, res) => {
    const replies = await getUnhandledReplies();
    res.status(200).json(replies);
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

export default router;
