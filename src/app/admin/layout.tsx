import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Or another appropriate font
import { AdminSidebar } from '@/components/admin/admin-sidebar'; // Adjust path as needed
import { AdminHeader } from '@/components/admin/admin-header'; // Adjust path as needed
// Import necessary providers if admin section needs separate context (e.g., auth checks)

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ExamPrep Hub - Admin Panel',
  description: 'Manage ExamPrep Hub content and users.',
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // TODO: Add robust authentication and authorization check here.
  // Redirect non-admins or show an unauthorized message.
  // Example:
  // const { user, isAdmin, loading } = useAdminAuth(); // Replace with your actual auth logic
  // if (loading) return <div>Loading Admin Panel...</div>;
  // if (!isAdmin) { router.push('/'); return null; } // Or show unauthorized

  return (
    <div className={`flex min-h-screen bg-muted/40 ${inter.className}`}>
      <AdminSidebar />
      <div className="flex flex-col flex-1">
        <AdminHeader />
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
