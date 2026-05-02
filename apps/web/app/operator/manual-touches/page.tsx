import Link from 'next/link';

import { Panel } from '@/components/cards';
import { Shell } from '@/components/shell';
import { getOperatorManualTouches } from '@/lib/data';
import { formatDateTime } from '@/lib/format';
import { requireOperatorSession } from '@/lib/session';

const CHANNEL_OPTIONS = [
  'email',
  'linkedin',
  'instagram',
  'facebook',
  'contact_form',
  'whatsapp',
  'other'
] as const;

const STATUS_OPTIONS = [
  'planned',
  'sent',
  'replied',
  'interested',
  'rejected',
  'booked_call',
  'closed'
] as const;

export default async function OperatorManualTouchesPage({
  searchParams
}: {
  searchParams: Promise<{
    channel?: string;
    status?: string;
    success?: string;
    error?: string;
  }>;
}) {
  await requireOperatorSession();
  const params = await searchParams;
  const selectedChannel = normalizeFilter(params.channel, CHANNEL_OPTIONS);
  const selectedStatus = normalizeFilter(params.status, STATUS_OPTIONS);
  const data = await getOperatorManualTouches({
    channel: selectedChannel ?? undefined,
    status: selectedStatus ?? undefined
  });
  const redirectTo = buildRedirectPath(selectedChannel, selectedStatus);

  return (
    <Shell
      title="Manual touches"
      eyebrow="Operator / Manual touches"
      description="Pure logging and review for founder-led outreach across non-email channels. No sending automation, no scraping, and no platform bots."
      aside={
        <Panel title="Navigation">
          <div className="button-row">
            <Link className="secondary-button" href="/operator">
              Operator overview
            </Link>
            <Link className="secondary-button" href="/operator/review">
              Review queues
            </Link>
          </div>
        </Panel>
      }
    >
      {params.success === 'created' ? (
        <div className="banner banner-success">Manual touch logged.</div>
      ) : null}
      {params.success === 'updated' ? (
        <div className="banner banner-success">Manual touch updated.</div>
      ) : null}
      {params.error ? <div className="banner banner-error">{params.error}</div> : null}

      <Panel title="Filters">
        <form method="get" className="form-grid">
          <div className="field">
            <label htmlFor="channel">Channel</label>
            <select id="channel" name="channel" defaultValue={selectedChannel ?? ''}>
              <option value="">All channels</option>
              {CHANNEL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {labelize(option)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={selectedStatus ?? ''}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {labelize(option)}
                </option>
              ))}
            </select>
          </div>
          <div className="button-row">
            <button className="primary-button" type="submit">
              Apply filters
            </button>
            <Link className="secondary-button" href="/operator/manual-touches">
              Clear
            </Link>
          </div>
        </form>
      </Panel>

      <Panel title="Create / log touch">
        <form action="/api/operator/manual-touches" method="post" className="form-grid">
          <input type="hidden" name="redirect_to" value={redirectTo} />
          <div className="field">
            <label htmlFor="client_id">Client ID (optional)</label>
            <input id="client_id" name="client_id" />
          </div>
          <div className="field">
            <label htmlFor="lead_id">Lead ID (optional)</label>
            <input id="lead_id" name="lead_id" />
          </div>
          <div className="field">
            <label htmlFor="company_name">Company name</label>
            <input id="company_name" name="company_name" />
          </div>
          <div className="field">
            <label htmlFor="person_name">Person name</label>
            <input id="person_name" name="person_name" />
          </div>
          <div className="field">
            <label htmlFor="create_channel">Channel</label>
            <select id="create_channel" name="channel" defaultValue="linkedin">
              {CHANNEL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {labelize(option)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="create_status">Status</label>
            <select id="create_status" name="status" defaultValue="planned">
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {labelize(option)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="message_body">Message body (optional)</label>
            <textarea id="message_body" name="message_body" />
          </div>
          <div className="field">
            <label htmlFor="notes">Notes (optional)</label>
            <textarea id="notes" name="notes" />
          </div>
          <div className="button-row">
            <button className="primary-button" type="submit">
              Log touch
            </button>
          </div>
        </form>
      </Panel>

      <Panel title="Touches">
        {data.manual_touches.length === 0 ? (
          <p className="muted">No manual touches match the current filters.</p>
        ) : (
          <div className="review-grid">
            {data.manual_touches.map((touch) => (
              <details className="review-card" key={touch.id}>
                <summary>
                  <div className="review-card-head">
                    <div>
                      <h3>{touch.person_name ?? touch.company_name ?? 'Unnamed touch'}</h3>
                      <p className="muted">
                        {labelize(touch.channel)} / {labelize(touch.status)}
                      </p>
                    </div>
                    <div className="badge-row">
                      {touch.company_name ? <span className="pill">{touch.company_name}</span> : null}
                      <span className="pill">{formatDateTime(touch.created_at)}</span>
                    </div>
                  </div>
                </summary>
                <dl className="detail-list">
                  <div>
                    <dt>Client ID</dt>
                    <dd className="code">{touch.client_id ?? 'Not linked'}</dd>
                  </div>
                  <div>
                    <dt>Lead ID</dt>
                    <dd className="code">{touch.lead_id ?? 'Not linked'}</dd>
                  </div>
                  <div>
                    <dt>Sent at</dt>
                    <dd>{formatDateTime(touch.sent_at)}</dd>
                  </div>
                  <div>
                    <dt>Reply at</dt>
                    <dd>{formatDateTime(touch.reply_at)}</dd>
                  </div>
                  <div>
                    <dt>Message</dt>
                    <dd>{touch.message_body ?? 'No message body logged.'}</dd>
                  </div>
                  <div>
                    <dt>Notes</dt>
                    <dd>{touch.notes ?? 'No notes yet.'}</dd>
                  </div>
                </dl>
                <form
                  action={`/api/operator/manual-touches/${touch.id}`}
                  method="post"
                  className="form-grid"
                >
                  <input type="hidden" name="redirect_to" value={redirectTo} />
                  <div className="field">
                    <label htmlFor={`status-${touch.id}`}>Update status</label>
                    <select
                      id={`status-${touch.id}`}
                      name="status"
                      defaultValue={touch.status}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {labelize(option)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`notes-${touch.id}`}>Update notes</label>
                    <textarea id={`notes-${touch.id}`} name="notes" defaultValue={touch.notes ?? ''} />
                  </div>
                  <div className="button-row">
                    <button className="secondary-button" type="submit">
                      Save update
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

function normalizeFilter<T extends readonly string[]>(
  value: string | undefined,
  options: T
): T[number] | null {
  if (!value) {
    return null;
  }

  return options.includes(value as T[number]) ? (value as T[number]) : null;
}

function labelize(value: string): string {
  return value.replace(/_/g, ' ');
}

function buildRedirectPath(channel: string | null, status: string | null): string {
  const params = new URLSearchParams();
  if (channel) {
    params.set('channel', channel);
  }
  if (status) {
    params.set('status', status);
  }

  const query = params.toString();
  return query ? `/operator/manual-touches?${query}` : '/operator/manual-touches';
}
