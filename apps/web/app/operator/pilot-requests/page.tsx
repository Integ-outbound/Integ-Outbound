import { Panel } from '@/components/cards';
import { Shell } from '@/components/shell';
import { getOperatorPilotRequests } from '@/lib/data';
import { formatDateTime } from '@/lib/format';
import { requireOperatorSession } from '@/lib/session';

export default async function OperatorPilotRequestsPage() {
  await requireOperatorSession();
  const data = await getOperatorPilotRequests();

  return (
    <Shell
      title="New pilot requests"
      eyebrow="Operator / Pilot requests"
      description="This queue gives Mark and operators visibility into every public pilot application without relying on campaign mail systems."
    >
      <Panel title="Pilot requests">
        {data.requests.length === 0 ? (
          <p>No pilot requests yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Contact</th>
                <th>Company</th>
                <th>Website</th>
                <th>Offer</th>
                <th>Desired client type</th>
                <th>Notes</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.requests.map((request) => (
                <tr key={request.id}>
                  <td className="code">{formatDateTime(request.created_at)}</td>
                  <td>
                    <strong>{request.contact_name}</strong>
                    <div className="muted">{request.contact_email}</div>
                  </td>
                  <td>{request.company_name}</td>
                  <td className="code">{request.website}</td>
                  <td>{request.offer}</td>
                  <td>{request.desired_client_type}</td>
                  <td>{request.notes ?? 'No notes'}</td>
                  <td>
                    <span className="pill">{request.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </Shell>
  );
}
