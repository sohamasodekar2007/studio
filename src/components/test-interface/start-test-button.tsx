// src/components/test-interface/start-test-button.tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { GeneratedTest } from '@/types';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { PlayCircle, Lock } from 'lucide-react'; 
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
         if (test.testseriesType === 'chapterwise' && userModel === 'chapterwise') return true; // Renamed from testType
         if (test.testseriesType === 'full_length' && userModel === 'full_length') return true; // Renamed from testType
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
  };

  let buttonText = 'Start Test Now';
  let isDisabled = false;
  let buttonIcon = <PlayCircle className="mr-2 h-5 w-5" />;
  let buttonVariant: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link" | null | undefined = "default";

  if (authLoading) {
    buttonText = 'Loading...';
    isDisabled = true;
  } else if (!user) {
    buttonText = 'Login to Start';
  } else if (!hasAccess) {
    buttonText = 'Upgrade to Access';
    isDisabled = true; 
    buttonIcon = <Lock className="mr-2 h-4 w-4" />; 
    buttonVariant = "secondary"; 
  }

  const testInterfacePath = (user && user.id) ? `/test-interface/${test.test_code}?userId=${user.id}` : '#';

  return (
    <Link
        href={testInterfacePath}
        passHref
        target={!isDisabled && testInterfacePath !== '#' ? "_blank" : undefined} 
        rel="noopener noreferrer"
        onClick={handleStartClick} 
        className={`w-full sm:w-auto ${isDisabled || testInterfacePath === '#' ? 'pointer-events-none opacity-70' : ''}`}
        aria-disabled={isDisabled}
    >
      <Button size="lg" className="w-full" variant={buttonVariant || "default"} disabled={isDisabled || authLoading}>
        {buttonIcon}
        {buttonText}
      </Button>
    </Link>
  );
}
