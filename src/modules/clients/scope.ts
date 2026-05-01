import { Reply } from '../../db/types';

export const DEFAULT_CLIENT_ID = '00000000-0000-0000-0000-000000000001';

const HUMAN_REVIEW_REPLY_CLASSIFICATIONS = new Set<
  NonNullable<Reply['classification']>
>(['positive', 'question', 'referral', 'neutral']);

export function resolveClientId(clientId?: string | null): string {
  return clientId?.trim() || DEFAULT_CLIENT_ID;
}

export function appendClientScope(
  conditions: string[],
  params: unknown[],
  qualifiedColumn: string,
  clientId?: string
): void {
  if (!clientId) {
    return;
  }

  params.push(resolveClientId(clientId));
  conditions.push(`${qualifiedColumn} = $${params.length}`);
}

export function canReassignOwnedRecord(
  currentClientId: string,
  nextClientId: string
): boolean {
  return currentClientId === nextClientId || currentClientId === DEFAULT_CLIENT_ID;
}

export function shouldGenerateSuggestedReply(
  classification: Reply['classification'],
  routingDecision: Reply['routing_decision']
): classification is NonNullable<Reply['classification']> {
  return (
    routingDecision === 'human_review' &&
    classification !== null &&
    HUMAN_REVIEW_REPLY_CLASSIFICATIONS.has(classification)
  );
}
