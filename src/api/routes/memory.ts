import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, parseWithSchema } from '../utils';
import {
  getDraftQualityReport,
  getOutcomesByCampaign,
  getPerformanceReport,
  getRejectionPatternReport,
  logOutcome
} from '../../modules/memory/service';

const router = Router();

const outcomeBodySchema = z.object({
  lead_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  company_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  outcome_type: z.enum([
    'meeting_booked',
    'meeting_held',
    'meeting_no_show',
    'deal_opened',
    'deal_closed',
    'deal_lost',
    'unsubscribed'
  ]),
  notes: z.string().trim().min(1).nullable().optional(),
  occurred_at: z.string().datetime().nullable().optional()
});

const campaignIdParamsSchema = z.object({
  campaignId: z.string().uuid()
});

router.post(
  '/outcomes',
  asyncHandler(async (req, res) => {
    const body = parseWithSchema(outcomeBodySchema, req.body, 'Invalid outcome payload.');
    const outcome = await logOutcome(body);
    res.status(201).json(outcome);
  })
);

router.get(
  '/memory/rejection-patterns',
  asyncHandler(async (_req, res) => {
    const report = await getRejectionPatternReport();
    res.status(200).json(report);
  })
);

router.get(
  '/memory/performance',
  asyncHandler(async (_req, res) => {
    const report = await getPerformanceReport();
    res.status(200).json(report);
  })
);

router.get(
  '/memory/draft-quality',
  asyncHandler(async (_req, res) => {
    const report = await getDraftQualityReport();
    res.status(200).json(report);
  })
);

router.get(
  '/memory/outcomes/:campaignId',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(campaignIdParamsSchema, req.params, 'Invalid campaign id.');
    const report = await getOutcomesByCampaign(params.campaignId);
    res.status(200).json(report);
  })
);

export default router;
