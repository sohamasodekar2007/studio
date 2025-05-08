import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'EduNexus - Authentication', // Updated title
  description: 'Login or Sign up for EduNexus', // Updated description
};

// This layout intentionally doesn't use AppLayout to provide a clean auth interface.
// It ensures that the header/sidebar from the main AppLayout are not rendered on auth pages.
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
