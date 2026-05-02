import { CTASection, FeatureCard, MarketingPage, Section } from '@/components/marketing';

export default function AboutPage() {
  return (
    <MarketingPage>
      <Section
        eyebrow="About Integ"
        title="Founder-led outbound infrastructure built for controlled execution."
        description="Integ is building an AI-assisted outbound operating system with human-reviewed execution and practical agency workflows."
      >
        <div className="feature-grid">
          <FeatureCard
            title="Built around real operational constraints"
            body="The product direction is shaped by sending quality, reply sync, intent classification, follow-up stopping, and operator visibility instead of abstract automation claims."
          />
          <FeatureCard
            title="Human review is still part of the system"
            body="Integ does not claim to be fully autonomous today. Human review still matters for outbound quality, reply handling, and operational safety."
          />
          <FeatureCard
            title="Founder-led and execution-focused"
            body="This is an early-stage, hands-on effort aimed at getting controlled outbound pilots working credibly before widening the surface area."
          />
          <FeatureCard
            title="Agency-oriented from the start"
            body="The clearest fit is helping agencies and service teams run outbound pilots with better infrastructure and repeatable process support."
          />
        </div>
      </Section>

      <Section
        eyebrow="Why us"
        title="We use software to compress the work of a small outbound team."
        description="Traditional outbound requires multiple moving parts: list builders, SDRs, copywriters, inbox managers, follow-up tracking, reply handling, and reporting. Integ is being built to compress that workflow into one AI-assisted operating system with human oversight."
      >
        <div className="feature-grid">
          <FeatureCard
            title="Less ramp time"
            body="No long hiring cycle, no SDR onboarding period, no weeks spent building basic outbound operations from scratch."
          />
          <FeatureCard
            title="Less overhead"
            body="Instead of paying for a full sales team before the channel is proven, agencies can start with a focused pilot."
          />
          <FeatureCard
            title="More operational leverage"
            body="AI handles repetitive coordination work while humans focus on judgment, strategy, and live opportunities."
          />
          <FeatureCard
            title="Built to compound"
            body="Every campaign creates learning: which segments respond, what messages work, what objections appear, and where the next opportunity is."
          />
        </div>
      </Section>

      <Section
        eyebrow="Why now"
        title="The gap is not just lead generation. It is operational discipline."
        description="Most teams do not fail because they never found data. They fail because the workflow from sourcing to sending to reply handling is scattered and brittle."
      >
        <div className="split-band">
          <FeatureCard
            title="Integ's angle"
            body="Use software to structure the work, keep operators in control of sensitive decisions, and let the system handle repetitive coordination."
          />
          <FeatureCard
            title="Current scope"
            body="Controlled outbound pilots, onboarding, reply sync, intent classification, and human handoff. No self-serve campaign launching yet."
          />
        </div>
      </Section>

      <CTASection
        title="See how the workflow actually runs."
        body="If the positioning fits, the next useful page is the concrete step-by-step workflow rather than more broad claims."
        primaryHref="/what-we-do"
        primaryLabel="See the workflow"
        secondaryHref="/signup"
        secondaryLabel="Start onboarding"
      />
    </MarketingPage>
  );
}
