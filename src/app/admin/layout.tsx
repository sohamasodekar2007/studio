// src/app/admin/layout.tsx
'use client';

import { AuthProvider } from '@/context/auth-context';
import { SidebarProvider } from '@/components/ui/sidebar'; // Import SidebarProvider
import AdminLayoutContent from '@/components/admin/admin-layout';

export default function AdminRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthProvider>
      <SidebarProvider defaultOpen> {/* Ensure SidebarProvider wraps AdminLayoutContent */}
        <AdminLayoutContent>{children}</AdminLayoutContent>
      </SidebarProvider>
    </AuthProvider>
  );
}
