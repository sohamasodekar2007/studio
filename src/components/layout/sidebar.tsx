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
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Home, ListChecks, GraduationCap, LineChart, Settings, HelpCircle, Wand2, ShieldCheck } from 'lucide-react'; // Added ShieldCheck
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context'; // Import useAuth

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth(); // Get user information

  // Simple check for admin role (replace with actual role check)
  // Example: Check if user email is in a predefined list of admin emails
  const isAdmin = user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL; // Use an env variable for admin email

  const isActive = (href: string) => pathname === href;
   // Check if the path starts with the given href (for parent routes)
  const isActiveParent = (href: string) => pathname.startsWith(href);


  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon">
       <SidebarHeader className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
          <GraduationCap className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-semibold">STUDY SPHERE</h1> {/* Updated Brand Name */}
        </div>
        <SidebarTrigger className="hidden sm:flex" />
      </SidebarHeader>
      <SidebarContent className="flex-1">
        <SidebarMenu>
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
              <SidebarMenuButton as="a" isActive={isActiveParent('/tests')} tooltip="Test Series">
                 <ListChecks />
                 <span>Test Series</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
           <SidebarMenuItem>
             <Link href="/study-tips" legacyBehavior passHref>
               <SidebarMenuButton as="a" isActive={isActive('/study-tips')} tooltip="AI Study Tips">
                 <Wand2 />
                 <span>Study Tips</span>
               </SidebarMenuButton>
             </Link>
           </SidebarMenuItem>
           {/* Add Results link later when page exists */}
           {/*
           <SidebarMenuItem>
            <Link href="/results" legacyBehavior passHref>
              <SidebarMenuButton as="a" isActive={isActive('/results')} tooltip="Results">
                 <LineChart />
                 <span>Results</span>
              </SidebarMenuButton>
            </Link>
           </SidebarMenuItem>
           */}
           {/* Conditionally render Admin Panel link */}
           {isAdmin && (
             <SidebarMenuItem>
               <Link href="/admin" legacyBehavior passHref>
                 <SidebarMenuButton as="a" isActive={isActiveParent('/admin')} tooltip="Admin Panel">
                   <ShieldCheck />
                   <span>Admin Panel</span>
                 </SidebarMenuButton>
               </Link>
             </SidebarMenuItem>
           )}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="mt-auto">
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/settings" legacyBehavior passHref>
              <SidebarMenuButton as="a" isActive={isActive('/settings')} tooltip="Settings">
                 <Settings />
                 <span>Settings</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem>
             <Link href="/help" legacyBehavior passHref>
              <SidebarMenuButton as="a" isActive={isActive('/help')} tooltip="Help & Support">
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
