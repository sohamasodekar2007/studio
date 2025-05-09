// src/app/auth/telegram/callback/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { processTelegramLogin } from '@/actions/telegram-auth-actions';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile, ContextUser } from '@/types'; 
import { Button } from '@/components/ui/button';

export default function TelegramCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser, setLoading: setAuthLoading, mapUserProfileToContextUser } = useAuth();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const processAuth = async () => {
      const params = Object.fromEntries(searchParams.entries());
      
      if (!params.hash || !params.id) {
        setError("Invalid Telegram authentication data received.");
        setIsLoading(false);
        return;
      }

      try {
        const result = await processTelegramLogin(params);

        if (result.success && result.user) {
          toast({
            title: "Telegram Login Successful!",
            description: `Welcome, ${result.user.name || result.user.email}!`,
          });

          setAuthLoading(true);
          const contextUser = mapUserProfileToContextUser(result.user);
          setUser(contextUser);
          // Ensure result.user (which is Omit<UserProfile, 'password'>) is stringified
          localStorage.setItem('loggedInUser', JSON.stringify(result.user));
          setAuthLoading(false);

          if (result.needsProfileCompletion) {
            router.push('/settings?status=complete-profile'); 
          } else {
            router.push('/'); // Redirect to dashboard
          }
        } else {
          setError(result.message || "Telegram authentication failed. Please try again.");
        }
      } catch (e: any) {
        setError(`An unexpected error occurred: ${e.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    processAuth();
  }, [searchParams, router, toast, setUser, setAuthLoading, mapUserProfileToContextUser]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Verifying Telegram login...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-destructive/5">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-xl font-bold text-destructive mb-2">Authentication Error</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => router.push('/auth/signup')} variant="outline">
          Back to Sign Up
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-muted-foreground">Redirecting...</p>
    </div>
    );
}
