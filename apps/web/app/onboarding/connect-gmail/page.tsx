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
      description="This starts Google OAuth for the signed-in client onboarding session and binds the mailbox to that exact client record."
      aside={
        <>
          <Panel title="Security note" tone="warning">
            <p>
              The browser never receives the global API key. This button posts to a frontend route,
              which calls the backend server-side with the client-scoped OAuth start request.
            </p>
          </Panel>
          <Panel title="What to expect">
            <dl className="detail-list">
              <div>
                <dt>Google OAuth</dt>
                <dd>You will be redirected to Google to approve Gmail access for the connected inbox.</dd>
              </div>
              <div>
                <dt>Client ownership</dt>
                <dd>The signed OAuth state returns the mailbox to the correct client instead of creating an orphan record.</dd>
              </div>
              <div>
                <dt>Current scope</dt>
                <dd>This step connects the inbox only. It does not create campaigns or start sending.</dd>
              </div>
            </dl>
          </Panel>
        </>
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
                {mailbox.status} / sync {mailbox.sync_health} / last sync {formatDateTime(mailbox.last_sync_time)}
              </span>
            )
          }))}
          emptyMessage="No mailbox connected yet."
        />
      </Panel>
    </Shell>
  );
}
