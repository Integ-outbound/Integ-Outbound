import { DataList, Panel } from '@/components/cards';
import { Shell } from '@/components/shell';
import { getClientOnboardingStatus } from '@/lib/data';
import { formatDateTime } from '@/lib/format';
import { requireClientSession } from '@/lib/session';

export default async function ConnectGmailPage() {
  const session = await requireClientSession();
  const status = await getClientOnboardingStatus(session.clientId);

  return (
    <Shell
      title="Connect Gmail"
      eyebrow="Mailbox onboarding"
      description="This starts Google OAuth for the signed-in client onboarding session and binds the mailbox to that client ID."
      aside={
        <Panel title="Security note" tone="warning">
          <p>
            The browser never receives the global API key. This button posts to a frontend route,
            which calls the backend server-side with the client-scoped OAuth start request.
          </p>
        </Panel>
      }
    >
      <Panel title="Start Gmail OAuth">
        <form action="/api/onboarding/connect-gmail" method="post" className="button-row">
          <button className="primary-button" type="submit">
            Connect Gmail
          </button>
        </form>
      </Panel>
      <Panel title="Existing mailbox status">
        <DataList
          rows={status.mailboxes.map((mailbox) => ({
            label: mailbox.email,
            value: (
              <span className="code">
                {mailbox.status} · sync {mailbox.sync_health} · last sync {formatDateTime(mailbox.last_sync_time)}
              </span>
            )
          }))}
          emptyMessage="No mailbox connected yet."
        />
      </Panel>
    </Shell>
  );
}
