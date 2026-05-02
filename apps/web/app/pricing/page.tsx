import { CTASection, MarketingPage, PricingCard, Section } from '@/components/marketing';

export default function PricingPage() {
  return (
    <MarketingPage>
      <Section
        eyebrow="Pricing"
        title="Pilot-first pricing for agency growth."
        description="Start small, prove the segment, then expand if the campaign creates real sales conversations."
      >
        <div className="pricing-grid">
          <PricingCard
            title="Outbound Pilot"
            price="$750-$1,500"
            summary="30-day campaign test"
            items={[
              'one target segment',
              'prospect list building',
              'contact research where possible',
              'outreach messaging',
              'controlled sending',
              'follow-up handling',
              'reply tracking',
              'weekly report'
            ]}
            ctaHref="/signup"
            ctaLabel="Start pilot"
          />
          <PricingCard
            title="Managed Client Acquisition"
            price="$1,500-$3,000/mo"
            summary="Ongoing outbound execution"
            items={[
              'monthly campaign waves',
              'new prospect segments',
              'contact sourcing',
              'message testing',
              'follow-up management',
              'reply handling',
              'reporting and optimization'
            ]}
            featured
            ctaHref="/signup"
            ctaLabel="Discuss managed plan"
          />
          <PricingCard
            title="White-label / Custom Ops"
            price="Custom"
            summary="For agencies that want outbound support for themselves or their clients"
            items={[
              'custom campaign workflow',
              'prospect sourcing support',
              'outreach operations',
              'reporting',
              'process support'
            ]}
            ctaHref="/contact"
            ctaLabel="Contact us"
          />
        </div>
        <p className="muted">Pricing depends on target market, data requirements, volume, and scope.</p>
      </Section>

      <Section
        eyebrow="No fake guarantees"
        title="No fake guarantees."
        description="We do not promise guaranteed clients or guaranteed revenue. We run a controlled outbound process designed to create qualified sales conversations. Results depend on the offer, market, targeting, and follow-up."
      >
        <div className="product-highlight">
          <p className="section-kicker">Honest expectations</p>
          <h3>Pipeline work, not fantasy promises.</h3>
          <p className="muted">
            The goal is to create qualified replies and client opportunities through a
            disciplined outbound process, not to sell made-up certainty.
          </p>
        </div>
      </Section>

      <CTASection
        title="Use pricing as a starting point, then scope the pilot around the market."
        body="The best next step is a short conversation about your agency, the clients you want, and the segment worth testing first."
        primaryHref="/signup"
        primaryLabel="Start pilot"
        secondaryHref="/contact"
        secondaryLabel="Contact"
      />
    </MarketingPage>
  );
}
