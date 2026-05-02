import Link from 'next/link';

import { CTASection, FAQItem, FeatureCard, Hero, MarketingPage, PricingCard, Section } from '@/components/marketing';

export default function HomePage() {
  return (
    <MarketingPage>
      <Hero
        eyebrow="Integ outbound"
        title="More clients for agencies through better outbound."
        description="We help agencies find the right prospects, start better conversations, and turn outbound into a repeatable client acquisition channel."
        primaryHref="/signup"
        primaryLabel="Start pilot"
        secondaryHref="/what-we-do"
        secondaryLabel="See how it works"
        metrics={[
          {
            title: 'More qualified conversations',
            body: 'We focus on reaching the right people with messages that are specific enough to get real replies.'
          },
          {
            title: 'Done-for-you execution',
            body: 'We help with targeting, prospect sourcing, outreach, follow-up, reply handling, and campaign improvement.'
          },
          {
            title: 'Built for agencies',
            body: 'Designed for agencies that want more pipeline without hiring SDRs or relying only on referrals.'
          },
          {
            title: 'Start with a pilot',
            body: 'We test one focused segment first, learn from the market, and scale only when the signal is real.'
          }
        ]}
      />

      <Section
        eyebrow="The problem"
        title="Referrals are not a growth strategy."
        description="Most agencies know they need more pipeline, but outbound usually turns into a messy mix of bad lists, generic messages, missed follow-ups, and inconsistent execution."
      >
        <div className="feature-grid">
          <FeatureCard
            title="Pipeline is inconsistent"
            body="Some months are busy. Some months are dry. Referrals are useful, but they are not predictable enough to build around."
          />
          <FeatureCard
            title="Outbound feels painful"
            body="Building lists, finding contacts, writing messages, following up, and tracking replies takes time most agency founders do not have."
          />
          <FeatureCard
            title="Most lead lists are weak"
            body="Generic databases create generic outreach. Generic outreach gets ignored."
          />
          <FeatureCard
            title="Replies get wasted"
            body="Interested prospects need fast, thoughtful handling. A slow or sloppy reply process kills opportunities."
          />
        </div>
        <div className="note-card">
          <strong>Integ turns this into a focused outbound process built around conversations, not busywork.</strong>
        </div>
      </Section>

      <Section
        eyebrow="What Integ does"
        title="We build and run outbound campaigns for agencies."
        description="Integ helps agencies turn a target market into a live outbound campaign: the account list, the contacts, the messaging, the sending, the follow-up, and the reply handling."
      >
        <div className="feature-grid">
          <FeatureCard
            title="Pick the right market"
            body="We help define one clear target segment so the campaign is focused from day one."
          />
          <FeatureCard
            title="Build the prospect list"
            body="We source companies that actually fit the campaign instead of dumping thousands of random leads into a sequence."
          />
          <FeatureCard
            title="Find decision-makers"
            body="We look for founders, owners, CEOs, growth leads, marketing leaders, or the people most likely to care."
          />
          <FeatureCard
            title="Write sharper outreach"
            body="We create messages based on the prospect, the agency offer, and the campaign angle."
          />
          <FeatureCard
            title="Launch controlled outreach"
            body="We send in a controlled way, review the campaign, and avoid reckless volume."
          />
          <FeatureCard
            title="Handle replies"
            body="We track interested replies, questions, objections, and next steps so real opportunities do not get lost."
          />
          <FeatureCard
            title="Improve the next wave"
            body="We use actual market response to improve targeting, messaging, and follow-up."
          />
        </div>
        <div className="product-highlight">
          <p className="section-kicker">The engine behind the service</p>
          <h3>Managed outcome first. Systems underneath.</h3>
          <p className="muted">
            Behind the scenes, Integ uses AI-assisted research, drafting, inbox-based
            outreach, reply tracking, and human review to keep campaigns organized and
            controlled. The buyer does not need to manage the machinery - they get the
            outcome.
          </p>
        </div>
      </Section>

      <Section
        eyebrow="Who it is for"
        title="For agencies that can deliver, but need more opportunities."
        description="Integ works best for agencies with a real offer, proof of delivery, and a desire to create more client conversations."
      >
        <div className="feature-grid">
          <FeatureCard
            title="Paid media agencies"
            body="PPC, Google Ads, Meta Ads, TikTok Ads, and performance agencies that want more sales conversations with ecommerce, SaaS, local service, or B2B prospects."
          />
          <FeatureCard
            title="Growth agencies"
            body="Teams helping clients with acquisition, funnels, conversion, revenue growth, or demand generation."
          />
          <FeatureCard
            title="B2B service agencies"
            body="Agencies with clear offers and enough deal value to justify outbound."
          />
          <FeatureCard
            title="Founder-led teams"
            body="Small teams where the founder is still involved in sales and needs a more consistent pipeline."
          />
        </div>
        <div className="split-band">
          <FeatureCard
            title="Not for agencies with a weak offer."
            body="Outbound cannot fix a bad offer, weak delivery, or unclear market. We work best when the agency already knows how to deliver and needs more qualified conversations."
          />
          <div className="product-highlight">
            <p className="section-kicker">Best-fit agencies</p>
            <h3>Built for founder-led teams that want a repeatable acquisition channel.</h3>
            <p className="muted">
              The strongest fit is an agency that wants more clients and qualified sales
              conversations without hiring SDRs or chasing random cold email tactics.
            </p>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Controlled pilot"
        title="Start with one campaign. Prove the signal."
        description="We do not start with a giant retainer or massive blast. We start with one focused outbound pilot, test the market, and see whether the campaign creates real conversations."
      >
        <div className="split-band">
          <FeatureCard
            title="What the pilot includes"
            body="A pilot campaign is designed to test whether outbound can become a reliable source of qualified sales opportunities."
            bullets={[
              'One target segment',
              'Prospect list building',
              'Contact research where possible',
              'Outreach strategy',
              'Message writing',
              'Controlled sending',
              'Follow-up handling',
              'Reply tracking',
              'Weekly reporting',
              'Next-step recommendations'
            ]}
          />
          <div className="product-highlight">
            <p className="section-kicker">Pilot campaign</p>
            <h3>Apply for pilot</h3>
            <p className="muted">
              Opening limited early pilot slots for agencies that want more sales
              opportunities.
            </p>
            <div className="button-row">
              <Link className="primary-button" href="/signup">
                Apply for pilot
              </Link>
              <Link className="secondary-button" href="/contact">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Pricing preview"
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
            ctaHref="/pricing"
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
            ctaHref="/pricing"
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
            ctaHref="/pricing"
            ctaLabel="Contact us"
          />
        </div>
      </Section>

      <Section
        eyebrow="FAQ preview"
        title="A few practical questions serious buyers ask early."
        description="The answers stay focused on outcomes, controlled execution, and honest expectations."
      >
        <div className="faq-list">
          <FAQItem
            question="What does Integ actually do?"
            answer="We help agencies run outbound campaigns that create more qualified sales conversations. That includes targeting, prospect list building, contact research, outreach messaging, follow-up, reply handling, and reporting."
          />
          <FAQItem
            question="Is this software or a service?"
            answer="It is a managed service powered by internal software. Clients get the campaign execution and outcome-focused workflow, not another tool they need to manage."
          />
          <FAQItem
            question="Do you guarantee new clients?"
            answer="No. We do not make fake guarantees. We build and run campaigns designed to create qualified conversations. Whether those conversations turn into clients depends on the offer, pricing, market, and sales follow-up."
          />
        </div>
        <div className="button-row">
          <Link className="secondary-button" href="/faq">
            Read full FAQ
          </Link>
        </div>
      </Section>

      <CTASection
        title="Start with one segment. Prove the signal. Scale what works."
        body="If you want to turn outbound into a more predictable client acquisition channel, the best next step is a focused pilot campaign."
        primaryHref="/signup"
        primaryLabel="Start pilot"
        secondaryHref="/contact"
        secondaryLabel="Contact"
      />
    </MarketingPage>
  );
}
