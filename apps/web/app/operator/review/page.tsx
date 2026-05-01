import { Panel } from '@/components/cards';
import { Shell } from '@/components/shell';
import { getOperatorReview } from '@/lib/data';
import { requireOperatorSession } from '@/lib/session';

function summarizeRecord(record: Record<string, unknown>): string {
  return JSON.stringify(record, null, 2);
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
      <Panel title="Lead review queue">
        {review.lead_review_queue.length === 0 ? (
          <p className="muted">No lead review items right now.</p>
        ) : (
          review.lead_review_queue.map((item, index) => (
            <pre className="panel code" key={`lead-${index}`}>
              {summarizeRecord(item)}
            </pre>
          ))
        )}
      </Panel>
      <Panel title="Reply review queue">
        {review.reply_review_queue.length === 0 ? (
          <p className="muted">No reply review items right now.</p>
        ) : (
          review.reply_review_queue.map((item, index) => (
            <pre className="panel code" key={`reply-${index}`}>
              {summarizeRecord(item)}
            </pre>
          ))
        )}
      </Panel>
    </Shell>
  );
}
