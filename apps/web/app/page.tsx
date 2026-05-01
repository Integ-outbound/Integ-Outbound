import Link from 'next/link';

import { Panel, StatGrid } from '@/components/cards';
import { Shell } from '@/components/shell';

export default function HomePage() {
  return (
    <Shell
      title="Client onboarding, not campaign control."
      eyebrow="integ-outbound.com"
      description="This MVP gives new clients a safe onboarding flow, mailbox connection, and visibility into review state without exposing send controls or the global operator key."
      aside={
        <Panel title="Guardrails" tone="warning">
          <ul className="checklist">
            <li className="checklist-item">
              <span className="checkmark">Safe</span>
              <div>
                <strong>No campaign launch controls</strong>
                <p>Clients can see status, but they cannot start campaigns from this UI.</p>
              </div>
            </li>
            <li className="checklist-item">
              <span className="checkmark">Safe</span>
              <div>
                <strong>No browser API key exposure</strong>
                <p>All sensitive backend calls stay on the frontend server.</p>
              </div>
            </li>
          </ul>
        </Panel>
      }
    >
      <Panel title="Choose your path" tone="accent">
        <div className="button-row">
          <Link className="primary-button" href="/signup">
            Start client onboarding
          </Link>
          <Link className="secondary-button" href="/operator/login">
            Operator sign-in
          </Link>
        </div>
      </Panel>
      <StatGrid
        items={[
          { label: 'Frontend role', value: 'Onboarding' },
          { label: 'OAuth target', value: 'Gmail' },
          { label: 'Calendar', value: 'Placeholder' },
          { label: 'Client actions', value: 'Read-only' }
        ]}
      />
      <Panel title="MVP scope">
        <p>
          The frontend covers signup, Gmail connection, onboarding checklist, operator visibility,
          and a read-only client dashboard. It intentionally stops before campaign launch,
          real sends, or client-side write paths into sensitive workflow state.
        </p>
      </Panel>
    </Shell>
  );
}
