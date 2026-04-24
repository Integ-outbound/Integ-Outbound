import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, HttpError, parseWithSchema } from '../utils';
import {
  handleGoogleOAuthCallback,
  sendMailboxTestEmail,
  startGoogleOAuth
} from '../../modules/mailboxes/service';

const publicMailboxesRouter = Router();
const router = Router();

const emptyQuerySchema = z.object({});

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
  body: z.string().min(1)
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
  '/mailboxes/google/oauth/start',
  asyncHandler(async (req, res) => {
    parseWithSchema(emptyQuerySchema, req.query, 'Invalid Google OAuth start query.');
    const result = startGoogleOAuth();
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

export { publicMailboxesRouter };
export default router;
