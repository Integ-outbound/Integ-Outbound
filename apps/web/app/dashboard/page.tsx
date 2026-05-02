import { DataList, Panel, StatGrid } from '@/components/cards';
import { Shell } from '@/components/shell';
import { getClientOnboardingStatus } from '@/lib/data';
import { formatDateTime } from '@/lib/format';
import { requireClientSession } from '@/lib/session';

export default async function DashboardPage() {
  const session = await requireClientSession();
  const status = await getClientOnboardingStatus(session.clientId);

  return (
    <Shell
      title={`${status.client.name} status dashboard`}
      eyebrow="Client visibility"
      description="This page is intentionally read-only. It surfaces mailbox health, campaign summary, and review workload without any launch or send controls."
      aside={
        <Panel title="What this page is for" tone="accent">
          <p>
            Use this surface to confirm mailbox connection, see whether review queues are building,
            and understand the current operating state without exposing sending actions to clients.
          </p>
        </Panel>
      }
    >
      <StatGrid
        items={[
          { label: 'Active campaigns', value: status.counts.active_campaigns, hint: 'Operator-controlled only' },
          { label: 'Total campaigns', value: status.counts.total_campaigns },
          { label: 'Drafts pending review', value: status.counts.drafts_pending_review },
          { label: 'Replies pending review', value: status.counts.replies_pending_review }
        ]}
      />
      <Panel title="Connected mailbox status">
        <DataList
          rows={status.mailboxes.map((mailbox) => ({
            label: mailbox.email,
            value: (
              <span className="code">
                {mailbox.status} / send {mailbox.daily_send_count}/{mailbox.daily_send_limit} / auth failures {mailbox.consecutive_auth_failures} / last sync {formatDateTime(mailbox.last_sync_time)}
              </span>
            )
          }))}
          emptyMessage="No mailbox connected yet."
        />
      </Panel>
      <Panel title="Current guardrail">
        <p>No send controls, campaign launch actions, or lead creation actions are exposed here yet.</p>
      </Panel>
    </Shell>
  );
}
