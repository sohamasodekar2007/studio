import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { AppLayout } from '@/components/layout/app-layout'; // Import AppLayout
import { Toaster } from "@/components/ui/toaster"; // Import Toaster
import { AuthProvider } from '@/context/auth-context'; // Import AuthProvider
import Script from 'next/script'; // Import Script component

export const metadata: Metadata = {
  title: 'STUDY SPHERE - MHT-CET, JEE, NEET Test Series', // Updated title
  description: 'Your ultimate destination for MHT-CET, JEE, and NEET exam preparation. Practice tests, DPPs, performance analysis, and more.', // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
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
         <AuthProvider> {/* Wrap with AuthProvider */}
            <AppLayout> {/* Wrap children with AppLayout */}
              {children}
            </AppLayout>
            <Toaster /> {/* Add Toaster here for notifications */}
         </AuthProvider>
      </body>
    </html>
  );
}
