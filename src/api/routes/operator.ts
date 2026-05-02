import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, parseWithSchema } from '../utils';
import {
  getOperatorClientStatuses,
  getOperatorPilotRequests,
  getOperatorReviewQueues,
  getOperatorSafety,
  getOperatorStatus
} from '../../modules/operator/service';

const router = Router();

const statusQuerySchema = z.object({
  client_id: z.string().uuid().optional()
});

const reviewQuerySchema = z.object({
  client_id: z.string().uuid().optional(),
  lead_limit: z.coerce.number().int().positive().max(200).optional(),
  reply_limit: z.coerce.number().int().positive().max(200).optional()
});

router.get(
  '/operator/status',
  asyncHandler(async (req, res) => {
    const query = parseWithSchema(statusQuerySchema, req.query, 'Invalid operator status query.');
    const status = await getOperatorStatus(query.client_id);
    res.status(200).json(status);
  })
);

router.get(
  '/operator/review',
  asyncHandler(async (req, res) => {
    const query = parseWithSchema(reviewQuerySchema, req.query, 'Invalid operator review query.');
    const review = await getOperatorReviewQueues(
      query.client_id,
      query.lead_limit ?? 25,
      query.reply_limit ?? 25
    );
    res.status(200).json(review);
  })
);

router.get(
  '/operator/clients',
  asyncHandler(async (_req, res) => {
    const clients = await getOperatorClientStatuses();
    res.status(200).json(clients);
  })
);

router.get(
  '/operator/pilot-requests',
  asyncHandler(async (_req, res) => {
    const requests = await getOperatorPilotRequests();
    res.status(200).json(requests);
  })
);

router.get(
  '/operator/safety',
  asyncHandler(async (req, res) => {
    const query = parseWithSchema(statusQuerySchema, req.query, 'Invalid operator safety query.');
    const safety = await getOperatorSafety(query.client_id);
    res.status(200).json(safety);
  })
);

export default router;
