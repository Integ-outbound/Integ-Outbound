import { Router } from 'express';

import { requireInternalApiKey } from './auth';
import campaignsRouter from './routes/campaigns';
import contactsRouter from './routes/contacts';
import draftsRouter from './routes/drafts';
import enrichmentRouter from './routes/enrichment';
import icpRouter from './routes/icp';
import leadsRouter from './routes/leads';
import memoryRouter from './routes/memory';
import observabilityRouter from './routes/observability';
import repliesRouter from './routes/replies';
import reviewRouter from './routes/review';
import sendingRouter from './routes/sending';
import universeRouter from './routes/universe';

const router = Router();

router.use(observabilityRouter);
router.use(requireInternalApiKey);

router.use(campaignsRouter);
router.use(leadsRouter);
router.use(universeRouter);
router.use(icpRouter);
router.use(contactsRouter);
router.use(enrichmentRouter);
router.use(draftsRouter);
router.use(reviewRouter);
router.use(sendingRouter);
router.use(repliesRouter);
router.use(memoryRouter);

export default router;
