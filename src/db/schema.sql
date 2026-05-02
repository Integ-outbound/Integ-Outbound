CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY,
  domain text UNIQUE NOT NULL,
  name text,
  industry text,
  employee_count integer,
  country text,
  city text,
  website text,
  linkedin_url text,
  icp_score numeric CHECK (icp_score IS NULL OR (icp_score >= 0.0 AND icp_score <= 1.0)),
  icp_score_updated_at timestamptz,
  outreach_status text NOT NULL DEFAULT 'never_contacted' CHECK (
    outreach_status IN ('never_contacted', 'in_sequence', 'replied', 'suppressed', 'pipeline')
  ),
  suppressed boolean NOT NULL DEFAULT false,
  suppression_reason text,
  last_seen_at timestamptz,
  enriched_at timestamptz,
  raw_enrichment jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email text UNIQUE,
  first_name text,
  last_name text,
  title text,
  seniority text CHECK (seniority IS NULL OR seniority IN ('c_level', 'vp', 'director', 'manager', 'ic')),
  department text,
  linkedin_url text,
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (
    verification_status IN ('unverified', 'valid', 'risky', 'invalid', 'catch_all')
  ),
  verification_provider text,
  verified_at timestamptz,
  opted_out boolean NOT NULL DEFAULT false,
  opted_out_at timestamptz,
  bounced boolean NOT NULL DEFAULT false,
  bounced_at timestamptz,
  last_seen_at timestamptz,
  source text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  company_domain text,
  operator_name text,
  operator_email text,
  service_type text,
  target_icp_notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pilot_requests (
  id uuid PRIMARY KEY,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  company_name text NOT NULL,
  website text NOT NULL,
  offer text NOT NULL,
  desired_client_type text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'archived')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

