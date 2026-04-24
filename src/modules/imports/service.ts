import { access } from 'node:fs/promises';
import { createReadStream } from 'node:fs';

import { parse } from 'csv-parse';

import { HttpError } from '../../api/utils';
import { DbClient, ensureFound, generateId, query, withTransaction } from '../../db/client';
import { Company, Contact, ImportBatch } from '../../db/types';
import { logEvent } from '../observability/service';
import {
  NormalizationError,
  normalizeDomain,
  normalizeEmail,
  normalizeSeniority
} from '../shared/normalization';

const DEFAULT_CHUNK_SIZE = 500;
const MAX_CHUNK_SIZE = 5_000;
const MAX_ERROR_SAMPLES = 25;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const COMPANY_REQUIRED_COLUMNS = ['domain'] as const;
const COMPANY_ALLOWED_COLUMNS = new Set([
  'domain',
  'source_record_id',
  'name',
  'industry',
  'employee_count',
  'country',
  'city',
  'website',
  'linkedin_url',
  'suppressed',
  'suppression_reason'
]);

const CONTACT_REQUIRED_COLUMNS = ['email', 'company_id', 'company_domain'] as const;
const CONTACT_ALLOWED_COLUMNS = new Set([
  'email',
  'company_id',
  'company_domain',
  'source_record_id',
  'first_name',
  'last_name',
  'title',
  'seniority',
  'department',
  'linkedin_url',
  'verification_status'
]);

type ImportEntityType = 'company' | 'contact';
type ImportBatchStatus = ImportBatch['status'];

interface ImportErrorSample {
  rowNumber: number | null;
  identifier: string | null;
  message: string;
}

interface ImportExecutionState {
  totalRows: number;
  insertedRows: number;
  updatedRows: number;
  skippedRows: number;
  errorRows: number;
  sampleErrors: ImportErrorSample[];
}

export interface CsvImportOptions {
  filePath: string;
  sourceType: string;
  sourceName: string;
  chunkSize?: number;
  dryRun?: boolean;
  notes?: string | null;
}

export interface ImportExecutionResult {
  batchId: string;
  entityType: ImportEntityType;
  sourceType: string;
  sourceName: string;
  status: ImportBatchStatus;
  totalRows: number;
  insertedRows: number;
  updatedRows: number;
  skippedRows: number;
  errorRows: number;
  sampleErrors: ImportErrorSample[];
  dryRun: boolean;
}

interface SourceRecord {
  sourceRecordId: string;
  rawPayload: Record<string, string>;
}

interface CompanyImportRow {
  rowNumber: number;
  domain: string;
  sourceRecordId: string;
  name: string | null;
  industry: string | null;
  employeeCount: number | null;
  country: string | null;
  city: string | null;
  website: string | null;
  linkedinUrl: string | null;
  suppressed: boolean;
  suppressionReason: string | null;
  rawPayload: Record<string, string>;
}

interface CompanyCandidate extends Omit<CompanyImportRow, 'sourceRecordId' | 'rawPayload' | 'rowNumber'> {
  sourceRecords: SourceRecord[];
  rowCount: number;
}

interface ContactImportRow {
  rowNumber: number;
  email: string;
  companyId: string | null;
  companyDomain: string | null;
  sourceRecordId: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  seniority: Contact['seniority'];
  department: string | null;
  linkedinUrl: string | null;
  verificationStatus: Contact['verification_status'] | null;
  rawPayload: Record<string, string>;
}

interface ResolvedContactRow extends ContactImportRow {
  resolvedCompanyId: string;
}

interface ContactCandidate extends Omit<ResolvedContactRow, 'sourceRecordId' | 'rawPayload' | 'rowNumber'> {
  sourceRecords: SourceRecord[];
  rowCount: number;
  firstRowNumber: number;
}

interface ChunkSummary {
  insertedRows: number;
  updatedRows: number;
  skippedRows: number;
  errorRows: number;
  sampleErrors: ImportErrorSample[];
}

interface ImportChunkContext {
  batchId: string;
  sourceType: string;
  sourceName: string;
  dryRun: boolean;
  chunkIndex: number;
  chunkSize: number;
}

function createEmptyState(): ImportExecutionState {
  return {
    totalRows: 0,
    insertedRows: 0,
    updatedRows: 0,
    skippedRows: 0,
    errorRows: 0,
    sampleErrors: []
  };
}

