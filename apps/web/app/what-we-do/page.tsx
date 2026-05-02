import { CTASection, FeatureCard, MarketingPage, Section } from '@/components/marketing';

const workflow = [
  {
    title: '1. Choose the target',
    body: "We define the ideal prospects, geography, exclusions, and campaign angle."
  },
  {
    title: '2. Build the list',
    body: 'We source companies that fit the target instead of using generic lead dumps.'
  },
  {
    title: '3. Find the right people',
    body: "We identify decision-makers likely to care about the agency's offer."
  },
  {
    title: '4. Write the outreach',
    body: "We create specific messages that connect the prospect's situation to the agency's value."
  },
  {
    title: '5. Send the campaign',
    body: 'We launch carefully, with review and limits instead of reckless volume.'
  },
  {
    title: '6. Manage replies',
    body: 'We track positive replies, questions, objections, and next steps.'
  },
  {
    title: '7. Improve the campaign',
    body: 'We use response data to refine the next wave.'
  }
];

export default function WhatWeDoPage() {
  return (
    <MarketingPage>
      <Section
        eyebrow="What we do"
        title="We run outbound campaigns that create sales conversations."
        description='Integ helps agencies go from "we need more clients" to a focused outbound campaign: target market, prospect list, decision-makers, outreach, follow-up, reply handling, and reporting.'
      >
        <div className="feature-grid">
          {workflow.map((step) => (
            <FeatureCard key={step.title} title={step.title} body={step.body} />
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Why this works better"
        title="Better campaigns come from focus, relevance, and follow-through."
        description="The goal is not more activity for its own sake. The goal is more qualified replies and stronger client opportunities."
      >
        <div className="feature-grid">
          <FeatureCard
            title="Focused targeting"
            body="Better prospects beat bigger lists."
          />
          <FeatureCard
            title="Specific messaging"
            body="People respond when the message feels relevant."
          />
          <FeatureCard
            title="Consistent follow-up"
            body="Opportunities are lost when follow-up is random."
          />
          <FeatureCard
            title="Human judgment"
            body="AI speeds up the work, but humans protect quality."
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
        title="See whether outbound can become a repeatable client acquisition channel."
        body="A focused pilot campaign is the cleanest way to test the market before you commit to a bigger outbound motion."
        primaryHref="/signup"
        primaryLabel="Start pilot"
        secondaryHref="/products"
        secondaryLabel="See products"
      />
    </MarketingPage>
  );
}
