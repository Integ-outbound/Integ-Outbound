import { Panel } from '@/components/cards';
import { Shell } from '@/components/shell';

export default async function SignupPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <Shell
      title="Create the client onboarding record."
      eyebrow="Client signup"
      description="This creates the client profile only. It does not create campaigns, leads, or outbound activity."
      aside={
        <Panel title="What happens next">
          <p>After signup, the frontend stores a signed onboarding session cookie and sends you into the Gmail connection checklist.</p>
        </Panel>
      }
    >
      {params.error ? <div className="banner banner-error">{params.error}</div> : null}
      <Panel title="Client profile">
        <form action="/api/signup" method="post" className="form-grid">
          <div className="field">
            <label htmlFor="company_name">Company name</label>
            <input id="company_name" name="company_name" required />
          </div>
          <div className="field">
            <label htmlFor="domain">Company domain</label>
            <input id="domain" name="domain" placeholder="example.com" required />
          </div>
          <div className="field">
            <label htmlFor="founder_operator_name">Founder or operator name</label>
            <input id="founder_operator_name" name="founder_operator_name" required />
          </div>
          <div className="field">
            <label htmlFor="email">Operator email</label>
            <input id="email" name="email" type="email" required />
          </div>
          <div className="field">
            <label htmlFor="service_type">Service type</label>
            <input id="service_type" name="service_type" placeholder="Outbound agency, SaaS, consultancy..." required />
          </div>
          <div className="field">
            <label htmlFor="target_icp_notes">Target ICP notes</label>
            <textarea id="target_icp_notes" name="target_icp_notes" required />
          </div>
          <div className="button-row">
            <button className="primary-button" type="submit">
              Create onboarding profile
            </button>
          </div>
        </form>
      </Panel>
    </Shell>
  );
}
