import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, parseWithSchema } from '../utils';
import {
  approveDraft,
  editDraft,
  generateDraft,
  getDraft,
  rejectDraft
} from '../../modules/drafts/service';
import { getQueue } from '../../queue/worker';
import { JOB_NAMES } from '../../queue/jobs';

const router = Router();

const emptyBodySchema = z.object({});
const rejectBodySchema = z.object({
  reason: z.enum([
    'wrong_company',
    'wrong_contact',
    'wrong_angle',
    'bad_draft',
    'data_issue',
    'timing',
    'already_in_pipeline'
  ]),
  notes: z.string().trim().min(1).nullable().optional()
});
const editBodySchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1)
});

const leadIdParamsSchema = z.object({
  leadId: z.string().uuid()
});

const campaignIdParamsSchema = z.object({
  campaignId: z.string().uuid()
});

const draftIdParamsSchema = z.object({
  draftId: z.string().uuid()
});

router.post(
  '/drafts/generate/:leadId',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(leadIdParamsSchema, req.params, 'Invalid lead id.');
    parseWithSchema(emptyBodySchema, req.body ?? {}, 'Invalid draft generation payload.');
    const draft = await generateDraft(params.leadId);
    res.status(201).json(draft);
  })
);

router.post(
  '/drafts/generate-batch/:campaignId',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(campaignIdParamsSchema, req.params, 'Invalid campaign id.');
    parseWithSchema(emptyBodySchema, req.body ?? {}, 'Invalid draft batch payload.');
    const jobId = await getQueue().send(JOB_NAMES.GENERATE_DRAFTS, {
      campaignId: params.campaignId
    });
    res.status(202).json({ queued: true, jobName: JOB_NAMES.GENERATE_DRAFTS, jobId });
  })
);

router.get(
  '/drafts/:leadId',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(leadIdParamsSchema, req.params, 'Invalid lead id.');
    const draft = await getDraft(params.leadId);
    if (!draft) {
      res.status(404).json({ message: 'Draft not found.' });
      return;
    }

    res.status(200).json(draft);
  })
);

router.post(
  '/drafts/:draftId/approve',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(draftIdParamsSchema, req.params, 'Invalid draft id.');
    parseWithSchema(emptyBodySchema, req.body ?? {}, 'Invalid draft approval payload.');
    const draft = await approveDraft(params.draftId);
    res.status(200).json(draft);
  })
);

router.post(
  '/drafts/:draftId/reject',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(draftIdParamsSchema, req.params, 'Invalid draft id.');
    const body = parseWithSchema(rejectBodySchema, req.body, 'Invalid draft rejection payload.');
    const draft = await rejectDraft(params.draftId, body.reason, body.notes ?? null);
    res.status(200).json(draft);
  })
);

router.post(
  '/drafts/:draftId/edit',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(draftIdParamsSchema, req.params, 'Invalid draft id.');
    const body = parseWithSchema(editBodySchema, req.body, 'Invalid draft edit payload.');
    const draft = await editDraft(params.draftId, body.subject, body.body);
    res.status(200).json(draft);
  })
);

export default router;
