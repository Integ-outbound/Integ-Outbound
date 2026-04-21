export interface BatchFailure {
  itemType: string;
  itemId: string;
  message: string;
}

export interface BatchJobSummary {
  attempted: number;
  succeeded: number;
  failed: number;
  failures: BatchFailure[];
}

export class BatchJobError extends Error {
  public readonly summary: BatchJobSummary;

  constructor(jobName: string, summary: BatchJobSummary) {
    const firstFailure = summary.failures[0];
    const firstFailureText = firstFailure
      ? ` First failure: ${firstFailure.itemType} ${firstFailure.itemId} - ${firstFailure.message}`
      : '';

    super(
      `${jobName} batch completed with ${summary.failed} failure(s) out of ${summary.attempted} item(s).${firstFailureText}`
    );
    this.name = 'BatchJobError';
    this.summary = summary;
  }
}

export function finalizeBatchJob(jobName: string, summary: BatchJobSummary): BatchJobSummary {
  if (summary.failed > 0) {
    throw new BatchJobError(jobName, summary);
  }

  return summary;
}
