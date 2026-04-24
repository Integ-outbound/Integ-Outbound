import {
  closeCli,
  prepareCli,
  printJson,
  readImportCliOptions
} from './shared';
import { importCompaniesFromCsv } from '../modules/imports/service';

async function main(): Promise<void> {
  await prepareCli();
  try {
    const options = readImportCliOptions();
    const result = await importCompaniesFromCsv(options);
    printJson(result);
    process.exitCode = result.status === 'failed' ? 1 : 0;
  } finally {
    await closeCli();
  }
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  await closeCli();
  process.exit(1);
});
