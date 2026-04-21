import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, parseWithSchema } from '../utils';
import {
  bulkImportCompanies,
  getCompany,
  listCompanies,
  suppressCompany,
  upsertCompany
} from '../../modules/universe/service';

const router = Router();

const companyBodySchema = z.object({
  domain: z.string().min(1),
  name: z.string().trim().min(1).nullable().optional(),
  industry: z.string().trim().min(1).nullable().optional(),
  employee_count: z.number().int().nonnegative().nullable().optional(),
  country: z.string().trim().min(1).nullable().optional(),
  city: z.string().trim().min(1).nullable().optional(),
  website: z.string().trim().min(1).nullable().optional(),
  linkedin_url: z.string().trim().min(1).nullable().optional(),
  outreach_status: z.enum(['never_contacted', 'in_sequence', 'replied', 'suppressed', 'pipeline']).optional(),
  suppressed: z.boolean().optional(),
  suppression_reason: z.string().trim().min(1).nullable().optional(),
  raw_enrichment: z.record(z.unknown()).nullable().optional()
});

const companyQuerySchema = z.object({
  industry: z.string().optional(),
  country: z.string().optional(),
  minEmployeeCount: z.coerce.number().int().nonnegative().optional(),
  maxEmployeeCount: z.coerce.number().int().nonnegative().optional(),
  outreachStatus: z.enum(['never_contacted', 'in_sequence', 'replied', 'suppressed', 'pipeline']).optional(),
  suppressed: z
    .union([z.literal('true'), z.literal('false')])
    .transform((value) => value === 'true')
    .optional()
});

const importBodySchema = z.object({
  rows: z.array(companyBodySchema)
});

const suppressBodySchema = z.object({
  reason: z.string().min(1)
});

const companyDomainParamsSchema = z.object({
  domain: z.string().min(1)
});

const companyIdParamsSchema = z.object({
  id: z.string().uuid()
});

router.post(
  '/companies',
  asyncHandler(async (req, res) => {
    const body = parseWithSchema(companyBodySchema, req.body, 'Invalid company payload.');
    const company = await upsertCompany(body);
    res.status(200).json(company);
  })
);

router.get(
  '/companies',
  asyncHandler(async (req, res) => {
    const filters = parseWithSchema(companyQuerySchema, req.query, 'Invalid company query.');
    const companies = await listCompanies(filters);
    res.status(200).json(companies);
  })
);

router.get(
  '/companies/:domain',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(companyDomainParamsSchema, req.params, 'Invalid company domain.');
    const company = await getCompany(params.domain);
    if (!company) {
      res.status(404).json({ message: 'Company not found.' });
      return;
    }

    res.status(200).json(company);
  })
);

router.post(
  '/companies/:id/suppress',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(companyIdParamsSchema, req.params, 'Invalid company id.');
    const body = parseWithSchema(suppressBodySchema, req.body, 'Invalid suppression payload.');
    const company = await suppressCompany(params.id, body.reason);
    res.status(200).json(company);
  })
);

router.post(
  '/companies/import',
  asyncHandler(async (req, res) => {
    const body = parseWithSchema(importBodySchema, req.body, 'Invalid company import payload.');
    const result = await bulkImportCompanies(body.rows);
    res.status(200).json(result);
  })
);

export default router;
