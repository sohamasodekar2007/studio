// src/components/test-interface/start-test-button.tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { GeneratedTest } from '@/types';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { PlayCircle, AlertTriangle, ShoppingCart, Lock } from 'lucide-react'; // Added icons
import { useRouter } from 'next/navigation'; // Use router for login redirect

interface StartTestButtonProps {
  test: GeneratedTest;
}

export default function StartTestButton({ test }: StartTestButtonProps) {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const userModel = user?.model || 'free';

  // --- Determine if the user can access this test ---
  const canAccess = () => {
    switch (test.type) {
      case 'FREE':
        return true; // Everyone can access FREE tests
      case 'FREE_PREMIUM':
        return userModel !== 'free'; // Only premium users can access FREE_PREMIUM
      case 'PAID':
        // PAID tests have specific access rules
        if (userModel === 'combo') return true; // Combo plan accesses all PAID tests
        if (test.testType === 'chapterwise' && userModel === 'chapterwise') return true;
        if (test.testType === 'full_length' && userModel === 'full_length') return true;
        return false; // Free users or mismatched premium users cannot access this PAID test
      default:
        return false; // Unknown type
    }
  };

  const hasAccess = canAccess();

  // --- Handle Button Click ---
  const handleStartClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!user && !authLoading) {
      e.preventDefault(); // Prevent navigation
      toast({
        variant: 'destructive',
        title: 'Login Required',
        description: 'Please log in or sign up to start the test.',
      });
      // Redirect to login, remembering the intended test page
      router.push(`/auth/login?redirect=/take-test/${test.test_code}`);
      return;
    }

    if (user && !hasAccess) {
         e.preventDefault(); // Prevent navigation
         toast({
             variant: 'destructive',
             title: 'Upgrade Required',
             description: `Your current plan (${userModel}) does not include access to this test. Please upgrade.`,
         });
         // Optionally redirect to upgrade page: router.push('/upgrade');
         return;
    }

    // If user is logged in and has access, the Link component will handle navigation
    // Open in a new tab is handled by the Link component's target attribute
  };

  // --- Determine Button State and Text ---
  let buttonText = 'Start Test';
  let isDisabled = false;
  let buttonIcon = <PlayCircle className="mr-2 h-5 w-5" />;
  let buttonVariant: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link" | null | undefined = "default";
  let showUpgradePrompt = false;

  if (authLoading) {
    buttonText = 'Loading...';
    isDisabled = true;
  } else if (!user) {
    buttonText = 'Login to Start Test';
    // Let onClick handler manage redirection, button remains enabled
  } else if (!hasAccess) {
    buttonText = 'Upgrade to Access';
    isDisabled = true; // Disable direct link click
    buttonIcon = <Lock className="mr-2 h-4 w-4" />; // Show lock icon
    buttonVariant = "secondary"; // Use secondary variant for upgrade prompt
    showUpgradePrompt = true; // Indicate we should show upgrade message/link
  } else {
     // User logged in and has access
     buttonText = 'Start Test';
     buttonIcon = <PlayCircle className="mr-2 h-5 w-5" />;
  }

  // Override for test type specific issues (like if full_length interface is not ready)
  if (test.testType !== 'chapterwise' && hasAccess) {
     buttonText = 'Interface Coming Soon';
     isDisabled = true;
     buttonIcon = <AlertTriangle className="mr-2 h-4 w-4" />;
  }


  // Render the button based on the determined state
  if (showUpgradePrompt) {
      return (
         <Button
            variant={buttonVariant}
            size="lg"
            className="w-full"
            onClick={() => { /* TODO: Redirect to upgrade page */
                 toast({ title: "Upgrade Required", description: "Please upgrade your plan to access this test." });
            }}
         >
            {buttonIcon}
            {buttonText}
         </Button>
      );
  }

  const testUrl = (user && user.id && test.testType === 'chapterwise')
    ? `/chapterwise-test/${test.test_code}?userId=${user.id}`
    : '#'; // Default to '#' if not chapterwise or no user

  // Render the Link or a disabled button if needed
  return (
    <Link
        href={testUrl}
        passHref
        target={!isDisabled && testUrl !== '#' ? "_blank" : undefined} // Open in new tab only if enabled and valid URL
        rel="noopener noreferrer"
        onClick={handleStartClick} // Handles login check and access check
        className={`w-full sm:w-auto ${isDisabled || testUrl === '#' ? 'pointer-events-none' : ''}`} // Disable link interaction if button is disabled
        aria-disabled={isDisabled}
    >
      <Button size="lg" className="w-full" variant={buttonVariant || "default"} disabled={isDisabled || authLoading}>
        {buttonIcon}
        {buttonText}
      </Button>
    </Link>
  );
}
