import Link from 'next/link';

import { CTASection, MarketingPage, OfferCard, Section } from '@/components/marketing';

const products = [
  {
    title: 'Outbound Pilot',
    who: 'Agencies or founder-led teams testing one market with a controlled first motion.',
    included:
      'ICP definition, target account sourcing, contact discovery where possible, personalized messaging, controlled sending, reply handling, and a weekly operating readout.',
    useCase:
      'Use this when the goal is to prove whether a focused outbound offer can create real conversations in 30 days. Best first step if you want to test outbound before hiring SDRs or building an internal team.',
    cta: 'Start a pilot'
  },
  {
    title: 'Managed Client Acquisition',
    who: 'Teams that already know outbound matters and need ongoing execution capacity.',
    included:
      'Recurring campaign waves, sourcing and verification, controlled sending, reply classification, follow-up management, reporting, and optimization.',
    useCase:
      'Use this when outbound should become an ongoing operating motion rather than a one-time pilot. A leaner alternative to building an internal outbound department too early.',
    cta: 'Discuss managed execution'
  },
  {
    title: 'White-label Outbound Support',
    who: 'Outbound or marketing agencies that need stronger internal systems and safer workflows.',
    included:
      'Operational infrastructure, protected onboarding, sending-inbox connection workflow, reply sync, review visibility, and internal coordination surfaces.',
    useCase:
      'Use this when the agency needs more than list building and copywriting and wants a real operating layer. Useful for agencies that want the capability of an outbound team without carrying the entire operational load internally.',
    cta: 'Explore infrastructure support'
  },
  {
    title: 'Client Onboarding + Gmail Connection',
    who: 'Agencies onboarding new clients into a controlled outbound setup.',
    included:
      'Client profile creation, Gmail connection through Google OAuth, onboarding checklist, mailbox status visibility, and operator visibility.',
    useCase: 'Use this when the first problem is getting clients live safely without passing passwords around or exposing send controls.',
    cta: 'Begin onboarding'
  }
];

export default function ProductsPage() {
  return (
    <MarketingPage>
      <Section
        eyebrow="Products"
        title="Different service shapes for different stages of the outbound motion."
        description="Each offering keeps the same safety posture: no self-serve send controls for clients, no browser exposure of operator secrets, and no claim that human review has disappeared."
      >
        <div className="feature-grid">
          {products.map((product) => (
            <OfferCard
              key={product.title}
              title={product.title}
              who={product.who}
              included={product.included}
              useCase={product.useCase}
              ctaHref="/signup"
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
        title="Start with the smallest credible scope."
        body="For most early engagements, the right move is a pilot before trying to scale into a bigger outbound operating layer."
        primaryHref="/signup"
        primaryLabel="Start onboarding"
        secondaryHref="/faq"
        secondaryLabel="Read common questions"
      />
    </MarketingPage>
  );
}
