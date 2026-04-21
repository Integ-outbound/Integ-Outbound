import 'dotenv/config';

import express, { NextFunction, Request, Response } from 'express';

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

  if (!process.env.INTERNAL_API_KEY?.trim()) {
    throw new Error('INTERNAL_API_KEY is required.');
  }

  app.use(express.json({ limit: '2mb' }));
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
    next();
  });

  await runMigrations();
  await startWorker(startQueueWorker);

  app.use('/api/v1', router);

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({
        message: error.message,
        details: error.details ?? null
      });
      return;
    }

    if (error instanceof Error && /not found/i.test(error.message)) {
      res.status(404).json({ message: error.message });
      return;
    }

    console.error('Unhandled error', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ message });
  });

  const server = app.listen(port, () => {
    console.log(`Outbound ops backend listening on port ${port}`);
  });

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
