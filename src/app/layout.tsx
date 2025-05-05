import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { AppLayout } from '@/components/layout/app-layout'; // Import AppLayout
import { Toaster } from "@/components/ui/toaster"; // Import Toaster

export const metadata: Metadata = {
  title: 'ExamPrep Hub - MHT-CET, JEE, NEET Test Series', // Updated title
  description: 'Practice tests and performance analysis for MHT-CET, JEE, and NEET aspirants.', // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className={`antialiased font-sans`}>
        <AppLayout> {/* Wrap children with AppLayout */}
          {children}
        </AppLayout>
        <Toaster /> {/* Add Toaster here for notifications */}
      </body>
    </html>
  );
}
