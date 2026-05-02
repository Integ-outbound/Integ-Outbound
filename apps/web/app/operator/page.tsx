import Link from 'next/link';

import { Panel, StatGrid } from '@/components/cards';
import { Shell } from '@/components/shell';
import { getOperatorSafety, getOperatorStatus } from '@/lib/data';
import { requireOperatorSession } from '@/lib/session';

export default async function OperatorPage() {
  await requireOperatorSession();
  const [status, safety] = await Promise.all([getOperatorStatus(), getOperatorSafety()]);

  return (
    <Shell
      title="Operator overview"
      eyebrow="Internal console"
      description="This is a read-heavy operational surface for visibility into onboarding, review, mailbox health, and send safety."
      aside={
        <>
          <Panel title="Navigation">
            <div className="button-row">
              <Link className="secondary-button" href="/operator/clients">
                Client onboarding
              </Link>
              <Link className="secondary-button" href="/operator/pilot-requests">
                Pilot requests
              </Link>
              <Link className="secondary-button" href="/operator/review">
                Review queues
              </Link>
              <Link className="secondary-button" href="/operator/safety">
                Safety checks
              </Link>
              <form action="/api/operator/logout" method="post">
                <button className="secondary-button" type="submit">
                  Sign out
                </button>
              </form>
            </div>
          </Panel>
          <Panel title="Review signal">
            <dl className="detail-list">
              <div>
                <dt>Average review time</dt>
                <dd>{Math.round(status.reviewStats.averageReviewTimeSeconds)} seconds</dd>
              </div>
              <div>
                <dt>Review statuses tracked</dt>
                <dd>{Object.keys(status.reviewStats.countsByStatus).length}</dd>
              </div>
              <div>
                <dt>Rejection reasons tracked</dt>
                <dd>{Object.keys(status.reviewStats.rejectionReasons).length}</dd>
              </div>
            </dl>
          </Panel>
        </>
      }
    >
      <StatGrid
        items={[
          { label: 'Active campaigns', value: status.activeCampaigns },
          { label: 'Pending drafts', value: status.pendingLeadReview },
          { label: 'Unhandled replies', value: status.unhandledReplies },
          { label: 'Send-ready', value: status.sendReady },
          { label: 'New pilot requests', value: status.newPilotRequests },
          { label: 'Connected mailboxes', value: status.connectedMailboxes },
          { label: 'Unhealthy mailboxes', value: status.unhealthyMailboxes },
          { label: 'Failed send attempts', value: safety.failed_send_attempts },
          { label: 'Worker enabled', value: safety.worker.enabled ? 'yes' : 'no' }
        ]}
      />
    </Shell>
  );
}
