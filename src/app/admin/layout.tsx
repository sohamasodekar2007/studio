
'use client'; // Required for SidebarProvider context

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminHeader } from '@/components/admin/admin-header';
import { AuthProvider } from '@/context/auth-context';
import { SidebarProvider } from '@/components/ui/sidebar'; // Import SidebarProvider
import { cn } from '@/lib/utils'; // Import cn utility

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
      {/* Wrap with SidebarProvider and add group/sidebar */}
      <SidebarProvider defaultOpen={true}>
        <div className={`group/sidebar flex min-h-screen bg-muted/40 ${inter.className}`}>
          <AdminSidebar />
          {/* This div will have the dynamic margin based on sidebar state */}
          <div
            className={cn(
              "flex flex-col flex-1 transition-[margin-left] duration-300 ease-in-out",
              "sm:ml-[--sidebar-width-icon] peer-data-[state=expanded]:sm:ml-[--sidebar-width]" // Apply margin based on peer state
            )}
          >
            <AdminHeader />
            {/* Main content area */}
            <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </AuthProvider>
  );
}
