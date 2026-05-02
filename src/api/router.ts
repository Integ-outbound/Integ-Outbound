import { Router } from 'express';

import { requireInternalApiKey } from './auth';
import campaignsRouter from './routes/campaigns';
import clientsRouter from './routes/clients';
import contactsRouter from './routes/contacts';
import draftsRouter from './routes/drafts';
import enrichmentRouter from './routes/enrichment';
import icpRouter from './routes/icp';
import importsRouter from './routes/imports';
import leadsRouter from './routes/leads';
import mailboxesRouter, { publicMailboxesRouter } from './routes/mailboxes';
import manualTouchesRouter from './routes/manual-touches';
import memoryRouter from './routes/memory';
import observabilityRouter from './routes/observability';
import operatorRouter from './routes/operator';
import pilotRequestsRouter from './routes/pilot-requests';
import repliesRouter from './routes/replies';
import reviewRouter from './routes/review';
import sendingRouter from './routes/sending';
import universeRouter from './routes/universe';

const router = Router();

router.use(observabilityRouter);
router.use(publicMailboxesRouter);
router.use(requireInternalApiKey);

router.use(mailboxesRouter);
router.use(manualTouchesRouter);
router.use(clientsRouter);
router.use(campaignsRouter);
router.use(leadsRouter);
router.use(importsRouter);
router.use(universeRouter);
router.use(icpRouter);
router.use(contactsRouter);
router.use(enrichmentRouter);
router.use(draftsRouter);
router.use(reviewRouter);
router.use(operatorRouter);
router.use(pilotRequestsRouter);
router.use(sendingRouter);
router.use(repliesRouter);
router.use(memoryRouter);

export default router;
