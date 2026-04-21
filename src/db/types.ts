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
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  angle: string;
  persona: string;
  icp_target: Record<string, unknown>;
  sequence_steps: number;
  sequence_delay_days: number;
  status: 'draft' | 'active' | 'paused' | 'archived';
  prompt_version: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
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
  lead_id: string;
  draft_id: string;
  contact_id: string;
  from_address: string | null;
  subject: string | null;
  body: string | null;
  sending_provider: string | null;
  sent_at: string | null;
  delivery_status: 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed';
  opened: boolean;
  opened_at: string | null;
  created_at: string;
}

export interface Reply {
  id: string;
  sent_message_id: string;
  contact_id: string;
  company_id: string;
  raw_content: string;
  classification: 'positive' | 'negative' | 'opt_out' | 'out_of_office' | 'question' | 'referral' | 'neutral' | null;
  classification_confidence: number | null;
  classification_model: string | null;
  routing_decision: 'auto_handled' | 'human_review' | 'escalated' | null;
  operator_action: string | null;
  suggested_response: string | null;
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
