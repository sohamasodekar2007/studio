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
import { Home, ListChecks, GraduationCap, Settings, HelpCircle, Wand2, ShieldCheck, MessageSquare, Activity, ClipboardCheck, Notebook, Trophy, UserPlus, Users, UserCheck as UserCheckIcon } from 'lucide-react'; // Added Notebook, Trophy, UserPlus, Users, UserCheckIcon
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context'; // Import useAuth
import ThemeToggle from '@/components/theme-toggle';
import Image from 'next/image'; // Import Image

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const isAdmin = user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  const isActive = (href: string) => {
    // Exact match for most top-level pages
    if (['/', '/settings', '/help', '/study-tips', '/doubt-solving', '/progress', '/notebooks', '/leaderboard', '/find-friends', '/friends-followers', '/friends-following'].includes(href)) { // Added new friend pages
      return pathname === href;
    }
    // Starts with for tests, admin, and dpp as they have sub-routes
    if (['/tests', '/admin', '/dpp'].includes(href)) {
      return pathname.startsWith(href);
    }
    // Special case for specific dynamic routes if needed
    if (href.startsWith('/tests/') && pathname.startsWith('/tests/')) return true;
    if (href.startsWith('/dpp/') && pathname.startsWith('/dpp/')) return true;
    if (href.startsWith('/friend-history/') && pathname.startsWith('/friend-history/')) return true;
    if (href.startsWith('/friends-compare/') && pathname.startsWith('/friends-compare/')) return true;


    return false;
  };

  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon">
      <SidebarHeader className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2 group-data-[state=collapsed]:hidden">
           {/* EduNexus Logo */}
            <Image
                src="/EduNexus-logo-black.jpg" // Prioritize black for light mode visibility
                alt="EduNexus Logo"
                width={30} // Adjust size as needed
                height={30}
                className="h-8 w-8 dark:hidden" // Hide on dark mode
                unoptimized // Good for local images
            />
             <Image
                src="/EduNexus-logo-white.jpg" // White logo for dark mode
                alt="EduNexus Logo"
                width={30} // Adjust size as needed
                height={30}
                className="h-8 w-8 hidden dark:block" // Show only on dark mode
                unoptimized // Good for local images
            />
          {/* Updated Name */}
          <h1 className="text-lg font-semibold">EduNexus</h1>
        </div>
        <SidebarTrigger className="hidden sm:flex" />
      </SidebarHeader>

      <SidebarContent className="flex-1">
        <SidebarMenu>
          <SidebarGroup>
            <SidebarGroupLabel className="group-data-[state=collapsed]:hidden">Main Navigation</SidebarGroupLabel>
            <SidebarMenuItem>
              <Link href="/" passHref legacyBehavior>
                <SidebarMenuButton as="a" isActive={isActive('/')} tooltip="Dashboard">
                  <Home />
                  <span className="group-data-[state=collapsed]:hidden">Dashboard</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/tests" passHref legacyBehavior>
                <SidebarMenuButton as="a" isActive={isActive('/tests')} tooltip="Test Series">
                  <ListChecks />
                  <span className="group-data-[state=collapsed]:hidden">Test Series</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <Link href="/dpp" passHref legacyBehavior>
                    <SidebarMenuButton as="a" isActive={isActive('/dpp')} tooltip="DPP">
                        <ClipboardCheck />
                        <span className="group-data-[state=collapsed]:hidden">DPP</span>
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
             <SidebarMenuItem>
              <Link href="/notebooks" passHref legacyBehavior>
                <SidebarMenuButton as="a" isActive={isActive('/notebooks')} tooltip="Notebooks">
                  <Notebook />
                  <span className="group-data-[state=collapsed]:hidden">Notebooks</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/progress" passHref legacyBehavior>
                <SidebarMenuButton as="a" isActive={isActive('/progress')} tooltip="My Progress">
                  <Activity />
                  <span className="group-data-[state=collapsed]:hidden">My Progress</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
             <SidebarMenuItem>
              <Link href="/leaderboard" passHref legacyBehavior>
                <SidebarMenuButton as="a" isActive={isActive('/leaderboard')} tooltip="Leaderboard">
                  <Trophy />
                  <span className="group-data-[state=collapsed]:hidden">Leaderboard</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          </SidebarGroup>

           <SidebarSeparator className="my-3" />

           {/* Friends Section */}
           <SidebarGroup>
                <SidebarGroupLabel className="group-data-[state=collapsed]:hidden">Friends</SidebarGroupLabel>
                <SidebarMenuItem>
                    <Link href="/find-friends" passHref legacyBehavior>
                        <SidebarMenuButton as="a" isActive={isActive('/find-friends')} tooltip="Find Friends">
                            <UserPlus />
                            <span className="group-data-[state=collapsed]:hidden">Find Friends</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <Link href="/friends-following" passHref legacyBehavior>
                        <SidebarMenuButton as="a" isActive={isActive('/friends-following')} tooltip="Following">
                            <UserCheckIcon />
                            <span className="group-data-[state=collapsed]:hidden">Following</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                    <Link href="/friends-followers" passHref legacyBehavior>
                        <SidebarMenuButton as="a" isActive={isActive('/friends-followers')} tooltip="Followers">
                            <Users />
                            <span className="group-data-[state=collapsed]:hidden">Followers</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
            </SidebarGroup>

          <SidebarSeparator className="my-3" />

          <SidebarGroup>
            <SidebarGroupLabel className="group-data-[state=collapsed]:hidden">AI Tools</SidebarGroupLabel>
            <SidebarMenuItem>
              <Link href="/study-tips" passHref legacyBehavior>
                <SidebarMenuButton as="a" isActive={isActive('/study-tips')} tooltip="AI Study Tips">
                  <Wand2 />
                  <span className="group-data-[state=collapsed]:hidden">AI Study Tips</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/doubt-solving" passHref legacyBehavior>
                <SidebarMenuButton as="a" isActive={isActive('/doubt-solving')} tooltip="Doubt Solving">
                  <MessageSquare />
                  <span className="group-data-[state=collapsed]:hidden">Doubt Solving</span>
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
                  <Link href="/admin" passHref legacyBehavior>
                    <SidebarMenuButton as="a" isActive={isActive('/admin')} tooltip="Admin Panel">
                      <ShieldCheck />
                      <span className="group-data-[state=collapsed]:hidden">Admin Panel</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              </SidebarGroup>
            </>
          )}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="mt-auto flex flex-col items-center gap-2 group-data-[state=collapsed]:gap-0">
        <div className="w-full flex justify-center group-data-[state=collapsed]:my-2">
          <ThemeToggle />
        </div>
        <SidebarSeparator className="my-1 group-data-[state=collapsed]:hidden"/>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/settings" passHref legacyBehavior>
              <SidebarMenuButton as="a" isActive={isActive('/settings')} tooltip="Settings">
                <Settings />
                <span className="group-data-[state=collapsed]:hidden">Settings</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Link href="/help" passHref legacyBehavior>
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