function getChunkSize(chunkSize: number | undefined): number {
  const size = chunkSize ?? DEFAULT_CHUNK_SIZE;
  if (!Number.isInteger(size) || size <= 0 || size > MAX_CHUNK_SIZE) {
    throw new Error(`Chunk size must be between 1 and ${MAX_CHUNK_SIZE}.`);
  }

  return size;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

function validateHeaders(
  headers: string[],
  required: readonly string[],
  allowed: Set<string>
): string[] {
  const normalizedHeaders = headers.map(normalizeHeader);

  const duplicateHeaders = normalizedHeaders.filter(
    (header, index) => normalizedHeaders.indexOf(header) !== index
  );
  if (duplicateHeaders.length > 0) {
    throw new Error(`Duplicate CSV header(s): ${Array.from(new Set(duplicateHeaders)).join(', ')}`);
  }

  const missingHeaders = required.filter((header) => !normalizedHeaders.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required CSV header(s): ${missingHeaders.join(', ')}`);
  }

  const unknownHeaders = normalizedHeaders.filter((header) => !allowed.has(header));
  if (unknownHeaders.length > 0) {
    throw new Error(`Unknown CSV header(s): ${unknownHeaders.join(', ')}`);
  }

  return normalizedHeaders;
}

function parseNullableString(value: string | undefined): string | null {
  const normalized = (value ?? '').trim();
  return normalized ? normalized : null;
}

function parseBoolean(value: string | undefined, fieldName: string): boolean {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false;
  }

  throw new Error(`Invalid ${fieldName} value: ${value}`);
}

function parseInteger(value: string | undefined, fieldName: string): number | null {
  const normalized = parseNullableString(value);
  if (!normalized) {
    return null;
  }

  const number = Number(normalized);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`Invalid ${fieldName} value: ${value}`);
  }

  return number;
}

function parseVerificationStatus(
  value: string | undefined
): Contact['verification_status'] | null {
  const normalized = parseNullableString(value)?.toLowerCase() ?? null;
  if (!normalized) {
    return null;
  }

  if (normalized === 'unverified' || normalized === 'valid' || normalized === 'risky' || normalized === 'invalid' || normalized === 'catch_all') {
    return normalized;
  }

  throw new Error(`Invalid verification_status value: ${value}`);
}

function parseSeniority(value: string | undefined): Contact['seniority'] | null {
  const normalized = parseNullableString(value)?.toLowerCase() ?? null;
  if (!normalized) {
    return null;
  }

  if (
    normalized === 'c_level' ||
    normalized === 'vp' ||
    normalized === 'director' ||
    normalized === 'manager' ||
    normalized === 'ic'
  ) {
    return normalized;
  }

  throw new Error(`Invalid seniority value: ${value}`);
}

function addSampleError(
  state: Pick<ImportExecutionState, 'sampleErrors'>,
  sample: ImportErrorSample
): void {
  if (state.sampleErrors.length >= MAX_ERROR_SAMPLES) {
    return;
  }

  state.sampleErrors.push(sample);
}

function combineSamples(...sampleSets: ImportErrorSample[][]): ImportErrorSample[] {
  const combined: ImportErrorSample[] = [];
  for (const sampleSet of sampleSets) {
    for (const sample of sampleSet) {
      if (combined.length >= MAX_ERROR_SAMPLES) {
        return combined;
      }

      combined.push(sample);
    }
  }

  return combined;
}

function safeString(value: string | null | undefined): string | null {
  return parseNullableString(value ?? undefined);
}

function mergeNullableString(current: string | null, incoming: string | null): string | null {
  if (current && current.trim()) {
    return current;
  }

  return incoming ?? current;
}

function buildContactSourceLabel(sourceType: string, sourceName: string): string {
  return `${sourceType}:${sourceName}`;
}

function normalizeCompanyRow(rawRow: Record<string, string>, rowNumber: number): CompanyImportRow {
  try {
    const domain = normalizeDomain(rawRow.domain ?? '');
    return {
      rowNumber,
      domain,
      sourceRecordId: parseNullableString(rawRow.source_record_id) ?? domain,
      name: safeString(rawRow.name),
      industry: safeString(rawRow.industry),
      employeeCount: parseInteger(rawRow.employee_count, 'employee_count'),
      country: safeString(rawRow.country),
      city: safeString(rawRow.city),
      website: safeString(rawRow.website),
      linkedinUrl: safeString(rawRow.linkedin_url),
      suppressed: parseBoolean(rawRow.suppressed, 'suppressed'),
      suppressionReason: safeString(rawRow.suppression_reason),
      rawPayload: rawRow
    };
  } catch (error) {
    if (error instanceof NormalizationError) {
      throw new Error(error.message);
    }

    throw error;
  }
}

function normalizeContactRow(rawRow: Record<string, string>, rowNumber: number): ContactImportRow {
  try {
    const email = normalizeEmail(rawRow.email ?? '');
    const companyId = parseNullableString(rawRow.company_id);
    const companyDomainRaw = parseNullableString(rawRow.company_domain);
    const companyDomain = companyDomainRaw ? normalizeDomain(companyDomainRaw) : null;

    if (!companyId && !companyDomain) {
      throw new Error('Each contact row must include company_id or company_domain.');
    }

    if (companyId && !UUID_REGEX.test(companyId)) {
      throw new Error(`Invalid company_id value: ${companyId}`);
    }

    const title = safeString(rawRow.title);
    const seniority = parseSeniority(rawRow.seniority) ?? normalizeSeniority(title);

    return {
      rowNumber,
      email,
      companyId,
      companyDomain,
      sourceRecordId: parseNullableString(rawRow.source_record_id) ?? email,
      firstName: safeString(rawRow.first_name),
      lastName: safeString(rawRow.last_name),
      title,
      seniority,
      department: safeString(rawRow.department),
      linkedinUrl: safeString(rawRow.linkedin_url),
      verificationStatus: parseVerificationStatus(rawRow.verification_status),
      rawPayload: rawRow
    };
  } catch (error) {
    if (error instanceof NormalizationError) {
      throw new Error(error.message);
    }

    throw error;
  }
}

async function createImportBatch(
  entityType: ImportEntityType,
  options: CsvImportOptions
): Promise<ImportBatch> {
  return withTransaction(async (client) => {
    const result = await query<ImportBatch>(
      `
        INSERT INTO import_batches (
          id,
          entity_type,
          source_type,
          source_name,
          status,
          dry_run,
          notes
        )
        VALUES ($1, $2, $3, $4, 'running', $5, $6)
        RETURNING *
      `,
      [
        generateId(),
        entityType,
        options.sourceType,
        options.sourceName,
        options.dryRun ?? false,
        options.notes ?? null
      ],
      client
    );

    const batch = ensureFound(result.rows[0], 'Import batch creation failed.');
    await logEvent(
      {
        eventType: 'import.started',
        entityType: 'import_batch',
        entityId: batch.id,
        payload: {
          entity_type: entityType,
          source_type: options.sourceType,
          source_name: options.sourceName,
          dry_run: options.dryRun ?? false
        },
        triggeredBy: 'system'
      },
      client
    );

    return batch;
  });
}

async function persistImportBatchState(
  batchId: string,
  state: ImportExecutionState,
  status: ImportBatchStatus,
  options: { completed?: boolean; notes?: string | null } = {}
): Promise<void> {
  await query(
    `
      UPDATE import_batches
      SET
        status = $2,
        total_rows = $3,
        inserted_rows = $4,
        updated_rows = $5,
        skipped_rows = $6,
        error_rows = $7,
        error_summary = $8::jsonb,
        notes = COALESCE($9, notes),
        completed_at = CASE WHEN $10 THEN NOW() ELSE completed_at END
      WHERE id = $1
    `,
    [
      batchId,
      status,
      state.totalRows,
      state.insertedRows,
      state.updatedRows,
      state.skippedRows,
      state.errorRows,
      JSON.stringify(state.sampleErrors),
      options.notes ?? null,
      options.completed ?? false
    ]
  );
}

export async function getImportBatch(batchId: string): Promise<ImportBatch | null> {
  const result = await query<ImportBatch>(
    `
      SELECT *
      FROM import_batches
      WHERE id = $1
    `,
    [batchId]
  );

  return result.rows[0] ?? null;
}

async function ensureFileReadable(filePath: string): Promise<void> {
  await access(filePath);
}

async function createCsvParser(
  filePath: string,
  requiredColumns: readonly string[],
  allowedColumns: Set<string>
): Promise<AsyncIterable<Record<string, string>>> {
  await ensureFileReadable(filePath);

  const parser = parse({
    columns: (header) => validateHeaders(header.map(String), requiredColumns, allowedColumns),
    bom: true,
    skip_empty_lines: true,
    trim: true
  });

  return createReadStream(filePath).pipe(parser);
}

async function loadExistingCompanies(
  domains: string[],
  client?: DbClient
): Promise<Map<string, Company>> {
  if (domains.length === 0) {
    return new Map();
  }

  const result = await query<Company>(
    `
      SELECT *
      FROM companies
      WHERE domain = ANY($1::text[])
    `,
    [domains],
    client
  );

  return new Map(result.rows.map((row) => [row.domain, row]));
}

async function loadCompaniesByIds(
  ids: string[],
  client?: DbClient
): Promise<Map<string, Company>> {
  if (ids.length === 0) {
    return new Map();
  }

  const result = await query<Company>(
    `
      SELECT *
      FROM companies
      WHERE id = ANY($1::uuid[])
    `,
    [ids],
    client
  );

  return new Map(result.rows.map((row) => [row.id, row]));
}

async function loadExistingContacts(
  emails: string[],
  client?: DbClient
): Promise<Map<string, Contact>> {
  if (emails.length === 0) {
    return new Map();
  }

  const result = await query<Contact>(
    `
      SELECT *
      FROM contacts
      WHERE email = ANY($1::text[])
    `,
    [emails],
    client
  );

  return new Map(result.rows.map((row) => [row.email ?? '', row]));
}

async function upsertCompanySource(
  companyId: string,
  sourceType: string,
  sourceName: string,
  sourceRecord: SourceRecord,
  batchId: string,
  client: DbClient
): Promise<void> {
  await query(
    `
      INSERT INTO company_sources (
        id,
        company_id,
        source_type,
        source_name,
        source_record_id,
        source_batch_id,
        first_seen_at,
        last_seen_at,
        last_imported_at,
        raw_payload
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW(), $7::jsonb)
      ON CONFLICT (company_id, source_type, source_name, source_record_id)
      DO UPDATE SET
        source_batch_id = EXCLUDED.source_batch_id,
        last_seen_at = NOW(),
        last_imported_at = NOW(),
        raw_payload = EXCLUDED.raw_payload
    `,
    [
      generateId(),
      companyId,
      sourceType,
      sourceName,
      sourceRecord.sourceRecordId,
      batchId,
      JSON.stringify(sourceRecord.rawPayload)
    ],
    client
  );
}

async function upsertContactSource(
  contactId: string,
  sourceType: string,
  sourceName: string,
  sourceRecord: SourceRecord,
  batchId: string,
  client: DbClient
): Promise<void> {
  await query(
    `
      INSERT INTO contact_sources (
        id,
        contact_id,
        source_type,
        source_name,
        source_record_id,
        source_batch_id,
        first_seen_at,
        last_seen_at,
        last_imported_at,
        raw_payload
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW(), $7::jsonb)
      ON CONFLICT (contact_id, source_type, source_name, source_record_id)
      DO UPDATE SET
        source_batch_id = EXCLUDED.source_batch_id,
        last_seen_at = NOW(),
        last_imported_at = NOW(),
        raw_payload = EXCLUDED.raw_payload
    `,
    [
      generateId(),
      contactId,
      sourceType,
      sourceName,
      sourceRecord.sourceRecordId,
      batchId,
      JSON.stringify(sourceRecord.rawPayload)
    ],
    client
  );
}

function dedupeCompanyRows(
  rows: CompanyImportRow[],
  state: Pick<ImportExecutionState, 'skippedRows' | 'errorRows' | 'sampleErrors'>
): CompanyCandidate[] {
  const candidates = new Map<string, CompanyCandidate>();

  for (const row of rows) {
    const existing = candidates.get(row.domain);
    if (!existing) {
      candidates.set(row.domain, {
        domain: row.domain,
        name: row.name,
        industry: row.industry,
        employeeCount: row.employeeCount,
        country: row.country,
        city: row.city,
        website: row.website,
        linkedinUrl: row.linkedinUrl,
        suppressed: row.suppressed,
        suppressionReason: row.suppressionReason,
        sourceRecords: [{ sourceRecordId: row.sourceRecordId, rawPayload: row.rawPayload }],
        rowCount: 1
      });
      continue;
    }

    existing.name = mergeNullableString(existing.name, row.name);
    existing.industry = mergeNullableString(existing.industry, row.industry);
    existing.country = mergeNullableString(existing.country, row.country);
    existing.city = mergeNullableString(existing.city, row.city);
    existing.website = mergeNullableString(existing.website, row.website);
    existing.linkedinUrl = mergeNullableString(existing.linkedinUrl, row.linkedinUrl);
    existing.employeeCount = existing.employeeCount ?? row.employeeCount;
    existing.suppressed = existing.suppressed || row.suppressed;
    existing.suppressionReason =
      existing.suppressionReason ?? (row.suppressed ? row.suppressionReason : null);
    existing.sourceRecords.push({ sourceRecordId: row.sourceRecordId, rawPayload: row.rawPayload });
    existing.rowCount += 1;
    state.skippedRows += 1;
  }

  return Array.from(candidates.values());
}

function resolveContactRows(
  rows: ContactImportRow[],
  companiesById: Map<string, Company>,
  companiesByDomain: Map<string, Company>,
  state: Pick<ImportExecutionState, 'errorRows' | 'sampleErrors'>
): ResolvedContactRow[] {
  const resolvedRows: ResolvedContactRow[] = [];

  for (const row of rows) {
    const companyById = row.companyId ? companiesById.get(row.companyId) ?? null : null;
    const companyByDomain = row.companyDomain ? companiesByDomain.get(row.companyDomain) ?? null : null;

    if (row.companyId && !companyById) {
      state.errorRows += 1;
      addSampleError(state, {
        rowNumber: row.rowNumber,
        identifier: row.email,
        message: `Company ${row.companyId} was not found.`
      });
      continue;
    }

    if (row.companyDomain && !companyByDomain) {
      state.errorRows += 1;
      addSampleError(state, {
        rowNumber: row.rowNumber,
        identifier: row.email,
        message: `Company domain ${row.companyDomain} was not found.`
      });
      continue;
    }

    if (companyById && companyByDomain && companyById.id !== companyByDomain.id) {
      state.errorRows += 1;
      addSampleError(state, {
        rowNumber: row.rowNumber,
        identifier: row.email,
        message: 'company_id and company_domain resolve to different companies.'
      });
      continue;
    }

    const resolvedCompany = companyById ?? companyByDomain;
    if (!resolvedCompany) {
      state.errorRows += 1;
      addSampleError(state, {
        rowNumber: row.rowNumber,
        identifier: row.email,
        message: 'Unable to resolve a company for the contact row.'
      });
      continue;
    }

    resolvedRows.push({
      ...row,
      resolvedCompanyId: resolvedCompany.id
    });
  }

  return resolvedRows;
}

function dedupeContactRows(
  rows: ResolvedContactRow[],
  state: Pick<ImportExecutionState, 'skippedRows' | 'errorRows' | 'sampleErrors'>
): ContactCandidate[] {
  const candidates = new Map<string, ContactCandidate>();
  const invalidatedEmails = new Set<string>();

  for (const row of rows) {
    if (invalidatedEmails.has(row.email)) {
      state.errorRows += 1;
      addSampleError(state, {
        rowNumber: row.rowNumber,
        identifier: row.email,
        message: 'Conflicting duplicate email rows in the same chunk.'
      });
      continue;
    }

    const existing = candidates.get(row.email);
    if (!existing) {
      candidates.set(row.email, {
        email: row.email,
        companyId: row.companyId,
        companyDomain: row.companyDomain,
        resolvedCompanyId: row.resolvedCompanyId,
        firstName: row.firstName,
        lastName: row.lastName,
        title: row.title,
        seniority: row.seniority,
        department: row.department,
        linkedinUrl: row.linkedinUrl,
        verificationStatus: row.verificationStatus,
        sourceRecords: [{ sourceRecordId: row.sourceRecordId, rawPayload: row.rawPayload }],
        rowCount: 1,
        firstRowNumber: row.rowNumber
      });
      continue;
    }

    if (existing.resolvedCompanyId !== row.resolvedCompanyId) {
      state.errorRows += existing.rowCount + 1;
      addSampleError(state, {
        rowNumber: existing.firstRowNumber,
        identifier: row.email,
        message: 'Conflicting company linkage for the same email in one chunk.'
      });
      addSampleError(state, {
        rowNumber: row.rowNumber,
        identifier: row.email,
        message: 'Conflicting company linkage for the same email in one chunk.'
      });
      candidates.delete(row.email);
      invalidatedEmails.add(row.email);
      continue;
    }

    existing.firstName = mergeNullableString(existing.firstName, row.firstName);
    existing.lastName = mergeNullableString(existing.lastName, row.lastName);
    existing.title = mergeNullableString(existing.title, row.title);
    existing.seniority = existing.seniority ?? row.seniority;
    existing.department = mergeNullableString(existing.department, row.department);
    existing.linkedinUrl = mergeNullableString(existing.linkedinUrl, row.linkedinUrl);
    existing.verificationStatus = existing.verificationStatus ?? row.verificationStatus;
    existing.sourceRecords.push({ sourceRecordId: row.sourceRecordId, rawPayload: row.rawPayload });
    existing.rowCount += 1;
    state.skippedRows += 1;
  }

  return Array.from(candidates.values());
}

function determineImportStatus(
  state: ImportExecutionState,
  finalFailure: boolean
): ImportBatchStatus {
  if (finalFailure) {
    return 'failed';
  }

  if (state.errorRows > 0) {
    return 'partial';
  }

  return 'completed';
}

async function processCompanyChunk(
  rows: CompanyImportRow[],
  context: ImportChunkContext
): Promise<ChunkSummary> {
  const state = {
    skippedRows: 0,
    errorRows: 0,
    sampleErrors: [] as ImportErrorSample[]
  };
  const candidates = dedupeCompanyRows(rows, state);
  const domains = candidates.map((candidate) => candidate.domain);

  const runChunk = async (client?: DbClient): Promise<ChunkSummary> => {
    const companiesByDomain = await loadExistingCompanies(domains, client);
    let insertedRows = 0;
    let updatedRows = 0;
    let skippedRows = state.skippedRows;

    for (const candidate of candidates) {
      const existing = companiesByDomain.get(candidate.domain) ?? null;
      if (!existing) {
        insertedRows += 1;

        if (!context.dryRun && client) {
          const result = await query<Company>(
            `
              INSERT INTO companies (
                id,
                domain,
                name,
                industry,
                employee_count,
                country,
                city,
                website,
                linkedin_url,
                outreach_status,
                suppressed,
                suppression_reason,
                last_seen_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
              RETURNING *
            `,
            [
              generateId(),
              candidate.domain,
              candidate.name,
              candidate.industry,
              candidate.employeeCount,
              candidate.country,
              candidate.city,
              candidate.website,
              candidate.linkedinUrl,
              candidate.suppressed ? 'suppressed' : 'never_contacted',
              candidate.suppressed,
              candidate.suppressionReason
            ],
            client
          );

          const company = ensureFound(result.rows[0], `Company import insert failed for ${candidate.domain}.`);
          for (const sourceRecord of candidate.sourceRecords) {
            await upsertCompanySource(
              company.id,
              context.sourceType,
              context.sourceName,
              sourceRecord,
              context.batchId,
              client
            );
          }

          await logEvent(
            {
              eventType: 'company.import_inserted',
              entityType: 'company',
              entityId: company.id,
              payload: {
                batch_id: context.batchId,
                domain: company.domain,
                source_type: context.sourceType,
                source_name: context.sourceName
              },
              triggeredBy: 'system'
            },
            client
          );
        }

        continue;
      }

      const nextName = mergeNullableString(existing.name, candidate.name);
      const nextIndustry = mergeNullableString(existing.industry, candidate.industry);
      const nextCountry = mergeNullableString(existing.country, candidate.country);
      const nextCity = mergeNullableString(existing.city, candidate.city);
      const nextWebsite = mergeNullableString(existing.website, candidate.website);
      const nextLinkedin = mergeNullableString(existing.linkedin_url, candidate.linkedinUrl);
      const nextEmployeeCount = existing.employee_count ?? candidate.employeeCount;
      const nextSuppressed = existing.suppressed || candidate.suppressed;
      const nextSuppressionReason =
        existing.suppression_reason ?? (candidate.suppressed ? candidate.suppressionReason : null);
      const nextOutreachStatus = nextSuppressed ? 'suppressed' : existing.outreach_status;

      const changed =
        nextName !== existing.name ||
        nextIndustry !== existing.industry ||
        nextCountry !== existing.country ||
        nextCity !== existing.city ||
        nextWebsite !== existing.website ||
        nextLinkedin !== existing.linkedin_url ||
        nextEmployeeCount !== existing.employee_count ||
        nextSuppressed !== existing.suppressed ||
        nextSuppressionReason !== existing.suppression_reason ||
        nextOutreachStatus !== existing.outreach_status;

      if (changed) {
        updatedRows += 1;
      } else {
        skippedRows += 1;
      }

      if (!context.dryRun && client) {
        const result = await query<Company>(
          `
            UPDATE companies
            SET
              name = $2,
              industry = $3,
              employee_count = $4,
              country = $5,
              city = $6,
              website = $7,
              linkedin_url = $8,
              outreach_status = $9,
              suppressed = $10,
              suppression_reason = $11,
              last_seen_at = NOW(),
              updated_at = NOW()
            WHERE id = $1
            RETURNING *
          `,
          [
            existing.id,
            nextName,
            nextIndustry,
            nextEmployeeCount,
            nextCountry,
            nextCity,
            nextWebsite,
            nextLinkedin,
            nextOutreachStatus,
            nextSuppressed,
            nextSuppressionReason
          ],
          client
        );

        const company = ensureFound(result.rows[0], `Company import update failed for ${candidate.domain}.`);
        for (const sourceRecord of candidate.sourceRecords) {
          await upsertCompanySource(
            company.id,
            context.sourceType,
            context.sourceName,
            sourceRecord,
            context.batchId,
            client
          );
        }

        if (changed) {
          await logEvent(
            {
              eventType: 'company.import_updated',
              entityType: 'company',
              entityId: company.id,
              payload: {
                batch_id: context.batchId,
                domain: company.domain,
                source_type: context.sourceType,
                source_name: context.sourceName
              },
              triggeredBy: 'system'
            },
            client
          );
        }
      }
    }

    return {
      insertedRows,
      updatedRows,
      skippedRows,
      errorRows: state.errorRows,
      sampleErrors: state.sampleErrors
    };
  };

  try {
    if (context.dryRun) {
      return runChunk();
    }

    return await withTransaction(async (client) => runChunk(client));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      insertedRows: 0,
      updatedRows: 0,
      skippedRows: state.skippedRows,
      errorRows: state.errorRows + candidates.length,
      sampleErrors: combineSamples(state.sampleErrors, [
        {
          rowNumber: rows[0]?.rowNumber ?? null,
          identifier: rows[0]?.domain ?? null,
          message: `Chunk ${context.chunkIndex} failed: ${message}`
        }
      ])
    };
  }
}

async function processContactChunk(
  rows: ContactImportRow[],
  context: ImportChunkContext
): Promise<ChunkSummary> {
  const preState = {
    skippedRows: 0,
    errorRows: 0,
    sampleErrors: [] as ImportErrorSample[]
  };

  const companyIds = Array.from(
    new Set(rows.map((row) => row.companyId).filter((value): value is string => Boolean(value)))
  );
  const companyDomains = Array.from(
    new Set(rows.map((row) => row.companyDomain).filter((value): value is string => Boolean(value)))
  );

  const companiesById = await loadCompaniesByIds(companyIds);
  const companiesByDomain = await loadExistingCompanies(companyDomains);
  const resolvedRows = resolveContactRows(rows, companiesById, companiesByDomain, preState);
  const candidates = dedupeContactRows(resolvedRows, preState);
  const emails = candidates.map((candidate) => candidate.email);

  const runChunk = async (client?: DbClient): Promise<ChunkSummary> => {
    const contactsByEmail = await loadExistingContacts(emails, client);
    let insertedRows = 0;
    let updatedRows = 0;
    let skippedRows = preState.skippedRows;

    for (const candidate of candidates) {
      const existing = contactsByEmail.get(candidate.email) ?? null;
      if (!existing) {
        insertedRows += 1;

        if (!context.dryRun && client) {
          const result = await query<Contact>(
            `
              INSERT INTO contacts (
                id,
                company_id,
                email,
                first_name,
                last_name,
                title,
                seniority,
                department,
                linkedin_url,
                verification_status,
                source,
                last_seen_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
              RETURNING *
            `,
            [
              generateId(),
              candidate.resolvedCompanyId,
              candidate.email,
              candidate.firstName,
              candidate.lastName,
              candidate.title,
              candidate.seniority,
              candidate.department,
              candidate.linkedinUrl,
              candidate.verificationStatus ?? 'unverified',
              buildContactSourceLabel(context.sourceType, context.sourceName)
            ],
            client
          );

          const contact = ensureFound(result.rows[0], `Contact import insert failed for ${candidate.email}.`);
          for (const sourceRecord of candidate.sourceRecords) {
            await upsertContactSource(
              contact.id,
              context.sourceType,
              context.sourceName,
              sourceRecord,
              context.batchId,
              client
            );
          }

          await logEvent(
            {
              eventType: 'contact.import_inserted',
              entityType: 'contact',
              entityId: contact.id,
              payload: {
                batch_id: context.batchId,
                email: contact.email,
                source_type: context.sourceType,
                source_name: context.sourceName
              },
              triggeredBy: 'system'
            },
            client
          );
        }

        continue;
      }

      if (existing.company_id !== candidate.resolvedCompanyId) {
        preState.errorRows += candidate.rowCount;
        addSampleError(preState, {
          rowNumber: candidate.firstRowNumber,
          identifier: candidate.email,
          message: 'Existing contact is linked to a different company.'
        });
        continue;
      }

      const nextFirstName = mergeNullableString(existing.first_name, candidate.firstName);
      const nextLastName = mergeNullableString(existing.last_name, candidate.lastName);
      const nextTitle = mergeNullableString(existing.title, candidate.title);
      const nextSeniority = existing.seniority ?? candidate.seniority;
      const nextDepartment = mergeNullableString(existing.department, candidate.department);
      const nextLinkedin = mergeNullableString(existing.linkedin_url, candidate.linkedinUrl);
      const nextVerificationStatus =
        existing.verification_status === 'unverified'
          ? candidate.verificationStatus ?? existing.verification_status
          : existing.verification_status;
      const nextSource = mergeNullableString(
        existing.source,
        buildContactSourceLabel(context.sourceType, context.sourceName)
      );

      const changed =
        nextFirstName !== existing.first_name ||
        nextLastName !== existing.last_name ||
        nextTitle !== existing.title ||
        nextSeniority !== existing.seniority ||
        nextDepartment !== existing.department ||
        nextLinkedin !== existing.linkedin_url ||
        nextVerificationStatus !== existing.verification_status ||
        nextSource !== existing.source;

      if (changed) {
        updatedRows += 1;
      } else {
        skippedRows += 1;
      }

      if (!context.dryRun && client) {
        const result = await query<Contact>(
          `
            UPDATE contacts
            SET
              first_name = $2,
              last_name = $3,
              title = $4,
              seniority = $5,
              department = $6,
              linkedin_url = $7,
              verification_status = $8,
              source = $9,
              last_seen_at = NOW(),
              updated_at = NOW()
            WHERE id = $1
            RETURNING *
          `,
          [
            existing.id,
            nextFirstName,
            nextLastName,
            nextTitle,
            nextSeniority,
            nextDepartment,
            nextLinkedin,
            nextVerificationStatus,
            nextSource
          ],
          client
        );

        const contact = ensureFound(result.rows[0], `Contact import update failed for ${candidate.email}.`);
        for (const sourceRecord of candidate.sourceRecords) {
          await upsertContactSource(
            contact.id,
            context.sourceType,
            context.sourceName,
            sourceRecord,
            context.batchId,
            client
          );
        }

        if (changed) {
          await logEvent(
            {
              eventType: 'contact.import_updated',
              entityType: 'contact',
              entityId: contact.id,
              payload: {
                batch_id: context.batchId,
                email: contact.email,
                source_type: context.sourceType,
                source_name: context.sourceName
              },
              triggeredBy: 'system'
            },
            client
          );
        }
      }
    }

    return {
      insertedRows,
      updatedRows,
      skippedRows,
      errorRows: preState.errorRows,
      sampleErrors: preState.sampleErrors
    };
  };

  try {
    if (context.dryRun) {
      return runChunk();
    }

    return await withTransaction(async (client) => runChunk(client));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      insertedRows: 0,
      updatedRows: 0,
      skippedRows: preState.skippedRows,
      errorRows: preState.errorRows + candidates.length,
      sampleErrors: combineSamples(preState.sampleErrors, [
        {
          rowNumber: rows[0]?.rowNumber ?? null,
          identifier: rows[0]?.email ?? null,
          message: `Chunk ${context.chunkIndex} failed: ${message}`
        }
      ])
    };
  }
}

async function processCsvInChunks<T>(
  filePath: string,
  requiredColumns: readonly string[],
  allowedColumns: Set<string>,
  batchId: string,
  chunkSize: number,
  processRow: (row: Record<string, string>, rowNumber: number) => T,
  processChunk: (rows: T[], context: ImportChunkContext) => Promise<ChunkSummary>,
  contextBase: Omit<ImportChunkContext, 'batchId' | 'chunkIndex' | 'chunkSize'>
): Promise<ImportExecutionState> {
  const state = createEmptyState();
  const records = await createCsvParser(filePath, requiredColumns, allowedColumns);
  const chunk: T[] = [];
  let chunkIndex = 0;
  let rowNumber = 1;

  const flush = async (): Promise<void> => {
    if (chunk.length === 0) {
      return;
    }

    chunkIndex += 1;
    const summary = await processChunk(chunk.splice(0, chunk.length), {
      ...contextBase,
      batchId,
      chunkIndex,
      chunkSize
    });

    state.insertedRows += summary.insertedRows;
    state.updatedRows += summary.updatedRows;
    state.skippedRows += summary.skippedRows;
    state.errorRows += summary.errorRows;
    state.sampleErrors = combineSamples(state.sampleErrors, summary.sampleErrors);

    await persistImportBatchState(batchId, state, 'running');
    await logEvent({
      eventType: 'import.chunk_processed',
      entityType: 'import_batch',
      entityId: batchId,
      payload: {
        chunk_index: chunkIndex,
        chunk_size: summary.insertedRows + summary.updatedRows + summary.skippedRows + summary.errorRows,
        inserted_rows: summary.insertedRows,
        updated_rows: summary.updatedRows,
        skipped_rows: summary.skippedRows,
        error_rows: summary.errorRows
      },
      triggeredBy: 'system'
    });
  };

  for await (const rawRecord of records) {
    state.totalRows += 1;
    try {
      const record = Object.fromEntries(
        Object.entries(rawRecord).map(([key, value]) => [normalizeHeader(key), String(value ?? '')])
      );
      chunk.push(processRow(record, rowNumber));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.errorRows += 1;
      addSampleError(state, {
        rowNumber,
        identifier: null,
        message
      });
    }

    if (chunk.length >= chunkSize) {
      await flush();
    }

    rowNumber += 1;
  }

  await flush();
  return state;
}

async function finalizeImportRun(
  batch: ImportBatch,
  state: ImportExecutionState,
  unrecoverableError: Error | null
): Promise<ImportExecutionResult> {
  const status = determineImportStatus(state, unrecoverableError !== null);
  const notes = unrecoverableError ? unrecoverableError.message : batch.notes;

  await persistImportBatchState(batch.id, state, status, {
    completed: true,
    notes
  });

  await logEvent({
    eventType: status === 'failed' ? 'import.failed' : 'import.completed',
    entityType: 'import_batch',
    entityId: batch.id,
    payload: {
      entity_type: batch.entity_type,
      source_type: batch.source_type,
      source_name: batch.source_name,
      total_rows: state.totalRows,
      inserted_rows: state.insertedRows,
      updated_rows: state.updatedRows,
      skipped_rows: state.skippedRows,
      error_rows: state.errorRows,
      status
    },
    triggeredBy: 'system'
  });

  return {
    batchId: batch.id,
    entityType: batch.entity_type,
    sourceType: batch.source_type,
    sourceName: batch.source_name,
    status,
    totalRows: state.totalRows,
    insertedRows: state.insertedRows,
    updatedRows: state.updatedRows,
    skippedRows: state.skippedRows,
    errorRows: state.errorRows,
    sampleErrors: state.sampleErrors,
    dryRun: batch.dry_run
  };
}

export async function importCompaniesFromCsv(options: CsvImportOptions): Promise<ImportExecutionResult> {
  const chunkSize = getChunkSize(options.chunkSize);
  const batch = await createImportBatch('company', options);
  let failure: Error | null = null;
  let state = createEmptyState();

  try {
    state = await processCsvInChunks(
      options.filePath,
      COMPANY_REQUIRED_COLUMNS,
      COMPANY_ALLOWED_COLUMNS,
      batch.id,
      chunkSize,
      normalizeCompanyRow,
      processCompanyChunk,
      {
        sourceType: options.sourceType,
        sourceName: options.sourceName,
        dryRun: options.dryRun ?? false
      }
    );
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));
  }

  return finalizeImportRun(batch, state, failure);
}

export async function importContactsFromCsv(options: CsvImportOptions): Promise<ImportExecutionResult> {
  const chunkSize = getChunkSize(options.chunkSize);
  const batch = await createImportBatch('contact', options);
  let failure: Error | null = null;
  let state = createEmptyState();

  try {
    state = await processCsvInChunks(
      options.filePath,
      CONTACT_REQUIRED_COLUMNS,
      CONTACT_ALLOWED_COLUMNS,
      batch.id,
      chunkSize,
      normalizeContactRow,
      processContactChunk,
      {
        sourceType: options.sourceType,
        sourceName: options.sourceName,
        dryRun: options.dryRun ?? false
      }
    );
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));
  }

  return finalizeImportRun(batch, state, failure);
}

export async function runImportPreflightIntegrityCheck(): Promise<{
  companyRowsChecked: number;
  contactRowsChecked: number;
  companyIssues: Array<{ normalizedValue: string; ids: string[]; originals: string[] }>;
  contactIssues: Array<{ normalizedValue: string; ids: string[]; originals: string[] }>;
}> {
  const [companiesResult, contactsResult] = await Promise.all([
    query<{ id: string; domain: string }>('SELECT id, domain FROM companies ORDER BY created_at ASC'),
    query<{ id: string; email: string | null }>(
      'SELECT id, email FROM contacts WHERE email IS NOT NULL ORDER BY created_at ASC'
    )
  ]);

  const companyMap = new Map<string, { ids: string[]; originals: string[] }>();
  const contactMap = new Map<string, { ids: string[]; originals: string[] }>();
  const companyIssues: Array<{ normalizedValue: string; ids: string[]; originals: string[] }> = [];
  const contactIssues: Array<{ normalizedValue: string; ids: string[]; originals: string[] }> = [];

  for (const row of companiesResult.rows) {
    const normalized = normalizeDomain(row.domain);
    const existing = companyMap.get(normalized) ?? { ids: [], originals: [] };
    existing.ids.push(row.id);
    existing.originals.push(row.domain);
    companyMap.set(normalized, existing);
  }

  for (const row of contactsResult.rows) {
    const normalized = normalizeEmail(row.email ?? '');
    const existing = contactMap.get(normalized) ?? { ids: [], originals: [] };
    existing.ids.push(row.id);
    existing.originals.push(row.email ?? '');
    contactMap.set(normalized, existing);
  }

  for (const [normalizedValue, entry] of companyMap.entries()) {
    if (entry.ids.length > 1) {
      companyIssues.push({
        normalizedValue,
        ids: entry.ids,
        originals: entry.originals
      });
    }
  }

  for (const [normalizedValue, entry] of contactMap.entries()) {
    if (entry.ids.length > 1) {
      contactIssues.push({
        normalizedValue,
        ids: entry.ids,
        originals: entry.originals
      });
    }
  }

  return {
    companyRowsChecked: companiesResult.rows.length,
    contactRowsChecked: contactsResult.rows.length,
    companyIssues,
    contactIssues
  };
}

export async function getImportBatchOrThrow(batchId: string): Promise<ImportBatch> {
  const batch = await getImportBatch(batchId);
  if (!batch) {
    throw new HttpError(404, `Import batch ${batchId} not found.`);
  }

  return batch;
}
