export interface Client {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  domain: string;
  name: string | null;
  industry: string | null;
  employee_count: number | null;
  country: string | null;
  city: string | null;
  website: string | null;
  linkedin_url: string | null;
  icp_score: number | null;
  icp_score_updated_at: string | null;
  outreach_status: 'never_contacted' | 'in_sequence' | 'replied' | 'suppressed' | 'pipeline';
  suppressed: boolean;
  suppression_reason: string | null;
  last_seen_at: string | null;
  enriched_at: string | null;
  raw_enrichment: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  company_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  seniority: 'c_level' | 'vp' | 'director' | 'manager' | 'ic' | null;
  department: string | null;
  linkedin_url: string | null;
  verification_status: 'unverified' | 'valid' | 'risky' | 'invalid' | 'catch_all';
  verification_provider: string | null;
  verified_at: string | null;
  opted_out: boolean;
  opted_out_at: string | null;
  bounced: boolean;
  bounced_at: string | null;
  last_seen_at: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  client_id: string;
  name: string;
  angle: string;
  persona: string;
  icp_target: Record<string, unknown>;
  sequence_steps: number;
  sequence_delay_days: number;
  daily_send_limit: number | null;
  status: 'draft' | 'active' | 'paused' | 'archived';
  prompt_version: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  client_id: string;
  company_id: string;
  contact_id: string;
  campaign_id: string;
  icp_score_at_creation: number | null;
  status: 'pending_review' | 'approved' | 'rejected' | 'send_ready' | 'sent' | 'bounced' | 'replied' | 'suppressed';
  rejection_reason:
    | 'wrong_company'
    | 'wrong_contact'
    | 'wrong_angle'
    | 'bad_draft'
    | 'data_issue'
    | 'timing'
    | 'already_in_pipeline'
    | null;
  rejection_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  sequence_step: number;
  next_step_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Draft {
  id: string;
  lead_id: string;
  subject: string | null;
  body: string | null;
  model_version: string | null;
  prompt_version: string | null;
  signals_used: unknown;
  operator_decision: 'approved' | 'rejected' | 'edited' | null;
  edited_subject: string | null;
  edited_body: string | null;
  edit_diff_subject: string | null;
  edit_diff_body: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface SentMessage {
  id: string;
  client_id: string;
  lead_id: string;
  draft_id: string;
  contact_id: string;
  mailbox_id: string | null;
  from_address: string | null;
  subject: string | null;
  body: string | null;
  sending_provider: string | null;
  sent_at: string | null;
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  delivery_status: 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed';
  opened: boolean;
  opened_at: string | null;
  created_at: string;
}

export interface Reply {
  id: string;
  client_id: string;
  sent_message_id: string;
  contact_id: string;
  company_id: string;
  raw_content: string;
  classification: 'positive' | 'negative' | 'opt_out' | 'out_of_office' | 'question' | 'referral' | 'neutral' | null;
  classification_confidence: number | null;
  classification_model: string | null;
  routing_decision: 'auto_handled' | 'human_review' | 'escalated' | null;
  operator_action: string | null;
  suggested_response_subject: string | null;
  suggested_response: string | null;
  suggested_response_model: string | null;
  suggested_response_generated_at: string | null;
  reviewed_response_subject: string | null;
  reviewed_response_body: string | null;
  reviewed_response_status: 'approved' | 'edited' | 'rejected' | null;
  reviewed_response_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  handled: boolean;
  handled_at: string | null;
  received_at: string | null;
  created_at: string;
}

export interface Outcome {
  id: string;
  lead_id: string;
  contact_id: string;
  company_id: string;
  campaign_id: string;
  outcome_type:
    | 'meeting_booked'
    | 'meeting_held'
    | 'meeting_no_show'
    | 'deal_opened'
    | 'deal_closed'
    | 'deal_lost'
    | 'unsubscribed';
  notes: string | null;
  occurred_at: string | null;
  created_at: string;
}

export interface IcpDefinition {
  id: string;
  name: string;
  version: number;
  active: boolean;
  filters: Record<string, unknown>;
  scoring_weights: Record<string, number>;
  created_at: string;
}

export interface ImportBatch {
  id: string;
  entity_type: 'company' | 'contact';
  source_type: string;
  source_name: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed' | 'partial';
  total_rows: number;
  inserted_rows: number;
  updated_rows: number;
  skipped_rows: number;
  error_rows: number;
  dry_run: boolean;
  notes: string | null;
  error_summary: unknown;
  created_at: string;
}

export interface Mailbox {
  id: string;
  client_id: string;
  provider: 'google';
  email: string;
  display_name: string | null;
  is_active: boolean;
  status: 'connected' | 'unhealthy' | 'disabled';
  daily_send_limit: number;
  consecutive_auth_failures: number;
  last_auth_failed_at: string | null;
  last_send_at: string | null;
  gmail_history_id: string | null;
  messages_total: number | null;
  threads_total: number | null;
  last_connected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MailboxOauthToken {
  id: string;
  mailbox_id: string;
  provider: 'google';
  refresh_token_encrypted: string;
  scope: string | null;
  token_type: string | null;
  expiry_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanySource {
  id: string;
  company_id: string;
  source_type: string;
  source_name: string;
  source_record_id: string;
  source_batch_id: string;
  first_seen_at: string;
  last_seen_at: string;
  last_imported_at: string;
  raw_payload: Record<string, unknown> | null;
  created_at: string;
}

export interface ContactSource {
  id: string;
  contact_id: string;
  source_type: string;
  source_name: string;
  source_record_id: string;
  source_batch_id: string;
  first_seen_at: string;
  last_seen_at: string;
  last_imported_at: string;
  raw_payload: Record<string, unknown> | null;
  created_at: string;
}

export interface GmailSyncState {
  id: string;
  mailbox_id: string;
  last_sync_started_at: string | null;
  last_sync_completed_at: string | null;
  last_history_id: string | null;
  last_message_internal_at: string | null;
  last_error: string | null;
  sync_status: 'idle' | 'running' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface EmailThread {
  id: string;
  mailbox_id: string;
  gmail_thread_id: string;
  subject: string | null;
  participants: unknown;
  first_message_at: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailMessage {
  id: string;
  mailbox_id: string;
  email_thread_id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  direction: 'outbound' | 'inbound';
  from_address: string | null;
  to_addresses: unknown;
  cc_addresses: unknown;
  bcc_addresses: unknown;
  subject: string | null;
  snippet: string | null;
  text_body: string | null;
  html_body: string | null;
  gmail_internal_date: string | null;
  headers: unknown;
  sent_message_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface InboundMessageProcessing {
  id: string;
  email_message_id: string;
  status: 'pending' | 'ingested' | 'skipped' | 'error';
  matched_sent_message_id: string | null;
  matched_by: string | null;
  reply_id: string | null;
  notes: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface MailboxSendAttempt {
  id: string;
  mailbox_id: string | null;
  lead_id: string;
  contact_id: string;
  campaign_id: string;
  sent_message_id: string | null;
  status: 'sent' | 'blocked' | 'failed';
  failure_category: 'auth_failure' | 'rate_limit' | 'validation_error' | 'unknown' | 'governance' | null;
  error_code: string | null;
  error_message: string | null;
  attempted_at: string;
  created_at: string;
}
