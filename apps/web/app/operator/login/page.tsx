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
      description="This gate is backed by the existing INTERNAL_API_KEY, but the key itself stays on the server once validated."
    >
      {params.error ? <div className="banner banner-error">{params.error}</div> : null}
      <Panel title="Enter internal key">
        <form action="/api/operator/login" method="post" className="form-grid">
          <div className="field">
            <label htmlFor="api_key">Internal API key</label>
            <input id="api_key" name="api_key" type="password" required />
          </div>
          <div className="button-row">
            <button className="primary-button" type="submit">
              Unlock operator pages
            </button>
          </div>
        </form>
      </Panel>
    </Shell>
  );
}
