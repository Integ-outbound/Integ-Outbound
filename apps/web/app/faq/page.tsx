import { CTASection, FAQItem, MarketingPage, Section } from '@/components/marketing';

export default function FaqPage() {
  return (
    <MarketingPage>
      <Section
        eyebrow="FAQ"
        title="Clear answers for practical buyers."
        description="This page stays focused on what agencies care about: client opportunities, qualified sales conversations, and a controlled outbound process."
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
            question="Who is this for?"
            answer="Founder-led agencies, especially paid media, PPC, performance, growth, and B2B service agencies that want more client opportunities."
          />
          <FAQItem
            question="Do you guarantee new clients?"
            answer="No. We do not make fake guarantees. We build and run campaigns designed to create qualified conversations. Whether those conversations turn into clients depends on the offer, pricing, market, and sales follow-up."
          />
          <FAQItem
            question="What makes this different from buying a lead list?"
            answer="We do not just hand over random leads. We build a campaign-specific prospect list, create relevant outreach, launch the campaign, and help manage replies."
          />
          <FAQItem
            question="What happens after someone replies?"
            answer="Interested replies are tracked and surfaced for human follow-up so real opportunities do not get buried."
          />
          <FAQItem
            question="Can I review the outreach before it goes out?"
            answer="Yes. Early campaigns are controlled and human-reviewed."
          />
          <FAQItem
            question="Do I need to hire SDRs?"
            answer="No. The point is to test outbound before committing to a full sales team."
          />
          <FAQItem
            question="How long does setup take?"
            answer="A focused pilot can usually be prepared in a few days once the target market, offer, and campaign scope are clear."
          />
          <FAQItem
            question="How do we start?"
            answer={
              <>
                Apply for a pilot or email <a href="mailto:mark@integ-outbound.com">mark@integ-outbound.com</a>.
              </>
            }
          />
          <FAQItem
            question="Do you need my Gmail password?"
            answer="No. If inbox access is needed, it is handled through secure Google authorization. We never ask for Gmail passwords."
          />
        </div>
      </Section>

      <CTASection
        title="If the fit is right, the next step is a pilot."
        body="Share your agency, offer, and target market, and we can see whether a focused outbound campaign makes sense."
        primaryHref="/signup"
        primaryLabel="Start pilot"
        secondaryHref="/contact"
        secondaryLabel="Contact"
      />
    </MarketingPage>
  );
}
