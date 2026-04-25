import 'dotenv/config';

import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createGunzip } from 'node:zlib';

import { parse } from 'csv-parse';
import pg from 'pg';

const TARGET_COUNTRIES = new Map([
  ['united states', 'United States'],
  ['usa', 'United States'],
  ['us', 'United States'],
  ['canada', 'Canada'],
  ['united kingdom', 'United Kingdom'],
  ['uk', 'United Kingdom'],
  ['great britain', 'United Kingdom'],
  ['australia', 'Australia']
]);

const DEFAULT_OUTPUT_CSV = path.resolve('imports', 'pdl_companies_filtered_v3.csv');
const DEFAULT_REJECTED_CSV = path.resolve('imports', 'pdl_companies_rejected_sample_v3.csv');
const DEFAULT_REPORT_JSON = path.resolve('imports', 'pdl_companies_filter_report_v3.json');
const FIRST_PASS_REPORT_JSON = path.resolve('imports', 'pdl_companies_filter_report.json');
const SECOND_PASS_REPORT_JSON = path.resolve('imports', 'pdl_companies_filter_report_v2.json');
const MAX_ACCEPTED_OUTPUT = 1000;
const MAX_ACCEPTED_SAMPLE = 50;
const MAX_REJECTED_SAMPLE = 50;
const MAX_REJECTED_FILE_ROWS = 500;
const TOP_BUCKET_LIMIT = 20;

const HIGH_CONFIDENCE_INCLUDE_PATTERNS = [
  /computer software/i,
  /\bsoftware\b/i,
  /\bsaas\b/i,
  /cloud software/i,
  /cybersecurity/i,
  /computer\s*&\s*network security/i,
  /information security/i,
  /managed service provider/i,
  /\bmsp\b/i,
  /\bit services\b/i,
  /cloud services/i,
  /devops/i,
  /developer tools?/i,
  /data platform/i,
  /analytics software/i,
  /hr software/i,
  /sales software/i,
  /marketing technology/i,
  /martech/i,
  /fintech software/i,
  /payment software/i,
  /payments software/i,
  /logistics software/i,
  /supply chain software/i,
  /b2b platform/i,
  /enterprise software/i,
  /business software/i,
  /cloud platform/i,
  /security platform/i,
  /identity platform/i,
  /dev tools?/i,
  /cloud management/i,
  /data analytics/i,
  /observability/i,
  /workflow automation/i,
  /sales enablement/i,
  /hr tech/i,
  /sales tech/i
];

const STRONG_PRODUCT_CUE_PATTERNS = [
  /\bsoftware\b/i,
  /\bplatform\b/i,
  /\bcloud\b/i,
  /\bcyber\b/i,
  /\bsecurity\b/i,
  /\bsaas\b/i,
  /\bdata\b/i,
  /\banalytics\b/i,
  /\bautomation\b/i,
  /\bcrm\b/i,
  /\bapi\b/i,
  /\bdevops\b/i,
  /\bdeveloper\b/i,
  /\binfrastructure\b/i,
  /\bworkflow\b/i,
  /\bintelligence\b/i,
  /\bai\b/i,
  /machine learning/i,
  /compliance software/i,
  /payment software/i,
  /payments software/i,
  /hr software/i,
  /sales software/i,
  /logistics software/i,
  /supply chain software/i,
  /enterprise software/i,
  /business software/i,
  /data platform/i,
  /cloud platform/i,
  /security platform/i,
  /developer tools?/i,
  /dev tools?/i,
  /observability/i
];

const EXTREME_PRODUCT_CUE_PATTERNS = [
  /computer software/i,
  /\bsoftware\b/i,
  /\bsaas\b/i,
  /\bplatform\b/i,
  /\bcloud\b/i,
  /\bcyber\b/i,
  /computer\s*&\s*network security/i,
  /information security/i,
  /\bsecurity\b/i,
  /developer tools?/i,
  /\bdevops\b/i,
  /data platform/i,
  /analytics software/i,
  /workflow automation/i,
  /enterprise software/i,
  /business software/i,
  /payment software/i,
  /hr software/i,
  /sales software/i
];

const PREFERRED_INDUSTRY_PATTERNS = [
  /computer software/i,
  /computer\s*&\s*network security/i,
  /cybersecurity/i,
  /cloud software/i,
  /enterprise software/i,
  /business software/i,
  /software/i
];

const HARD_REVIEW_INDUSTRY_PATTERNS = [
  /outsourcing\/offshoring/i,
  /computer networking/i,
  /information technology and services/i,
  /^information technology$/i,
  /\binternet\b/i,
  /marketing and advertising/i,
  /management consulting/i,
  /financial services/i,
  /\binsurance\b/i,
  /\baccounting\b/i,
  /hospital\s*&\s*health care/i,
  /real estate/i,
  /telecommunications/i,
  /security and investigations/i,
  /industrial automation/i,
  /information services/i,
  /construction/i,
  /electrical\/electronic manufacturing/i,
  /logistics and supply chain/i,
  /oil & energy/i
];

