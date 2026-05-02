import { CTASection, MarketingPage, PricingCard, Section } from '@/components/marketing';

export default function PricingPage() {
  return (
    <MarketingPage>
      <Section
        eyebrow="Pricing"
        title="Indicative pricing for controlled outbound work."
        description="Pricing depends on market, data requirements, send volume, inbox setup, and scope. These ranges are useful for qualification and planning, not binding commitments."
      >
        <div className="pricing-grid">
          <PricingCard
            title="Outbound Pilot"
            price="$750-$1,500 / 30-day pilot"
            summary="Best for testing one market and one offer in a controlled first wave."
            items={[
              '1 ICP segment',
              'target account sourcing',
              'contact discovery where possible',
              'verified outreach list',
              'personalized messaging',
              'controlled sending',
              'reply handling',
              'weekly report'
            ]}
            ctaHref="/signup"
            ctaLabel="Start pilot"
          />
          <PricingCard
            title="Managed Client Acquisition"
            price="$1,500-$3,000/mo"
            summary="Best for ongoing outbound execution and iteration."
            items={[
              'ongoing campaign waves',
              'source and verify contacts',
              'controlled sending',
              'reply classification',
              'follow-up management',
              'reporting',
              'optimization'
            ]}
            featured
            ctaHref="/signup"
            ctaLabel="Discuss managed plan"
          />
          <PricingCard
            title="Custom / White-label Ops"
            price="Custom"
            summary="Best for outbound or marketing agencies needing infrastructure or fulfillment support."
            items={[
              'custom workflow scope',
              'agency-aligned delivery model',
              'white-label or embedded support',
              'tailored reporting and operating process'
            ]}
            ctaHref="/signup"
            ctaLabel="Request custom scope"
          />
        </div>
        <p className="muted">
          Pricing depends on market, data requirements, send volume, inbox setup, and scope.
        </p>
      </Section>

      <CTASection
        title="Use pricing as a scope signal, not a shortcut."
        body="The best starting point is still a short onboarding and pilot conversation so the actual market, sending setup, and delivery expectations are clear."
        primaryHref="/signup"
        primaryLabel="Start onboarding"
        secondaryHref="/what-we-do"
        secondaryLabel="See the workflow"
      />
    </MarketingPage>
  );
}
