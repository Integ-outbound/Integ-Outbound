import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, HttpError, parseWithSchema } from '../utils';
import {
  handleGoogleOAuthCallback,
  sendMailboxTestEmail,
  startGoogleOAuthForClient
} from '../../modules/mailboxes/service';
import {
  getMailboxStatus,
  listMailboxes
} from '../../modules/mailboxes/operations';
import { syncMailbox } from '../../modules/mailboxes/sync';

const publicMailboxesRouter = Router();
const router = Router();

const mailboxListQuerySchema = z.object({
  client_id: z.string().uuid().optional()
});

const oauthCallbackQuerySchema = z.object({
  code: z.string().trim().min(1).optional(),
  state: z.string().trim().min(1).optional(),
  error: z.string().trim().min(1).optional(),
  error_description: z.string().trim().min(1).optional()
});

const mailboxIdParamsSchema = z.object({
  id: z.string().uuid()
});

const testSendBodySchema = z.object({
  to: z.string().email(),
  subject: z
    .string()
    .trim()
    .min(1)
    .refine((value) => !/[\r\n]/.test(value), 'Subject must not contain new lines.'),
  body: z.string().min(1),
  sentMessageId: z.string().uuid().optional()
});

const syncBodySchema = z.object({
  maxResults: z.number().int().positive().max(200).optional()
});

publicMailboxesRouter.get(
  '/mailboxes/google/oauth/callback',
  asyncHandler(async (req, res) => {
    const query = parseWithSchema(
      oauthCallbackQuerySchema,
      req.query,
      'Invalid Google OAuth callback query.'
    );

    if (query.error) {
      throw new HttpError(
        400,
        `Google OAuth failed: ${query.error_description ?? query.error}`
      );
    }

    if (!query.code || !query.state) {
      throw new HttpError(400, 'Google OAuth callback requires code and state.');
    }

    const result = await handleGoogleOAuthCallback(query.code, query.state);
    res.status(200).json(result);
  })
);

router.get(
  '/mailboxes',
  asyncHandler(async (req, res) => {
    const query = parseWithSchema(mailboxListQuerySchema, req.query, 'Invalid mailbox list query.');
    const mailboxes = await listMailboxes(query.client_id);
    res.status(200).json(mailboxes);
  })
);

router.get(
  '/mailboxes/:id',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(mailboxIdParamsSchema, req.params, 'Invalid mailbox id.');
    const query = parseWithSchema(mailboxListQuerySchema, req.query, 'Invalid mailbox status query.');
    const mailbox = await getMailboxStatus(params.id, query.client_id);
    if (!mailbox) {
      res.status(404).json({ message: 'Mailbox not found.' });
      return;
    }

    res.status(200).json(mailbox);
  })
);

router.get(
  '/mailboxes/google/oauth/start',
  asyncHandler(async (req, res) => {
    const query = parseWithSchema(mailboxListQuerySchema, req.query, 'Invalid Google OAuth start query.');
    const result = await startGoogleOAuthForClient(query.client_id);
    res.status(200).json(result);
  })
);

router.post(
  '/mailboxes/:id/test-send',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(mailboxIdParamsSchema, req.params, 'Invalid mailbox id.');
    const body = parseWithSchema(testSendBodySchema, req.body, 'Invalid mailbox test-send payload.');
    const result = await sendMailboxTestEmail(params.id, body);
    res.status(200).json(result);
  })
);

router.post(
  '/mailboxes/:id/sync',
  asyncHandler(async (req, res) => {
    const params = parseWithSchema(mailboxIdParamsSchema, req.params, 'Invalid mailbox id.');
    const body = parseWithSchema(syncBodySchema, req.body ?? {}, 'Invalid mailbox sync payload.');
    const result = await syncMailbox(params.id, body);
    res.status(200).json(result);
  })
);

export { publicMailboxesRouter };
export default router;
