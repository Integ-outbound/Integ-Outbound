import { Panel } from '@/components/cards';
import { Shell } from '@/components/shell';

export default function CalendarPlaceholderPage() {
  return (
    <Shell
      title="Calendar connection is next."
      eyebrow="Placeholder"
      description="Google Calendar is intentionally not connected in this MVP. No Calendar scopes are requested yet."
      aside={
        <Panel title="Why it is not live yet" tone="warning">
          <p>
            Calendar support will need its own backend OAuth flow, stored connection state, and
            clear client-safe scheduling rules. This build keeps it deliberately out of scope.
          </p>
        </Panel>
      }
    >
      <Panel title="What will happen later">
        <dl className="detail-list">
          <div>
            <dt>Separate OAuth scopes</dt>
            <dd>Calendar access should be requested independently from Gmail so scopes stay clear and narrow.</dd>
          </div>
          <div>
            <dt>Availability-aware workflows</dt>
            <dd>Any future scheduling help should be tied to explicit backend support rather than a placeholder browser action.</dd>
          </div>
          <div>
            <dt>Current posture</dt>
            <dd>This frontend can mention Calendar as a future capability, but it does not request access or act on calendar data.</dd>
          </div>
        </dl>
      </Panel>
    </Shell>
  );
}