const EXCLUDE_PATTERNS = [
  /\bbank\b/i,
  /credit union/i,
  /\bmortgage\b/i,
  /\bloan(s)?\b/i,
  /\blending\b/i,
  /wealth management/i,
  /investment management/i,
  /\binsurance\b/i,
  /\baccounting\b/i,
  /\bcpa\b/i,
  /law firm/i,
  /legal services/i,
  /\bhospital\b/i,
  /health care provider/i,
  /\bclinic\b/i,
  /medical practice/i,
  /real estate broker/i,
  /property management/i,
  /marketing agency/i,
  /advertising agency/i,
  /digital agency/i,
  /branding agency/i,
  /\brecruit/i,
  /\bstaffing\b/i,
  /\bassociation\b/i,
  /\bcouncil\b/i,
  /\bchamber\b/i,
  /\bsummit\b/i,
  /\bconference\b/i,
  /\bevent\b/i,
  /\bpublication\b/i,
  /\bmedia\b/i,
  /\bnews\b/i,
  /\bvc\b/i,
  /venture capital/i,
  /private equity/i,
  /\baccelerator\b/i,
  /\bnonprofit\b/i,
  /\bnon-profit\b/i,
  /\bschool\b/i,
  /\buniversity\b/i,
  /\bgovernment\b/i,
  /\brestaurant\b/i,
  /\bretail\b/i,
  /ecommerce store/i,
  /consumer products/i,
  /\bconsumer\b/i,
  /\bcrypto\b/i,
  /\bgambling\b/i,
  /\badult\b/i
];

const NON_BUSINESS_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'aol.com',
  'icloud.com',
  'proton.me',
  'protonmail.com'
]);

const HOSTING_SUFFIXES = [
  'wixsite.com',
  'weebly.com',
  'wordpress.com',
  'blogspot.com',
  'tumblr.com',
  'squarespace.com',
  'godaddysites.com',
  'webflow.io',
  'site123.me',
  'myshopify.com'
];

const PREFERRED_TLDS = new Set(['com', 'io', 'ai', 'co', 'net', 'tech']);
const GENERIC_BUSINESS_TLDS = new Set([
  'app',
  'cloud',
  'software',
  'systems',
  'solutions',
  'digital',
  'global',
  'dev',
  'tools',
  'works',
  'platform'
]);

const COUNTRY_TLD_MAP = new Map([
  ['us', 'United States'],
  ['ca', 'Canada'],
  ['co.uk', 'United Kingdom'],
  ['uk', 'United Kingdom'],
  ['org.uk', 'United Kingdom'],
  ['au', 'Australia'],
  ['com.au', 'Australia'],
  ['cn', 'China'],
  ['in', 'India'],
  ['br', 'Brazil'],
  ['ru', 'Russia'],
  ['de', 'Germany'],
  ['fr', 'France'],
  ['it', 'Italy'],
  ['es', 'Spain'],
  ['nl', 'Netherlands'],
  ['se', 'Sweden'],
  ['no', 'Norway'],
  ['fi', 'Finland'],
  ['pl', 'Poland'],
  ['jp', 'Japan'],
  ['kr', 'South Korea'],
  ['sg', 'Singapore'],
  ['ie', 'Ireland'],
  ['il', 'Israel'],
  ['ch', 'Switzerland'],
  ['at', 'Austria'],
  ['be', 'Belgium'],
  ['dk', 'Denmark'],
  ['nz', 'New Zealand'],
  ['za', 'South Africa']
]);

