import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Services | Bookify',
  description: 'Explore available services and appointment durations with Bookify.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
