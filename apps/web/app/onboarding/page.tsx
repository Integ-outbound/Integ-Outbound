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
      title={`${status.client.name} onboarding`}
      eyebrow="Checklist"
      description="This flow is intentionally limited to profile setup, mailbox connection, and status visibility. Clients still do not get launch or send controls here."
      aside={
        <>
          <Panel title="Next steps" tone="accent">
            <div className="button-row">
              <Link className="secondary-button" href="/onboarding/connect-gmail">
                Connect Gmail
              </Link>
              <Link className="secondary-button" href="/onboarding/calendar">
                Calendar placeholder
              </Link>
              <Link className="primary-button" href="/dashboard">
                View status dashboard
              </Link>
            </div>
          </Panel>
          <Panel title="Mailbox snapshot">
            <DataList
              rows={status.mailboxes.map((mailbox) => ({
                label: mailbox.email,
                value: (
                  <span className="code">
                    {mailbox.status} / sync {mailbox.sync_health} / last sync {formatDateTime(mailbox.last_sync_time)}
                  </span>
                )
              }))}
              emptyMessage="No mailbox connected yet. Start with Google OAuth before expecting any sending or reply visibility."
            />
          </Panel>
        </>
      }
    >
      {params.signup === 'created' ? (
        <div className="banner banner-success">Client profile created. Continue by connecting Gmail.</div>
      ) : null}
      {params.gmail === 'connected' ? (
        <div className="banner banner-success">Gmail connected successfully to this client record.</div>
      ) : null}
      <Panel title="Checklist">
        <Checklist
          items={[
            { label: 'Client profile created', done: status.checklist.client_profile_created },
            { label: 'Gmail connected', done: status.checklist.gmail_connected },
            {
              label: 'Calendar connected',
              done: status.checklist.calendar_connected,
              note: 'Google Calendar is intentionally a placeholder in this MVP.'
            },
            {
              label: 'First campaign not started',
              done: status.checklist.first_campaign_not_started,
              note: 'Campaign launch is still operator-controlled.'
            },
            {
              label: 'Operator review pending',
              done: !status.checklist.operator_review_pending,
              note: 'This stays pending until the operator moves onboarding beyond setup.'
            }
          ]}
        />
      </Panel>
      <StatGrid
        items={[
          { label: 'Mailboxes', value: status.mailboxes.length },
          { label: 'Pending drafts', value: status.counts.drafts_pending_review },
          { label: 'Pending replies', value: status.counts.replies_pending_review },
          {
            label: 'Send-ready leads',
            value: status.counts.send_ready,
            hint: 'Client-facing pages still do not expose send controls.'
          }
        ]}
      />
    </Shell>
  );
}
