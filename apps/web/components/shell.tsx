import Link from 'next/link';
import type { ReactNode } from 'react';

interface ShellProps {
  title: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
  aside?: ReactNode;
}

export function Shell({ title, eyebrow, description, children, aside }: ShellProps) {
  return (
    <div className="page-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">{eyebrow ?? 'Integ Outbound'}</p>
          <h1>{title}</h1>
          {description ? <p className="hero-copy">{description}</p> : null}
        </div>
        <nav className="hero-nav">
          <Link href="/">Home</Link>
          <Link href="/signup">Signup</Link>
          <Link href="/onboarding">Onboarding</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/operator">Operator</Link>
        </nav>
      </header>
      <main className={`content-grid${aside ? ' with-aside' : ''}`}>
        <section className="stack">{children}</section>
        {aside ? <aside className="stack">{aside}</aside> : null}
      </main>
    </div>
  );
}
