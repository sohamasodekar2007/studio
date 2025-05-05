'use client'; // Make this a client component to use usePathname

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation'; // Import usePathname
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { AppLayout } from '@/components/layout/app-layout';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/context/auth-context';
import Script from 'next/script';

// Metadata should ideally be moved to a parent server component or handled differently
// export const metadata: Metadata = { ... }; // Cannot export metadata from client component

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith('/admin');
  const isAuthRoute = pathname.startsWith('/auth');

  // Determine if the main AppLayout should be rendered
  const showAppLayout = !isAdminRoute && !isAuthRoute;

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        {/* Add title and description meta tags here if needed, as metadata export is not possible */}
        <title>STUDY SPHERE - MHT-CET, JEE, NEET Test Series</title>
        <meta name="description" content="Your ultimate destination for MHT-CET, JEE, and NEET exam preparation. Practice tests, DPPs, performance analysis, and more." />

        {/* MathJax Configuration */}
        <Script id="mathjax-config" strategy="beforeInteractive">
          {`
            window.MathJax = {
              tex: {
                inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
                displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
                processEscapes: true,
              },
              svg: {
                fontCache: 'global'
              },
              options: {
                skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre'],
              },
            };
          `}
        </Script>
        {/* Load MathJax library */}
        <Script
          id="mathjax-script"
          strategy="lazyOnload" // Load after page interactive
          src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
        />
      </head>
      <body className={`antialiased font-sans`}>
         <AuthProvider> {/* AuthProvider wraps everything */}
            {showAppLayout ? (
              <AppLayout> {/* Render AppLayout only for non-admin/non-auth routes */}
                {children}
              </AppLayout>
            ) : (
              <>{children}</> // Render only children for admin/auth routes (AdminLayout/AuthLayout will take over)
            )}
            <Toaster /> {/* Toaster is available globally */}
         </AuthProvider>
      </body>
    </html>
  );
}
