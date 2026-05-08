import Link from 'next/link';

import { Panel, StatGrid } from '@/components/cards';
import { Shell } from '@/components/shell';
import { getOperatorCampaigns, getOperatorClientStatuses } from '@/lib/data';
import { formatDateTime } from '@/lib/format';
import { requireOperatorSession } from '@/lib/session';
import type { OperatorCampaigns } from '@/lib/types';

const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'archived'] as const;
const LEAD_STATUSES = [
  'pending_review',
  'approved',
  'rejected',
  'send_ready',
  'sent',
  'bounced',
  'replied',
  'suppressed'
] as const;

export default async function OperatorCampaignsPage({
  searchParams
}: {
  searchParams: Promise<{
    client_id?: string;
    success?: string;
    error?: string;
  }>;
}) {
  await requireOperatorSession();
  const params = await searchParams;
  const [campaignData, clientData] = await Promise.all([
    getOperatorCampaigns(params.client_id),
    getOperatorClientStatuses()
  ]);
  const redirectTo = params.client_id
    ? `/operator/campaigns?client_id=${encodeURIComponent(params.client_id)}`
    : '/operator/campaigns';
  const totals = summarizeCampaigns(campaignData);

  return (
    <Shell
      title="Campaign control"
      eyebrow="Operator / Campaigns"
      description="Create campaigns, track existing ones, and pause or activate outbound from one protected operator surface."
      aside={
        <Panel title="Navigation">
          <div className="button-row">
            <Link className="secondary-button" href="/operator">
              Operator overview
            </Link>
            <Link className="secondary-button" href="/operator/review">
              Review queues
            </Link>
            <Link className="secondary-button" href="/operator/safety">
              Safety checks
            </Link>
          </div>
        </Panel>
      }
    >
      {params.success === 'created' ? (
        <div className="banner banner-success">Campaign created.</div>
      ) : null}
      {params.success === 'updated' ? (
        <div className="banner banner-success">Campaign updated.</div>
      ) : null}
      {params.error ? <div className="banner banner-error">{params.error}</div> : null}

      <StatGrid
        items={[
          { label: 'Campaigns', value: campaignData.campaigns.length },
          { label: 'Active', value: totals.active },
          { label: 'Pending review', value: totals.pendingReview },
          { label: 'Send-ready', value: totals.sendReady },
          { label: 'Sent today', value: totals.sentToday },
          { label: 'Failed attempts', value: totals.failedAttempts }
        ]}
      />

      <Panel title="Filter">
        <form method="get" className="form-grid">
          <div className="field">
            <label htmlFor="client_filter">Client</label>
            <select id="client_filter" name="client_id" defaultValue={params.client_id ?? ''}>
              <option value="">All clients</option>
              {clientData.clients.map((clientStatus) => (
                <option key={clientStatus.client.id} value={clientStatus.client.id}>
                  {clientStatus.client.name}
                </option>
              ))}
            </select>
          </div>
          <div className="button-row">
            <button className="primary-button" type="submit">
              Apply
            </button>
            <Link className="secondary-button" href="/operator/campaigns">
              Clear
            </Link>
          </div>
        </form>
      </Panel>

      <Panel title="Create campaign">
        <form action="/api/operator/campaigns" method="post" className="form-grid">
          <input type="hidden" name="redirect_to" value={redirectTo} />
          <div className="field">
            <label htmlFor="client_id">Client</label>
            <select id="client_id" name="client_id" defaultValue={params.client_id ?? ''} required>
              <option value="" disabled>
                Select a client
              </option>
              {clientData.clients.map((clientStatus) => (
                <option key={clientStatus.client.id} value={clientStatus.client.id}>
                  {clientStatus.client.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="name">Campaign name</label>
            <input id="name" name="name" required />
          </div>
          <div className="field">
            <label htmlFor="angle">Angle</label>
            <textarea id="angle" name="angle" required />
          </div>
          <div className="field">
            <label htmlFor="persona">Persona</label>
            <input id="persona" name="persona" required />
          </div>
          <div className="field">
            <label htmlFor="icp_target">ICP target JSON</label>
            <textarea id="icp_target" name="icp_target" defaultValue={'{}'} />
          </div>
          <div className="field">
            <label htmlFor="sequence_steps">Sequence steps</label>
            <input id="sequence_steps" name="sequence_steps" type="number" min="1" defaultValue="3" />
          </div>
          <div className="field">
            <label htmlFor="sequence_delay_days">Delay days</label>
            <input id="sequence_delay_days" name="sequence_delay_days" type="number" min="0" defaultValue="3" />
          </div>
          <div className="field">
            <label htmlFor="daily_send_limit">Daily send limit</label>
            <input id="daily_send_limit" name="daily_send_limit" type="number" min="1" />
          </div>
          <div className="field">
            <label htmlFor="status">Initial status</label>
            <select id="status" name="status" defaultValue="draft">
              {CAMPAIGN_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {labelize(status)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="prompt_version">Prompt version</label>
            <input id="prompt_version" name="prompt_version" />
          </div>
          <div className="button-row">
            <button className="primary-button" type="submit">
              Create campaign
            </button>
          </div>
        </form>
      </Panel>

      <Panel title="Existing campaigns">
        {campaignData.campaigns.length === 0 ? (
          <p className="muted">No campaigns match this view.</p>
        ) : (
          <div className="review-grid">
            {campaignData.campaigns.map((campaign) => (
              <details className="review-card" key={campaign.id}>
                <summary>
                  <div className="review-card-head">
                    <div>
                      <h3>{campaign.name}</h3>
                      <p className="muted">
                        {campaign.client.name} / {labelize(campaign.status)}
                      </p>
                    </div>
                    <div className="badge-row">
                      <span className="pill">{formatDateTime(campaign.created_at)}</span>
                      <span className="pill">{campaign.sent_today} sent today</span>
                    </div>
                  </div>
                </summary>
                <dl className="detail-list">
                  <div>
                    <dt>Campaign ID</dt>
                    <dd className="code">{campaign.id}</dd>
                  </div>
                  <div>
                    <dt>Client</dt>
                    <dd>{campaign.client.name}</dd>
                  </div>
                  <div>
                    <dt>Persona</dt>
                    <dd>{campaign.persona}</dd>
                  </div>
                  <div>
                    <dt>Angle</dt>
                    <dd>{campaign.angle}</dd>
                  </div>
                  <div>
                    <dt>Sequence</dt>
                    <dd>
                      {campaign.sequence_steps} steps / {campaign.sequence_delay_days} day delay
                    </dd>
                  </div>
                  <div>
                    <dt>Daily limit</dt>
                    <dd>{campaign.daily_send_limit ?? 'No campaign limit set'}</dd>
                  </div>
                  <div>
                    <dt>Lead statuses</dt>
                    <dd>{formatLeadCounts(campaign.lead_status_counts)}</dd>
                  </div>
                  <div>
                    <dt>Failed send attempts</dt>
                    <dd>{campaign.failed_send_attempts}</dd>
                  </div>
                </dl>
                <form
                  action={`/api/operator/campaigns/${campaign.id}`}
                  method="post"
                  className="form-grid"
                >
                  <input type="hidden" name="redirect_to" value={redirectTo} />
                  <input type="hidden" name="client_id" value={campaign.client_id} />
                  <div className="field">
                    <label htmlFor={`status-${campaign.id}`}>Status</label>
                    <select id={`status-${campaign.id}`} name="status" defaultValue={campaign.status}>
                      {CAMPAIGN_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {labelize(status)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`daily-send-limit-${campaign.id}`}>Daily send limit</label>
                    <input
                      id={`daily-send-limit-${campaign.id}`}
                      name="daily_send_limit"
                      type="number"
                      min="1"
                      defaultValue={campaign.daily_send_limit ?? ''}
                    />
                  </div>
                  <div className="button-row">
                    <button className="secondary-button" type="submit">
                      Save campaign
                    </button>
                  </div>
                </form>
              </details>
            ))}
          </div>
        )}
      </Panel>
    </Shell>
  );
}

function summarizeCampaigns(data: OperatorCampaigns) {
  return data.campaigns.reduce(
    (totals, campaign) => ({
      active: totals.active + (campaign.status === 'active' ? 1 : 0),
      pendingReview: totals.pendingReview + Number(campaign.lead_status_counts.pending_review ?? 0),
      sendReady: totals.sendReady + Number(campaign.lead_status_counts.send_ready ?? 0),
      sentToday: totals.sentToday + campaign.sent_today,
      failedAttempts: totals.failedAttempts + campaign.failed_send_attempts
    }),
    {
      active: 0,
      pendingReview: 0,
      sendReady: 0,
      sentToday: 0,
      failedAttempts: 0
    }
  );
}

function formatLeadCounts(counts: Record<string, number>): string {
  const parts = LEAD_STATUSES
    .map((status) => [status, Number(counts[status] ?? 0)] as const)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `${labelize(status)}: ${count}`);

  return parts.length > 0 ? parts.join(' / ') : 'No leads attached';
}

function labelize(value: string): string {
  return value.replace(/_/g, ' ');
}
