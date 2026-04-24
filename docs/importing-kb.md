# KB Import Guide

This backend is import-ready for large company and contact CSV loads through the CLI. Imports are chunked, idempotent on canonical keys, conservatively merged, and tracked in `import_batches`.

## Workflow

1. Run the preflight integrity check:

```powershell
npm run import:preflight
```

2. Dry-run the companies file:

```powershell
npm run import:companies -- --file .\docs\samples\sample-companies.csv --source-type csv --source-name local-sample --dry-run
```

3. Run the real companies import:

```powershell
npm run import:companies -- --file .\docs\samples\sample-companies.csv --source-type csv --source-name local-sample --chunk-size 500
```

4. Dry-run the contacts file:

```powershell
npm run import:contacts -- --file .\docs\samples\sample-contacts.csv --source-type csv --source-name local-sample --dry-run
```

5. Run the real contacts import:

```powershell
npm run import:contacts -- --file .\docs\samples\sample-contacts.csv --source-type csv --source-name local-sample --chunk-size 500
```

6. Inspect status:

```powershell
npm run import:status -- --batch-id <batch-id>
```

The same batch can also be fetched through the protected API:

```text
GET /api/v1/import-batches/:id
```

## Required Columns

### Companies CSV

Required:

- `domain`

Allowed optional columns:

- `source_record_id`
- `name`
- `industry`
- `employee_count`
- `country`
- `city`
- `website`
- `linkedin_url`
- `suppressed`
- `suppression_reason`

### Contacts CSV

Required headers:

- `email`
- `company_id`
- `company_domain`

Each row must contain at least one of:

- `company_id`
- `company_domain`

Allowed optional columns:

- `source_record_id`
- `first_name`
- `last_name`
- `title`
- `seniority`
- `department`
- `linkedin_url`
- `verification_status`

## Import Behavior

- Domains are normalized before deduplication.
- Emails are normalized before deduplication.
- Contacts without a safe company link are rejected.
- Existing non-null canonical fields are preserved.
- Existing suppressed / opted-out / bounced state is never cleared by import.
- Re-importing the same file does not create duplicate companies or contacts.
- Source attribution is stored in `company_sources` and `contact_sources`.
- Dry-run creates an `import_batches` record but does not mutate canonical records.

## Sample Files

- Template companies CSV: [docs/samples/companies-template.csv](samples/companies-template.csv)
- Template contacts CSV: [docs/samples/contacts-template.csv](samples/contacts-template.csv)
- Safe local companies sample: [docs/samples/sample-companies.csv](samples/sample-companies.csv)
- Safe local contacts sample: [docs/samples/sample-contacts.csv](samples/sample-contacts.csv)
