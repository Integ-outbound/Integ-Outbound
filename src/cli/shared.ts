import 'dotenv/config';

import { parseArgs } from 'node:util';

import { pool } from '../db/client';
import { runMigrations } from '../db/migrations';

export interface ImportCliOptions {
  filePath: string;
  sourceType: string;
  sourceName: string;
  chunkSize?: number;
  dryRun?: boolean;
  notes?: string;
}

export async function prepareCli(): Promise<void> {
  await runMigrations();
}

export async function closeCli(): Promise<void> {
  await pool.end();
}

export function readImportCliOptions(): ImportCliOptions {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' },
      'source-type': { type: 'string' },
      'source-name': { type: 'string' },
      'chunk-size': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      notes: { type: 'string' }
    },
    allowPositionals: false
  });

  const filePath = values.file?.trim();
  const sourceType = values['source-type']?.trim();
  const sourceName = values['source-name']?.trim();

  if (!filePath) {
    throw new Error('--file is required.');
  }

  if (!sourceType) {
    throw new Error('--source-type is required.');
  }

  if (!sourceName) {
    throw new Error('--source-name is required.');
  }

  const chunkSize = values['chunk-size'] ? Number(values['chunk-size']) : undefined;
  if (values['chunk-size'] && (!Number.isInteger(chunkSize) || Number(chunkSize) <= 0)) {
    throw new Error('--chunk-size must be a positive integer.');
  }

  return {
    filePath,
    sourceType,
    sourceName,
    chunkSize,
    dryRun: values['dry-run'],
    notes: values.notes?.trim() || undefined
  };
}

export function readBatchId(): string {
  const { values } = parseArgs({
    options: {
      'batch-id': { type: 'string' }
    },
    allowPositionals: false
  });

  const batchId = values['batch-id']?.trim();
  if (!batchId) {
    throw new Error('--batch-id is required.');
  }

  return batchId;
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}
