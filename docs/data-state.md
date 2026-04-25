# Data State

## Current Sources

- `pdl-company-universe-003`
  - label: `production_candidate_company_seed`
  - shape: company-only seed
  - status: imported into the KB
  - campaign readiness: not contact-ready

- `apollo-icp-test-001`
  - label: `test_only`
  - shape: small test company/contact set
  - status: useful for workflow validation only
  - campaign readiness: do not use as a production campaign source

- `local-sample`
  - label: `local_sample`
  - shape: tiny sample import data
  - status: local import validation only
  - campaign readiness: unusable for campaigns

## Current Reality

- `pdl-company-universe-003` is a company-only seed, not a launch-ready prospect list.
- The imported PDL companies are not paired with verified contacts.
- `apollo-icp-test-001` is test data and should remain test-only.
- No current contact source should be treated as production campaign-ready.

## Current Blocker

- The main data blocker is verified contacts for the chosen ICP, not more company volume.

## First Production Data Target

- `100` UK/US paid media and PPC agencies
- `1` founder, CEO, or operator contact per agency
- verified work email preferred
- no generic inboxes
- manual quality review before any lead creation

## What Not To Assume

- Do not treat the current `1,000` PDL companies as campaign-ready contacts.
- Do not treat Apollo test contacts as a production contact source.
- Do not start contact enrichment or lead creation against the PDL seed until a narrower first ICP list is sourced and reviewed.
