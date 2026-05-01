import type { ReactNode } from 'react';

export function Panel({
  title,
  children,
  tone = 'default'
}: {
  title: string;
  children: ReactNode;
  tone?: 'default' | 'accent' | 'warning';
}) {
  return (
    <section className={`panel panel-${tone}`}>
      <div className="panel-title-row">
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function StatGrid({
  items
}: {
  items: Array<{ label: string; value: string | number; hint?: string }>;
}) {
  return (
    <div className="stat-grid">
      {items.map((item) => (
        <article className="stat-card" key={item.label}>
          <p className="stat-label">{item.label}</p>
          <p className="stat-value">{item.value}</p>
          {item.hint ? <p className="stat-hint">{item.hint}</p> : null}
        </article>
      ))}
    </div>
  );
}

export function Checklist({
  items
}: {
  items: Array<{ label: string; done: boolean; note?: string }>;
}) {
  return (
    <ul className="checklist">
      {items.map((item) => (
        <li className={`checklist-item${item.done ? ' is-done' : ''}`} key={item.label}>
          <span className="checkmark">{item.done ? 'Ready' : 'Pending'}</span>
          <div>
            <strong>{item.label}</strong>
            {item.note ? <p>{item.note}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DataList({
  rows,
  emptyMessage = 'Nothing to show yet.'
}: {
  rows: Array<{ label: string; value: ReactNode }>;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <p className="muted">{emptyMessage}</p>;
  }

  return (
    <dl className="data-list">
      {rows.map((row) => (
        <div className="data-row" key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
