import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'LiquiGuard — Autonomous DeFi Micro-Hedging on Somnia',
  description:
    'Protect lending collateral from liquidation with automated DreamDEX binary event micro-hedges powered by Somnia Shannon sub-second finality.',
  icons: {
    icon: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="cyber-bg min-h-screen text-slate-100 antialiased selection:bg-cyan-500 selection:text-black">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
