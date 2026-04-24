import { Router } from 'express';
import { z } from 'zod';

import { requireInternalApiKey } from '../auth';
import { asyncHandler, parseWithSchema } from '../utils';
import {
  getAuditTrail,
  getReadiness,
  getSystemHealth
} from '../../modules/observability/service';
import { shouldStartWorker } from '../../runtime';

const router = Router();

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).default(50)
});

const auditParamsSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().uuid()
});

router.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    try {
      const readiness = await getReadiness(shouldStartWorker());
      res.status(200).json(readiness);
    } catch (error) {
      res.status(503).json({
        ready: false,
        message: error instanceof Error ? error.message : 'Service not ready'
      });
    }
  })
);

router.get(
  '/health',
  requireInternalApiKey,
  asyncHandler(async (_req, res) => {
    const health = await getSystemHealth();
    res.status(200).json(health);
  })
);

router.get(
  '/audit/:entityType/:entityId',
  requireInternalApiKey,
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(auditParamsSchema, req.params, 'Invalid audit params.');
    const query = parseWithSchema(auditQuerySchema, req.query, 'Invalid audit query.');
    const events = await getAuditTrail(params.entityType, params.entityId, query.limit ?? 50);
    res.status(200).json(events);
  })
);

export default router;
