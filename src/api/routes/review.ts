import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, parseWithSchema } from '../utils';
import {
  bulkReject,
  getReviewQueue,
  getReviewStats
} from '../../modules/review/service';

const router = Router();

const queueQuerySchema = z.object({
  campaign_id: z.string().uuid().optional(),
  min_icp_score: z.coerce.number().min(0).max(1).optional()
});

const bulkRejectBodySchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1),
  reason: z.enum([
    'wrong_company',
    'wrong_contact',
    'wrong_angle',
    'bad_draft',
    'data_issue',
    'timing',
    'already_in_pipeline'
  ])
});

router.get(
  '/review/queue',
  asyncHandler(async (req, res) => {
    const filters = parseWithSchema(queueQuerySchema, req.query, 'Invalid review queue query.');
    const queue = await getReviewQueue(filters);
    res.status(200).json(queue);
  })
);

router.get(
  '/review/stats',
  asyncHandler(async (_req, res) => {
    const stats = await getReviewStats();
    res.status(200).json(stats);
  })
);

router.post(
  '/review/bulk-reject',
  asyncHandler(async (req, res) => {
    const body = parseWithSchema(bulkRejectBodySchema, req.body, 'Invalid bulk rejection payload.');
    const result = await bulkReject(body.leadIds, body.reason);
    res.status(200).json(result);
  })
);

export default router;
