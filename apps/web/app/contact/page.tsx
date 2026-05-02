import { CTASection, FeatureCard, MarketingPage, Section } from '@/components/marketing';

export default function ContactPage() {
  return (
    <MarketingPage>
      <Section
        eyebrow="Contact"
        title="Want more client conversations?"
        description="If you run an agency and want to test outbound as a client acquisition channel, reach out. We are opening a limited number of controlled pilot slots."
      >
        <div className="split-band">
          <div className="product-highlight">
            <p className="section-kicker">Primary contact</p>
            <h3>mark@integ-outbound.com</h3>
            <p className="muted">
              The fastest way to start is to email the team with your agency, offer, and
              target market.
            </p>
            <div className="button-row">
              <a className="primary-button" href="mailto:mark@integ-outbound.com">
                Email us
              </a>
            </div>
          </div>
          <FeatureCard
            title="Reasons to reach out"
            body="A pilot makes the most sense when a few of these are already true."
            bullets={[
              'You run a paid media, PPC, growth, or B2B service agency',
              'You want more qualified sales conversations',
              'You rely too much on referrals',
              'You want to test outbound without hiring SDRs',
              'You want a focused pilot before committing to a bigger campaign'
            ]}
          />
        </div>
      </Section>

      <CTASection
        title="Start with one segment. Prove the signal. Scale what works."
        body="The right first step is a controlled pilot campaign aimed at creating real client opportunities."
        primaryHref="/signup"
        primaryLabel="Start pilot"
      />
    </MarketingPage>
  );
}
