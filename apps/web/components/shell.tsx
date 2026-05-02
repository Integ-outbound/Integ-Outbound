import Link from 'next/link';
import type { ReactNode } from 'react';

interface ShellProps {
  title: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
  aside?: ReactNode;
  theme?: 'light' | 'dark';
}

export function Shell({
  title,
  eyebrow,
  description,
  children,
  aside,
  theme = 'light'
}: ShellProps) {
  return (
    <div className={`page-shell${theme === 'light' ? ' light-surface' : ''}`}>
      <header className="app-nav">
        <Link href="/" className="brand-lockup">
          <span className="brand-mark">IN</span>
          <span className="brand-text">
            <span className="brand-name">Integ</span>
            <span className="brand-tag">Outbound onboarding and operations</span>
          </span>
        </Link>
        <nav className="app-nav-links">
          <Link className="app-nav-link" href="/">
            Home
          </Link>
          <Link className="app-nav-link" href="/about">
            About
          </Link>
          <Link className="app-nav-link" href="/signup">
            Signup
          </Link>
          <Link className="app-nav-link" href="/onboarding">
            Onboarding
          </Link>
          <Link className="app-nav-link" href="/dashboard">
            Dashboard
          </Link>
          <Link className="app-nav-link" href="/operator">
            Operator
          </Link>
        </nav>
      </header>
      <header className="hero">
        <div>
          <p className="eyebrow">{eyebrow ?? 'Integ Outbound'}</p>
          <h1>{title}</h1>
          {description ? <p className="hero-copy">{description}</p> : null}
        </div>
        <div className="button-row">
          <Link className="secondary-button" href="/signup">
            Start pilot
          </Link>
          <Link className="ghost-button" href="/operator/login">
            Operator access
          </Link>
        </div>
      </header>
      <main className={`content-grid${aside ? ' with-aside' : ''}`}>
        <section className="stack">{children}</section>
        {aside ? <aside className="stack">{aside}</aside> : null}
      </main>
    </div>
  );
}
