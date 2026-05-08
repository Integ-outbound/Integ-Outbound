export interface Client {
  id: string;
  slug: string;
  name: string;
  company_domain: string | null;
  operator_name: string | null;
  operator_email: string | null;
  service_type: string | null;
  target_icp_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PilotRequest {
  id: string;
  contact_name: string;
  contact_email: string;
  company_name: string;
  website: string;
  offer: string;
  desired_client_type: string;
  notes: string | null;
  status: 'new' | 'reviewed' | 'archived';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ManualTouch {
  id: string;
  client_id: string | null;
  lead_id: string | null;
  company_name: string | null;
  person_name: string | null;
  channel: 'email' | 'linkedin' | 'instagram' | 'facebook' | 'contact_form' | 'whatsapp' | 'other';
  message_body: string | null;
  status: 'planned' | 'sent' | 'replied' | 'interested' | 'rejected' | 'booked_call' | 'closed';
  sent_at: string | null;
  reply_at: string | null;
  notes: string | null;
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

export interface MailboxStatusView {
  id: string;
  client_id: string;
  email: string;
  provider: 'google';
  status: 'connected' | 'unhealthy' | 'disabled';
  is_active: boolean;
  last_sync_time: string | null;
  sync_health: 'healthy' | 'stale' | 'error' | 'never_synced' | 'running';
  daily_send_count: number;
  daily_send_limit: number;
  consecutive_auth_failures: number;
  last_auth_failed_at: string | null;
}

export interface ClientOnboardingStatus {
  client: Client;
  checklist: {
    client_profile_created: boolean;
    gmail_connected: boolean;
    calendar_connected: boolean;
    first_campaign_not_started: boolean;
    operator_review_pending: boolean;
  };
  counts: {
    total_campaigns: number;
    active_campaigns: number;
    drafts_pending_review: number;
    replies_pending_review: number;
    send_ready: number;
    failed_send_attempts: number;
  };
  mailboxes: MailboxStatusView[];
}

export interface OperatorStatus {
  client_id: string | null;
  activeCampaigns: number;
  pendingLeadReview: number;
  sendReady: number;
  unhandledReplies: number;
  connectedMailboxes: number;
  unhealthyMailboxes: number;
  newPilotRequests: number;
  sendsToday: number;
  bouncesToday: number;
  reviewStats: {
    countsByStatus: Record<string, number>;
    rejectionReasons: Record<string, number>;
    averageReviewTimeSeconds: number;
  };
}

export interface OperatorReviewQueues {
  client_id: string | null;
  lead_review_queue: Array<Record<string, unknown>>;
  reply_review_queue: Array<Record<string, unknown>>;
}

export interface OperatorSafety {
  client_id: string | null;
  send_ready_count: number;
  active_campaigns: number;
  mailboxes_without_client_id: number;
  campaigns_without_client_id: number;
  unhealthy_mailboxes: number;
  failed_send_attempts: number;
  sync_health: {
    healthy: number;
    stale: number;
    error: number;
    never_synced: number;
    running: number;
  };
  worker: {
    enabled: boolean;
  };
}

export interface OperatorClientStatuses {
  clients: Array<
    ClientOnboardingStatus & {
      connected_mailboxes: number;
    }
  >;
}

export interface OperatorPilotRequests {
  requests: PilotRequest[];
}

export interface OperatorManualTouches {
  manual_touches: ManualTouch[];
}

export interface OperatorCampaigns {
  client_id: string | null;
  campaigns: Array<
    Campaign & {
      client: Pick<Client, 'id' | 'name' | 'company_domain' | 'operator_email'>;
      lead_status_counts: Record<string, number>;
      sent_today: number;
      failed_send_attempts: number;
    }
  >;
}
