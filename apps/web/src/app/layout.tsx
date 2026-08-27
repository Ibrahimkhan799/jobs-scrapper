import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Archivo } from 'next/font/google';
import { AppShell } from '@/components/app-shell';
import { Providers } from './providers';
import './globals.css';

const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'Job Hunter',
  description: 'Local-first job discovery and matching. Match Score is not a hiring probability.',
};

const DIRECTION_CONTRACT = `THESIS: A private classifieds desk for jobs you might apply to — not a SaaS command center of metric cards.
OWN-WORLD: Cool newsprint ground, Archivo grotesk, hairline rules, oxidized-green match scores as the only color, custom listbox dropdowns.
STORY: Scan ranked listings, open a letter, approve before it leaves.
FIRST VIEWPORT: Nameplate plus text nav; a one-line status strip; a classifieds list of jobs ranked by score with the score as a left gutter.
FORM: Classifieds columns (grounded 7, seed 04305ad8), raised by Japanese density, cloud-edge achromatic field, and split-flap ranked rows.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance`;

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={archivo.variable}>
      <body className="min-h-screen antialiased">
        <noscript dangerouslySetInnerHTML={{ __html: `<!-- ${DIRECTION_CONTRACT} -->` }} />
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
