import { Panel } from '@/components/cards';
import { Shell } from '@/components/shell';

export default async function SignupPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;

  return (
    <Shell
      title="Apply for an outbound pilot."
      eyebrow="Pilot application"
      description="Tell us about your agency, your offer, and the type of clients you want more of. We'll review whether a focused outbound pilot makes sense."
      aside={
        <>
          <Panel title="What happens next">
            <dl className="detail-list">
              <div>
                <dt>1. Pilot review</dt>
                <dd>We review your offer, target market, and whether outbound fits the agency.</dd>
              </div>
              <div>
                <dt>2. Campaign fit</dt>
                <dd>We look for a focused segment and a reason the market should respond.</dd>
              </div>
              <div>
                <dt>3. Pilot onboarding</dt>
                <dd>If the fit is right, we move into the setup needed to prepare the pilot campaign.</dd>
              </div>
            </dl>
          </Panel>
          <Panel title="Best applications are specific" tone="accent">
            <p>
              A clear offer, a practical target market, and honest notes about why prospects
              should reply all make it easier to shape the pilot quickly.
            </p>
          </Panel>
        </>
      }
    >
      {params.error ? <div className="banner banner-error">{params.error}</div> : null}
      {params.success === 'received' ? (
        <div className="banner banner-success">
          Pilot request received. We&apos;ll review your details and follow up soon.
        </div>
      ) : null}
      <Panel title="Pilot request">
        <form action="/api/signup" method="post" className="form-grid">
          <div className="field">
            <label htmlFor="company_name">Company name</label>
            <input id="company_name" name="company_name" required />
          </div>
          <div className="field">
            <label htmlFor="domain">Website</label>
            <input id="domain" name="domain" placeholder="youragency.com" required />
          </div>
          <div className="field">
            <label htmlFor="founder_operator_name">Your name</label>
            <input id="founder_operator_name" name="founder_operator_name" required />
          </div>
          <div className="field">
            <label htmlFor="email">Work email</label>
            <input id="email" name="email" type="email" required />
          </div>
          <div className="field">
            <label htmlFor="service_type">What does your agency sell?</label>
            <input
              id="service_type"
              name="service_type"
              placeholder="Paid media, PPC, growth, demand gen, B2B services..."
              required
            />
          </div>
          <div className="field">
            <label htmlFor="target_icp_notes">Who do you want as clients?</label>
            <textarea id="target_icp_notes" name="target_icp_notes" required />
          </div>
          <div className="field">
            <label htmlFor="offer_hook">What makes your offer worth replying to?</label>
            <textarea id="offer_hook" name="offer_hook" required />
          </div>
          <div className="field">
            <label htmlFor="extra_notes">Anything else we should know?</label>
            <textarea id="extra_notes" name="extra_notes" />
          </div>
          <div className="button-row">
            <button className="primary-button" type="submit">
              Submit pilot request
            </button>
          </div>
        </form>
      </Panel>
    </Shell>
  );
}
