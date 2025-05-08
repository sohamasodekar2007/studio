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
  useSidebar, // Import useSidebar hook
} from '@/components/ui/sidebar';
import { Home, ListChecks, GraduationCap, Settings, HelpCircle, Wand2, ShieldCheck, MessageSquare, Activity, ClipboardCheck, Notebook, Trophy, UserPlus, Users, UserCheck as UserCheckIcon, BarChartHorizontal, FileClock, Target, Info, BookUser } from 'lucide-react'; // Added BookUser
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context'; // Import useAuth
import ThemeToggle from '@/components/theme-toggle';
import Image from 'next/image'; // Import Image
import TutorialGuide from './tutorial-guide'; // Import the new guide component
import { useState, useEffect, useCallback } from 'react'; // Import useState, useEffect, useCallback
import type { Step } from 'react-joyride';
import { CallBackProps, STATUS, ACTIONS, EVENTS } from 'react-joyride';

// Define Tutorial Steps Configuration
// Ensure IDs match the elements in the JSX below
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
    content: 'Utilize AI features like Study Tips and Doubt Solving (Premium).',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '#tutorial-target-settings',
    content: 'Manage your profile details and password.',
    placement: 'right',
    disableBeacon: true,
  },
   {
    target: '#tutorial-target-help',
    content: 'Find answers to common questions or contact support.',
    placement: 'right',
    disableBeacon: true,
  },
   {
    target: '#tutorial-target-theme-toggle',
    content: 'Switch between light and dark themes.',
    placement: 'right',
    disableBeacon: true,
  },
];


