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
import { Home, BookOpen, GraduationCap, Lightbulb, Settings, HelpCircle } from 'lucide-react';
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
          <h1 className="text-lg font-semibold">EduNexus</h1>
        </div>
        <SidebarTrigger className="hidden sm:flex" />
      </SidebarHeader>
      <SidebarContent className="flex-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/" passHref legacyBehavior>
              <SidebarMenuButton asChild isActive={isActive('/')} tooltip="Dashboard">
                <a>
                  <Home />
                  <span>Dashboard</span>
                </a>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Link href="/content" passHref legacyBehavior>
              <SidebarMenuButton asChild isActive={isActive('/content')} tooltip="Content">
                <a>
                  <BookOpen />
                  <span>Content</span>
                </a>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Link href="/recommendations" passHref legacyBehavior>
              <SidebarMenuButton asChild isActive={isActive('/recommendations')} tooltip="Recommendations">
                <a>
                  <Lightbulb />
                  <span>Recommendations</span>
                </a>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="mt-auto">
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/settings" passHref legacyBehavior>
              <SidebarMenuButton asChild isActive={isActive('/settings')} tooltip="Settings">
                <a>
                  <Settings />
                  <span>Settings</span>
                </a>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem>
             <Link href="/help" passHref legacyBehavior>
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
