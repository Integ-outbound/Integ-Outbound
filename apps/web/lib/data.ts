import 'server-only';

import { fetchBackendJson } from '@/lib/backend';
import type {
  Client,
  ClientOnboardingStatus,
  MailboxStatusView,
  OperatorClientStatuses,
  OperatorPilotRequests,
  OperatorReviewQueues,
  OperatorSafety,
  OperatorStatus
} from '@/lib/types';

export async function getClientOnboardingStatus(clientId: string): Promise<ClientOnboardingStatus> {
  return fetchBackendJson<ClientOnboardingStatus>(`/api/v1/clients/${clientId}/onboarding-status`);
}

export async function getClientMailboxes(clientId: string): Promise<MailboxStatusView[]> {
  return fetchBackendJson<MailboxStatusView[]>(`/api/v1/clients/${clientId}/mailboxes`);
}

export async function getClientRecord(clientId: string): Promise<Client> {
  return fetchBackendJson<Client>(`/api/v1/clients/${clientId}`);
}

export async function getOperatorStatus(clientId?: string): Promise<OperatorStatus> {
  const suffix = clientId ? `?client_id=${encodeURIComponent(clientId)}` : '';
  return fetchBackendJson<OperatorStatus>(`/api/v1/operator/status${suffix}`);
}

export async function getOperatorReview(clientId?: string): Promise<OperatorReviewQueues> {
  const suffix = clientId ? `?client_id=${encodeURIComponent(clientId)}` : '';
  return fetchBackendJson<OperatorReviewQueues>(`/api/v1/operator/review${suffix}`);
}

export async function getOperatorSafety(clientId?: string): Promise<OperatorSafety> {
  const suffix = clientId ? `?client_id=${encodeURIComponent(clientId)}` : '';
  return fetchBackendJson<OperatorSafety>(`/api/v1/operator/safety${suffix}`);
}

export async function getOperatorClientStatuses(): Promise<OperatorClientStatuses> {
  return fetchBackendJson<OperatorClientStatuses>('/api/v1/operator/clients');
}

export async function getOperatorPilotRequests(): Promise<OperatorPilotRequests> {
  return fetchBackendJson<OperatorPilotRequests>('/api/v1/operator/pilot-requests');
}
