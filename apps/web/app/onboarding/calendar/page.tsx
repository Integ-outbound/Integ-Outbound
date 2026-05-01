import { Panel } from '@/components/cards';
import { Shell } from '@/components/shell';

export default function CalendarPlaceholderPage() {
  return (
    <Shell
      title="Calendar connection is next."
      eyebrow="Placeholder"
      description="Google Calendar is intentionally not connected in this MVP. No Calendar scopes are requested yet."
    >
      <Panel title="What will happen later">
        <p>
          The next iteration can add Calendar-specific backend support, separate OAuth scopes,
          and availability-aware reply assistance. This build keeps that connection intentionally disabled.
        </p>
      </Panel>
    </Shell>
  );
}
