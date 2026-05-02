import Link from 'next/link';
import type { ReactNode } from 'react';

export function MarketingNav() {
  return (
    <header className="marketing-nav">
      <Link href="/" className="brand-lockup">
        <span className="brand-mark">IN</span>
        <span className="brand-text">
          <span className="brand-name">Integ</span>
          <span className="brand-tag">AI outbound for agencies</span>
        </span>
      </Link>
      <nav className="nav-links">
        <Link className="nav-link" href="/about">
          About
        </Link>
        <Link className="nav-link" href="/what-we-do">
          What we do
        </Link>
        <Link className="nav-link" href="/products">
          Products
        </Link>
        <Link className="nav-link" href="/pricing">
          Pricing
        </Link>
        <Link className="nav-link" href="/faq">
          FAQ
        </Link>
        <Link className="nav-link" href="/contact">
          Contact
        </Link>
        <Link className="primary-button nav-cta" href="/signup">
          Start pilot
        </Link>
        <Link className="secondary-button nav-cta" href="/operator/login">
          Operator login
        </Link>
      </nav>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="marketing-footer">
      <div className="footer-grid">
        <div>
          <div className="brand-lockup">
            <span className="brand-mark">IN</span>
            <span className="brand-text">
              <span className="brand-name">Integ</span>
              <span className="brand-tag">AI outbound for agencies</span>
            </span>
          </div>
          <p className="footer-note">More qualified sales conversations for agencies.</p>
          <p className="footer-note">
            <a href="mailto:mark@integ-outbound.com">mark@integ-outbound.com</a>
          </p>
          <p className="footer-note">
            Integ runs controlled outbound campaigns. We do not guarantee revenue or booked
            meetings.
          </p>
        </div>
        <div className="footer-links">
          <Link href="/about">About</Link>
          <Link href="/what-we-do">What we do</Link>
          <Link href="/products">Products</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/signup">Start pilot</Link>
        </div>
      </div>
    </footer>
  );
}

export function MarketingPage({
  children
}: {
  children: ReactNode;
}) {
  return (
    <div className="site-frame">
      <div className="marketing-page">
        <MarketingNav />
        <div className="marketing-stack">{children}</div>
        <MarketingFooter />
      </div>
    </div>
  );
}

export function Hero({
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  metrics
}: {
  eyebrow: string;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  metrics: Array<{ title: string; body: string }>;
}) {
  return (
    <section className="hero-grid">
      <div className="hero-panel hero-copy-block">
        <div>
          <p className="section-kicker">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
        <p className="hero-supporting">{description}</p>
        <div className="button-row">
          <Link className="primary-button" href={primaryHref}>
            {primaryLabel}
          </Link>
          <Link className="secondary-button" href={secondaryHref}>
            {secondaryLabel}
          </Link>
        </div>
      </div>
      <div className="hero-metrics">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.title}>
            <strong>{metric.title}</strong>
            <p>{metric.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function Section({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="marketing-section">
      <div className="section-head">
        <p className="section-kicker">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {children}
    </section>
  );
}

export function FeatureCard({
  title,
  body,
  bullets
}: {
  title: string;
  body: string;
  bullets?: string[];
}) {
  return (
    <article className="feature-card">
      <h3>{title}</h3>
      <p>{body}</p>
      {bullets?.length ? (
        <ul>
          {bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function PricingCard({
  title,
  price,
  summary,
  items,
  featured = false,
  ctaHref,
  ctaLabel
}: {
  title: string;
  price: string;
  summary: string;
  items: string[];
  featured?: boolean;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <article className={`pricing-card${featured ? ' is-featured' : ''}`}>
      <div>
        <h3>{title}</h3>
        <div className="price">{price}</div>
      </div>
      <p className="price-note">{summary}</p>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div className="button-row">
        <Link className={featured ? 'primary-button' : 'secondary-button'} href={ctaHref}>
          {ctaLabel}
        </Link>
      </div>
    </article>
  );
}

export function OfferCard({
  title,
  summary,
  included,
  bestFor,
  ctaHref,
  ctaLabel
}: {
  title: string;
  summary: string;
  included: string;
  bestFor: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <article className="offer-card">
      <div className="offer-card-head">
        <h3>{title}</h3>
        <p>{summary}</p>
      </div>
      <dl className="offer-card-list">
        <div>
          <dt>Includes</dt>
          <dd>{included}</dd>
        </div>
        <div>
          <dt>Best for</dt>
          <dd>{bestFor}</dd>
        </div>
      </dl>
      <div className="button-row">
        <Link className="secondary-button" href={ctaHref}>
          {ctaLabel}
        </Link>
      </div>
    </article>
  );
}

export function FAQItem({
  question,
  answer
}: {
  question: string;
  answer: ReactNode;
}) {
  return (
    <details className="faq-item">
      <summary>
        <strong>{question}</strong>
        <span>Open</span>
      </summary>
      <div className="faq-item-content">{answer}</div>
    </details>
  );
}

export function CTASection({
  title,
  body,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel
}: {
  title: string;
  body: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="marketing-cta">
      <div className="cta-card">
        <div>
          <p className="section-kicker">Next step</p>
          <h2>{title}</h2>
        </div>
        <p>{body}</p>
        <div className="button-row">
          <Link className="primary-button" href={primaryHref}>
            {primaryLabel}
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link className="secondary-button" href={secondaryHref}>
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
