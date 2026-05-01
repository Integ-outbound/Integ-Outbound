import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, parseWithSchema } from '../utils';
import {
  createLead,
  getLead,
  listLeads,
  rejectLead,
  rescheduleLead,
  suppressLead
} from '../../modules/leads/service';

const router = Router();

const leadStatusSchema = z.enum([
  'pending_review',
  'approved',
  'rejected',
  'send_ready',
  'sent',
  'bounced',
  'replied',
  'suppressed'
]);

const leadRejectionReasonSchema = z.enum([
  'wrong_company',
  'wrong_contact',
  'wrong_angle',
  'bad_draft',
  'data_issue',
  'timing',
  'already_in_pipeline'
]);

const createLeadBodySchema = z.object({
  client_id: z.string().uuid(),
  company_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  icp_score_at_creation: z.number().min(0).max(1).nullable().optional(),
  next_step_at: z.string().datetime().nullable().optional()
});

const leadQuerySchema = z.object({
  client_id: z.string().uuid().optional(),
  campaign_id: z.string().uuid().optional(),
  company_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
  status: leadStatusSchema.optional()
});

const leadIdParamsSchema = z.object({
  id: z.string().uuid()
});

const clientMutationBodySchema = z.object({
  client_id: z.string().uuid()
});

const rejectLeadBodySchema = clientMutationBodySchema.extend({
  rejection_reason: leadRejectionReasonSchema,
  rejection_notes: z.string().trim().min(1).nullable().optional()
});

const suppressLeadBodySchema = clientMutationBodySchema.extend({
  notes: z.string().trim().min(1)
});

const rescheduleLeadBodySchema = clientMutationBodySchema.extend({
  next_step_at: z.string().datetime()
});

router.post(
  '/leads',
  asyncHandler(async (req, res) => {
    const body = parseWithSchema(createLeadBodySchema, req.body, 'Invalid lead payload.');
    const lead = await createLead(body);
    res.status(201).json(lead);
  })
);

router.get(
  '/leads',
  asyncHandler(async (req, res) => {
    const query = parseWithSchema(leadQuerySchema, req.query, 'Invalid lead query.');
    const leads = await listLeads(query);
    res.status(200).json(leads);
  })
);

router.get(
  '/leads/:id',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(leadIdParamsSchema, req.params, 'Invalid lead id.');
    const lead = await getLead(params.id);
    if (!lead) {
      res.status(404).json({ message: 'Lead not found.' });
      return;
    }

    res.status(200).json(lead);
  })
);

router.post(
  '/leads/:id/reject',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(leadIdParamsSchema, req.params, 'Invalid lead id.');
    const body = parseWithSchema(rejectLeadBodySchema, req.body, 'Invalid lead rejection payload.');
    const lead = await rejectLead(params.id, body, 'operator', body.client_id);
    res.status(200).json(lead);
  })
);

router.post(
  '/leads/:id/suppress',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(leadIdParamsSchema, req.params, 'Invalid lead id.');
    const body = parseWithSchema(suppressLeadBodySchema, req.body, 'Invalid lead suppression payload.');
    const lead = await suppressLead(params.id, body.notes, 'operator', body.client_id);
    res.status(200).json(lead);
  })
);

router.post(
  '/leads/:id/reschedule',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(leadIdParamsSchema, req.params, 'Invalid lead id.');
    const body = parseWithSchema(
      rescheduleLeadBodySchema,
      req.body,
      'Invalid lead reschedule payload.'
    );
    const lead = await rescheduleLead(params.id, body.next_step_at, 'operator', body.client_id);
    res.status(200).json(lead);
  })
);

export default router;
