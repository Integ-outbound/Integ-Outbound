import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, parseWithSchema } from '../utils';
import {
  getContactsForCompany,
  listContacts,
  markOptOut,
  upsertContact,
  verifyContact
} from '../../modules/contacts/service';
import { getQueue } from '../../queue/worker';
import { JOB_NAMES } from '../../queue/jobs';

const router = Router();

const contactBodySchema = z.object({
  company_id: z.string().uuid(),
  email: z.string().trim().min(1),
  first_name: z.string().trim().min(1).nullable().optional(),
  last_name: z.string().trim().min(1).nullable().optional(),
  title: z.string().trim().min(1).nullable().optional(),
  seniority: z.enum(['c_level', 'vp', 'director', 'manager', 'ic']).nullable().optional(),
  department: z.string().trim().min(1).nullable().optional(),
  linkedin_url: z.string().trim().min(1).nullable().optional(),
  source: z.string().trim().min(1).nullable().optional()
});

const contactQuerySchema = z.object({
  company_id: z.string().uuid().optional(),
  verification_status: z.enum(['unverified', 'valid', 'risky', 'invalid', 'catch_all']).optional(),
  seniority: z.enum(['c_level', 'vp', 'director', 'manager', 'ic']).optional(),
  title: z.string().trim().min(1).optional(),
  suppressed: z
    .union([z.literal('true'), z.literal('false')])
    .transform((value) => value === 'true')
    .optional()
});

const emptyBodySchema = z.object({});

const verifyBatchBodySchema = z.object({
  limit: z.number().int().positive().max(1000).default(100)
});

const companyIdParamsSchema = z.object({
  companyId: z.string().uuid()
});

const contactIdParamsSchema = z.object({
  id: z.string().uuid()
});

router.post(
  '/contacts',
  asyncHandler(async (req, res) => {
    const body = parseWithSchema(contactBodySchema, req.body, 'Invalid contact payload.');
    const contact = await upsertContact(body);
    res.status(200).json(contact);
  })
);

router.get(
  '/contacts',
  asyncHandler(async (req, res) => {
    const query = parseWithSchema(contactQuerySchema, req.query, 'Invalid contact query.');
    const contacts = await listContacts(query);
    res.status(200).json(contacts);
  })
);

router.get(
  '/contacts/company/:companyId',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(companyIdParamsSchema, req.params, 'Invalid company id.');
    const contacts = await getContactsForCompany(params.companyId);
    res.status(200).json(contacts);
  })
);

router.post(
  '/contacts/:id/opt-out',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(contactIdParamsSchema, req.params, 'Invalid contact id.');
    parseWithSchema(emptyBodySchema, req.body ?? {}, 'Invalid opt-out payload.');
    const contact = await markOptOut(params.id);
    res.status(200).json(contact);
  })
);

router.post(
  '/contacts/:id/verify',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(contactIdParamsSchema, req.params, 'Invalid contact id.');
    parseWithSchema(emptyBodySchema, req.body ?? {}, 'Invalid verify payload.');
    const contact = await verifyContact(params.id);
    res.status(200).json(contact);
  })
);

router.post(
  '/contacts/verify-batch',
  asyncHandler(async (req, res) => {
    const body = parseWithSchema(verifyBatchBodySchema, req.body, 'Invalid verify-batch payload.');
    const jobId = await getQueue().send(JOB_NAMES.VERIFY_CONTACTS, { limit: body.limit });
    res.status(202).json({ queued: true, jobName: JOB_NAMES.VERIFY_CONTACTS, jobId });
  })
);

export default router;