export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [runTutorial, setRunTutorial] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const { setOpen: setSidebarOpen, state: sidebarState } = useSidebar(); // Get sidebar control and state


  const isAdmin = user?.role === 'Admin'; // Check user role

  const isActive = (href: string) => {
    const exactMatchRoutes = [
        '/',
        '/settings',
        '/help',
        '/study-tips',
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
    ];
    if (exactMatchRoutes.includes(href)) {
      return pathname === href;
    }
    // Improved handling for parent routes
    if (['/tests', '/admin', '/dpp'].includes(href)) {
        // Check if pathname is exactly the href or starts with href followed by '/'
        return pathname === href || pathname.startsWith(href + '/');
    }
    // Specific check for dynamic routes under /tests or /dpp if needed, though startsWith might cover it
    // Example: if (href === '/tests' && pathname.startsWith('/tests/')) return true;

    return false;
  };

  // Centralized callback handler in the parent component
  const handleJoyrideCallback = useCallback((data: CallBackProps) => {
    const { status, index, type, step, action } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    // console.log("Joyride Callback:", data); // Debugging

    if (finishedStatuses.includes(status)) {
      setRunTutorial(false);
      setStepIndex(0);
      // Optionally ensure sidebar returns to default state if modified
      // setSidebarOpen(true); // Or based on your default preference
    } else if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
       // Ensure sidebar is open if the *next* step's target is likely inside the sidebar
       // This is a heuristic, might need refinement based on your exact targets
       const nextStepIndex = index + (action === ACTIONS.PREV ? -1 : 1);
       const nextStep = tutorialSteps[nextStepIndex];
       if (nextStep && typeof nextStep.target === 'string' && nextStep.target.startsWith('#tutorial-target-') && sidebarState === 'collapsed') {
           console.log("Opening sidebar for next step target:", nextStep.target);
           setSidebarOpen(true);
           // Delay setting the step index slightly to allow sidebar animation
           setTimeout(() => {
               setStepIndex(nextStepIndex);
           }, 300);
       } else {
           // Set the step index for the next step
           setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
       }
    } else if (type === EVENTS.TOUR_START) {
        // Ensure sidebar is open when the tour starts if the first target needs it
        const firstStep = tutorialSteps[0];
         if (firstStep && typeof firstStep.target === 'string' && firstStep.target.startsWith('#tutorial-target-') && sidebarState === 'collapsed') {
            setSidebarOpen(true);
        }
    }
  }, [setSidebarOpen, sidebarState]);


  const startTutorial = useCallback(() => {
    // Ensure sidebar is open before starting if the first step targets it
    if (tutorialSteps[0]?.target && typeof tutorialSteps[0].target === 'string' && tutorialSteps[0].target.startsWith('#tutorial-target-') && sidebarState === 'collapsed') {
       setSidebarOpen(true);
       // Delay starting the tutorial slightly to ensure sidebar is open
       setTimeout(() => {
          setStepIndex(0);
          setRunTutorial(true);
       }, 350); // Adjust delay as needed
    } else {
       setStepIndex(0);
       setRunTutorial(true);
    }
  }, [setSidebarOpen, sidebarState]);

  return (
    <>
      <Sidebar side="left" variant="sidebar" collapsible="icon" className="hidden sm:flex peer"> {/* Added peer */}
        <SidebarHeader className="flex items-center justify-between p-4"> {/* Increased padding */}
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
                  className="h-8 w-8 hidden dark:block" // Show on dark mode
                  unoptimized // Good for local images
              />
            {/* Updated Name */}
            <h1 className="text-lg font-semibold">EduNexus</h1>
          </div>
          <SidebarTrigger className="hidden sm:flex" />
        </SidebarHeader>

        <SidebarContent className="flex-1 mt-2">
          <SidebarMenu>
            {/* Main Navigation */}
            <SidebarGroup>
              <SidebarGroupLabel className="group-data-[state=collapsed]:hidden">Main Navigation</SidebarGroupLabel>
              <SidebarMenuItem>
                {/* Ensure the Link has passHref and legacyBehavior for compatibility with SidebarMenuButton as 'a' */}
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
              <SidebarMenuItem> {/* New PYQ DPPs */}
                  <Link href="/pyq-dpps" passHref legacyBehavior>
                      <SidebarMenuButton as="a" isActive={isActive('/pyq-dpps')} tooltip="PYQ DPPs" id="tutorial-target-pyq-dpps">
                          <Target />
                          <span className="group-data-[state=collapsed]:hidden">PYQ DPPs</span>
                      </SidebarMenuButton>
                  </Link>
              </SidebarMenuItem>
              <SidebarMenuItem> {/* New PYQ Mock Tests */}
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

            {/* Friends Section */}
            <SidebarGroup id="tutorial-target-friends-group">
                  <SidebarGroupLabel className="group-data-[state=collapsed]:hidden">Friends</SidebarGroupLabel>
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

            {/* AI Tools Section */}
            <SidebarGroup id="tutorial-target-ai-tools-group">
              <SidebarGroupLabel className="group-data-[state=collapsed]:hidden">AI Tools</SidebarGroupLabel>
              <SidebarMenuItem>
                <Link href="/study-tips" passHref legacyBehavior>
                  <SidebarMenuButton as="a" isActive={isActive('/study-tips')} tooltip="AI Study Tips" id="tutorial-target-study-tips">
                    <Wand2 />
                    <span className="group-data-[state=collapsed]:hidden">AI Study Tips</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/doubt-solving" passHref legacyBehavior>
                  <SidebarMenuButton as="a" isActive={isActive('/doubt-solving')} tooltip="Doubt Solving" id="tutorial-target-doubt-solving">
                    <MessageSquare />
                    <span className="group-data-[state=collapsed]:hidden">Doubt Solving</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            </SidebarGroup>

            {/* Admin Panel Link (Conditional) */}
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

        <SidebarFooter className="mt-auto flex flex-col items-center gap-2 group-data-[state=collapsed]:gap-0">
          {/* Theme Toggle */}
          <div className="w-full flex justify-center group-data-[state=collapsed]:my-2" id="tutorial-target-theme-toggle">
            <ThemeToggle />
          </div>
          <SidebarSeparator className="my-1 group-data-[state=collapsed]:hidden"/>
          {/* Other Footer Items */}
          <SidebarMenu>
             <SidebarMenuItem>
                {/* Tutorial Button */}
                <SidebarMenuButton onClick={startTutorial} tooltip="Start Tutorial" id="tutorial-target-start-tutorial">
                    <BookUser />
                    <span className="group-data-[state=collapsed]:hidden">Tutorial</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/settings" passHref legacyBehavior>
                <SidebarMenuButton as="a" isActive={isActive('/settings')} tooltip="Settings" id="tutorial-target-settings">
                  <Settings />
                  <span className="group-data-[state=collapsed]:hidden">Settings</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/help" passHref legacyBehavior>
                <SidebarMenuButton as="a" isActive={isActive('/help')} tooltip="Help & Support" id="tutorial-target-help">
                  <HelpCircle />
                  <span className="group-data-[state=collapsed]:hidden">Help & Support</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {/* Tutorial Guide Component */}
      <TutorialGuide
        run={runTutorial}
        steps={tutorialSteps}
        stepIndex={stepIndex}
        handleJoyrideCallback={handleJoyrideCallback}
       />
    </>
  );
}
