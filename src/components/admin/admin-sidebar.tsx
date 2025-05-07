// src/components/admin/admin-sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Users,
  Settings,
  BarChart3,
  ShieldCheck,
  ClipboardList,
  FileText,
  Banknote,
  Edit,
  PlusCircle, 
  List, 
  Globe,
  PieChart 
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
} from '@/components/ui/sidebar'; 
import { useAuth } from '@/context/auth-context'; 

// Define navigation items for the admin sidebar
const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: Home },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/tests/manage', label: 'Manage Tests', icon: List }, 
  { href: '/admin/tests/create', label: 'Create Test', icon: PlusCircle },
  { href: '/admin/questions', label: 'Add Question', icon: ClipboardList },
  { href: '/admin/questions/edit', label: 'Edit Questions', icon: Edit },
  { href: '/admin/notes', label: 'Short Notes', icon: FileText },
  { href: '/admin/payments', label: 'Payments', icon: Banknote },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/reports', label: 'Reports', icon: PieChart }, 
];

const settingsNavItem = { href: '/admin/settings', label: 'Settings', icon: Settings };
const homeNavItem = { href: '/', label: 'Main Website', icon: Globe }; 

export function AdminSidebar() {
  const pathname = usePathname();
  const { user } = useAuth(); 

  const isActive = (href: string) => {
    if (href === '/admin' || href === '/') {
        return pathname === href;
    }
    return pathname.startsWith(href);
  };


  const isAdmin = user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  if (!isAdmin) {
    return null;
  }

  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon">
      <SidebarHeader className="flex items-center justify-between p-2">
        <Link
          href="/admin"
          className="flex items-center gap-2 group-data-[collapsible=icon]:hidden"
          aria-label="Admin Dashboard Home"
          >
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-semibold">SPHERE Admin</h1> 
        </Link>
        <SidebarTrigger className="hidden sm:flex mr-1" />
      </SidebarHeader>

      <SidebarContent className="flex-1 mt-4">
        <SidebarMenu>
           <SidebarMenuItem>
              <Link href={homeNavItem.href} passHref legacyBehavior>
                <SidebarMenuButton as="a" isActive={isActive(homeNavItem.href)} tooltip={homeNavItem.label}>
                  <homeNavItem.icon />
                  <span>{homeNavItem.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          {adminNavItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href} passHref legacyBehavior>
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
             <Link href={settingsNavItem.href} passHref legacyBehavior>
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

