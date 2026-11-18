import type { Metadata } from 'next';
import './globals.css';
import type { RootLayoutProps } from './types/layout.types';

export const metadata: Metadata = {
  title: 'Services | Bookify',
  description: 'Explore available services and appointment durations with Bookify.',
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
