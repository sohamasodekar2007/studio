

'use client'; // Required for AuthProvider context and SidebarProvider

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminHeader } from '@/components/admin/admin-header';
import { AuthProvider } from '@/context/auth-context';
import { SidebarProvider } from '@/components/ui/sidebar'; // Re-import SidebarProvider
import { useAuth } from '@/context/auth-context'; // Import useAuth
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

const inter = Inter({ subsets: ['latin'] });

// Metadata can't be exported from Client Components directly.

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL)) {
      // Redirect non-admin users or logged-out users away from admin panel
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  // Show loading state or nothing if user is not admin yet
  if (loading || !user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    return (
       <div className="flex items-center justify-center min-h-screen bg-muted/40">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="ml-4 space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
            </div>
       </div>
    ); // Or a loading spinner
  }


  return (
    <AuthProvider>
      {/* Wrap the content with SidebarProvider */}
      <SidebarProvider defaultOpen>
        <div className={`flex min-h-screen bg-muted/40 ${inter.className}`}>
          <AdminSidebar /> {/* Sidebar remains inside SidebarProvider */}
          <div className="flex flex-col flex-1"> {/* Content Area takes remaining space */}
            <AdminHeader />
            <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </AuthProvider>
  );
}
