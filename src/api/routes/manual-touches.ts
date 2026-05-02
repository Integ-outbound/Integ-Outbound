import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, parseWithSchema } from '../utils';
import {
  createManualTouch,
  listManualTouches,
  updateManualTouch
} from '../../modules/manual-touches/service';

const router = Router();

const manualTouchChannelSchema = z.enum([
  'email',
  'linkedin',
  'instagram',
  'facebook',
  'contact_form',
  'whatsapp',
  'other'
]);

const manualTouchStatusSchema = z.enum([
  'planned',
  'sent',
  'replied',
  'interested',
  'rejected',
  'booked_call',
  'closed'
]);

const listManualTouchesQuerySchema = z.object({
  channel: manualTouchChannelSchema.optional(),
  status: manualTouchStatusSchema.optional(),
  client_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(500).optional()
});

const createManualTouchBodySchema = z.object({
  client_id: z.string().uuid().optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  company_name: z.string().trim().optional().nullable(),
  person_name: z.string().trim().optional().nullable(),
  channel: manualTouchChannelSchema,
  message_body: z.string().trim().optional().nullable(),
  status: manualTouchStatusSchema.optional(),
  sent_at: z.string().datetime().optional().nullable(),
  reply_at: z.string().datetime().optional().nullable(),
  notes: z.string().trim().optional().nullable()
});

const updateManualTouchBodySchema = z.object({
  client_id: z.string().uuid().optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  company_name: z.string().trim().optional().nullable(),
  person_name: z.string().trim().optional().nullable(),
  channel: manualTouchChannelSchema.optional(),
  message_body: z.string().trim().optional().nullable(),
  status: manualTouchStatusSchema.optional(),
  sent_at: z.string().datetime().optional().nullable(),
  reply_at: z.string().datetime().optional().nullable(),
  notes: z.string().trim().optional().nullable()
});

const manualTouchIdParamsSchema = z.object({
  id: z.string().uuid()
});

router.get(
  '/operator/manual-touches',
  asyncHandler(async (req, res) => {
    const query = parseWithSchema(
      listManualTouchesQuerySchema,
      req.query,
      'Invalid manual touch query.'
    );
    const manualTouches = await listManualTouches(query);
    res.status(200).json({ manual_touches: manualTouches });
  })
);

router.post(
  '/operator/manual-touches',
  asyncHandler(async (req, res) => {
    const body = parseWithSchema(
      createManualTouchBodySchema,
      req.body,
      'Invalid manual touch payload.'
    );
    const manualTouch = await createManualTouch(body);
    res.status(201).json(manualTouch);
  })
);

router.patch(
  '/operator/manual-touches/:id',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(
      manualTouchIdParamsSchema,
      req.params,
      'Invalid manual touch id.'
    );
    const body = parseWithSchema(
      updateManualTouchBodySchema,
      req.body,
      'Invalid manual touch update payload.'
    );
    const manualTouch = await updateManualTouch(params.id, body);
    res.status(200).json(manualTouch);
  })
);

export default router;
