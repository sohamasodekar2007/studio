

'use client'; // Required for AuthProvider context and SidebarProvider

import { AuthProvider } from '@/context/auth-context';
// Removed SidebarProvider import from here
import AdminLayoutContent from '@/components/admin/admin-layout'; 

export default function AdminRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthProvider>
      {/* SidebarProvider is now handled within AdminLayoutContent/AdminSidebar components */}
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </AuthProvider>
  );
}
