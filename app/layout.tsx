import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OneMetric — Dynamic Campaign Segmentation Engine',
  description:
    'Production-grade intent segmentation engine featuring dual-gate hysteresis, cross-BU ownership protocol, and HubSpot CRM sync.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
