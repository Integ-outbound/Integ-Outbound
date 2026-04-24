import { closeCli, prepareCli, printJson, readBatchId } from './shared';
import { getImportBatchOrThrow } from '../modules/imports/service';

async function main(): Promise<void> {
  await prepareCli();
  try {
    const batchId = readBatchId();
    const batch = await getImportBatchOrThrow(batchId);
    printJson(batch);
  } finally {
    await closeCli();
  }
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  await closeCli();
  process.exit(1);
});
