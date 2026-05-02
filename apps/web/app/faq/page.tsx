import { CTASection, FAQItem, MarketingPage, Section } from '@/components/marketing';

export default function FaqPage() {
  return (
    <MarketingPage>
      <Section
        eyebrow="FAQ"
        title="Clear answers for the practical questions."
        description="The goal is to stay concrete about what Integ already supports and what still remains controlled or human-reviewed."
      >
        <div className="faq-list">
          <FAQItem
            question="Is this a SaaS tool or a managed service?"
            answer="Today it is best understood as an AI-powered outbound operating system plus managed execution. The software supports onboarding, reply sync, review visibility, and operator workflow, while the service side helps agencies run the work credibly."
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
            question="Do clients give Gmail passwords?"
            answer="No. Clients connect Gmail through Google OAuth. The onboarding flow is built around OAuth-based connection rather than collecting mailbox passwords."
          />
          <FAQItem
            question="How does Gmail connection work?"
            answer="A client completes onboarding, then clicks Connect Gmail. The frontend starts a server-side request to the backend OAuth flow, Google returns to the API callback, and the mailbox is attached to the correct client record."
          />
          <FAQItem
            question="Do you guarantee booked meetings?"
            answer="No. Integ is focused on controlled outbound execution, better messaging operations, safer sending, and cleaner reply handling. Outcome quality depends on market, offer, inbox health, and many variables outside a blanket guarantee."
          />
          <FAQItem
            question="What happens if replies come in?"
            answer="Replies are synced, classified, and used to stop future follow-ups. Interested replies are handed to humans so the next step is handled intentionally."
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
            question="Do you use generic lead lists?"
            answer="No. The goal is to work from a defined ICP and a targeted account set rather than a broad, context-free list."
          />
          <FAQItem
            question="What kind of companies do you target?"
            answer="That depends on the client, the offer, and the market. The workflow starts by defining the ICP before targeting or messaging work begins."
          />
          <FAQItem
            question="How long does setup take?"
            answer="A pilot setup can move quickly once the client profile, Gmail connection, offer positioning, and targeting assumptions are in place."
          />
          <FAQItem
            question="Is outreach automated?"
            answer="Parts of the workflow are AI-assisted and systematized, but the current posture is controlled outbound with human review still in the loop where it matters."
          />
          <FAQItem
            question="Can clients review messages before sending?"
            answer="That can be part of the operating process, but the current frontend does not expose self-serve campaign launch or send controls to clients."
          />
        </div>
      </Section>

      <CTASection
        title="If the questions match, the next step is onboarding."
        body="The onboarding flow is the cleanest way to start a pilot conversation without exposing campaign launch controls or unsafe client-side actions."
        primaryHref="/signup"
        primaryLabel="Start pilot"
      />
    </MarketingPage>
  );
}
