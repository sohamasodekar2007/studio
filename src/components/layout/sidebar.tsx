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
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Home,
  ListChecks,
  Settings,
  HelpCircle,
  ShieldCheck,
  MessageSquare,
  Activity,
  ClipboardCheck,
  Notebook,
  Trophy,
  UserPlus,
  Users,
  UserCheck as UserCheckIcon,
  BarChartHorizontal,
  FileClock,
  Target,
  Info,
  BookUser,
  MoreVertical,
  Sun,
  Moon,
  Swords,
  Bell,
  Gift, // Added Gift icon
  ShoppingBag // Added ShoppingBag icon
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import Image from 'next/image';
import TutorialGuide from './tutorial-guide';
import { useState, useEffect, useCallback } from 'react';
import type { Step } from 'react-joyride';
import { CallBackProps, STATUS, ACTIONS, EVENTS } from 'react-joyride';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from 'next-themes';
import type { ChallengeInvite } from '@/types';
import { Badge } from '@/components/ui/badge'; // Imported Badge


// Define Tutorial Steps Configuration
const tutorialSteps: Step[] = [
  {
    target: '#tutorial-target-dashboard',
    content: 'This is your Dashboard, the main hub for accessing all features.',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '#tutorial-target-test-series',
    content: 'Browse and take chapter-wise or full-length mock tests here.',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '#tutorial-target-dpp',
    content: 'Access Daily Practice Problems to sharpen your skills.',
    placement: 'right',
    disableBeacon: true,
  },
   {
    target: '#tutorial-target-pyq-dpps',
    content: 'Practice with questions directly from previous year exams.',
    placement: 'right',
    disableBeacon: true,
  },
   {
    target: '#tutorial-target-pyq-mock-tests',
    content: 'Take full mock tests using past exam questions.',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '#tutorial-target-notebooks',
    content: 'Create notebooks and save important questions for revision.',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '#tutorial-target-progress',
    content: 'Track your test history and analyze your performance.',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '#tutorial-target-leaderboard',
    content: 'See your rank based on points earned from tests and DPPs.',
    placement: 'right',
    disableBeacon: true,
  },
    {
    target: '#tutorial-target-friends-group',
    content: 'Connect with friends, follow their progress, and compare performance.',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '#tutorial-target-ai-tools-group',
    content: 'Utilize AI features like Doubt Solving (Premium).',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '#tutorial-target-referrals',
    content: 'Invite friends to EduNexus and earn rewards!',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '#tutorial-target-packages', 
    content: 'View and manage your subscription plans here.',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '#tutorial-target-more-dropdown',
    content: 'Access Settings, Help, Tutorial and Theme options here.',
    placement: 'right',
    disableBeacon: true,
  },
];


