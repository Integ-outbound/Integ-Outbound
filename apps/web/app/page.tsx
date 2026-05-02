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
        description="Integ is an AI-powered outbound operating system plus managed execution. Software speed. Human judgment. Agency outcomes. We help agencies start more qualified sales conversations without hiring, training, and managing an outbound team from scratch."
        primaryHref="/signup"
        primaryLabel="Start pilot"
        secondaryHref="/what-we-do"
        secondaryLabel="See how it works"
        metrics={[
          {
            title: 'Cheaper than hiring a team',
            body: 'Start with a focused outbound pilot before committing to SDR headcount, training, and management.'
          },
          {
            title: 'Human-reviewed execution',
            body: 'AI speeds up the work, but judgment, reply quality, and sensitive decisions stay reviewed by humans.'
          },
          {
            title: 'Built for agencies',
            body: 'Designed for founder-led teams that want more pipeline without building a full outbound department.'
          },
          {
            title: 'Controlled path to pipeline',
            body: 'The goal is more qualified sales conversations, not more software to manage or risky launch controls.'
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
        eyebrow="Why Integ"
        title="The work of an outbound team, without hiring one."
        description="Hiring SDRs is expensive. Training them takes time. Managing lead lists, outreach, follow-up, and replies creates more operational drag before you even know if the channel works."
      >
        <p className="muted">
          Integ gives agencies a faster path: an AI-powered internal outbound system
          operated with human review, built to help you start more qualified sales
          conversations without building a sales team from scratch.
        </p>
        <div className="feature-grid">
          <FeatureCard
            title="Cheaper than an SDR team"
            body="A full outbound team means salaries, tools, training, management, and ramp time. Integ starts with a focused pilot so you can test outbound before committing to headcount."
          />
          <FeatureCard
            title="Faster than hiring and training"
            body="Instead of spending weeks recruiting and onboarding, we move straight into target selection, prospect sourcing, messaging, and campaign execution."
          />
          <FeatureCard
            title="Powered by internal AI systems"
            body="Our internal tooling helps with research, list building, message creation, reply handling, and campaign organization - the repetitive work that normally slows teams down."
          />
          <FeatureCard
            title="Human judgment where it matters"
            body="AI speeds up execution, but campaign judgment, reply quality, and sensitive decisions stay human-reviewed."
          />
          <FeatureCard
            title="Built for agency economics"
            body="Agencies need pipeline without bloated sales overhead. Integ is designed to give founder-led teams a leaner way to test and run outbound."
          />
          <FeatureCard
            title="Outcome-first execution"
            body="The goal is not more software to manage. The goal is more qualified conversations with prospects who can become clients."
          />
        </div>
        <div className="product-highlight">
          <p className="section-kicker">Why agencies choose this model</p>
          <h3>Start with a pilot. Prove the channel. Scale what works.</h3>
          <p className="muted">
            Integ sits between software and service: an AI-powered outbound operating
            system plus managed execution.
          </p>
          <div className="button-row">
            <Link className="primary-button" href="/signup">
              Start pilot
            </Link>
          </div>
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
            body="We use software to coordinate targeting, research, messaging, review state, reply handling, and internal safety checks while keeping sensitive actions server-side."
            bullets={[
              'target-market intake and campaign setup',
              'account and contact discovery support',
              'message drafting, reply sync, and intent classification',
              'operator visibility into review state and safety'
            ]}
          />
          <div className="product-highlight">
            <p className="section-kicker">Software speed. Human judgment. Agency outcomes.</p>
            <h3>Not just software. Not just an agency.</h3>
            <p className="muted">
              Integ is an AI-powered outbound operating system plus managed execution.
              Clients do not get public campaign launch controls, and the work remains
              human-reviewed where judgment matters.
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
        eyebrow="The system"
        title="A modern outbound workflow built to become more autonomous over time."
        description="The endpoint is a system that can move from target market to qualified opportunity with less manual coordination at every step. Today, Integ combines AI-powered tooling with human review. As the system improves, more of the workflow becomes automated while quality controls stay in place."
      >
        <div className="product-highlight">
          <p className="section-kicker">From target market to client opportunity</p>
          <p className="muted">
            Designed to reduce the work of building an outbound function while keeping
            quality controls in place.
          </p>
        </div>
        <div className="feature-grid">
          <FeatureCard
            title="1. Target market input"
            body="The agency defines who they want as clients: industry, geography, company type, buyer persona, offer, and exclusions."
          />
          <FeatureCard
            title="2. Account discovery"
            body="The system helps identify companies that match the target market and filters out weak fits."
          />
          <FeatureCard
            title="3. Contact discovery"
            body="Relevant decision-makers are found and prioritized based on role, company fit, and outreach relevance."
          />
          <FeatureCard
            title="4. Campaign strategy"
            body="The system turns the agency offer and target market into an outreach angle that makes sense for the prospect."
          />
          <FeatureCard
            title="5. Message generation"
            body="AI drafts outreach based on the prospect, market, and offer. Humans review for quality before launch."
          />
          <FeatureCard
            title="6. Controlled sending"
            body="Campaigns are sent carefully with safety checks, limits, and review gates."
          />
          <FeatureCard
            title="7. Reply detection"
            body="Replies are captured and organized so interested prospects are not missed."
          />
          <FeatureCard
            title="8. Intent classification"
            body="The system identifies positive replies, questions, objections, referrals, not-interested replies, and out-of-office responses."
          />
          <FeatureCard
            title="9. Follow-up control"
            body="Follow-ups adapt based on prospect behavior. When someone replies, irrelevant follow-ups stop."
          />
          <FeatureCard
            title="10. Human handoff"
            body="Interested conversations are handed to the agency or operator for next steps, call booking, and sales follow-up."
          />
          <FeatureCard
            title="11. Learning loop"
            body="Campaign data improves the next wave: better targeting, stronger messages, better qualification, and sharper execution."
          />
        </div>
        <div className="note-grid">
          <div className="note-card">
            <strong>Current model: AI-assisted and human-reviewed.</strong>
            <p>
              Integ is not presented as fully autonomous today. Human review still
              matters for quality, strategy, and sensitive decisions.
            </p>
          </div>
          <div className="note-card">
            <strong>Product direction: increasingly autonomous outbound operations with safety controls.</strong>
            <p>
              The system is built toward autonomous outbound operations while keeping
              review gates and controlled execution in place.
            </p>
          </div>
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
          <FeatureCard
            title="Outbound Pilot"
            body="A 30-day pilot to prove whether a segment, offer, and inbox setup can produce real conversations before hiring SDRs or building an internal team."
          />
          <FeatureCard
            title="Managed Client Acquisition"
            body="Ongoing campaign waves with reply handling, reporting, and iterative messaging improvement for teams that need a leaner alternative to building an internal outbound department too early."
          />
          <FeatureCard
            title="White-label Outbound Support"
            body="A deeper operational layer for agencies that want the capability of an outbound team without carrying the entire operational load internally."
          />
          <FeatureCard title="Client Onboarding + Gmail Connection" body="A safer onboarding path for collecting client profile data, connecting the sending inbox through Google OAuth, and keeping access controlled." />
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
            title="Managed Client Acquisition"
            price="$1,500-$3,000/mo"
            summary="Ongoing campaign waves with optimization and reporting."
            items={[
              'ongoing sourcing and verification',
              'controlled sending',
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
            answer="Today it is better described as an AI-powered outbound operating system plus managed execution. Integ provides infrastructure and workflow support, but it is not positioned as a fully self-serve outbound dashboard."
          />
          <FAQItem
            question="Why use Integ instead of hiring SDRs?"
            answer="Hiring SDRs can work, but it is expensive and slow before the channel is proven. Integ lets agencies test outbound with a managed AI-assisted workflow first, without taking on the cost, training, and management burden of a full team."
          />
          <FAQItem
            question="Is Integ cheaper than building an internal outbound team?"
            answer="Yes, for the initial stage. A full internal team can require salaries, tools, data, training, and management. Integ starts with a focused pilot and scales only when there is signal."
          />
          <FAQItem
            question="Does AI do all the work?"
            answer="No. AI helps with research, drafting, organization, and classification. Human review still matters for quality, strategy, and sensitive decisions. The product direction is more autonomous over time, but current execution is intentionally controlled."
          />
          <FAQItem
            question="What is the long-term vision?"
            answer="The long-term vision is an outbound operating system that can take a client's target market and manage more of the workflow automatically: sourcing, outreach, replies, follow-up, learning, and handoff. The current model is AI-assisted and human-reviewed so quality stays high while the system improves."
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
