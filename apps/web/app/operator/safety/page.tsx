import { DataList, Panel, StatGrid } from '@/components/cards';
import { Shell } from '@/components/shell';
import { getOperatorSafety } from '@/lib/data';
import { requireOperatorSession } from '@/lib/session';

export default async function OperatorSafetyPage() {
  await requireOperatorSession();
  const safety = await getOperatorSafety();

  return (
    <Shell
      title="Safety checks"
      eyebrow="Operator / Safety"
      description="This page surfaces the operational safety counters you asked for, including orphan checks and sync health."
    >
      <StatGrid
        items={[
          { label: 'Send-ready count', value: safety.send_ready_count },
          { label: 'Active campaigns', value: safety.active_campaigns },
          { label: 'Unhealthy mailboxes', value: safety.unhealthy_mailboxes },
          { label: 'Failed send attempts', value: safety.failed_send_attempts }
        ]}
      />
      <Panel title="Safety details" tone="warning">
        <DataList
          rows={[
            {
              label: 'Mailboxes without client_id',
              value: <span className="code">{safety.mailboxes_without_client_id}</span>
            },
            {
              label: 'Campaigns without client_id',
              value: <span className="code">{safety.campaigns_without_client_id}</span>
            },
            {
              label: 'Worker enabled',
              value: <span className="code">{safety.worker.enabled ? 'true' : 'false'}</span>
            },
            {
              label: 'Sync health',
              value: (
                <span className="code">
                  healthy {safety.sync_health.healthy} · stale {safety.sync_health.stale} · error {safety.sync_health.error} · never synced {safety.sync_health.never_synced} · running {safety.sync_health.running}
                </span>
              )
            }
          ]}
        />
      </Panel>
    </Shell>
  );
}
