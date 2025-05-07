// src/components/test-interface/start-test-button.tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { GeneratedTest } from '@/types';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { PlayCircle, AlertTriangle } from 'lucide-react';

interface StartTestButtonProps {
  test: GeneratedTest;
}

export default function StartTestButton({ test }: StartTestButtonProps) {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const handleStartTest = () => {
    if (!user && !authLoading) {
      toast({
        variant: 'destructive',
        title: 'Login Required',
        description: 'Please log in to start the test.',
      });
      // Optionally redirect to login, or let AuthProvider handle it
      // router.push(`/auth/login?redirect=/take-test/${test.test_code}`);
      return false; // Prevent navigation if not logged in
    }
    return true; // Allow navigation
  };

  let testUrl = '#';
  let buttonText = 'Start Test';
  let isDisabled = false;

  if (user && user.id) {
    if (test.testType === 'chapterwise') {
      testUrl = `/chapterwise-test/${test.test_code}?userId=${user.id}`;
    } else if (test.testType === 'full_length') {
      // Placeholder for full_length test, currently not implemented
      buttonText = 'Full Length Test (Coming Soon)';
      isDisabled = true;
      testUrl = '#'; // Prevent navigation
    } else {
      buttonText = 'Test Type Not Supported';
      isDisabled = true;
    }
  } else if (!authLoading) {
    // User not logged in, button should prompt login or be disabled
    buttonText = 'Login to Start Test';
    // isDisabled = true; // Or let handleStartTest manage it
  }

  if (authLoading) {
    return <Button size="lg" className="w-full sm:w-auto" disabled>Loading User...</Button>;
  }

  if (isDisabled || testUrl === '#') {
     return (
        <Button size="lg" className="w-full sm:w-auto" disabled>
            {test.testType !== 'chapterwise' && <AlertTriangle className="mr-2 h-4 w-4" />}
            {buttonText}
        </Button>
     );
  }


  return (
    <Link
        href={testUrl}
        passHref
        target="_blank" // Open in new tab
        rel="noopener noreferrer"
        onClick={(e) => {
            if (!handleStartTest()) {
            e.preventDefault(); // Prevent navigation if login required
            }
        }}
        className="w-full sm:w-auto"
    >
      <Button size="lg" className="w-full">
        <PlayCircle className="mr-2 h-5 w-5" />
        {buttonText}
      </Button>
    </Link>
  );
}
