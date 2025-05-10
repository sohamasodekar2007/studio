// src/app/layout.tsx
'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { AppLayout } from '@/components/layout/app-layout';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/context/auth-context';
import Script from 'next/script';
import { ThemeProvider } from 'next-themes';
import { useEffect } from 'react'; // Import useEffect

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith('/admin');
  const isAuthRoute = pathname.startsWith('/auth');

  const showAppLayout = !isAdminRoute && !isAuthRoute;

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const handleSelectStart = (event: Event) => {
      // For older IEs and non-standard browsers, `Event` might not have `preventDefault`.
      // However, modern browsers support it on `Event`.
      // For robust text selection prevention, CSS `user-select: none` is also recommended.
      if (event.preventDefault) {
        event.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('selectstart', handleSelectStart); // For text selection

    // Cleanup function to remove event listeners
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('selectstart', handleSelectStart);
    };
  }, []); // Empty dependency array ensures this runs only once on mount and unmount


  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <title>EduNexus - MHT-CET, JEE, NEET Test Series</title>
        <meta name="description" content="Your ultimate destination for MHT-CET, JEE, and NEET exam preparation with EduNexus. Practice tests, DPPs, performance analysis, and more." />
        <link rel="icon" href="/EduNexus-logo-black.jpg" type="image/jpeg" media="(prefers-color-scheme: light)" />
        <link rel="icon" href="/EduNexus-logo-white.jpg" type="image/jpeg" media="(prefers-color-scheme: dark)" />

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
        <Script
          id="mathjax-script"
          strategy="lazyOnload"
          src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
        />
      </head>
      <body className={`antialiased font-sans`}>
         <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
           <AuthProvider>
              {showAppLayout ? (
                <AppLayout>
                  {children}
                </AppLayout>
              ) : (
                <>{children}</>
              )}
              <Toaster />
           </AuthProvider>
         </ThemeProvider>
      </body>
    </html>
  );
}
