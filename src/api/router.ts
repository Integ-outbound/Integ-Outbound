import { Router } from 'express';

import contactsRouter from './routes/contacts';
import draftsRouter from './routes/drafts';
import enrichmentRouter from './routes/enrichment';
import icpRouter from './routes/icp';
import memoryRouter from './routes/memory';
import observabilityRouter from './routes/observability';
import repliesRouter from './routes/replies';
import reviewRouter from './routes/review';
import sendingRouter from './routes/sending';
import universeRouter from './routes/universe';

const router = Router();

router.use(universeRouter);
router.use(icpRouter);
router.use(contactsRouter);
router.use(enrichmentRouter);
router.use(draftsRouter);
router.use(reviewRouter);
router.use(sendingRouter);
router.use(repliesRouter);
router.use(memoryRouter);
router.use(observabilityRouter);

export default router;
