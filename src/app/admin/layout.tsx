import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Or another appropriate font
import { AdminSidebar } from '@/components/admin/admin-sidebar'; // Adjust path as needed
import { AdminHeader } from '@/components/admin/admin-header'; // Adjust path as needed
import { AuthProvider } from '@/context/auth-context'; // Import AuthProvider
// Import necessary providers if admin section needs separate context (e.g., auth checks)

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'STUDY SPHERE - Admin Panel', // Updated Title
  description: 'Manage STUDY SPHERE content and users.', // Updated Description
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Note: Actual admin role checking should happen within pages or middleware
  // This layout structure assumes the user is authorized to see the admin UI frame.

  return (
    <AuthProvider> {/* Ensure Auth context is available for header/sidebar checks */}
      <div className={`flex min-h-screen bg-muted/40 ${inter.className}`}>
        <AdminSidebar />
        <div className="flex flex-col flex-1">
          <AdminHeader />
          <main className="flex-1 p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </AuthProvider>
  );
}
