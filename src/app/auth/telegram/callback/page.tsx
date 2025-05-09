// src/app/auth/telegram/callback/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { processTelegramLogin } from '@/actions/telegram-auth-actions';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@/types'; // For mapping to context user

export default function TelegramCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, setUser, setLoading: setAuthLoading } = useAuth(); // Use login and setUser from context
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

          // Manually set user in context and local storage
          // The AuthContext's login function is designed for email/password.
          // For external providers, we update the context directly.
          setAuthLoading(true); // Mimic loading state
          const contextUser = { // Map to ContextUser type
              id: result.user.id,
              email: result.user.email,
              name: result.user.name,
              phone: result.user.phone,
              avatarUrl: result.user.avatarUrl,
              class: result.user.class,
              model: result.user.model,
              role: result.user.role,
              expiry_date: result.user.expiry_date,
              createdAt: result.user.createdAt,
              targetYear: result.user.targetYear,
              telegramId: result.user.telegramId,
              telegramUsername: result.user.telegramUsername,
          };
          setUser(contextUser);
          localStorage.setItem('loggedInUser', JSON.stringify(result.user)); // Store Omit<UserProfile, 'password'>
          setAuthLoading(false);

          if (result.needsProfileCompletion) {
            // Redirect to a page where user can complete their profile (class, targetYear)
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
  }, [searchParams, router, login, toast, setUser, setAuthLoading]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Processing Telegram login...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-xl font-bold text-destructive mb-2">Authentication Error</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => router.push('/auth/signup')} variant="outline">
          Back to Sign Up
        </Button>
      </div>
    );
  }

  // Should not reach here if redirecting
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-muted-foreground">Redirecting...</p>
    </div>
    );
}
