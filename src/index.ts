import 'dotenv/config';

import express, { NextFunction, Request, Response } from 'express';

import { applySecurityHeaders, requireJsonForMutations } from './api/security';
import router from './api/router';
import { HttpError } from './api/utils';
import { pool } from './db/client';
import { runMigrations } from './db/migrations';
import { startWorker, stopWorker } from './queue/worker';
import { shouldStartWorker } from './runtime';

async function bootstrap(): Promise<void> {
  const app = express();
  const port = Number(process.env.PORT ?? 3000);
  const startQueueWorker = shouldStartWorker();
  const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';
  const internalApiKey = process.env.INTERNAL_API_KEY?.trim();

  if (!internalApiKey) {
    throw new Error('INTERNAL_API_KEY is required.');
  }

  if (internalApiKey.length < 32) {
    throw new Error('INTERNAL_API_KEY must be at least 32 characters long.');
  }

  app.disable('x-powered-by');
  app.set('trust proxy', isProduction ? 1 : false);
  app.use(applySecurityHeaders);
  app.use(requireJsonForMutations);
  app.use(express.json({ limit: '1mb', strict: true, type: ['application/json', 'application/*+json'] }));
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
    next();
  });

  await runMigrations();
  await startWorker(startQueueWorker);

  app.use('/api/v1', router);

  app.use((_req, res) => {
    res.status(404).json({ message: 'Not found' });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const parseError =
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      (error as { type?: string }).type === 'entity.parse.failed';

    if (parseError) {
      res.status(400).json({ message: 'Invalid JSON payload' });
      return;
    }

    if (error instanceof HttpError) {
      res.status(error.statusCode).json({
        message:
          isProduction && error.statusCode >= 500 ? 'Internal server error' : error.message,
        details:
          error.statusCode === 400 && !isProduction ? error.details ?? null : undefined
      });
      return;
    }

    if (error instanceof Error && /not found/i.test(error.message)) {
      res.status(404).json({ message: 'Not found' });
      return;
    }

    console.error('Unhandled error', error);
    const message =
      isProduction ? 'Internal server error' : error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ message });
  });

  const server = app.listen(port, () => {
    console.log(`Outbound ops backend listening on port ${port}`);
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 35_000;
  server.keepAliveTimeout = 5_000;

  const shutdown = async () => {
    server.close();
    await stopWorker();
    await pool.end();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void bootstrap().catch((error) => {
  console.error('Application bootstrap failed', error);
  process.exit(1);
});
