import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, parseWithSchema } from '../utils';
import {
  createOrUpdateICP,
  generateShortlist,
  getActiveICP
} from '../../modules/icp/service';
import { getQueue } from '../../queue/worker';
import { JOB_NAMES } from '../../queue/jobs';

const router = Router();

const icpBodySchema = z.object({
  name: z.string().min(1),
  filters: z.object({
    industries: z.array(z.string()).optional(),
    countries: z.array(z.string()).optional(),
    employee_count_min: z.number().int().nonnegative().optional(),
    employee_count_max: z.number().int().nonnegative().optional(),
    required_signals: z.array(z.string()).optional()
  }),
  scoring_weights: z.record(z.number().nonnegative())
});

const scoreAllBodySchema = z.object({});

const shortlistQuerySchema = z.object({
  limit: z.coerce.number().int().positive().default(25),
  minScore: z.coerce.number().min(0).max(1).default(0.5)
});

router.get(
  '/icp',
  asyncHandler(async (_req, res) => {
    const icp = await getActiveICP();
    if (!icp) {
      res.status(404).json({ message: 'No active ICP definition found.' });
      return;
    }

    res.status(200).json(icp);
  })
);

router.post(
  '/icp',
  asyncHandler(async (req, res) => {
    const body = parseWithSchema(icpBodySchema, req.body, 'Invalid ICP payload.');
    const icp = await createOrUpdateICP(body);
    res.status(201).json(icp);
  })
);

router.post(
  '/icp/score-all',
  asyncHandler(async (req, res) => {
    parseWithSchema(scoreAllBodySchema, req.body ?? {}, 'Invalid score-all payload.');
    const jobId = await getQueue().send(JOB_NAMES.SCORE_COMPANIES, {});
    res.status(202).json({ queued: true, jobName: JOB_NAMES.SCORE_COMPANIES, jobId });
  })
);

router.get(
  '/icp/shortlist',
  asyncHandler(async (req, res) => {
    const query = parseWithSchema(shortlistQuerySchema, req.query, 'Invalid shortlist query.');
    const companies = await generateShortlist(query.limit ?? 25, query.minScore ?? 0.5);
    res.status(200).json(companies);
  })
);

export default router;
