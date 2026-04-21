import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, parseWithSchema } from '../utils';
import {
  enrichCompany,
  getEnrichmentSummary
} from '../../modules/enrichment/service';
import { getQueue } from '../../queue/worker';
import { JOB_NAMES } from '../../queue/jobs';

const router = Router();

const emptyBodySchema = z.object({});

const enrichBatchBodySchema = z.object({
  limit: z.number().int().positive().max(1000).default(100)
});

const companyIdParamsSchema = z.object({
  companyId: z.string().uuid()
});

router.post(
  '/enrichment/batch',
  asyncHandler(async (req, res) => {
    const body = parseWithSchema(enrichBatchBodySchema, req.body, 'Invalid enrichment batch payload.');
    const jobId = await getQueue().send(JOB_NAMES.ENRICH_BATCH, { limit: body.limit });
    res.status(202).json({ queued: true, jobName: JOB_NAMES.ENRICH_BATCH, jobId });
  })
);

router.post(
  '/enrichment/:companyId',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(companyIdParamsSchema, req.params, 'Invalid company id.');
    parseWithSchema(emptyBodySchema, req.body ?? {}, 'Invalid enrichment payload.');
    const enrichment = await enrichCompany(params.companyId);
    res.status(200).json(enrichment);
  })
);

router.get(
  '/enrichment/:companyId',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(companyIdParamsSchema, req.params, 'Invalid company id.');
    const enrichment = await getEnrichmentSummary(params.companyId);
    if (!enrichment) {
      res.status(404).json({ message: 'Enrichment not found.' });
      return;
    }

    res.status(200).json(enrichment);
  })
);

export default router;
