import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, parseWithSchema } from '../utils';
import {
  createCampaign,
  getCampaign,
  listCampaigns,
  updateCampaign
} from '../../modules/campaigns/service';

const router = Router();

const campaignStatusSchema = z.enum(['draft', 'active', 'paused', 'archived']);

const createCampaignBodySchema = z.object({
  client_id: z.string().uuid().optional(),
  name: z.string().trim().min(1),
  angle: z.string().trim().min(1),
  persona: z.string().trim().min(1),
  icp_target: z.record(z.unknown()),
  sequence_steps: z.number().int().positive().optional(),
  sequence_delay_days: z.number().int().min(0).optional(),
  daily_send_limit: z.number().int().positive().nullable().optional(),
  status: campaignStatusSchema,
  prompt_version: z.string().trim().min(1).nullable().optional()
});

const listCampaignQuerySchema = z.object({
  client_id: z.string().uuid().optional(),
  status: campaignStatusSchema.optional()
});

const campaignIdParamsSchema = z.object({
  id: z.string().uuid()
});

const updateCampaignBodySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    angle: z.string().trim().min(1).optional(),
    persona: z.string().trim().min(1).optional(),
    icp_target: z.record(z.unknown()).optional(),
    sequence_steps: z.number().int().positive().optional(),
    sequence_delay_days: z.number().int().min(0).optional(),
    daily_send_limit: z.number().int().positive().nullable().optional(),
    status: campaignStatusSchema.optional(),
    prompt_version: z.string().trim().min(1).nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one campaign field must be provided.'
  });

router.post(
  '/campaigns',
  asyncHandler(async (req, res) => {
    const body = parseWithSchema(createCampaignBodySchema, req.body, 'Invalid campaign payload.');
    const campaign = await createCampaign(body);
    res.status(201).json(campaign);
  })
);

router.get(
  '/campaigns',
  asyncHandler(async (req, res) => {
    const query = parseWithSchema(listCampaignQuerySchema, req.query, 'Invalid campaign query.');
    const campaigns = await listCampaigns(query);
    res.status(200).json(campaigns);
  })
);

router.get(
  '/campaigns/:id',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(campaignIdParamsSchema, req.params, 'Invalid campaign id.');
    const campaign = await getCampaign(params.id);
    if (!campaign) {
      res.status(404).json({ message: 'Campaign not found.' });
      return;
    }

    res.status(200).json(campaign);
  })
);

router.patch(
  '/campaigns/:id',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(campaignIdParamsSchema, req.params, 'Invalid campaign id.');
    const body = parseWithSchema(updateCampaignBodySchema, req.body, 'Invalid campaign patch payload.');
    const campaign = await updateCampaign(params.id, body);
    res.status(200).json(campaign);
  })
);

export default router;
