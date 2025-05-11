// src/components/admin/admin-layout.tsx
'use client';

import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminHeader } from '@/components/admin/admin-header';
import { useAuth } from '@/context/auth-context';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
// SidebarProvider is now handled in src/app/admin/layout.tsx

export default function AdminLayoutContent({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Added check for NEXT_PUBLIC_ADMIN_EMAIL before using it
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    if (!loading && (!user || !adminEmail || user.email !== adminEmail)) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

   // Added check for NEXT_PUBLIC_ADMIN_EMAIL before using it
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  if (loading || !user || !adminEmail || user.email !== adminEmail) {
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
      <div className="flex min-h-screen bg-muted/40">
        <AdminSidebar /> {/* This is the <Sidebar> which is part of the flex flow */}
        <div
          className={cn(
            "flex flex-col flex-1" // Main content takes remaining space. Removed explicit margin and transition.
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