export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [runTutorial, setRunTutorial] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const { setOpen: setSidebarOpen, state: sidebarState } = useSidebar();
  const { theme, setTheme } = useTheme();

  const isAdmin = user?.role === 'Admin';
  const [actualPendingInvitesCount, setActualPendingInvitesCount] = useState(0);

  const fetchPendingInvitesCount = useCallback(() => {
    if (user?.id && typeof window !== 'undefined') {
        try {
            const invitesJson = localStorage.getItem(`userChallengeInvites_${user.id}`);
            if (invitesJson) {
                const allInvites: ChallengeInvite[] = JSON.parse(invitesJson);
                const newPending = allInvites.filter(inv => inv.status === 'pending' && inv.expiresAt > Date.now());
                setActualPendingInvitesCount(newPending.length);
            } else {
                setActualPendingInvitesCount(0);
            }
        } catch (error) {
            console.error("Error fetching pending invites count for sidebar:", error);
            setActualPendingInvitesCount(0);
        }
    } else {
        setActualPendingInvitesCount(0);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchPendingInvitesCount();
    const intervalId = setInterval(fetchPendingInvitesCount, 30000); 
    return () => clearInterval(intervalId);
  }, [fetchPendingInvitesCount]);


  const isActive = (href: string) => {
    const exactMatchRoutes = [
        '/',
        '/settings',
        '/help',
        '/doubt-solving',
        '/progress',
        '/notebooks',
        '/leaderboard',
        '/find-friends',
        '/friends-followers',
        '/friends-following',
        '/friends-compare',
        '/pyq-mock-tests',
        '/pyq-dpps',
        '/challenge/create',
        '/challenges/invites',
        '/referrals',
        '/packages', 
    ];
    if (exactMatchRoutes.includes(href)) {
      return pathname === href;
    }
    if (href.endsWith('/') && href.length > 1) { 
        return pathname.startsWith(href);
    }
    const parentRoutesWithChildren = ['/tests', '/dpp', '/pyq-dpps', '/notebooks', '/challenge'];
    if (parentRoutesWithChildren.includes(href)) {
        return pathname.startsWith(href + '/');
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  const handleJoyrideCallback = useCallback((data: CallBackProps) => {
    const { status, index, type, action } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRunTutorial(false);
      setStepIndex(0);
    } else if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
       const nextStepIndex = index + (action === ACTIONS.PREV ? -1 : 1);
       const nextStep = tutorialSteps[nextStepIndex];
       if (nextStep && typeof nextStep.target === 'string' && nextStep.target.startsWith('#tutorial-target-') && sidebarState === 'collapsed') {
           setSidebarOpen(true);
           setTimeout(() => {
               setStepIndex(nextStepIndex);
           }, 300);
       } else {
           setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
       }
    } else if (type === EVENTS.TOUR_START) {
        const firstStep = tutorialSteps[0];
         if (firstStep && typeof firstStep.target === 'string' && firstStep.target.startsWith('#tutorial-target-') && sidebarState === 'collapsed') {
            setSidebarOpen(true);
        }
    }
  }, [setSidebarOpen, sidebarState]);


  const startTutorial = useCallback(() => {
    if (tutorialSteps[0]?.target && typeof tutorialSteps[0].target === 'string' && tutorialSteps[0].target.startsWith('#tutorial-target-') && sidebarState === 'collapsed') {
       setSidebarOpen(true);
       setTimeout(() => {
          setStepIndex(0);
          setRunTutorial(true);
       }, 350);
    } else {
       setStepIndex(0);
       setRunTutorial(true);
    }
  }, [setSidebarOpen, sidebarState]);

  return (
    <>
      <Sidebar side="left" variant="sidebar" collapsible="icon" className="hidden sm:flex peer">
        <SidebarHeader className="flex items-center justify-between p-4">
          <Link
            href="/"
            className="flex items-center gap-2 group-data-[state=collapsed]:hidden"
            aria-label="EduNexus Home"
          >
            <Image
                src="/EduNexus-logo-black.jpg"
                alt="EduNexus Logo"
                width={30}
                height={30}
                className="h-8 w-8 dark:hidden"
                unoptimized
            />
             <Image
                src="/EduNexus-logo-white.jpg"
                alt="EduNexus Logo"
                width={30}
                height={30}
                className="h-8 w-8 hidden dark:block"
                unoptimized
            />
            <h1 className="text-lg font-semibold">EduNexus</h1>
          </Link>
          <SidebarTrigger className="hidden sm:flex" />
        </SidebarHeader>

        <SidebarContent className="flex-1 mt-2">
          <SidebarMenu>
            <SidebarGroup>
              <SidebarGroupLabel className="group-data-[state=collapsed]:hidden">Main Navigation</SidebarGroupLabel>
              <SidebarMenuItem>
                <Link href="/" passHref legacyBehavior>
                  <SidebarMenuButton as="a" isActive={isActive('/')} tooltip="Dashboard" id="tutorial-target-dashboard">
                    <Home />
                    <span className="group-data-[state=collapsed]:hidden">Dashboard</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/tests" passHref legacyBehavior>
                  <SidebarMenuButton as="a" isActive={isActive('/tests')} tooltip="Test Series" id="tutorial-target-test-series">
                    <ListChecks />
                    <span className="group-data-[state=collapsed]:hidden">Test Series</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                  <Link href="/dpp" passHref legacyBehavior>
                      <SidebarMenuButton as="a" isActive={isActive('/dpp')} tooltip="DPP" id="tutorial-target-dpp">
                          <ClipboardCheck />
                          <span className="group-data-[state=collapsed]:hidden">DPP</span>
                      </SidebarMenuButton>
                  </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                  <Link href="/pyq-dpps" passHref legacyBehavior>
                      <SidebarMenuButton as="a" isActive={isActive('/pyq-dpps')} tooltip="PYQ DPPs" id="tutorial-target-pyq-dpps">
                          <Target />
                          <span className="group-data-[state=collapsed]:hidden">PYQ DPPs</span>
                      </SidebarMenuButton>
                  </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                  <Link href="/pyq-mock-tests" passHref legacyBehavior>
                      <SidebarMenuButton as="a" isActive={isActive('/pyq-mock-tests')} tooltip="PYQ Mock Tests" id="tutorial-target-pyq-mock-tests">
                          <FileClock />
                          <span className="group-data-[state=collapsed]:hidden">PYQ Mock Tests</span>
                      </SidebarMenuButton>
                  </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/notebooks" passHref legacyBehavior>
                  <SidebarMenuButton as="a" isActive={isActive('/notebooks')} tooltip="Notebooks" id="tutorial-target-notebooks">
                    <Notebook />
                    <span className="group-data-[state=collapsed]:hidden">Notebooks</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/progress" passHref legacyBehavior>
                  <SidebarMenuButton as="a" isActive={isActive('/progress')} tooltip="My Progress" id="tutorial-target-progress">
                    <Activity />
                    <span className="group-data-[state=collapsed]:hidden">My Progress</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/leaderboard" passHref legacyBehavior>
                  <SidebarMenuButton as="a" isActive={isActive('/leaderboard')} tooltip="Leaderboard" id="tutorial-target-leaderboard">
                    <Trophy />
                    <span className="group-data-[state=collapsed]:hidden">Leaderboard</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            </SidebarGroup>

            <SidebarSeparator className="my-3" />

            <SidebarGroup id="tutorial-target-friends-group">
                  <SidebarGroupLabel className="group-data-[state=collapsed]:hidden">Connect & Compete</SidebarGroupLabel>
                  <SidebarMenuItem>
                        <Link href="/challenge/create" passHref legacyBehavior>
                            <SidebarMenuButton as="a" isActive={isActive('/challenge/create')} tooltip="Create Challenge" id="tutorial-target-create-challenge">
                                <Swords />
                                <span className="group-data-[state=collapsed]:hidden">Create Challenge</span>
                            </SidebarMenuButton>
                        </Link>
                  </SidebarMenuItem>
                   <SidebarMenuItem>
                        <Link href="/challenges/invites" passHref legacyBehavior>
                            <SidebarMenuButton as="a" isActive={isActive('/challenges/invites')} tooltip="Challenge Invites" id="tutorial-target-challenge-invites">
                                <Bell />
                                <span className="group-data-[state=collapsed]:hidden">Challenge Invites</span>
                                {actualPendingInvitesCount > 0 && (
                                    <Badge variant="destructive" className="absolute top-1 right-1 h-4 w-4 p-0 flex items-center justify-center text-xs group-data-[state=expanded]:right-2 group-data-[state=expanded]:top-1.5">
                                       {actualPendingInvitesCount}
                                    </Badge>
                                )}
                            </SidebarMenuButton>
                        </Link>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                      <Link href="/find-friends" passHref legacyBehavior>
                          <SidebarMenuButton as="a" isActive={isActive('/find-friends')} tooltip="Find Friends" id="tutorial-target-find-friends">
                              <UserPlus />
                              <span className="group-data-[state=collapsed]:hidden">Find Friends</span>
                          </SidebarMenuButton>
                      </Link>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                      <Link href="/friends-following" passHref legacyBehavior>
                          <SidebarMenuButton as="a" isActive={isActive('/friends-following')} tooltip="Following" id="tutorial-target-following">
                              <UserCheckIcon />
                              <span className="group-data-[state=collapsed]:hidden">Following</span>
                          </SidebarMenuButton>
                      </Link>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                      <Link href="/friends-followers" passHref legacyBehavior>
                          <SidebarMenuButton as="a" isActive={isActive('/friends-followers')} tooltip="Followers" id="tutorial-target-followers">
                              <Users />
                              <span className="group-data-[state=collapsed]:hidden">Followers</span>
                          </SidebarMenuButton>
                      </Link>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                      <Link href="/friends-compare" passHref legacyBehavior>
                          <SidebarMenuButton as="a" isActive={isActive('/friends-compare')} tooltip="Compare Performance" id="tutorial-target-compare">
                              <BarChartHorizontal />
                              <span className="group-data-[state=collapsed]:hidden">Compare</span>
                          </SidebarMenuButton>
                      </Link>
                  </SidebarMenuItem>
              </SidebarGroup>

            <SidebarSeparator className="my-3" />

            <SidebarGroup id="tutorial-target-ai-tools-group">
              <SidebarGroupLabel className="group-data-[state=collapsed]:hidden">AI Tools</SidebarGroupLabel>
              <SidebarMenuItem>
                <Link href="/doubt-solving" passHref legacyBehavior>
                  <SidebarMenuButton as="a" isActive={isActive('/doubt-solving')} tooltip="Doubt Solving" id="tutorial-target-doubt-solving">
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
                      <SidebarMenuButton as="a" isActive={isActive('/admin')} tooltip="Admin Panel" id="tutorial-target-admin">
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

        <SidebarFooter className="mt-auto flex flex-col items-center gap-1 group-data-[state=collapsed]:gap-1">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                        variant="ghost"
                        className="w-full group-data-[state=collapsed]:w-8 group-data-[state=collapsed]:h-8"
                        tooltip="More Options"
                        id="tutorial-target-more-dropdown"
                    >
                        <MoreVertical />
                        <span className="group-data-[state=collapsed]:hidden">More</span>
                    </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    side="top"
                    align="center"
                    sideOffset={10}
                    className="w-56 mb-2"
                >
                    <DropdownMenuLabel>Options</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                     <DropdownMenuItem asChild>
                        <Link href="/packages">
                            <ShoppingBag className="mr-2 h-4 w-4" />
                            <span>Upgrade Plan</span>
                        </Link>
                     </DropdownMenuItem>
                     <DropdownMenuItem asChild>
                         <Link href="/referrals">
                             <Gift className="mr-2 h-4 w-4" />
                             <span>Referrals</span>
                         </Link>
                     </DropdownMenuItem>
                     <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
                        {theme === 'light' ? <Moon className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />}
                        <span>Toggle Theme</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href="/settings">
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Settings</span>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href="/help">
                            <HelpCircle className="mr-2 h-4 w-4" />
                            <span>Help & Support</span>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={startTutorial}>
                         <BookUser className="mr-2 h-4 w-4" />
                        <span>Start Tutorial</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <TutorialGuide
        run={runTutorial}
        steps={tutorialSteps}
        stepIndex={stepIndex}
        handleJoyrideCallback={handleJoyrideCallback}
       />
    </>
  );
}
