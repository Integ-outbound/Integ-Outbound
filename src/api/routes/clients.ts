import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, parseWithSchema } from '../utils';
import { createClient, listClients } from '../../modules/clients/service';

const router = Router();

const clientListQuerySchema = z.object({
  is_active: z.coerce.boolean().optional()
});

const createClientBodySchema = z.object({
  name: z.string().trim().min(1),
  slug: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  is_active: z.boolean().optional()
});

router.get(
  '/clients',
  asyncHandler(async (req, res) => {
    const query = parseWithSchema(clientListQuerySchema, req.query, 'Invalid client list query.');
    const clients = await listClients(query);
    res.status(200).json(clients);
  })
);

router.post(
  '/clients',
  asyncHandler(async (req, res) => {
    const body = parseWithSchema(createClientBodySchema, req.body, 'Invalid client payload.');
    const client = await createClient(body);
    res.status(201).json(client);
  })
);

export default router;
