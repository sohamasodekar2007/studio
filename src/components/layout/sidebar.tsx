// src/components/layout/sidebar.tsx
'use client';

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
  SidebarSeparator,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import { Home, ListChecks, GraduationCap, Settings, HelpCircle, Wand2, ShieldCheck, MessageSquare, Activity, BarChartHorizontalSquare } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import ThemeToggle from '@/components/theme-toggle';

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const isAdmin = user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  const isActive = (href: string) => {
    // Exact match for home, settings, help, study-tips, doubt-solving, progress
    if (['/', '/settings', '/help', '/study-tips', '/doubt-solving', '/progress'].includes(href)) {
      return pathname === href;
    }
    // Starts with for tests and admin as they have sub-routes
    if (href === '/tests' || href === '/admin') {
      return pathname.startsWith(href);
    }
    return false;
  };

  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon">
      <SidebarHeader className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
          <GraduationCap className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-semibold">STUDY SPHERE</h1>
        </div>
        <SidebarTrigger className="hidden sm:flex" />
      </SidebarHeader>

      <SidebarContent className="flex-1">
        <SidebarMenu>
          <SidebarGroup>
            <SidebarGroupLabel className="group-data-[state=collapsed]:hidden">Main Navigation</SidebarGroupLabel>
            <SidebarMenuItem>
              <Link href="/" legacyBehavior passHref>
                <SidebarMenuButton as="a" isActive={isActive('/')} tooltip="Dashboard">
                  <Home />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/tests" legacyBehavior passHref>
                <SidebarMenuButton as="a" isActive={isActive('/tests')} tooltip="Test Series">
                  <ListChecks />
                  <span>Test Series</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/progress" legacyBehavior passHref>
                <SidebarMenuButton as="a" isActive={isActive('/progress')} tooltip="My Progress">
                  <Activity />
                  <span>My Progress</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          </SidebarGroup>

          <SidebarSeparator className="my-3" />

          <SidebarGroup>
            <SidebarGroupLabel className="group-data-[state=collapsed]:hidden">AI Tools</SidebarGroupLabel>
            <SidebarMenuItem>
              <Link href="/study-tips" legacyBehavior passHref>
                <SidebarMenuButton as="a" isActive={isActive('/study-tips')} tooltip="AI Study Tips">
                  <Wand2 />
                  <span>AI Study Tips</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/doubt-solving" legacyBehavior passHref>
                <SidebarMenuButton as="a" isActive={isActive('/doubt-solving')} tooltip="Doubt Solving">
                  <MessageSquare />
                  <span>Doubt Solving</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          </SidebarGroup>

          {isAdmin && (
            <>
              <SidebarSeparator className="my-3" />
              <SidebarGroup>
                 <SidebarGroupLabel className="group-data-[state=collapsed]:hidden">Administration</SidebarGroupLabel>
                <SidebarMenuItem>
                  <Link href="/admin" legacyBehavior passHref>
                    <SidebarMenuButton as="a" isActive={isActive('/admin')} tooltip="Admin Panel">
                      <ShieldCheck />
                      <span>Admin Panel</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              </SidebarGroup>
            </>
          )}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="mt-auto flex flex-col items-center gap-2 group-data-[collapsible=icon]:gap-0">
        <div className="w-full flex justify-center group-data-[collapsible=icon]:my-2">
          <ThemeToggle />
        </div>
        <SidebarSeparator className="my-1 group-data-[state=collapsed]:hidden"/>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/settings" legacyBehavior passHref>
              <SidebarMenuButton as="a" isActive={isActive('/settings')} tooltip="Settings">
                <Settings />
                <span className="group-data-[state=collapsed]:hidden">Settings</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Link href="/help" legacyBehavior passHref>
              <SidebarMenuButton as="a" isActive={isActive('/help')} tooltip="Help & Support">
                <HelpCircle />
                <span className="group-data-[state=collapsed]:hidden">Help & Support</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