INSERT INTO clients (id, slug, name, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'default',
  'Default Client',
  true
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES clients(id),
  name text NOT NULL,
  angle text NOT NULL,
  persona text NOT NULL,
  icp_target jsonb NOT NULL,
  sequence_steps integer NOT NULL DEFAULT 3 CHECK (sequence_steps >= 1),
  sequence_delay_days integer NOT NULL DEFAULT 3 CHECK (sequence_delay_days >= 0),
  daily_send_limit integer CHECK (daily_send_limit IS NULL OR daily_send_limit >= 1),
  status text NOT NULL CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  prompt_version text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES clients(id),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  icp_score_at_creation numeric CHECK (
    icp_score_at_creation IS NULL OR (icp_score_at_creation >= 0.0 AND icp_score_at_creation <= 1.0)
  ),
  status text NOT NULL CHECK (
    status IN ('pending_review', 'approved', 'rejected', 'send_ready', 'sent', 'bounced', 'replied', 'suppressed')
  ),
  rejection_reason text CHECK (
    rejection_reason IS NULL OR rejection_reason IN (
      'wrong_company',
      'wrong_contact',
      'wrong_angle',
      'bad_draft',
      'data_issue',
      'timing',
      'already_in_pipeline'
    )
  ),
  rejection_notes text,
  reviewed_by text,
  reviewed_at timestamptz,
  sequence_step integer NOT NULL DEFAULT 1 CHECK (sequence_step >= 1),
  next_step_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drafts (
  id uuid PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  subject text,
  body text,
  model_version text,
  prompt_version text,
  signals_used jsonb,
  operator_decision text CHECK (operator_decision IS NULL OR operator_decision IN ('approved', 'rejected', 'edited')),
  edited_subject text,
  edited_body text,
  edit_diff_subject text,
  edit_diff_body text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sent_messages (
  id uuid PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES clients(id),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  draft_id uuid NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  from_address text,
  subject text,
  body text,
  sending_provider text,
  sent_at timestamptz,
  delivery_status text NOT NULL CHECK (
    delivery_status IN ('queued', 'sent', 'delivered', 'bounced', 'failed')
  ),
  opened boolean NOT NULL DEFAULT false,
  opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS replies (
  id uuid PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES clients(id),
  sent_message_id uuid NOT NULL REFERENCES sent_messages(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  raw_content text NOT NULL,
  classification text CHECK (
    classification IS NULL OR classification IN (
      'positive',
      'negative',
      'opt_out',
      'out_of_office',
      'question',
      'referral',
      'neutral'
    )
  ),
  classification_confidence numeric CHECK (
    classification_confidence IS NULL OR (classification_confidence >= 0.0 AND classification_confidence <= 1.0)
  ),
  classification_model text,
  routing_decision text CHECK (
    routing_decision IS NULL OR routing_decision IN ('auto_handled', 'human_review', 'escalated')
  ),
  operator_action text,
  suggested_response_subject text,
  suggested_response text,
  suggested_response_model text,
  suggested_response_generated_at timestamptz,
  reviewed_response_subject text,
  reviewed_response_body text,
  reviewed_response_status text CHECK (
    reviewed_response_status IS NULL OR reviewed_response_status IN ('approved', 'edited', 'rejected')
  ),
  reviewed_response_notes text,
  reviewed_by text,
  reviewed_at timestamptz,
  handled boolean NOT NULL DEFAULT false,
  handled_at timestamptz,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outcomes (
  id uuid PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  outcome_type text NOT NULL CHECK (
    outcome_type IN (
      'meeting_booked',
      'meeting_held',
      'meeting_no_show',
      'deal_opened',
      'deal_closed',
      'deal_lost',
      'unsubscribed'
    )
  ),
  notes text,
  occurred_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS icp_definitions (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  active boolean NOT NULL DEFAULT true,
  filters jsonb NOT NULL,
  scoring_weights jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_events (
  id uuid PRIMARY KEY,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  payload jsonb NOT NULL,
  triggered_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS import_batches (
  id uuid PRIMARY KEY,
  entity_type text NOT NULL CHECK (entity_type IN ('company', 'contact')),
  source_type text NOT NULL,
  source_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT NOW(),
  completed_at timestamptz,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'partial')),
  total_rows integer NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
  inserted_rows integer NOT NULL DEFAULT 0 CHECK (inserted_rows >= 0),
  updated_rows integer NOT NULL DEFAULT 0 CHECK (updated_rows >= 0),
  skipped_rows integer NOT NULL DEFAULT 0 CHECK (skipped_rows >= 0),
  error_rows integer NOT NULL DEFAULT 0 CHECK (error_rows >= 0),
  dry_run boolean NOT NULL DEFAULT false,
  notes text,
  error_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mailboxes (
  id uuid PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES clients(id),
  provider text NOT NULL CHECK (provider IN ('google')),
  email text NOT NULL,
  display_name text,
  is_active boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'unhealthy', 'disabled')),
  daily_send_limit integer NOT NULL DEFAULT 50 CHECK (daily_send_limit >= 1),
  consecutive_auth_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_auth_failures >= 0),
  last_auth_failed_at timestamptz,
  last_send_at timestamptz,
  gmail_history_id text,
  messages_total integer,
  threads_total integer,
  last_connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (provider, email)
);

CREATE TABLE IF NOT EXISTS mailbox_oauth_tokens (
  id uuid PRIMARY KEY,
  mailbox_id uuid NOT NULL UNIQUE REFERENCES mailboxes(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google')),
  refresh_token_encrypted text NOT NULL,
  scope text,
  token_type text,
  expiry_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_sources (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_name text NOT NULL,
  source_record_id text NOT NULL,
  source_batch_id uuid NOT NULL REFERENCES import_batches(id),
  first_seen_at timestamptz NOT NULL DEFAULT NOW(),
  last_seen_at timestamptz NOT NULL DEFAULT NOW(),
  last_imported_at timestamptz NOT NULL DEFAULT NOW(),
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, source_type, source_name, source_record_id)
);

CREATE TABLE IF NOT EXISTS contact_sources (
  id uuid PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_name text NOT NULL,
  source_record_id text NOT NULL,
  source_batch_id uuid NOT NULL REFERENCES import_batches(id),
  first_seen_at timestamptz NOT NULL DEFAULT NOW(),
  last_seen_at timestamptz NOT NULL DEFAULT NOW(),
  last_imported_at timestamptz NOT NULL DEFAULT NOW(),
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (contact_id, source_type, source_name, source_record_id)
);

CREATE TABLE IF NOT EXISTS gmail_sync_state (
  id uuid PRIMARY KEY,
  mailbox_id uuid NOT NULL UNIQUE REFERENCES mailboxes(id) ON DELETE CASCADE,
  last_sync_started_at timestamptz,
  last_sync_completed_at timestamptz,
  last_history_id text,
  last_message_internal_at timestamptz,
  last_error text,
  sync_status text NOT NULL DEFAULT 'idle' CHECK (
    sync_status IN ('idle', 'running', 'completed', 'failed')
  ),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_threads (
  id uuid PRIMARY KEY,
  mailbox_id uuid NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  gmail_thread_id text NOT NULL,
  subject text,
  participants jsonb,
  first_message_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (mailbox_id, gmail_thread_id)
);

CREATE TABLE IF NOT EXISTS email_messages (
  id uuid PRIMARY KEY,
  mailbox_id uuid NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  email_thread_id uuid NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  gmail_message_id text NOT NULL,
  gmail_thread_id text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  from_address text,
  to_addresses jsonb,
  cc_addresses jsonb,
  bcc_addresses jsonb,
  subject text,
  snippet text,
  text_body text,
  html_body text,
  gmail_internal_date timestamptz,
  headers jsonb,
  sent_message_id uuid REFERENCES sent_messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (mailbox_id, gmail_message_id)
);

CREATE TABLE IF NOT EXISTS inbound_message_processing (
  id uuid PRIMARY KEY,
  email_message_id uuid NOT NULL UNIQUE REFERENCES email_messages(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'ingested', 'skipped', 'error')),
  matched_sent_message_id uuid REFERENCES sent_messages(id) ON DELETE SET NULL,
  matched_by text,
  reply_id uuid REFERENCES replies(id) ON DELETE SET NULL,
  notes text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mailbox_send_attempts (
  id uuid PRIMARY KEY,
  mailbox_id uuid REFERENCES mailboxes(id) ON DELETE SET NULL,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  sent_message_id uuid REFERENCES sent_messages(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('sent', 'blocked', 'failed')),
  failure_category text CHECK (
    failure_category IS NULL OR failure_category IN ('auth_failure', 'rate_limit', 'validation_error', 'unknown', 'governance')
  ),
  error_code text,
  error_message text,
  attempted_at timestamptz NOT NULL DEFAULT NOW(),
  created_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS daily_send_limit integer CHECK (daily_send_limit IS NULL OR daily_send_limit >= 1);

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS company_domain text;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS operator_name text;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS operator_email text;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS service_type text;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS target_icp_notes text;

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id);

UPDATE campaigns
SET client_id = '00000000-0000-0000-0000-000000000001'
WHERE client_id IS NULL;

ALTER TABLE campaigns
  ALTER COLUMN client_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE campaigns
  ALTER COLUMN client_id SET NOT NULL;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id);

UPDATE leads l
SET client_id = COALESCE(c.client_id, '00000000-0000-0000-0000-000000000001')
FROM campaigns c
WHERE l.campaign_id = c.id
  AND l.client_id IS NULL;

UPDATE leads
SET client_id = '00000000-0000-0000-0000-000000000001'
WHERE client_id IS NULL;

ALTER TABLE leads
  ALTER COLUMN client_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE leads
  ALTER COLUMN client_id SET NOT NULL;

ALTER TABLE sent_messages
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id);

UPDATE sent_messages sm
SET client_id = COALESCE(l.client_id, '00000000-0000-0000-0000-000000000001')
FROM leads l
WHERE sm.lead_id = l.id
  AND sm.client_id IS NULL;

UPDATE sent_messages
SET client_id = '00000000-0000-0000-0000-000000000001'
WHERE client_id IS NULL;

ALTER TABLE sent_messages
  ALTER COLUMN client_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE sent_messages
  ALTER COLUMN client_id SET NOT NULL;

ALTER TABLE sent_messages
  ADD COLUMN IF NOT EXISTS mailbox_id uuid REFERENCES mailboxes(id) ON DELETE SET NULL;

ALTER TABLE sent_messages
  ADD COLUMN IF NOT EXISTS gmail_message_id text;

ALTER TABLE sent_messages
  ADD COLUMN IF NOT EXISTS gmail_thread_id text;

ALTER TABLE mailboxes
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id);

UPDATE mailboxes
SET client_id = '00000000-0000-0000-0000-000000000001'
WHERE client_id IS NULL;

ALTER TABLE mailboxes
  ALTER COLUMN client_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE mailboxes
  ALTER COLUMN client_id SET NOT NULL;

ALTER TABLE mailboxes
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE mailboxes
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'unhealthy', 'disabled'));

ALTER TABLE mailboxes
  ADD COLUMN IF NOT EXISTS daily_send_limit integer NOT NULL DEFAULT 50 CHECK (daily_send_limit >= 1);

ALTER TABLE mailboxes
  ADD COLUMN IF NOT EXISTS consecutive_auth_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_auth_failures >= 0);

