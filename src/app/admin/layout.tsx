

'use client'; // Required for AuthProvider context and SidebarProvider

import { AuthProvider } from '@/context/auth-context';
import { SidebarProvider } from '@/components/ui/sidebar';
import AdminLayoutContent from '@/components/admin/admin-layout'; // Import the renamed content component

export default function AdminRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthProvider>
      <SidebarProvider defaultOpen> {/* Wrap content with SidebarProvider here */}
        <AdminLayoutContent>{children}</AdminLayoutContent>
      </SidebarProvider>
    </AuthProvider>
  );
}
