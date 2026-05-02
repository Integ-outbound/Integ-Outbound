import Link from 'next/link';

import { Checklist, DataList, Panel, StatGrid } from '@/components/cards';
import { Shell } from '@/components/shell';
import { formatDateTime } from '@/lib/format';
import { getClientOnboardingStatus } from '@/lib/data';
import { requireClientSession } from '@/lib/session';

export default async function OnboardingPage({
  searchParams
}: {
  searchParams: Promise<{ signup?: string; gmail?: string }>;
}) {
  const session = await requireClientSession();
  const status = await getClientOnboardingStatus(session.clientId);
  const params = await searchParams;

  return (
    <Shell
      title="Pilot onboarding"
      eyebrow="Setup"
      description="Complete the setup needed to prepare your outbound pilot."
      aside={
        <>
          <Panel title="Continue setup" tone="accent">
            <div className="button-row">
              <Link className="secondary-button" href="/onboarding/connect-gmail">
                Inbox setup
              </Link>
              <Link className="secondary-button" href="/onboarding/calendar">
                Calendar info
              </Link>
              <Link className="primary-button" href="/dashboard">
                View pilot status
              </Link>
            </div>
          </Panel>
          <Panel title="Inbox setup">
            <DataList
              rows={status.mailboxes.map((mailbox) => ({
                label: mailbox.email,
                value: (
                  <span className="code">
                    {mailbox.status} / sync {mailbox.sync_health} / last sync {formatDateTime(mailbox.last_sync_time)}
                  </span>
                )
              }))}
              emptyMessage="No inbox connected yet. If inbox access is needed, it can be connected securely through Google."
            />
          </Panel>
        </>
      }
    >
      {params.signup === 'created' ? (
        <div className="banner banner-success">Pilot onboarding is ready. Continue with setup.</div>
      ) : null}
      {params.gmail === 'connected' ? (
        <div className="banner banner-success">Inbox setup completed for this client record.</div>
      ) : null}
      <Panel title="Checklist">
        <Checklist
          items={[
            {
              label: 'Agency profile submitted',
              done: status.checklist.client_profile_created
            },
            {
              label: 'Target client segment defined',
              done: Boolean(status.client.target_icp_notes?.trim()),
              note: 'A clear target segment keeps the pilot campaign focused.'
            },
            {
              label: 'Outreach angle approved',
              done:
                status.counts.total_campaigns > 0 ||
                status.counts.drafts_pending_review > 0 ||
                status.counts.send_ready > 0 ||
                status.counts.replies_pending_review > 0,
              note: 'The campaign angle is reviewed before the pilot moves forward.'
            },
            {
              label: 'Inbox setup completed if needed',
              done: status.checklist.gmail_connected,
              note: 'If inbox access is needed, it is connected securely through Google. We never ask for your password.'
            },
            {
              label: 'Campaign pending review',
              done: status.checklist.operator_review_pending,
              note: 'The pilot is reviewed before it moves into the next stage.'
            }
          ]}
        />
      </Panel>
      <Panel title="What happens here">
        <dl className="detail-list">
          <div>
            <dt>Inbox access</dt>
            <dd>If inbox access is needed, it is connected securely through Google. We never ask for your password.</dd>
          </div>
          <div>
            <dt>Calendar support</dt>
            <dd>Calendar support is coming later. For now, calls can be booked through your existing scheduling link.</dd>
          </div>
        </dl>
      </Panel>
      <StatGrid
        items={[
          { label: 'Connected inboxes', value: status.mailboxes.length },
          { label: 'Messages pending review', value: status.counts.drafts_pending_review },
          { label: 'Replies needing follow-up', value: status.counts.replies_pending_review },
          { label: 'Prospects prepared', value: status.counts.send_ready, hint: 'Tracked toward pilot readiness' }
        ]}
      />
    </Shell>
  );
}
