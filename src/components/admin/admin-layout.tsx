

'use client'; 

import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminHeader } from '@/components/admin/admin-header';
import { useAuth } from '@/context/auth-context';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils'; 
import { SidebarProvider } from '@/components/ui/sidebar'; // Import SidebarProvider

// Metadata can't be exported from Client Components directly.

export default function AdminLayoutContent({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL)) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  if (loading || !user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    return (
       <div className="flex items-center justify-center min-h-screen bg-muted/40">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="ml-4 space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
            </div>
       </div>
    ); 
  }

  return (
    <SidebarProvider defaultOpen> {/* Wrap with SidebarProvider here */}
      <div className="flex min-h-screen bg-muted/40">
        <AdminSidebar />
        <div
          className={cn(
            "flex flex-col flex-1 transition-[margin-left] duration-300 ease-in-out",
            "sm:ml-[var(--sidebar-width)]",
            "peer-data-[state=collapsed]:sm:ml-[var(--sidebar-width-icon)]" 
          )}
         >
          <AdminHeader />
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
