import { Panel } from '@/components/cards';
import { Shell } from '@/components/shell';
import { getOperatorReview } from '@/lib/data';
import { requireOperatorSession } from '@/lib/session';

function summarizeRecord(record: Record<string, unknown>): string {
  return JSON.stringify(record, null, 2);
}

function getStringValue(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return null;
}

function getTitle(record: Record<string, unknown>, fallback: string): string {
  return (
    getStringValue(record, ['subject', 'email', 'contact_email', 'company_name', 'client_name']) ??
    fallback
  );
}

function ReviewQueue({
  title,
  emptyMessage,
  prefix,
  items
}: {
  title: string;
  emptyMessage: string;
  prefix: string;
  items: Array<Record<string, unknown>>;
}) {
  return (
    <Panel title={title}>
      {items.length === 0 ? (
        <p className="muted">{emptyMessage}</p>
      ) : (
        <div className="review-grid">
          {items.map((item, index) => {
            const recordId =
              getStringValue(item, ['id', 'lead_id', 'reply_id', 'draft_id', 'campaign_id']) ??
              `${prefix}-${index}`;
            const headline = getTitle(item, `${prefix} item ${index + 1}`);
            const status =
              getStringValue(item, ['status', 'classification', 'review_status', 'state']) ??
              'Needs review';
            const clientId = getStringValue(item, ['client_id']);
            const createdAt = getStringValue(item, ['created_at', 'received_at', 'updated_at']);

            return (
              <details className="review-card" key={recordId}>
                <summary>
                  <div className="review-card-head">
                    <div>
                      <h3>{headline}</h3>
                      <p className="muted">{status}</p>
                    </div>
                    <div className="badge-row">
                      {clientId ? <span className="pill">client {clientId.slice(0, 8)}</span> : null}
                      {createdAt ? <span className="pill">{createdAt}</span> : null}
                    </div>
                  </div>
                </summary>
                <pre>{summarizeRecord(item)}</pre>
              </details>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

export default async function OperatorReviewPage() {
  await requireOperatorSession();
  const review = await getOperatorReview();

  return (
    <Shell
      title="Review queues"
      eyebrow="Operator / Review"
      description="Draft and reply review stay visible here without exposing send controls in the client surface."
    >
      <ReviewQueue
        title="Lead review queue"
        emptyMessage="No lead review items right now."
        prefix="lead"
        items={review.lead_review_queue}
      />
      <ReviewQueue
        title="Reply review queue"
        emptyMessage="No reply review items right now."
        prefix="reply"
        items={review.reply_review_queue}
      />
    </Shell>
  );
}
