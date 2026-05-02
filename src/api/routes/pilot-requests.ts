import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, parseWithSchema } from '../utils';
import { createPilotRequest } from '../../modules/pilot-requests/service';

const router = Router();

const createPilotRequestBodySchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().email(),
  company: z.string().trim().min(1),
  website: z.string().trim().min(1),
  offer: z.string().trim().min(1),
  desired_client_type: z.string().trim().min(1),
  notes: z.string().trim().optional()
});

router.post(
  '/pilot-requests',
  asyncHandler(async (req, res) => {
    const body = parseWithSchema(
      createPilotRequestBodySchema,
      req.body,
      'Invalid pilot request payload.'
    );
    const pilotRequest = await createPilotRequest(body);
    res.status(201).json(pilotRequest);
  })
);

export default router;
