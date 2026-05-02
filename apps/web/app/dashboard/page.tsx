import { DataList, Panel, StatGrid } from '@/components/cards';
import { Shell } from '@/components/shell';
import { getClientOnboardingStatus } from '@/lib/data';
import { formatDateTime } from '@/lib/format';
import { requireClientSession } from '@/lib/session';

export default async function DashboardPage() {
  const session = await requireClientSession();
  const status = await getClientOnboardingStatus(session.clientId);
  const targetSegment = status.client.target_icp_notes?.trim() || 'Target segment not defined yet.';
  const campaignStatus =
    status.counts.active_campaigns > 0
      ? 'Campaign live'
      : status.counts.total_campaigns > 0
        ? 'Campaign prepared'
        : 'Pilot preparation';

  return (
    <Shell
      title="Pilot status"
      eyebrow="Client visibility"
      description="Track where your outbound pilot stands."
      aside={
        <Panel title="Operator notes" tone="accent">
          <p>
            This page is intentionally read-only. Status updates appear here without exposing
            any public campaign launch or send controls.
          </p>
        </Panel>
      }
    >
      {status.counts.total_campaigns === 0 &&
      status.counts.drafts_pending_review === 0 &&
      status.counts.replies_pending_review === 0 ? (
        <Panel title="Current state">
          <p>
            Your pilot is being prepared. Status updates will appear here once the campaign
            setup begins.
          </p>
        </Panel>
      ) : null}
      <StatGrid
        items={[
          { label: 'Campaign status', value: campaignStatus },
          { label: 'Prospects prepared', value: status.counts.send_ready },
          { label: 'Messages pending review', value: status.counts.drafts_pending_review },
          { label: 'Replies needing follow-up', value: status.counts.replies_pending_review }
        ]}
      />
      <Panel title="Target segment">
        <p className="status-copy">{targetSegment}</p>
      </Panel>
      <Panel title="Connected inbox status">
        <DataList
          rows={status.mailboxes.map((mailbox) => ({
            label: mailbox.email,
            value: (
              <span className="code">
                {mailbox.status} / send {mailbox.daily_send_count}/{mailbox.daily_send_limit} / auth failures {mailbox.consecutive_auth_failures} / last sync {formatDateTime(mailbox.last_sync_time)}
              </span>
            )
          }))}
          emptyMessage="No inbox connected yet."
        />
      </Panel>
      <Panel title="Current guardrail">
        <p>No send controls, campaign launch actions, or lead creation actions are exposed here yet.</p>
      </Panel>
    </Shell>
  );
}
