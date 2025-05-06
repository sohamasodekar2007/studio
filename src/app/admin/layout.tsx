
'use client'; // Required for AuthProvider context

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminHeader } from '@/components/admin/admin-header';
import { AuthProvider } from '@/context/auth-context';
// Remove SidebarProvider and cn imports
// import { SidebarProvider } from '@/components/ui/sidebar';
// import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'] });

// Metadata can't be exported from Client Components directly.
// Move to a Server Component parent if needed, or handle in head tag directly in RootLayout.
// export const metadata: Metadata = { ... };

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Note: Actual admin role checking should happen within pages or middleware

  return (
    <AuthProvider> {/* Auth context for header/sidebar checks */}
      {/* Revert to original div structure */}
      <div className={`flex min-h-screen bg-muted/40 ${inter.className}`}>
        <AdminSidebar />
        {/* Revert flex-1 div */}
        <div className="flex flex-col flex-1">
          <AdminHeader />
          {/* Main content area */}
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </AuthProvider>
  );
}
