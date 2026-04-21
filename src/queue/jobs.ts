export const JOB_NAMES = {
  SCORE_COMPANIES: 'score-companies',
  ENRICH_BATCH: 'enrich-batch',
  VERIFY_CONTACTS: 'verify-contacts',
  GENERATE_DRAFTS: 'generate-drafts',
  CLASSIFY_REPLY: 'classify-reply',
  SCHEDULE_NEXT_STEP: 'schedule-next-step'
} as const;

export interface ScoreCompaniesJobData {}

export interface EnrichBatchJobData {
  limit?: number;
}

export interface VerifyContactsJobData {
  limit?: number;
}

export interface GenerateDraftsJobData {
  campaignId: string;
}

export interface ClassifyReplyJobData {
  replyId: string;
}

export interface ScheduleNextStepJobData {
  leadId: string;
}