ALTER TABLE mailboxes
  ADD COLUMN IF NOT EXISTS last_auth_failed_at timestamptz;

ALTER TABLE mailboxes
  ADD COLUMN IF NOT EXISTS last_send_at timestamptz;

ALTER TABLE replies
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id);

UPDATE replies r
SET client_id = COALESCE(sm.client_id, '00000000-0000-0000-0000-000000000001')
FROM sent_messages sm
WHERE r.sent_message_id = sm.id
  AND r.client_id IS NULL;

UPDATE replies
SET client_id = '00000000-0000-0000-0000-000000000001'
WHERE client_id IS NULL;

ALTER TABLE replies
  ALTER COLUMN client_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE replies
  ALTER COLUMN client_id SET NOT NULL;

ALTER TABLE replies
  ADD COLUMN IF NOT EXISTS suggested_response_subject text;

ALTER TABLE replies
  ADD COLUMN IF NOT EXISTS suggested_response_model text;

ALTER TABLE replies
  ADD COLUMN IF NOT EXISTS suggested_response_generated_at timestamptz;

ALTER TABLE replies
  ADD COLUMN IF NOT EXISTS reviewed_response_subject text;

ALTER TABLE replies
  ADD COLUMN IF NOT EXISTS reviewed_response_body text;

ALTER TABLE replies
  ADD COLUMN IF NOT EXISTS reviewed_response_status text CHECK (
    reviewed_response_status IS NULL OR reviewed_response_status IN ('approved', 'edited', 'rejected')
  );

