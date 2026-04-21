import 'dotenv/config';

import PgBoss from 'pg-boss';
import { z } from 'zod';

import { pool } from '../db/client';
import { verifyBatch } from '../modules/contacts/service';
import { generateBatchDrafts } from '../modules/drafts/service';
import { enrichBatch } from '../modules/enrichment/service';
import { scoreAllUnscored } from '../modules/icp/service';
import { logEvent } from '../modules/observability/service';
import { classifyReply } from '../modules/replies/service';
import { BatchJobError } from '../modules/shared/batch';
import { scheduleNextStep } from '../modules/sending/service';
import {
  ClassifyReplyJobData,
  EnrichBatchJobData,
  GenerateDraftsJobData,
  JOB_NAMES,
  ScheduleNextStepJobData,
  VerifyContactsJobData
} from './jobs';

let boss: PgBoss | null = null;
let workerHandlersRegistered = false;

const scoreCompaniesJobSchema = z.object({});
const enrichBatchJobSchema = z.object({
  limit: z.number().int().positive().optional()
});
const verifyContactsJobSchema = z.object({
  limit: z.number().int().positive().optional()
});
const generateDraftsJobSchema = z.object({
  campaignId: z.string().uuid()
});
const classifyReplyJobSchema = z.object({
  replyId: z.string().uuid()
});
const scheduleNextStepJobSchema = z.object({
  leadId: z.string().uuid()
});

export function getQueue(): PgBoss {
  if (!boss) {
    throw new Error('Queue worker has not been started.');
  }

  return boss;
}

export function isWorkerStarted(): boolean {
  return boss !== null;
}

export function isWorkerRunning(): boolean {
  return workerHandlersRegistered;
}

async function ensureQueueStarted(): Promise<PgBoss> {
  if (boss) {
    return boss;
  }

  boss = new PgBoss({
    connectionString: process.env.DATABASE_URL
  });

  boss.on('error', (error) => {
    console.error('pg-boss error', error);
  });

  await boss.start();
  for (const jobName of Object.values(JOB_NAMES)) {
    await boss.createQueue(jobName);
  }
  return boss;
}

async function registerHandler<T>(
  jobName: string,
  schema: z.ZodSchema<T>,
  handler: (data: T) => Promise<void>
): Promise<void> {
  const queue = getQueue();
  await queue.work(jobName, async (jobs) => {
    const job = Array.isArray(jobs) ? jobs[0] : jobs;
    if (!job) {
      return;
    }

    try {
      const parsed = schema.safeParse(job.data ?? {});
      if (!parsed.success) {
        throw new Error(`Invalid ${jobName} payload: ${parsed.error.message}`);
      }

      await handler(parsed.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const details =
        error instanceof BatchJobError
          ? {
              attempted: error.summary.attempted,
              succeeded: error.summary.succeeded,
              failed: error.summary.failed,
              failures: error.summary.failures.slice(0, 25)
            }
          : null;

      console.error('Queue job failed', {
        jobName,
        data: job.data,
        message,
        details
      });

      try {
        await logEvent({
          eventType: 'job.failed',
          entityType: 'job',
          entityId: null,
          payload: {
            job_name: jobName,
            job_data: (job.data ?? null) as Record<string, unknown> | null,
            error: message,
            details
          },
          triggeredBy: 'system'
        });
      } catch (logError) {
        console.error('Failed to log queue job error', {
          jobName,
          message: logError instanceof Error ? logError.message : String(logError)
        });
      }

      throw error;
    }
  });
}

export async function startWorker(registerHandlers = true): Promise<PgBoss> {
  const queue = await ensureQueueStarted();
  if (!registerHandlers || workerHandlersRegistered) {
    return queue;
  }

  await registerHandler<Record<string, never>>(
    JOB_NAMES.SCORE_COMPANIES,
    scoreCompaniesJobSchema,
    async () => {
    await scoreAllUnscored('system');
    }
  );

  await registerHandler<EnrichBatchJobData>(
    JOB_NAMES.ENRICH_BATCH,
    enrichBatchJobSchema,
    async (data) => {
    await enrichBatch(data.limit ?? 100, 'system');
    }
  );

  await registerHandler<VerifyContactsJobData>(
    JOB_NAMES.VERIFY_CONTACTS,
    verifyContactsJobSchema,
    async (data) => {
    await verifyBatch(data.limit ?? 100, 'system');
    }
  );

  await registerHandler<GenerateDraftsJobData>(
    JOB_NAMES.GENERATE_DRAFTS,
    generateDraftsJobSchema,
    async (data) => {
    await generateBatchDrafts(data.campaignId, 'system');
    }
  );

  await registerHandler<ClassifyReplyJobData>(
    JOB_NAMES.CLASSIFY_REPLY,
    classifyReplyJobSchema,
    async (data) => {
    await classifyReply(data.replyId, 'system');
    }
  );

  await registerHandler<ScheduleNextStepJobData>(
    JOB_NAMES.SCHEDULE_NEXT_STEP,
    scheduleNextStepJobSchema,
    async (data) => {
    await scheduleNextStep(data.leadId, 'system');
    }
  );

  workerHandlersRegistered = true;
  return queue;
}

export async function stopWorker(): Promise<void> {
  if (!boss) {
    return;
  }

  await boss.stop();
  boss = null;
  workerHandlersRegistered = false;
}

async function runStandaloneWorker(): Promise<void> {
  await startWorker();
  console.log('Outbound ops worker started');

  const shutdown = async () => {
    await stopWorker();
    await pool.end();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  void runStandaloneWorker().catch((error) => {
    console.error('Worker bootstrap failed', error);
    process.exit(1);
  });
}
