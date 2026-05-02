import Link from 'next/link';

import { CTASection, MarketingPage, OfferCard, Section } from '@/components/marketing';

const products = [
  {
    title: 'Outbound Pilot',
    summary: 'A 30-day campaign to test one target market.',
    included:
      'Target segment selection, prospect list building, contact research, outreach messaging, controlled launch, follow-up handling, reply tracking, and weekly reporting.',
    bestFor: 'Agencies that want to test whether outbound can create real sales conversations.',
    cta: 'Start pilot'
  },
  {
    title: 'Managed Client Acquisition',
    summary: 'Ongoing outbound execution for agencies that want consistent pipeline.',
    included:
      'Monthly campaign waves, new prospect segments, contact sourcing, message iteration, follow-up management, reply handling, and reporting and optimization.',
    bestFor: 'Agencies ready to make outbound a serious acquisition channel.',
    cta: 'Discuss managed plan'
  },
  {
    title: 'White-label Outbound Support',
    summary: 'Behind-the-scenes outbound execution for agencies serving their own clients.',
    included:
      'Campaign operations, prospect sourcing support, outreach workflow support, reply and outcome tracking, and process documentation.',
    bestFor:
      'Agencies that want fulfillment support without building the whole operation internally.',
    cta: 'Contact us'
  }
];

export default function ProductsPage() {
  return (
    <MarketingPage>
      <Section
        eyebrow="Products"
        title="Client acquisition offers for agencies."
        description="Start with a focused outbound pilot. Expand only when the market shows signal."
      >
        <div className="feature-grid">
          {products.map((product) => (
            <OfferCard
              key={product.title}
              title={product.title}
              summary={product.summary}
              included={product.included}
              bestFor={product.bestFor}
              ctaHref={product.title === 'White-label Outbound Support' ? '/contact' : '/signup'}
              ctaLabel={product.cta}
            />
          ))}
        </div>
        <div className="button-row">
          <Link className="primary-button" href="/signup">
            Start pilot
          </Link>
          <Link className="secondary-button" href="/pricing">
            View pricing
          </Link>
        </div>
      </Section>

      <CTASection
        title="Start small, then expand when the campaign proves the market."
        body="A pilot campaign is the best first step if you want more pipeline without overbuilding the outbound operation too early."
        primaryHref="/signup"
        primaryLabel="Start pilot"
        secondaryHref="/contact"
        secondaryLabel="Contact"
      />
    </MarketingPage>
  );
}
