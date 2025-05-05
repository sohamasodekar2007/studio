'use client'; // Add this directive

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
import { Button } from '@/components/ui/button';
import { Home, ListChecks, GraduationCap, LineChart, Settings, HelpCircle } from 'lucide-react'; // Updated icons
import Link from 'next/link';
import { usePathname } from 'next/navigation'; // Import usePathname hook

export function AppSidebar() {
  const pathname = usePathname(); // Get the current path

  // Helper function to determine if a link is active
  const isActive = (href: string) => pathname === href;

  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon">
       <SidebarHeader className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
          <GraduationCap className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-semibold">ExamPrep Hub</h1> {/* Updated App Name */}
        </div>
        <SidebarTrigger className="hidden sm:flex" />
      </SidebarHeader>
      <SidebarContent className="flex-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/" asChild>
              <SidebarMenuButton isActive={isActive('/')} tooltip="Dashboard">
                <Home />
                <span>Dashboard</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem>
             <Link href="/tests" asChild>
              <SidebarMenuButton isActive={isActive('/tests')} tooltip="Test Series">
                <ListChecks /> {/* Updated icon */}
                <span>Test Series</span> {/* Updated label */}
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
           {/* Add Results link later when page exists */}
           {/*
           <SidebarMenuItem>
            <Link href="/results" asChild>
              <SidebarMenuButton isActive={isActive('/results')} tooltip="Results">
                <LineChart />
                <span>Results</span>
              </SidebarMenuButton>
            </Link>
           </SidebarMenuItem>
           */}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="mt-auto">
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/settings" asChild>
              <SidebarMenuButton isActive={isActive('/settings')} tooltip="Settings">
                <Settings />
                <span>Settings</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem>
             <Link href="/help" asChild>
              <SidebarMenuButton isActive={isActive('/help')} tooltip="Help & Support">
                <HelpCircle />
                <span>Help & Support</span>
              </SidebarMenuButton>
             </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
