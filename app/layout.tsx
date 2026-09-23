import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LinkedIn Radar',
  description: 'Score your own LinkedIn exports against your ideal customer profile.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
