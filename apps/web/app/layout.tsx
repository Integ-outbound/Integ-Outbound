import type { Metadata } from 'next';
import { IBM_Plex_Mono, Space_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';

import './globals.css';

const headingFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-heading'
});

const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500']
});

export const metadata: Metadata = {
  title: 'Integ Outbound',
  description: 'Onboarding and operator visibility for integ-outbound.'
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${headingFont.variable} ${monoFont.variable}`}>{children}</body>
    </html>
  );
}
