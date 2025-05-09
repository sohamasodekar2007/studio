// src/app/admin/layout.tsx
'use client';

import { AuthProvider } from '@/context/auth-context';
import { SidebarProvider } from '@/components/ui/sidebar';
import AdminLayoutContent from '@/components/admin/admin-layout';

export default function AdminRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthProvider>
      {/* Admin routes have their own SidebarProvider instance */}
      <SidebarProvider defaultOpen>
        <AdminLayoutContent>{children}</AdminLayoutContent>
      </SidebarProvider>
    </AuthProvider>
  );
}