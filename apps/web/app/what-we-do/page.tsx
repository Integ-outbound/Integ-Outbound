import { CTASection, FeatureCard, MarketingPage, Section } from '@/components/marketing';

const workflow = [
  'Define the ICP',
  'Source target accounts',
  'Find and verify contacts',
  'Generate personalized outreach',
  'Send through connected Gmail inboxes',
  'Sync and classify replies',
  'Stop follow-ups after replies',
  'Hand interested replies to humans',
  'Report outcomes'
];

export default function WhatWeDoPage() {
  return (
    <MarketingPage>
      <Section
        eyebrow="What we do"
        title="A software-plus-service workflow for controlled outbound execution."
        description="Integ combines software and managed execution so agencies can move from targeting to reply handling without exposing clients to fragile, self-serve sending controls."
      >
        <div className="feature-grid">
          {workflow.map((step, index) => (
            <FeatureCard
              key={step}
              title={`${index + 1}. ${step}`}
              body={
                index === 0
                  ? 'Start with a narrow ICP and a real point of view on who should be targeted first.'
                  : index === 1
                    ? 'Build the account universe that fits the campaign objective instead of reaching for a generic broad list.'
                    : index === 2
                      ? 'Find usable contacts and verify what can be verified before messages go out.'
                      : index === 3
                        ? 'Create personalized outreach that reflects the account, the offer, and the actual campaign angle.'
                        : index === 4
                          ? 'Use connected Gmail inboxes through Google OAuth rather than shared passwords or untracked sending setups.'
                          : index === 5
                            ? 'Integ syncs replies and classifies intent so the team can see what is happening quickly.'
                            : index === 6
                              ? 'When someone replies, the system can stop future follow-ups instead of continuing blindly.'
                              : index === 7
                                ? 'Interested responses are routed back to humans so the conversation quality stays intact.'
                                : 'Operators and clients can review the outcome signals without exposing launch or send controls publicly.'
              }
            />
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Managed execution"
        title="Integ is not just software sitting beside the work."
        description="The current model assumes operational involvement. That is deliberate: agencies often need execution support and safety controls as much as they need a product surface."
      >
        <div className="split-band">
          <FeatureCard
            title="What the software handles"
            body="Onboarding, Gmail connection, protected backend calls, reply sync, review visibility, and operator-safe workflow coordination."
          />
          <FeatureCard
            title="What humans still handle"
            body="Campaign judgment, sensitive review decisions, interested-reply handoff, and the practical tradeoffs that still benefit from operator oversight."
          />
        </div>
      </Section>

      <CTASection
        title="Choose the right entry point."
        body="If the workflow matches what you need, the next question is whether you need a pilot, ongoing managed execution, or deeper infrastructure support."
        primaryHref="/products"
        primaryLabel="See products"
        secondaryHref="/pricing"
        secondaryLabel="View pricing"
      />
    </MarketingPage>
  );
}
