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
  PieChart,
  BookOpen,
  Gift,
  ShoppingBag,
  Package
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
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { useAuth } from '@/context/auth-context';
import Image from 'next/image';

// Define navigation items for the admin sidebar
const mainNavItems = [
  { href: '/admin', label: 'Dashboard', icon: Home },
  { href: '/admin/users', label: 'Users', icon: Users },
];

const contentManagementItems = [
  { href: '/admin/tests/manage', label: 'Manage Tests', icon: List },
  { href: '/admin/tests/create', label: 'Create Test', icon: PlusCircle },
  { href: '/admin/questions', label: 'Add Question', icon: ClipboardList },
  { href: '/admin/questions/edit', label: 'Edit Questions', icon: Edit }, 
  { href: '/admin/notes', label: 'Short Notes', icon: FileText },
];

const platformManagementItems = [
  { href: '/admin/payments', label: 'Payments', icon: Banknote },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/reports', label: 'Reports', icon: PieChart }, 
  { href: '/admin/referrals', label: 'Referrals', icon: Gift },
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
    // For parent routes like /admin/users, check if pathname starts with href
    return pathname.startsWith(href);
  };

  const isAdmin = user?.role === 'Admin';

  if (!isAdmin) {
    return null; // Don't render sidebar if user is not admin
  }

  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon" className="hidden sm:flex peer">
      <SidebarHeader className="flex items-center justify-between p-4"> 
        <Link
          href="/admin"
          className="flex items-center gap-2 group-data-[state=collapsed]:hidden"
          aria-label="Admin Dashboard Home"
        >
            <Image
                src="/EduNexus-logo-black.jpg" 
                alt="EduNexus Admin Logo"
                width={30}
                height={30}
                className="h-8 w-8 dark:hidden" 
                unoptimized
            />
             <Image
                src="/EduNexus-logo-white.jpg" 
                alt="EduNexus Admin Logo"
                width={30}
                height={30}
                className="h-8 w-8 hidden dark:block" 
                unoptimized
            />
          <h1 className="text-lg font-semibold">EduNexus Admin</h1>
        </Link>
        <SidebarTrigger className="hidden sm:flex mr-1" />
      </SidebarHeader>

      <SidebarContent className="flex-1 mt-2">
        <SidebarMenu>
          <SidebarGroup>
             <SidebarGroupLabel className="group-data-[state=collapsed]:hidden">Overview</SidebarGroupLabel>
            <SidebarMenuItem>
              <Link href={homeNavItem.href} passHref legacyBehavior>
                <SidebarMenuButton as="a" isActive={isActive(homeNavItem.href)} tooltip={homeNavItem.label}>
                  <homeNavItem.icon />
                  <span className="group-data-[state=collapsed]:hidden">{homeNavItem.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            {mainNavItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href} passHref legacyBehavior>
                  <SidebarMenuButton as="a" isActive={isActive(item.href)} tooltip={item.label}>
                    <item.icon />
                    <span className="group-data-[state=collapsed]:hidden">{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarGroup>

          <SidebarSeparator className="my-3" />

          <SidebarGroup>
            <SidebarGroupLabel className="group-data-[state=collapsed]:hidden">Content Management</SidebarGroupLabel>
            {contentManagementItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href} passHref legacyBehavior>
                  <SidebarMenuButton as="a" isActive={isActive(item.href)} tooltip={item.label}>
                    <item.icon />
                    <span className="group-data-[state=collapsed]:hidden">{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarGroup>

          <SidebarSeparator className="my-3" />

          <SidebarGroup>
            <SidebarGroupLabel className="group-data-[state=collapsed]:hidden">Platform</SidebarGroupLabel>
            {platformManagementItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href} passHref legacyBehavior>
                  <SidebarMenuButton as="a" isActive={isActive(item.href)} tooltip={item.label}>
                    <item.icon />
                    <span className="group-data-[state=collapsed]:hidden">{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarGroup>
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="mt-auto">
         <SidebarSeparator className="my-1 group-data-[state=collapsed]:hidden"/>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href={settingsNavItem.href} passHref legacyBehavior>
              <SidebarMenuButton as="a" isActive={isActive(settingsNavItem.href)} tooltip={settingsNavItem.label}>
                <settingsNavItem.icon />
                <span className="group-data-[state=collapsed]:hidden">{settingsNavItem.label}</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
