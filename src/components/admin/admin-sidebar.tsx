
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Users,
  BookOpen,
  Settings,
  BarChart3,
  ShieldCheck,
  ClipboardList,
  FileText,
  Banknote,
  Edit,
  PlusCircle, // Added icon for Create Test
  List, // Added icon for Manage Tests
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
} from '@/components/ui/sidebar'; // Use the main Sidebar components
import { useAuth } from '@/context/auth-context'; // Get user context if needed later

// Define navigation items for the admin sidebar
const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: Home },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/tests/manage', label: 'Manage Tests', icon: List }, // Updated link and icon
  { href: '/admin/tests/create', label: 'Create Test', icon: PlusCircle },
  { href: '/admin/questions', label: 'Add Question', icon: ClipboardList },
  { href: '/admin/questions/edit', label: 'Edit Questions', icon: Edit },
  { href: '/admin/notes', label: 'Short Notes', icon: FileText },
  { href: '/admin/payments', label: 'Payments', icon: Banknote },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
];

const settingsNavItem = { href: '/admin/settings', label: 'Settings', icon: Settings };

export function AdminSidebar() {
  const pathname = usePathname();
  const { user } = useAuth(); // Could be used to conditionally show items

  const isActive = (href: string) => pathname === href || (href !== '/admin' && pathname.startsWith(href));

  // Check if the current user is the designated admin
  const isAdmin = user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  // Only render the sidebar if the user is an admin
  if (!isAdmin) {
    return null;
  }

  return (
    // Use the main Sidebar component structure
    <Sidebar side="left" variant="sidebar" collapsible="icon">
      <SidebarHeader className="flex items-center justify-between p-2">
        <Link
          href="/admin"
          className="flex items-center gap-2 group-data-[collapsible=icon]:hidden"
          aria-label="Admin Dashboard Home"
          >
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-semibold">SPHERE Admin</h1> {/* Updated Name */}
        </Link>
         {/* Desktop Toggle Trigger */}
        <SidebarTrigger className="hidden sm:flex mr-1" />
      </SidebarHeader>

      <SidebarContent className="flex-1 mt-4">
        <SidebarMenu>
          {adminNavItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href} legacyBehavior passHref>
                <SidebarMenuButton as="a" isActive={isActive(item.href)} tooltip={item.label}>
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="mt-auto">
        <SidebarMenu>
          <SidebarMenuItem>
             <Link href={settingsNavItem.href} legacyBehavior passHref>
               <SidebarMenuButton as="a" isActive={isActive(settingsNavItem.href)} tooltip={settingsNavItem.label}>
                 <settingsNavItem.icon />
                 <span>{settingsNavItem.label}</span>
               </SidebarMenuButton>
             </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

