import Link from 'next/link';

import {
  CTASection,
  FAQItem,
  FeatureCard,
  Hero,
  MarketingPage,
  PricingCard,
  Section
} from '@/components/marketing';

export default function HomePage() {
  return (
    <MarketingPage>
      <Hero
        eyebrow="Integ outbound"
        title="AI-assisted outbound infrastructure for agencies that want more qualified sales conversations without hiring SDRs."
        description="Integ combines software plus managed execution for founder-led and agency-led outbound pilots. We help define the target market, connect Gmail safely, send through real inboxes, sync replies, stop follow-ups after human responses, and keep operators in control."
        primaryHref="/signup"
        primaryLabel="Start pilot"
        secondaryHref="/what-we-do"
        secondaryLabel="See how it works"
        metrics={[
          {
            title: 'Controlled sending',
            body: 'Gmail-based outreach with review-friendly guardrails instead of fully hands-off automation.'
          },
          {
            title: 'Human review stays in the loop',
            body: 'Interested replies, draft review, and operator oversight remain part of the operating model.'
          },
          {
            title: 'Built for agencies',
            body: 'Useful when you need outbound fulfillment, repeatable ops, or white-label infrastructure.'
          },
          {
            title: 'Early-stage and execution-focused',
            body: 'Positioned for controlled pilots, not broad self-serve campaign launching.'
          }
        ]}
      />

      <Section
        eyebrow="Problem"
        title="Outbound is easy to start badly and expensive to run well."
        description="Agencies and small sales teams usually hit the same wall: fragmented research, risky sending setups, weak reply handling, and too much manual work for every campaign wave."
      >
        <div className="feature-grid">
          <FeatureCard
            title="Tool sprawl slows execution"
            body="Lists, verification, messaging, sending, inbox management, and reporting often live in disconnected systems."
          />
          <FeatureCard
            title="Bad automation burns trust"
            body="If follow-ups keep running after someone replies, or if generic copy hits the wrong inbox, credibility disappears fast."
          />
          <FeatureCard
            title="Hiring SDRs is not always the right first move"
            body="Many agencies need a controlled pilot before building a full outbound team or promising outbound as a bigger service line."
          />
          <FeatureCard
            title="Operators still need visibility"
            body="Even with AI assistance, agencies need human review, reply visibility, and a clean handoff when intent is real."
          />
        </div>
      </Section>

      <Section
        eyebrow="What Integ does"
        title="Integ gives agencies an outbound operating layer with managed execution."
        description="The aim is not to sell a shiny dashboard first. The aim is to help agencies run controlled outbound pilots with better infrastructure, better process discipline, and clearer reply handling."
      >
        <div className="split-band">
          <FeatureCard
            title="Software plus operator workflow"
            body="We use software to coordinate client onboarding, Gmail connection, review state, reply sync, and internal safety checks while keeping sensitive actions server-side."
            bullets={[
              'Gmail OAuth mailbox connection',
              'reply sync and intent classification',
              'follow-up stopping after replies',
              'operator visibility into onboarding and safety'
            ]}
          />
          <div className="product-highlight">
            <p className="section-kicker">What this is not</p>
            <h3>Not a self-serve campaign launcher</h3>
            <p className="muted">
              Clients do not get campaign launch controls here yet. Integ is still optimized for
              controlled pilots, internal review, and managed outbound execution.
            </p>
            <div className="button-row">
              <Link className="secondary-button" href="/products">
                Explore offerings
              </Link>
            </div>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="How it works"
        title="A structured workflow from ICP definition to human handoff."
        description="Every step is designed to keep outbound moving without pretending human judgment is optional."
      >
        <div className="feature-grid">
          <FeatureCard title="1. Define the ICP" body="Clarify who should be targeted, which segments matter first, and what the offer should sound like." />
          <FeatureCard title="2. Source accounts and contacts" body="Build target-account lists and find usable contacts, then verify what can be verified before outreach starts." />
          <FeatureCard title="3. Generate messaging" body="Draft personalized outreach around the account, context, and service angle instead of blasting a generic template." />
          <FeatureCard title="4. Send through connected Gmail" body="Use real connected inboxes through Google OAuth, not shared passwords or opaque relay tricks." />
          <FeatureCard title="5. Sync and classify replies" body="Integ watches for replies, classifies intent, and stops follow-ups when a real response arrives." />
          <FeatureCard title="6. Hand interested responses to humans" body="Reply handling stays controlled so real conversations can move to the right operator or client team." />
        </div>
      </Section>

      <Section
        eyebrow="Who it is for"
        title="Built for agencies that need controlled outbound execution."
        description="The strongest fit today is an agency, consultant, or founder-led team that wants outbound capacity and infrastructure without pretending the process is already fully autonomous."
      >
        <div className="feature-grid">
          <FeatureCard title="Outbound agencies" body="Agencies that want fulfillment support, execution infrastructure, or a white-label operating layer for clients." />
          <FeatureCard title="Marketing partners adding outbound" body="Teams that already own strategy or growth work and want a cleaner path into outbound pilots." />
          <FeatureCard title="Founder-led service businesses" body="Small teams that need qualified sales conversations but are not ready to build a traditional SDR function." />
          <FeatureCard title="Early backers and collaborators" body="Stakeholders who need to see a credible, controlled workflow instead of inflated automation claims." />
        </div>
      </Section>

      <Section
        eyebrow="Products"
        title="Four clear entry points depending on the stage of the engagement."
        description="The same infrastructure can support a pilot, managed execution, or deeper agency-facing operations support."
      >
        <div className="feature-grid">
          <FeatureCard title="Outbound Pilot" body="A 30-day pilot to prove whether a segment, offer, and inbox setup can produce real conversations." />
          <FeatureCard title="Managed Outbound Engine" body="Ongoing campaign waves with reply handling, reporting, and iterative messaging improvement." />
          <FeatureCard title="AI Outbound Infrastructure" body="A deeper operational layer for agencies that want software plus internal workflow support." />
          <FeatureCard title="Client Onboarding + Gmail Connection" body="A safer onboarding path for collecting client profile data and connecting Gmail through Google OAuth." />
        </div>
        <div className="button-row">
          <Link className="secondary-button" href="/products">
            See product details
          </Link>
        </div>
      </Section>

      <Section
        eyebrow="Pricing preview"
        title="Indicative ranges for early outbound work."
        description="Pricing depends on market, data requirements, send volume, inbox setup, and scope. These ranges are meant to help prospects qualify the conversation, not lock in a contract."
      >
        <div className="pricing-grid">
          <PricingCard
            title="Outbound Pilot"
            price="$750-$1,500"
            summary="30-day pilot for one ICP segment with controlled execution."
            items={[
              '1 ICP segment',
              'target account sourcing',
              'verified outreach list',
              'personalized messaging',
              'controlled sending',
              'reply handling and weekly report'
            ]}
            ctaHref="/pricing"
            ctaLabel="View pricing"
          />
          <PricingCard
            title="Managed Outbound Engine"
            price="$1,500-$3,000/mo"
            summary="Ongoing campaign waves with optimization and reporting."
            items={[
              'ongoing sourcing and verification',
              'Gmail-based sending',
              'reply classification',
              'follow-up management',
              'reporting',
              'optimization'
            ]}
            featured
            ctaHref="/pricing"
            ctaLabel="See managed plan"
          />
          <PricingCard
            title="Custom / White-label Ops"
            price="Custom"
            summary="For agencies needing infrastructure support, fulfillment support, or a white-label motion."
            items={[
              'agency-specific workflows',
              'shared operating processes',
              'custom scope and reporting',
              'delivery tailored to the client mix'
            ]}
            ctaHref="/pricing"
            ctaLabel="See custom scope"
          />
        </div>
      </Section>

      <Section
        eyebrow="FAQ preview"
        title="The questions serious prospects usually ask first."
        description="The answers below stay honest about what is already in place and what still requires human review."
      >
        <div className="faq-list">
          <FAQItem
            question="Is this a SaaS tool or a managed service?"
            answer="Today it is better described as software plus managed execution. Integ provides infrastructure and workflow support, but it is not positioned as a fully self-serve outbound dashboard."
          />
          <FAQItem
            question="Do clients give Gmail passwords?"
            answer="No. Clients connect Gmail through Google OAuth. Passwords are not collected by the frontend."
          />
          <FAQItem
            question="What happens if replies come in?"
            answer="Replies are synced, classified, and used to stop further follow-ups. Interested replies are handed to humans for the next step."
          />
        </div>
        <div className="button-row">
          <Link className="secondary-button" href="/faq">
            Read full FAQ
          </Link>
        </div>
      </Section>

      <CTASection
        title="Start with a controlled pilot, not a vague outbound promise."
        body="If you want to test a market, prove a service offer, or add outbound capability without hiring a full SDR team first, the right next step is a structured onboarding and pilot conversation."
        primaryHref="/signup"
        primaryLabel="Start pilot"
        secondaryHref="/about"
        secondaryLabel="Learn more about Integ"
      />
    </MarketingPage>
  );
}