ALTER TABLE replies
  ADD COLUMN IF NOT EXISTS reviewed_response_notes text;

ALTER TABLE replies
  ADD COLUMN IF NOT EXISTS reviewed_by text;

ALTER TABLE replies
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);
CREATE INDEX IF NOT EXISTS idx_companies_country ON companies(country);
CREATE INDEX IF NOT EXISTS idx_companies_employee_count ON companies(employee_count);
CREATE INDEX IF NOT EXISTS idx_companies_suppressed ON companies(suppressed);
CREATE INDEX IF NOT EXISTS idx_companies_last_seen_at ON companies(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_verification_status ON contacts(verification_status);
CREATE INDEX IF NOT EXISTS idx_contacts_seniority ON contacts(seniority);
CREATE INDEX IF NOT EXISTS idx_contacts_title ON contacts(title);
CREATE INDEX IF NOT EXISTS idx_contacts_opted_out ON contacts(opted_out);
CREATE INDEX IF NOT EXISTS idx_contacts_bounced ON contacts(bounced);
CREATE INDEX IF NOT EXISTS idx_contacts_last_seen_at ON contacts(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_client_id ON campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_pilot_requests_status_created_at ON pilot_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_client_id_status ON leads(client_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id ON leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_replies_classification ON replies(classification);
CREATE INDEX IF NOT EXISTS idx_replies_client_id_handled ON replies(client_id, handled);
CREATE INDEX IF NOT EXISTS idx_sent_messages_sent_at ON sent_messages(sent_at);
CREATE INDEX IF NOT EXISTS idx_sent_messages_client_id ON sent_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_outcome_type ON outcomes(outcome_type);
CREATE INDEX IF NOT EXISTS idx_import_batches_status_started_at ON import_batches(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_sources_source_batch_id ON company_sources(source_batch_id);
CREATE INDEX IF NOT EXISTS idx_contact_sources_source_batch_id ON contact_sources(source_batch_id);
CREATE INDEX IF NOT EXISTS idx_mailboxes_provider_email ON mailboxes(provider, email);
CREATE INDEX IF NOT EXISTS idx_mailboxes_client_id ON mailboxes(client_id);
CREATE INDEX IF NOT EXISTS idx_mailbox_oauth_tokens_mailbox_id ON mailbox_oauth_tokens(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_gmail_message_id ON sent_messages(gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_gmail_thread_id ON sent_messages(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_mailbox_id ON sent_messages(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_gmail_sync_state_mailbox_id ON gmail_sync_state(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_mailbox_thread ON email_threads(mailbox_id, gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_mailbox_message ON email_messages(mailbox_id, gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_mailbox_thread ON email_messages(mailbox_id, gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_direction ON email_messages(direction);
CREATE INDEX IF NOT EXISTS idx_email_messages_sent_message_id ON email_messages(sent_message_id);
CREATE INDEX IF NOT EXISTS idx_inbound_message_processing_status ON inbound_message_processing(status);
CREATE INDEX IF NOT EXISTS idx_inbound_message_processing_sent_message_id ON inbound_message_processing(matched_sent_message_id);
CREATE INDEX IF NOT EXISTS idx_mailbox_send_attempts_mailbox_attempted_at ON mailbox_send_attempts(mailbox_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_mailbox_send_attempts_campaign_attempted_at ON mailbox_send_attempts(campaign_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_mailbox_send_attempts_lead_id ON mailbox_send_attempts(lead_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_company_domain_unique
  ON clients ((lower(company_domain)))
  WHERE company_domain IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'companies_set_updated_at') THEN
    CREATE TRIGGER companies_set_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'contacts_set_updated_at') THEN
    CREATE TRIGGER contacts_set_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'campaigns_set_updated_at') THEN
    CREATE TRIGGER campaigns_set_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'clients_set_updated_at') THEN
    CREATE TRIGGER clients_set_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'pilot_requests_set_updated_at') THEN
    CREATE TRIGGER pilot_requests_set_updated_at
    BEFORE UPDATE ON pilot_requests
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'leads_set_updated_at') THEN
    CREATE TRIGGER leads_set_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'mailboxes_set_updated_at') THEN
    CREATE TRIGGER mailboxes_set_updated_at
    BEFORE UPDATE ON mailboxes
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'mailbox_oauth_tokens_set_updated_at') THEN
    CREATE TRIGGER mailbox_oauth_tokens_set_updated_at
    BEFORE UPDATE ON mailbox_oauth_tokens
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'gmail_sync_state_set_updated_at') THEN
    CREATE TRIGGER gmail_sync_state_set_updated_at
    BEFORE UPDATE ON gmail_sync_state
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'email_threads_set_updated_at') THEN
    CREATE TRIGGER email_threads_set_updated_at
    BEFORE UPDATE ON email_threads
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'email_messages_set_updated_at') THEN
    CREATE TRIGGER email_messages_set_updated_at
    BEFORE UPDATE ON email_messages
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'inbound_message_processing_set_updated_at') THEN
    CREATE TRIGGER inbound_message_processing_set_updated_at
    BEFORE UPDATE ON inbound_message_processing
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
