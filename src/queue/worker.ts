import PgBoss from 'pg-boss';

import { pool } from '../db/client';
import { verifyBatch } from '../modules/contacts/service';
import { generateBatchDrafts } from '../modules/drafts/service';
import { enrichBatch } from '../modules/enrichment/service';
import { scoreAllUnscored } from '../modules/icp/service';
import { classifyReply } from '../modules/replies/service';
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

export function getQueue(): PgBoss {
  if (!boss) {
    throw new Error('Queue worker has not been started.');
  }

  return boss;
}

async function registerHandler<T>(jobName: string, handler: (data: T) => Promise<void>): Promise<void> {
  const queue = getQueue();
  await queue.work(jobName, async (jobs) => {
    const job = Array.isArray(jobs) ? jobs[0] : jobs;
    if (!job) {
      return;
    }

    try {
      await handler((job.data ?? {}) as T);
    } catch (error) {
      console.error('Queue job failed', {
        jobName,
        data: job.data,
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  });
}

export async function startWorker(): Promise<PgBoss> {
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

  await registerHandler<Record<string, never>>(JOB_NAMES.SCORE_COMPANIES, async () => {
    await scoreAllUnscored('system');
  });

  await registerHandler<EnrichBatchJobData>(JOB_NAMES.ENRICH_BATCH, async (data) => {
    await enrichBatch(data.limit ?? 100, 'system');
  });

  await registerHandler<VerifyContactsJobData>(JOB_NAMES.VERIFY_CONTACTS, async (data) => {
    await verifyBatch(data.limit ?? 100, 'system');
  });

  await registerHandler<GenerateDraftsJobData>(JOB_NAMES.GENERATE_DRAFTS, async (data) => {
    await generateBatchDrafts(data.campaignId, 'system');
  });

  await registerHandler<ClassifyReplyJobData>(JOB_NAMES.CLASSIFY_REPLY, async (data) => {
    await classifyReply(data.replyId, 'system');
  });

  await registerHandler<ScheduleNextStepJobData>(JOB_NAMES.SCHEDULE_NEXT_STEP, async (data) => {
    await scheduleNextStep(data.leadId, 'system');
  });

  return boss;
}

async function runStandaloneWorker(): Promise<void> {
  await startWorker();
  console.log('Outbound ops worker started');

  const shutdown = async () => {
    if (boss) {
      await boss.stop();
    }

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
