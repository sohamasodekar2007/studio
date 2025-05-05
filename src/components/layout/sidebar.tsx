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
            <Link href="/" legacyBehavior passHref>
              <SidebarMenuButton asChild isActive={isActive('/')} tooltip="Dashboard">
                <a> {/* Wrap content in an anchor tag for legacyBehavior */}
                    <Home />
                    <span>Dashboard</span>
                </a>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem>
             <Link href="/tests" legacyBehavior passHref>
              <SidebarMenuButton asChild isActive={isActive('/tests')} tooltip="Test Series">
                 <a>
                    <ListChecks /> {/* Updated icon */}
                    <span>Test Series</span> {/* Updated label */}
                 </a>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
           {/* Add Results link later when page exists */}
           {/*
           <SidebarMenuItem>
            <Link href="/results">
              <SidebarMenuButton isActive={isActive('/results')} tooltip="Results" asChild>
                <div>
                    <LineChart />
                    <span>Results</span>
                </div>
              </SidebarMenuButton>
            </Link>
           </SidebarMenuItem>
           */}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="mt-auto">
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/settings" legacyBehavior passHref>
              <SidebarMenuButton asChild isActive={isActive('/settings')} tooltip="Settings">
                 <a>
                    <Settings />
                    <span>Settings</span>
                 </a>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem>
             <Link href="/help" legacyBehavior passHref>
              <SidebarMenuButton asChild isActive={isActive('/help')} tooltip="Help & Support">
                 <a>
                    <HelpCircle />
                    <span>Help & Support</span>
                 </a>
              </SidebarMenuButton>
             </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
