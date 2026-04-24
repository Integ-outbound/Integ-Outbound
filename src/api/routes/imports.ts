import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, parseWithSchema } from '../utils';
import { getImportBatchOrThrow } from '../../modules/imports/service';

const router = Router();

const importBatchParamsSchema = z.object({
  id: z.string().uuid()
});

router.get(
  '/import-batches/:id',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(importBatchParamsSchema, req.params, 'Invalid import batch id.');
    const batch = await getImportBatchOrThrow(params.id);
    res.status(200).json(batch);
  })
);

export default router;
