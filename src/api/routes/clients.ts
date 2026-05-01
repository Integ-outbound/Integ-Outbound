import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, parseWithSchema } from '../utils';
import {
  createClient,
  createSignupClient,
  getClient,
  getClientMailboxes,
  getClientOnboardingStatus,
  listClients
} from '../../modules/clients/service';

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
  company_domain: z.string().trim().min(1).optional(),
  operator_name: z.string().trim().min(1).optional(),
  operator_email: z.string().email().optional(),
  service_type: z.string().trim().min(1).optional(),
  target_icp_notes: z.string().trim().min(1).optional(),
  is_active: z.boolean().optional()
});

const createSignupBodySchema = z.object({
  company_name: z.string().trim().min(1),
  domain: z.string().trim().min(1),
  founder_operator_name: z.string().trim().min(1),
  email: z.string().email(),
  service_type: z.string().trim().min(1),
  target_icp_notes: z.string().trim().min(1)
});

const clientIdParamsSchema = z.object({
  id: z.string().uuid()
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

router.post(
  '/clients/signup',
  asyncHandler(async (req, res) => {
    const body = parseWithSchema(createSignupBodySchema, req.body, 'Invalid client signup payload.');
    const client = await createSignupClient(body);
    res.status(201).json(client);
  })
);

router.get(
  '/clients/:id',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(clientIdParamsSchema, req.params, 'Invalid client id.');
    const client = await getClient(params.id);
    if (!client) {
      res.status(404).json({ message: 'Client not found.' });
      return;
    }

    res.status(200).json(client);
  })
);

router.get(
  '/clients/:id/onboarding-status',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(clientIdParamsSchema, req.params, 'Invalid client id.');
    const status = await getClientOnboardingStatus(params.id);
    res.status(200).json(status);
  })
);

router.get(
  '/clients/:id/mailboxes',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(clientIdParamsSchema, req.params, 'Invalid client id.');
    const mailboxes = await getClientMailboxes(params.id);
    res.status(200).json(mailboxes);
  })
);

export default router;
