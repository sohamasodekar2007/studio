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

  // Determine which interface to link to based on testType
  let testInterfacePath = '#'; // Default to '#' if interface not ready
  if (test.testType === 'chapterwise') {
    testInterfacePath = `/chapterwise-test/${test.test_code}?userId=${user?.id}`;
  } else if (test.testType === 'full_length') {
    // Currently, full_length test interface is not fully implemented.
    // We can point to chapterwise for now or disable.
    // For demonstration, let's assume it also points to chapterwise if no specific FL interface exists
    // testInterfacePath = `/full-length-test/${test.test_code}?userId=${user?.id}`; // Ideal
    testInterfacePath = `/chapterwise-test/${test.test_code}?userId=${user?.id}`; // Temporary
    buttonText = 'Start Full Test (Demo)';
    if (hasAccess && user) { // Only enable if user has access
        isDisabled = false; // Keep enabled if accessible
    }
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
  
  const finalTestUrl = (user && user.id) ? testInterfacePath : '#';

  return (
    <Link
        href={finalTestUrl}
        passHref
        target={!isDisabled && finalTestUrl !== '#' ? "_blank" : undefined} 
        rel="noopener noreferrer"
        onClick={handleStartClick} 
        className={`w-full sm:w-auto ${isDisabled || finalTestUrl === '#' ? 'pointer-events-none' : ''}`} 
        aria-disabled={isDisabled}
    >
      <Button size="lg" className="w-full" variant={buttonVariant || "default"} disabled={isDisabled || authLoading}>
        {buttonIcon}
        {buttonText}
      </Button>
    </Link>
  );
}
