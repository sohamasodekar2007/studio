// src/components/test-interface/start-test-button.tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { GeneratedTest } from '@/types';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { PlayCircle, AlertTriangle, ShoppingCart, Lock } from 'lucide-react'; 
import { useRouter } from 'next/navigation'; 

interface StartTestButtonProps {
  test: GeneratedTest;
}

export default function StartTestButton({ test }: StartTestButtonProps) {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const userModel = user?.model || 'free';

  const canAccess = () => {
    switch (test.type) {
      case 'FREE':
        return true; 
      case 'FREE_PREMIUM':
        return true;
      case 'PAID':
         if (userModel === 'combo') return true; 
         if (test.testType === 'chapterwise' && userModel === 'chapterwise') return true;
         if (test.testType === 'full_length' && userModel === 'full_length') return true;
         return false; 
      default:
        return false; 
    }
  };

  const hasAccess = canAccess();

  const handleStartClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!user && !authLoading) {
      e.preventDefault(); 
      toast({
        variant: 'destructive',
        title: 'Login Required',
        description: 'Please log in or sign up to start the test.',
      });
      router.push(`/auth/login?redirect=/take-test/${test.test_code}`);
      return;
    }

    if (user && !hasAccess) {
         e.preventDefault(); 
         toast({
             variant: 'destructive',
             title: 'Upgrade Required',
             description: `Your current plan (${userModel}) does not include access to this test. Please upgrade.`,
         });
         return;
    }

    // Special handling for challenge tests - should go to challenge interface if applicable
    // This component is primarily for general tests. Challenges have their own flow.
    if ((test as any).isChallenge) { // Assuming a hypothetical isChallenge flag or similar identifier
        e.preventDefault();
        router.push(`/challenge-test/${test.test_code}?userId=${user?.id}`);
        return;
    }
  };

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
  } else if (!hasAccess) {
    buttonText = 'Upgrade to Access';
    isDisabled = true; 
    buttonIcon = <Lock className="mr-2 h-4 w-4" />; 
    buttonVariant = "secondary"; 
    showUpgradePrompt = true; 
  }

  // For non-chapterwise tests where interface might not be ready (as per previous logic)
  // This logic can be adjusted if full_length and other interfaces are implemented.
  if (test.testType !== 'chapterwise') {
     buttonText = 'Interface Coming Soon'; // Or direct to the specific interface if ready
     isDisabled = true;
     buttonIcon = <AlertTriangle className="mr-2 h-4 w-4" />;
  }


  if (showUpgradePrompt) {
      return (
         <Button
            variant={buttonVariant}
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => { 
                 toast({ title: "Upgrade Required", description: "Please upgrade your plan to access this test." });
            }}
         >
            {buttonIcon}
            {buttonText}
         </Button>
      );
  }

  // Construct the correct URL based on the test type
  const testUrl = (user && user.id)
    ? test.testType === 'chapterwise'
      ? `/chapterwise-test/${test.test_code}?userId=${user.id}`
      // Assuming full_length tests also use test_code and might have a different route
      : test.testType === 'full_length'
        ? `/full-length-test/${test.test_code}?userId=${user.id}` // Update if route is different
        : '#' // Fallback for other types
    : '#'; 

  return (
    <Link
        href={testUrl}
        passHref
        target={!isDisabled && testUrl !== '#' ? "_blank" : undefined} 
        rel="noopener noreferrer"
        onClick={handleStartClick} 
        className={`w-full sm:w-auto ${isDisabled || testUrl === '#' ? 'pointer-events-none' : ''}`} 
        aria-disabled={isDisabled}
    >
      <Button size="lg" className="w-full" variant={buttonVariant || "default"} disabled={isDisabled || authLoading}>
        {buttonIcon}
        {buttonText}
      </Button>
    </Link>
  );
}
