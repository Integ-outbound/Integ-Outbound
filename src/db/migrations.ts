import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { pool } from './client';

async function loadSchema(): Promise<string> {
  const compiledPath = path.resolve(__dirname, 'schema.sql');
  const sourcePath = path.resolve(process.cwd(), 'src', 'db', 'schema.sql');

  try {
    return await readFile(compiledPath, 'utf8');
  } catch {
    return readFile(sourcePath, 'utf8');
  }
}

export async function runMigrations(): Promise<void> {
  const schema = await loadSchema();
  await pool.query(schema);
}
