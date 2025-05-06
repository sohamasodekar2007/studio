

'use client'; // Required for AuthProvider context and useAuth

// Remove SidebarProvider import
// import { SidebarProvider } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminHeader } from '@/components/admin/admin-header';
import { useAuth } from '@/context/auth-context';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

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

  // Remove the explicit SidebarProvider wrapper here
  return (
    <div className={`flex min-h-screen bg-muted/40`}>
      <AdminSidebar />
      <div className="flex flex-col flex-1">
        <AdminHeader />
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