function csvEscape(value) {
  const stringValue = value == null ? '' : String(value);
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function writeCsvRow(stream, values) {
  stream.write(`${values.map(csvEscape).join(',')}\n`);
}

function normalizeWhitespace(value) {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeCountry(value) {
  const normalized = normalizeWhitespace(value).toLowerCase();
  return TARGET_COUNTRIES.get(normalized) ?? null;
}

function normalizeDomain(rawValue) {
  const value = normalizeWhitespace(rawValue).toLowerCase();
  if (!value) {
    return null;
  }

  let candidate = value;
  if (!candidate.includes('://')) {
    candidate = `https://${candidate}`;
  }

  try {
    const url = new URL(candidate);
    let host = url.hostname.trim().toLowerCase();
    host = host.replace(/^www\./, '').replace(/\.+$/, '');
    if (
      !host ||
      !host.includes('.') ||
      /\s/.test(host) ||
      !/[a-z]/.test(host) ||
      /_{1,}/.test(host) ||
      /\.\./.test(host)
    ) {
      return null;
    }

    return host;
  } catch {
    return null;
  }
}

function normalizeWebsite(rawValue, domain) {
  const value = normalizeWhitespace(rawValue);
  if (!value && domain) {
    return `https://${domain}`;
  }

  if (!value) {
    return null;
  }

  return value.includes('://') ? value : `https://${value}`;
}

function normalizeLinkedinUrl(rawValue) {
  const value = normalizeWhitespace(rawValue);
  if (!value) {
    return null;
  }

  return value.includes('://') ? value : `https://${value}`;
}

function parseEmployeeCount(sizeValue) {
  const value = normalizeWhitespace(sizeValue).toLowerCase();
  if (!value) {
    return {
      employeeCount: null,
      acceptedBySize: false,
      sizeKnown: false,
      rawSize: null,
      sizeConfidence: 'missing'
    };
  }

  const rangeMatch = value.match(/^(\d[\d,]*)\s*-\s*(\d[\d,]*)$/);
  if (rangeMatch) {
    const min = Number(rangeMatch[1].replace(/,/g, ''));
    const max = Number(rangeMatch[2].replace(/,/g, ''));
    const midpoint = Math.round((min + max) / 2);
    return {
      employeeCount: midpoint,
      acceptedBySize: min >= 11 && max <= 200,
      sizeKnown: true,
      rawSize: value,
      sizeConfidence: 'range_midpoint'
    };
  }

  const plusMatch = value.match(/^(\d[\d,]*)\+$/);
  if (plusMatch) {
    const min = Number(plusMatch[1].replace(/,/g, ''));
    return {
      employeeCount: min,
      acceptedBySize: min >= 11 && min <= 200,
      sizeKnown: true,
      rawSize: value,
      sizeConfidence: 'open_ended'
    };
  }

  const numeric = Number(value.replace(/,/g, ''));
  if (Number.isFinite(numeric) && numeric > 0) {
    return {
      employeeCount: Math.round(numeric),
      acceptedBySize: numeric >= 11 && numeric <= 200,
      sizeKnown: true,
      rawSize: value,
      sizeConfidence: 'exact_or_source_numeric'
    };
  }

  return {
    employeeCount: null,
    acceptedBySize: false,
    sizeKnown: false,
    rawSize: value,
    sizeConfidence: 'unparsed'
  };
}

function createSourceRecordId(id, name, domain) {
  const trimmedId = normalizeWhitespace(id);
  if (trimmedId) {
    return trimmedId;
  }

  return createHash('sha256')
    .update(`${normalizeWhitespace(name)}|${domain}`)
    .digest('hex')
    .slice(0, 24);
}

function incrementCount(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function maybePushSample(list, value, limit) {
  if (list.length < limit) {
    list.push(value);
  }
}

function getDomainTld(domain) {
  const value = normalizeWhitespace(domain).toLowerCase();
  if (!value.includes('.')) {
    return null;
  }

  if (value.endsWith('.co.uk')) {
    return 'co.uk';
  }
  if (value.endsWith('.org.uk')) {
    return 'org.uk';
  }
  if (value.endsWith('.com.au')) {
    return 'com.au';
  }

  const parts = value.split('.');
  return parts.at(-1) ?? null;
}

function looksGlobalCompany(record) {
  const text = [record.name, record.industry, record.website].filter(Boolean).join(' | ');
  return /\b(global|international|worldwide|intl)\b/i.test(text);
}

function evaluateDomainSanity(record) {
  const domain = record.domain;
  if (!domain) {
    return { accepted: false, reason: 'domain_missing' };
  }

  if (NON_BUSINESS_DOMAINS.has(domain)) {
    return { accepted: false, reason: 'non_business_free_domain' };
  }

  if (HOSTING_SUFFIXES.some((suffix) => domain === suffix || domain.endsWith(`.${suffix}`))) {
    return { accepted: false, reason: 'free_hosted_domain' };
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
    return { accepted: false, reason: 'ip_address_domain' };
  }

  const tld = getDomainTld(domain);
  if (!tld) {
    return { accepted: false, reason: 'missing_tld' };
  }

  const tldCountry = COUNTRY_TLD_MAP.get(tld);
  if (tldCountry && tldCountry !== record.country && !looksGlobalCompany(record)) {
    return { accepted: false, reason: `country_tld_mismatch:${tldCountry}` };
  }

  if (
    !PREFERRED_TLDS.has(tld) &&
    !GENERIC_BUSINESS_TLDS.has(tld) &&
    !COUNTRY_TLD_MAP.has(tld)
  ) {
    return { accepted: false, reason: `low_confidence_tld:${tld}` };
  }

  return { accepted: true, tld };
}

function buildTextForMatching(record) {
  return [
    record.name,
    record.domain,
    record.industry,
    record.website,
    record.linkedin_url
  ]
    .filter(Boolean)
    .join(' | ');
}

function buildProductCueText(record) {
  return [
    record.name,
    record.domain,
    record.website
  ]
    .filter(Boolean)
    .join(' | ');
}

function detectStrongIncludeMatches(matchText) {
  return HIGH_CONFIDENCE_INCLUDE_PATTERNS
    .filter((pattern) => pattern.test(matchText))
    .map((pattern) => pattern.source);
}

function detectProductCues(matchText) {
  return STRONG_PRODUCT_CUE_PATTERNS
    .filter((pattern) => pattern.test(matchText))
    .map((pattern) => pattern.source);
}

function detectExtremeProductCues(matchText) {
  return EXTREME_PRODUCT_CUE_PATTERNS
    .filter((pattern) => pattern.test(matchText))
    .map((pattern) => pattern.source);
}

function hasPreferredIndustry(industryText) {
  return PREFERRED_INDUSTRY_PATTERNS.find((pattern) => pattern.test(industryText)) ?? null;
}

function findHardReviewIndustry(industryText) {
  return HARD_REVIEW_INDUSTRY_PATTERNS.find((pattern) => pattern.test(industryText)) ?? null;
}

function classifyFit(record) {
  const matchText = buildTextForMatching(record);
  const productCueText = buildProductCueText(record);
  const exclusionMatch = EXCLUDE_PATTERNS.find((pattern) => pattern.test(matchText));
  if (exclusionMatch) {
    return {
      included: false,
      type: 'exclusion',
      reason: `excluded:${exclusionMatch.source}`
    };
  }

  const strongMatches = detectStrongIncludeMatches(matchText);
  const productCues = detectProductCues(productCueText);
  const extremeProductCues = detectExtremeProductCues(productCueText);
  const industryText = normalizeWhitespace(record.industry).toLowerCase();
  const preferredIndustryMatch = hasPreferredIndustry(industryText);
  const hardReviewIndustryMatch = findHardReviewIndustry(industryText);
  const tld = getDomainTld(record.domain);
  const hasTrustedBorderlineTld =
    (tld != null && PREFERRED_TLDS.has(tld)) ||
    (tld != null && COUNTRY_TLD_MAP.get(tld) === record.country);

  if (preferredIndustryMatch) {
    return {
      included: true,
      includeReason: preferredIndustryMatch.source,
      matchedSignals: strongMatches.length > 0 ? strongMatches : productCues,
      fitTier: 'preferred'
    };
  }

  if (hardReviewIndustryMatch) {
    if (record.linkedin_url && extremeProductCues.length > 0 && hasTrustedBorderlineTld) {
      return {
        included: true,
        includeReason: `borderline_strong_product:${hardReviewIndustryMatch.source}`,
        matchedSignals: extremeProductCues,
        fitTier: 'borderline'
      };
    }

    return {
      included: false,
      type: 'weak_broad',
      reason: `hard_reject_industry_without_extreme_product_signal:${hardReviewIndustryMatch.source}`
    };
  }

  if (record.linkedin_url && productCues.length > 0 && hasTrustedBorderlineTld) {
    return {
      included: true,
      includeReason: productCues[0],
      matchedSignals: productCues,
      fitTier: 'borderline'
    };
  }

  return {
    included: false,
    type: 'weak_broad',
    reason: 'non_preferred_without_linkedin_plus_product_signal'
  };
}

function scoreAcceptedRecord(record) {
  let score = 0;
  const text = buildTextForMatching(record).toLowerCase();
  const industry = (record.industry ?? '').toLowerCase();
  const tld = getDomainTld(record.domain);

  if (record.fit_tier === 'preferred') {
    score += 70;
  } else {
    score += 35;
  }

  if (/computer software|enterprise software|business software|\bsaas\b|cloud software/.test(text)) {
    score += 35;
  } else if (/cybersecurity|computer\s*&\s*network security|information security|security platform/.test(text)) {
    score += 33;
  } else if (/devops|developer tools?|cloud services|cloud platform|observability|data platform/.test(text)) {
    score += 30;
  } else if (/sales software|sales tech|marketing technology|martech|hr software|hr tech|payment software|logistics software|supply chain software/.test(text)) {
    score += 27;
  }

  if (/outsourcing\/offshoring|computer networking|information technology and services|internet|marketing and advertising|management consulting|telecommunications|financial services/.test(industry)) {
    score -= 28;
  }

  if (!record.linkedin_url) {
    score -= 18;
  }

  if (record.linkedin_url) {
    score += 12;
  }

  if (tld && PREFERRED_TLDS.has(tld)) {
    score += 12;
  } else if (tld && GENERIC_BUSINESS_TLDS.has(tld)) {
    score += 2;
  } else if (tld) {
    score -= 14;
  }

  if (/\b(platform|software|cloud|data|analytics|automation|api|ai|security|workflow)\b/.test(text)) {
    score += 16;
  }

  if (record.employee_count >= 51 && record.employee_count <= 150) {
    score += 20;
  } else if (record.employee_count >= 11 && record.employee_count <= 50) {
    score += 15;
  } else if (record.employee_count >= 151 && record.employee_count <= 200) {
    score += 12;
  }

  if (record.country === 'United States') {
    score += 10;
  } else {
    score += 6;
  }

  if (record.size_confidence === 'range_midpoint') {
    score -= 2;
  }

  if (/^(group|solutions|services|consulting|systems)$/i.test(normalizeWhitespace(record.name))) {
    score -= 10;
  }

  return score;
}

function getScoreBucket(score) {
  if (score >= 120) {
    return '120+';
  }
  if (score >= 110) {
    return '110-119';
  }
  if (score >= 100) {
    return '100-109';
  }
  if (score >= 90) {
    return '90-99';
  }
  if (score >= 80) {
    return '80-89';
  }
  if (score >= 70) {
    return '70-79';
  }

  return '<70';
}

function updateTopAccepted(topAccepted, candidate) {
  topAccepted.push(candidate);
  topAccepted.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.domain.localeCompare(right.domain);
  });

  if (topAccepted.length > MAX_ACCEPTED_OUTPUT) {
    topAccepted.pop();
  }
}

async function createDomainDedupeStore() {
  if (!process.env.DATABASE_URL?.trim()) {
    return {
      async seenBefore() {
        return false;
      },
      async close() {}
    };
  }

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  await client.query('CREATE TEMP TABLE temp_pdl_seen_domains (domain text PRIMARY KEY) ON COMMIT PRESERVE ROWS');

  return {
    async seenBefore(domain) {
      const result = await client.query(
        `
          INSERT INTO temp_pdl_seen_domains (domain)
          VALUES ($1)
          ON CONFLICT DO NOTHING
          RETURNING domain
        `,
        [domain]
      );

      return result.rowCount === 0;
    },
    async close() {
      await client.end();
    }
  };
}

function makeAcceptedSample(candidate) {
  return {
    source_record_id: candidate.source_record_id,
    domain: candidate.domain,
    name: candidate.name,
    industry: candidate.industry,
    employee_count: candidate.employee_count,
    country: candidate.country,
    city: candidate.city,
    website: candidate.website,
    linkedin_url: candidate.linkedin_url,
    domain_tld: candidate.domain_tld,
    score: candidate.score,
    fit_tier: candidate.fit_tier,
    include_reason: candidate.includeReason,
    matched_signals: candidate.matchedSignals,
    size_source: candidate.raw_size,
    size_confidence: candidate.size_confidence
  };
}

async function detectInputCompression(filePath) {
  const handle = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(4);
    await handle.read(buffer, 0, 4, 0);
    if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
      return 'gzip';
    }

    return 'plain';
  } finally {
    await handle.close();
  }
}

