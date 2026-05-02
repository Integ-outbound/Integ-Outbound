import { CTASection, FeatureCard, MarketingPage, Section } from '@/components/marketing';

const workflow = [
  'Define the target market',
  'Source matching accounts',
  'Find relevant contacts',
  'Build campaign strategy',
  'Generate human-reviewed outreach',
  'Launch controlled sending',
  'Sync and classify replies',
  'Stop irrelevant follow-ups',
  'Hand qualified conversations to humans'
];

export default function WhatWeDoPage() {
  return (
    <MarketingPage>
      <Section
        eyebrow="What we do"
        title="A software-plus-service workflow for controlled outbound execution."
        description="Integ combines software and managed execution so agencies can move from targeting to reply handling without exposing clients to fragile, self-serve sending controls."
      >
        <div className="feature-grid">
          {workflow.map((step, index) => (
            <FeatureCard
              key={step}
              title={`${index + 1}. ${step}`}
              body={
                index === 0
                  ? 'Start with a narrow ICP and a real point of view on who should be targeted first.'
                  : index === 1
                    ? 'Build the account universe that fits the campaign objective instead of reaching for a generic broad list.'
                    : index === 2
                      ? 'Find usable contacts and prioritize the right buyers before messages go out.'
                      : index === 3
                        ? 'Turn the offer and market into an outreach angle that makes sense for the prospect instead of defaulting to generic copy.'
                        : index === 4
                          ? 'AI drafts outreach around the account, market, and offer while humans review quality before launch.'
                          : index === 5
                            ? 'Use connected sending infrastructure with review gates, safety checks, and controlled execution.'
                            : index === 6
                              ? 'Integ syncs replies and classifies intent so the team can see what is happening quickly.'
                            : index === 7
                                ? 'When someone replies, the system can stop future follow-ups instead of continuing blindly.'
                                : 'Interested responses are routed back to humans so conversation quality and next-step judgment stay intact.'
              }
            />
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Managed execution"
        title="Integ is not just software sitting beside the work."
        description="The current model assumes operational involvement. That is deliberate: agencies often need execution support and safety controls as much as they need a product surface."
      >
        <div className="split-band">
          <FeatureCard
            title="What the software handles"
            body="Onboarding, campaign coordination, protected backend calls, reply sync, review visibility, and operator-safe workflow coordination."
          />
          <FeatureCard
            title="What humans still handle"
            body="Campaign judgment, sensitive review decisions, interested-reply handoff, and the practical tradeoffs that still benefit from operator oversight."
          />
        </div>
      </Section>

      <Section
        eyebrow="Why not just hire SDRs?"
        title="Hiring a team before proving the channel is expensive."
        description="An internal SDR motion requires people, tools, training, management, data, messaging, QA, and reporting. That can work later, but it is a heavy first step."
      >
        <p className="muted">
          Integ gives agencies a leaner first step: test outbound with a managed
          AI-assisted workflow, then decide what deserves scale.
        </p>
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>Internal SDR team</th>
                <th>Integ pilot</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>High fixed cost</td>
                <td>Lower starting cost</td>
              </tr>
              <tr>
                <td>Hiring and ramp time</td>
                <td>Faster campaign launch</td>
              </tr>
              <tr>
                <td>Needs management</td>
                <td>Managed execution</td>
              </tr>
              <tr>
                <td>Needs tooling</td>
                <td>AI-powered internal system</td>
              </tr>
              <tr>
                <td>Needs data process</td>
                <td>Focused target segment</td>
              </tr>
              <tr>
                <td>Quality varies by rep</td>
                <td>Human-reviewed quality</td>
              </tr>
              <tr>
                <td>Expensive before signal</td>
                <td>Built to test signal first</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="note-card">
          <strong>Do not build the full sales machine before proving the market will respond.</strong>
        </div>
      </Section>

      <CTASection
        title="Choose the right entry point."
        body="If the workflow matches what you need, the next question is whether you need a pilot, ongoing managed execution, or deeper infrastructure support."
        primaryHref="/products"
        primaryLabel="See products"
        secondaryHref="/pricing"
        secondaryLabel="View pricing"
      />
    </MarketingPage>
  );
}
