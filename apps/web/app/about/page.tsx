import { CTASection, FeatureCard, MarketingPage, Section } from '@/components/marketing';

export default function AboutPage() {
  return (
    <MarketingPage>
      <Section
        eyebrow="About"
        title="We help agencies turn outbound into client opportunities."
        description="Integ exists for agencies that are good at delivery but inconsistent at pipeline. We combine AI-assisted systems with hands-on execution to help agencies start more qualified sales conversations."
      >
        <div className="feature-grid">
          <FeatureCard
            title="Built for agencies"
            body="The focus is founder-led agencies that want more clients without adding SDR hiring, list management, and reply chasing to the founder's plate."
          />
          <FeatureCard
            title="Done-for-you execution"
            body="The buyer does not need to manage the research, messaging, outreach, and follow-up machinery to get a campaign moving."
          />
        </div>
      </Section>

      <Section
        eyebrow="Why we exist"
        title="Good agencies should not depend only on referrals."
        description="Referrals are great, but they are not enough. Agencies need a reliable way to test markets, reach prospects, and create conversations without hiring a full sales team before the process is proven."
      >
        <div className="product-highlight">
          <p className="section-kicker">The buyer problem</p>
          <h3>More opportunities without building an SDR team first.</h3>
          <p className="muted">
            That is the core reason Integ exists: to help agencies create pipeline
            through a controlled outbound process before they commit to heavier internal
            headcount.
          </p>
        </div>
      </Section>

      <Section
        eyebrow="Our approach"
        title="Outcome first. Systems underneath."
        description="The client-facing goal is simple: more qualified conversations. Behind the scenes, we use software, AI assistance, and human review to organize the research, outreach, follow-up, and reply handling."
      >
        <div className="feature-grid">
          <FeatureCard
            title="More qualified replies"
            body="The campaign is built to produce real conversations, not vanity activity."
          />
          <FeatureCard
            title="Human-reviewed execution"
            body="AI speeds up the repetitive work, while humans protect quality and keep the campaign grounded."
          />
        </div>
      </Section>

      <Section
        eyebrow="Current focus"
        title="Built first for agencies."
        description="We are starting with agencies because the pain is obvious: inconsistent pipeline, founder-led sales, expensive SDR hires, weak lead vendors, and too much manual outbound work."
      >
        <div className="feature-grid">
          <FeatureCard
            title="Paid media and PPC"
            body="Teams that can deliver strong outcomes but need more predictable client acquisition."
          />
          <FeatureCard
            title="Growth and B2B services"
            body="Agencies with clear offers and enough deal value to justify a focused outbound campaign."
          />
        </div>
      </Section>

      <CTASection
        title="Start a pilot"
        body="If outbound should become a more reliable source of client opportunities, begin with one focused campaign and learn from the market."
        primaryHref="/signup"
        primaryLabel="Start pilot"
        secondaryHref="/contact"
        secondaryLabel="Contact"
      />
    </MarketingPage>
  );
}