async function createInputStream(filePath) {
  const compression = await detectInputCompression(filePath);
  const fileStream = createReadStream(filePath);
  if (compression === 'gzip') {
    return {
      compression,
      stream: fileStream.pipe(createGunzip())
    };
  }

  return {
    compression,
    stream: fileStream
  };
}

function normalizeInputRow(rawRow) {
  const sourceRecordId = createSourceRecordId(rawRow.id, rawRow.name, rawRow.website ?? rawRow.domain);
  const domain = normalizeDomain(rawRow.website ?? rawRow.domain ?? '');
  const name = normalizeWhitespace(rawRow.name);
  const country = normalizeCountry(rawRow.country);
  const city = normalizeWhitespace(rawRow.locality);
  const industry = normalizeWhitespace(rawRow.industry);
  const website = normalizeWebsite(rawRow.website, domain);
  const linkedinUrl = normalizeLinkedinUrl(rawRow.linkedin_url);
  const size = parseEmployeeCount(rawRow.size ?? rawRow.employee_count ?? '');

  return {
    source_record_id: sourceRecordId,
    domain,
    name: name || null,
    industry: industry || null,
    employee_count: size.employeeCount,
    country,
    city: city || null,
    website,
    linkedin_url: linkedinUrl,
    rawCountry: normalizeWhitespace(rawRow.country),
    rawSize: size.rawSize,
    sizeKnown: size.sizeKnown,
    acceptedBySize: size.acceptedBySize,
    sizeConfidence: size.sizeConfidence,
    rawRow
  };
}

