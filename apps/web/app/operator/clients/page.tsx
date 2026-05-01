import { Panel } from '@/components/cards';
import { Shell } from '@/components/shell';
import { getOperatorClientStatuses } from '@/lib/data';
import { requireOperatorSession } from '@/lib/session';

export default async function OperatorClientsPage() {
  await requireOperatorSession();
  const data = await getOperatorClientStatuses();

  return (
    <Shell
      title="Client onboarding status"
      eyebrow="Operator / Clients"
      description="Every client listed here is reduced to onboarding and review state only."
    >
      <Panel title="Clients">
        <table className="table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Domain</th>
              <th>Gmail</th>
              <th>Campaigns</th>
              <th>Pending drafts</th>
              <th>Pending replies</th>
            </tr>
          </thead>
          <tbody>
            {data.clients.map((clientStatus) => (
              <tr key={clientStatus.client.id}>
                <td>
                  <strong>{clientStatus.client.name}</strong>
                  <div className="muted">{clientStatus.client.operator_email ?? 'No operator email'}</div>
                </td>
                <td className="code">{clientStatus.client.company_domain ?? 'Not set'}</td>
                <td>{clientStatus.checklist.gmail_connected ? 'Connected' : 'Pending'}</td>
                <td>{clientStatus.counts.total_campaigns}</td>
                <td>{clientStatus.counts.drafts_pending_review}</td>
                <td>{clientStatus.counts.replies_pending_review}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </Shell>
  );
}
