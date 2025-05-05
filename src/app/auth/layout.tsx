import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'EduNexus - Authentication',
  description: 'Login or Sign up for EduNexus',
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // This layout intentionally doesn't use AppLayout to provide a clean auth interface
  return <>{children}</>;
}
