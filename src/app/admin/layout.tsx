'use client'; // Required for SidebarProvider context

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminHeader } from '@/components/admin/admin-header';
import { AuthProvider } from '@/context/auth-context';
import { SidebarProvider } from '@/components/ui/sidebar'; // Import SidebarProvider

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
      <SidebarProvider defaultOpen={true}> {/* Wrap with SidebarProvider */}
        <div className={`flex min-h-screen bg-muted/40 ${inter.className}`}>
          <AdminSidebar />
          <div className="flex flex-col flex-1">
            <AdminHeader />
            {/* Main content area - padding adjusted by AdminHeader/Sidebar state */}
            <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </AuthProvider>
  );
}
