import { Panel } from '@/components/cards';
import { Shell } from '@/components/shell';

export default async function OperatorLoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <Shell
      title="Operator access"
      eyebrow="Internal only"
      description="Sign in to control campaigns, review queues, mailbox health, and operator-only outreach records."
    >
      {params.error ? <div className="banner banner-error">{params.error}</div> : null}
      <Panel title="Admin login">
        <form action="/api/operator/login" method="post" className="form-grid">
          <div className="field">
            <label htmlFor="username">Username</label>
            <input id="username" name="username" autoComplete="username" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <div className="button-row">
            <button className="primary-button" type="submit">
              Sign in
            </button>
          </div>
        </form>
      </Panel>
      <Panel title="Internal key fallback">
        <form action="/api/operator/login" method="post" className="form-grid">
          <div className="field">
            <label htmlFor="api_key">Internal API key</label>
            <input id="api_key" name="api_key" type="password" />
          </div>
          <div className="button-row">
            <button className="secondary-button" type="submit">
              Unlock with key
            </button>
          </div>
        </form>
      </Panel>
    </Shell>
  );
}
