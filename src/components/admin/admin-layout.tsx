

'use client'; // Required for AuthProvider context and useAuth

import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminHeader } from '@/components/admin/admin-header';
import { useAuth } from '@/context/auth-context';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils'; // Import cn utility

// Metadata can't be exported from Client Components directly.

// Rename the component
export default function AdminLayoutContent({
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

  // Main layout structure using flexbox
  return (
    <div className="flex min-h-screen bg-muted/40">
      {/* Sidebar is positioned fixed by its own component */}
      <AdminSidebar />
       {/* Main content area: Adjust left margin based on sidebar state */}
       {/* Use peer classes to react to the sidebar's data-state */}
      <div
        className={cn(
          "flex flex-col flex-1 transition-[margin-left] duration-300 ease-in-out",
          // Apply margin only on sm+ screens
          // When sidebar is expanded (default state, or data-state=expanded)
          "sm:ml-[var(--sidebar-width)]",
           // When sidebar is collapsed (data-state=collapsed)
          "peer-data-[state=collapsed]:sm:ml-[var(--sidebar-width-icon)]" // Use peer selector based on Sidebar's data-state
        )}
       >
        <AdminHeader />
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