function sortBuckets(map, label) {
  return Array.from(map.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, TOP_BUCKET_LIMIT)
    .map(([value, count]) => ({ [label]: value, count }));
}

async function loadFirstPassComparison() {
  try {
    const report = JSON.parse(await readFile(FIRST_PASS_REPORT_JSON, 'utf8'));
    const firstPassAcceptedCandidates = report?.counts?.acceptedCandidates ?? null;
    const firstPassWritten = report?.counts?.acceptedWritten ?? null;
    const firstPassBroadIndustries = (report?.topAcceptedIndustries ?? []).filter((entry) =>
      /financial services|internet|information technology and services/i.test(entry.industry ?? '')
    );

    return {
      firstPassAcceptedCandidates,
      firstPassWritten,
      firstPassBroadIndustries
    };
  } catch {
    return null;
  }
}

async function loadSecondPassComparison() {
  try {
    const report = JSON.parse(await readFile(SECOND_PASS_REPORT_JSON, 'utf8'));
    return {
      secondPassAcceptedCandidates: report?.counts?.acceptedBeforeCap ?? null,
      secondPassRecommendation: report?.recommendation ?? null
    };
  } catch {
    return null;
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      input: {
        type: 'string',
        short: 'i'
      },
      output: {
        type: 'string'
      },
      rejected: {
        type: 'string'
      },
      report: {
        type: 'string'
      }
    }
  });

  if (!values.input) {
    throw new Error('Missing required --input <path> argument.');
  }

  const inputPath = path.resolve(values.input);
  const outputCsvPath = path.resolve(values.output ?? DEFAULT_OUTPUT_CSV);
  const rejectedCsvPath = path.resolve(values.rejected ?? DEFAULT_REJECTED_CSV);
  const reportJsonPath = path.resolve(values.report ?? DEFAULT_REPORT_JSON);

  await mkdir(path.dirname(outputCsvPath), { recursive: true });
  await mkdir(path.dirname(rejectedCsvPath), { recursive: true });
  await mkdir(path.dirname(reportJsonPath), { recursive: true });

  const { compression, stream } = await createInputStream(inputPath);
  const domainDedupeStore = await createDomainDedupeStore();
  const parser = parse({
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    relax_quotes: true,
    escape: '\\'
  });

  const input = stream.pipe(parser);
  const topAccepted = [];
  const acceptedIndustryCounts = new Map();
  const acceptedCountryCounts = new Map();
  const acceptedTldCounts = new Map();
  const acceptedSizeRangeCounts = new Map();
  const scoreDistribution = new Map();
  const rejectionReasonCounts = new Map();
  const suspiciousPatterns = new Map();
  const rejectedSamples = [];
  const counters = {
    rawRowsScanned: 0,
    acceptedBeforeCap: 0,
    acceptedWritten: 0,
    acceptedPreferredIndustry: 0,
    acceptedBorderline: 0,
    rejectedNoDomain: 0,
    rejectedNoName: 0,
    rejectedDuplicateDomain: 0,
    rejectedCountry: 0,
    rejectedSize: 0,
    rejectedWeakBroadIndustry: 0,
    rejectedExclusionMatch: 0,
    rejectedDomainSanity: 0
  };

  let headers = null;
  const firstFiveRows = [];

  try {
    for await (const row of input) {
      counters.rawRowsScanned += 1;
      if (!headers) {
        headers = Object.keys(row);
      }

      if (firstFiveRows.length < 5) {
        firstFiveRows.push(row);
      }

      const normalized = normalizeInputRow(row);

      if (!normalized.domain) {
        counters.rejectedNoDomain += 1;
        incrementCount(rejectionReasonCounts, 'no_clean_domain');
        maybePushSample(rejectedSamples, {
          source_record_id: normalized.source_record_id,
          name: normalized.name,
          website: normalized.website,
          country: normalized.rawCountry,
          rejection_reason: 'no_clean_domain'
        }, MAX_REJECTED_FILE_ROWS);
        continue;
      }

      if (!normalized.name) {
        counters.rejectedNoName += 1;
        incrementCount(rejectionReasonCounts, 'no_company_name');
        maybePushSample(rejectedSamples, {
          source_record_id: normalized.source_record_id,
          domain: normalized.domain,
          country: normalized.rawCountry,
          rejection_reason: 'no_company_name'
        }, MAX_REJECTED_FILE_ROWS);
        continue;
      }

      if (!normalized.country) {
        counters.rejectedCountry += 1;
        incrementCount(rejectionReasonCounts, 'country_out_of_target');
        maybePushSample(rejectedSamples, {
          source_record_id: normalized.source_record_id,
          domain: normalized.domain,
          name: normalized.name,
          country: normalized.rawCountry,
          rejection_reason: 'country_out_of_target'
        }, MAX_REJECTED_FILE_ROWS);
        continue;
      }

      if (!normalized.sizeKnown) {
        counters.rejectedSize += 1;
        incrementCount(rejectionReasonCounts, 'size_missing');
        maybePushSample(rejectedSamples, {
          source_record_id: normalized.source_record_id,
          domain: normalized.domain,
          name: normalized.name,
          country: normalized.country,
          rejection_reason: 'size_missing'
        }, MAX_REJECTED_FILE_ROWS);
        continue;
      }

      if (!normalized.acceptedBySize) {
        counters.rejectedSize += 1;
        incrementCount(rejectionReasonCounts, 'size_out_of_range');
        maybePushSample(rejectedSamples, {
          source_record_id: normalized.source_record_id,
          domain: normalized.domain,
          name: normalized.name,
          country: normalized.country,
          size: normalized.rawSize,
          rejection_reason: 'size_out_of_range'
        }, MAX_REJECTED_FILE_ROWS);
        continue;
      }

      const domainDecision = evaluateDomainSanity(normalized);
      if (!domainDecision.accepted) {
        counters.rejectedDomainSanity += 1;
        incrementCount(rejectionReasonCounts, domainDecision.reason);
        maybePushSample(rejectedSamples, {
          source_record_id: normalized.source_record_id,
          domain: normalized.domain,
          name: normalized.name,
          country: normalized.country,
          industry: normalized.industry,
          website: normalized.website,
          rejection_reason: domainDecision.reason
        }, MAX_REJECTED_FILE_ROWS);
        continue;
      }

      const fitDecision = classifyFit(normalized);
      if (!fitDecision.included) {
        if (fitDecision.type === 'exclusion') {
          counters.rejectedExclusionMatch += 1;
        } else {
          counters.rejectedWeakBroadIndustry += 1;
        }
        incrementCount(rejectionReasonCounts, fitDecision.reason);

        maybePushSample(rejectedSamples, {
          source_record_id: normalized.source_record_id,
          domain: normalized.domain,
          name: normalized.name,
          country: normalized.country,
          industry: normalized.industry,
          website: normalized.website,
          size: normalized.rawSize,
          rejection_reason: fitDecision.reason
        }, MAX_REJECTED_FILE_ROWS);
        continue;
      }

      if (await domainDedupeStore.seenBefore(normalized.domain)) {
        counters.rejectedDuplicateDomain += 1;
        incrementCount(rejectionReasonCounts, 'duplicate_domain');
        maybePushSample(rejectedSamples, {
          source_record_id: normalized.source_record_id,
          name: normalized.name,
          domain: normalized.domain,
          country: normalized.country,
          rejection_reason: 'duplicate_domain'
        }, MAX_REJECTED_FILE_ROWS);
        continue;
      }

      const acceptedRecord = {
        source_record_id: normalized.source_record_id,
        domain: normalized.domain,
        name: normalized.name,
        industry: normalized.industry,
        employee_count: normalized.employee_count,
        country: normalized.country,
        city: normalized.city,
        website: normalized.website,
        linkedin_url: normalized.linkedin_url,
        includeReason: fitDecision.includeReason,
        matchedSignals: fitDecision.matchedSignals,
        fit_tier: fitDecision.fitTier,
        domain_tld: domainDecision.tld,
        raw_size: normalized.rawSize,
        size_confidence: normalized.sizeConfidence
      };
      acceptedRecord.score = scoreAcceptedRecord(acceptedRecord);

      counters.acceptedBeforeCap += 1;
      if (acceptedRecord.fit_tier === 'preferred') {
        counters.acceptedPreferredIndustry += 1;
      } else {
        counters.acceptedBorderline += 1;
      }
      incrementCount(acceptedIndustryCounts, acceptedRecord.industry ?? '(missing)');
      incrementCount(acceptedCountryCounts, acceptedRecord.country);
      incrementCount(acceptedTldCounts, acceptedRecord.domain_tld ?? '(missing)');
      incrementCount(acceptedSizeRangeCounts, acceptedRecord.raw_size ?? '(missing)');
      incrementCount(scoreDistribution, getScoreBucket(acceptedRecord.score));

      if (!acceptedRecord.linkedin_url) {
        incrementCount(suspiciousPatterns, 'missing_linkedin_url');
      }
      if (acceptedRecord.domain_tld && !PREFERRED_TLDS.has(acceptedRecord.domain_tld)) {
        incrementCount(suspiciousPatterns, 'non_preferred_tld');
      }
      if (acceptedRecord.size_confidence === 'range_midpoint') {
        incrementCount(suspiciousPatterns, 'employee_count_is_midpoint_estimate');
      }
      if (
        /outsourcing\/offshoring|computer networking|information technology and services|internet|marketing and advertising|management consulting|telecommunications|financial services/i.test(acceptedRecord.industry ?? '')
      ) {
        incrementCount(suspiciousPatterns, 'borderline_industry_still_passed');
      }

      updateTopAccepted(topAccepted, acceptedRecord);
    }
  } finally {
    await domainDedupeStore.close();
  }

  topAccepted.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.domain.localeCompare(right.domain);
  });

  counters.acceptedWritten = topAccepted.length;
  const writtenIndustryCounts = new Map();
  const writtenTldCounts = new Map();
  let writtenPreferredCount = 0;
  for (const record of topAccepted) {
    incrementCount(writtenIndustryCounts, record.industry ?? '(missing)');
    incrementCount(writtenTldCounts, record.domain_tld ?? '(missing)');
    if (record.fit_tier === 'preferred') {
      writtenPreferredCount += 1;
    }
  }
  const writtenPreferredShare =
    topAccepted.length > 0 ? Number((writtenPreferredCount / topAccepted.length).toFixed(4)) : 0;

  const filteredCsvStream = createWriteStream(outputCsvPath);
  writeCsvRow(filteredCsvStream, [
    'source_record_id',
    'domain',
    'name',
    'industry',
    'employee_count',
    'country',
    'city',
    'website',
    'linkedin_url'
  ]);
  for (const record of topAccepted) {
    writeCsvRow(filteredCsvStream, [
      record.source_record_id,
      record.domain,
      record.name,
      record.industry,
      record.employee_count,
      record.country,
      record.city,
      record.website,
      record.linkedin_url
    ]);
  }
  await new Promise((resolve, reject) => {
    filteredCsvStream.on('finish', resolve);
    filteredCsvStream.on('error', reject);
    filteredCsvStream.end();
  });

  const rejectedCsvStream = createWriteStream(rejectedCsvPath);
  writeCsvRow(rejectedCsvStream, [
    'source_record_id',
    'name',
    'domain',
    'country',
    'industry',
    'website',
    'size',
    'rejection_reason'
  ]);
  for (const record of rejectedSamples) {
    writeCsvRow(rejectedCsvStream, [
      record.source_record_id ?? null,
      record.name ?? null,
      record.domain ?? null,
      record.country ?? null,
      record.industry ?? null,
      record.website ?? null,
      record.size ?? null,
      record.rejection_reason
    ]);
  }
  await new Promise((resolve, reject) => {
    rejectedCsvStream.on('finish', resolve);
    rejectedCsvStream.on('error', reject);
    rejectedCsvStream.end();
  });

  const firstPassComparison = await loadFirstPassComparison();
  const secondPassComparison = await loadSecondPassComparison();
  const noisyIndustryLeaders = sortBuckets(acceptedIndustryCounts, 'industry').filter((entry) =>
    /outsourcing\/offshoring|computer networking|information technology and services|internet|marketing and advertising|management consulting|financial services|insurance|accounting|hospital|real estate|telecommunications/i.test(entry.industry)
  );
  const preferredShare =
    counters.acceptedBeforeCap > 0
      ? Number((counters.acceptedPreferredIndustry / counters.acceptedBeforeCap).toFixed(4))
      : 0;

  const estimatedPrecisionVsFirstPass = {
    verdict: noisyIndustryLeaders.length === 0 ? 'higher_precision_than_v1_and_v2' : 'better_but_still_some_noise',
    explanation:
      noisyIndustryLeaders.length === 0
        ? 'Noisy categories from earlier passes no longer show up among the accepted industry leaders.'
        : 'Precision improved again, but some noisy categories still survive in accepted industries and keep this below live-import quality.',
    firstPassAcceptedCandidates: firstPassComparison?.firstPassAcceptedCandidates ?? null,
    secondPassAcceptedCandidates: secondPassComparison?.secondPassAcceptedCandidates ?? null,
    thirdPassAcceptedCandidates: counters.acceptedBeforeCap
  };

  const noisyWrittenIndustries = sortBuckets(writtenIndustryCounts, 'industry').filter((entry) =>
    /outsourcing\/offshoring|computer networking|information technology and services|internet|marketing and advertising|management consulting|financial services|insurance|accounting|hospital|real estate|telecommunications|construction/i.test(entry.industry)
  );

  const recommendation =
    noisyWrittenIndustries.length === 0 && writtenPreferredShare >= 0.98 && counters.acceptedWritten === 1000
      ? 'live_import'
      : counters.acceptedBeforeCap >= 250
        ? 'tighten_again'
        : 'reject';

  const report = {
    input: {
      filePath: inputPath,
      compression,
      fileSizeBytes: (await stat(inputPath)).size,
      headers,
      firstFiveRows
    },
    employeeCountLogic:
      'Numeric counts are used directly. Size ranges like 11-50 are converted to midpoint employee_count values for import compatibility, but midpoint-derived counts are lower-confidence than exact numeric counts.',
    filters: {
      countries: Array.from(new Set(Array.from(TARGET_COUNTRIES.values()))),
      employeeRange: '11-200',
      acceptedRequiresClearB2BSoftwareSignal: true,
      maxAcceptedWritten: MAX_ACCEPTED_OUTPUT
    },
    counts: counters,
    rejectionCountsByReason: sortBuckets(rejectionReasonCounts, 'reason'),
    topAcceptedIndustries: sortBuckets(acceptedIndustryCounts, 'industry'),
    topAcceptedCountries: sortBuckets(acceptedCountryCounts, 'country'),
    topAcceptedDomainTlds: sortBuckets(acceptedTldCounts, 'tld'),
    topAcceptedSizeRanges: sortBuckets(acceptedSizeRangeCounts, 'size_range'),
    scoreDistribution: sortBuckets(scoreDistribution, 'score_bucket'),
    writtenOutputSummary: {
      writtenPreferredIndustryShare: writtenPreferredShare,
      topWrittenIndustries: sortBuckets(writtenIndustryCounts, 'industry'),
      topWrittenDomainTlds: sortBuckets(writtenTldCounts, 'tld')
    },
    sampleAcceptedCompanies: topAccepted.slice(0, MAX_ACCEPTED_SAMPLE).map(makeAcceptedSample),
    sampleRejectedCompanies: rejectedSamples.slice(0, MAX_REJECTED_SAMPLE),
    suspiciousPatterns: Array.from(suspiciousPatterns.entries())
      .sort((left, right) => right[1] - left[1])
      .map(([pattern, count]) => ({ pattern, count })),
    acceptedMix: {
      preferredIndustryCount: counters.acceptedPreferredIndustry,
      borderlineCount: counters.acceptedBorderline,
      preferredIndustryShare: preferredShare
    },
    estimatedPrecisionVsFirstPass,
    recommendation
  };

  await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    script: path.resolve('scripts', 'prepare-pdl-companies.mjs'),
    inputPath,
    compression,
    outputCsvPath,
    rejectedCsvPath,
    reportJsonPath,
    counts: counters,
    rejectionCountsByReason: report.rejectionCountsByReason.slice(0, 15),
    topAcceptedIndustries: report.topAcceptedIndustries.slice(0, 10),
    topAcceptedCountries: report.topAcceptedCountries,
    topAcceptedDomainTlds: report.topAcceptedDomainTlds,
    scoreDistribution: report.scoreDistribution,
    sampleAcceptedCompanies: report.sampleAcceptedCompanies.slice(0, 5),
    sampleRejectedCompanies: report.sampleRejectedCompanies.slice(0, 5),
    recommendation
  }, null, 2));
}

await main();
