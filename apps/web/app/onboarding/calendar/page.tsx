import { Panel } from '@/components/cards';
import { Shell } from '@/components/shell';

export default function CalendarPlaceholderPage() {
  return (
    <Shell
      title="Calendar support is coming later."
      eyebrow="Pilot onboarding"
      description="For now, calls can be booked through your existing scheduling link."
      aside={
        <Panel title="Current approach" tone="warning">
          <p>
            This pilot setup focuses on outreach, replies, and qualified conversations first.
            Scheduling can continue through your existing calendar link.
          </p>
        </Panel>
      }
    >
      <Panel title="What to expect">
        <dl className="detail-list">
          <div>
            <dt>Today</dt>
            <dd>Use your current scheduling link for booked calls.</dd>
          </div>
          <div>
            <dt>Later</dt>
            <dd>Calendar support can be added once the pilot workflow needs it.</dd>
          </div>
          <div>
            <dt>Current posture</dt>
            <dd>No calendar access is requested or required right now.</dd>
          </div>
        </dl>
      </Panel>
    </Shell>
  );
}
