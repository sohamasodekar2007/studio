// src/app/test-interface/[testCode]/layout.tsx
import type { ReactNode } from 'react';

export const metadata = {
  title: 'EduNexus Test Interface',
  description: 'Attempt your scheduled test.',
};

// This layout removes the main AppLayout (header/sidebar) for a focused test environment.
export default function TestInterfaceLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-muted flex flex-col min-h-screen">
        {/* Removed ThemeProvider and AuthProvider from here as they should be in the root layout */}
        {/* The root layout already handles AuthProvider and ThemeProvider */}
        {children}
        {/* Toaster can also be in root layout, or here if specific to test interface */}
      </body>
    </html>
  );
}
