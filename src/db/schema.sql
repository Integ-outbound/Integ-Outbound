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
  source text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  angle text NOT NULL,
  persona text NOT NULL,
  icp_target jsonb NOT NULL,
  sequence_steps integer NOT NULL DEFAULT 3 CHECK (sequence_steps >= 1),
  sequence_delay_days integer NOT NULL DEFAULT 3 CHECK (sequence_delay_days >= 0),
  status text NOT NULL CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  prompt_version text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY,
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
  suggested_response text,
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

CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id ON leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_replies_classification ON replies(classification);
CREATE INDEX IF NOT EXISTS idx_sent_messages_sent_at ON sent_messages(sent_at);
CREATE INDEX IF NOT EXISTS idx_outcomes_outcome_type ON outcomes(outcome_type);

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

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'leads_set_updated_at') THEN
    CREATE TRIGGER leads_set_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
