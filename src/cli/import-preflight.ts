import { closeCli, prepareCli, printJson } from './shared';
import { runImportPreflightIntegrityCheck } from '../modules/imports/service';

async function main(): Promise<void> {
  await prepareCli();
  try {
    const result = await runImportPreflightIntegrityCheck();
    printJson(result);
    process.exitCode =
      result.companyIssues.length > 0 || result.contactIssues.length > 0 ? 1 : 0;
  } finally {
    await closeCli();
  }
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  await closeCli();
  process.exit(1);
});
