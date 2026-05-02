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
      title="Inbox setup"
      eyebrow="Pilot onboarding"
      description="If inbox access is needed for your pilot, connect it here so setup and reply handling can move forward."
      aside={
        <>
          <Panel title="Secure connection" tone="warning">
            <p>
              If inbox access is needed, it is connected securely through Google. We never
              ask for your password.
            </p>
          </Panel>
          <Panel title="What to expect">
            <dl className="detail-list">
              <div>
                <dt>Google authorization</dt>
                <dd>You will be redirected to Google to approve access for the connected inbox.</dd>
              </div>
              <div>
                <dt>Inbox status</dt>
                <dd>Once connected, you will see the inbox appear here along with its health and sync status.</dd>
              </div>
              <div>
                <dt>Next stage</dt>
                <dd>After connection, we can finalize readiness and move into pilot preparation.</dd>
              </div>
            </dl>
          </Panel>
        </>
      }
    >
      <Panel title="Start inbox connection">
        <form action="/api/onboarding/connect-gmail" method="post" className="button-row">
          <button className="primary-button" type="submit">
            Connect Google inbox
          </button>
        </form>
      </Panel>
      <Panel title="Existing inbox status">
        <DataList
          rows={status.mailboxes.map((mailbox) => ({
            label: mailbox.email,
            value: (
              <span className="code">
                {mailbox.status} / sync {mailbox.sync_health} / last sync {formatDateTime(mailbox.last_sync_time)}
              </span>
            )
          }))}
          emptyMessage="No inbox connected yet."
        />
      </Panel>
    </Shell>
  );
}
