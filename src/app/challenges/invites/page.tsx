// src/app/challenges/invites/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, Check, X, Loader2, AlertTriangle, Eye } from 'lucide-react';
import type { ChallengeInvite } from '@/types';
import { getUserChallengeInvites, acceptChallenge, rejectChallenge } from '@/actions/challenge-actions';
import { useToast } from '@/hooks/use-toast';

export default function ChallengeInvitesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [invites, setInvites] = useState<ChallengeInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({}); // For accept/reject loading

  const fetchInvites = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await getUserChallengeInvites(user.id);
      const pending = data.invites.filter(inv => inv.status === 'pending' && inv.expiresAt > Date.now()).sort((a, b) => b.createdAt - a.createdAt);
      setInvites(pending);

      // Update local storage for notification simulation
      localStorage.setItem(`userChallengeInvites_${user.id}`, JSON.stringify(data.invites)); // Store all invites
      localStorage.setItem(`lastSeenInvitesCount_${user.id}`, pending.length.toString()); // Update count of currently pending

    } catch (err: any) {
      setError(err.message || "Failed to load challenge invites.");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/auth/login?redirect=/challenges/invites');
      } else {
        fetchInvites();
      }
    }
  }, [user, authLoading, router, fetchInvites]);

  const handleAction = async (challengeCode: string, action: 'accept' | 'reject') => {
    if (!user?.id) return;
    setActionLoading(prev => ({ ...prev, [challengeCode]: true }));
    try {
      const result = action === 'accept'
        ? await acceptChallenge(challengeCode, user.id)
        : await rejectChallenge(challengeCode, user.id);

      if (result.success) {
        toast({ title: `Challenge ${action === 'accept' ? 'Accepted' : 'Rejected'}!` });
        fetchInvites(); // Refresh invites list (which also updates local storage)
        if (action === 'accept' && result.challenge) {
          router.push(`/challenge/lobby/${result.challenge.challengeCode}`);
        }
      } else {
        throw new Error(result.message || `Failed to ${action} challenge.`);
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Action Failed', description: err.message });
    } finally {
      setActionLoading(prev => ({ ...prev, [challengeCode]: false }));
    }
  };

  if (isLoading || authLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-2xl space-y-6">
        <Skeleton className="h-8 w-1/2" /> <Skeleton className="h-6 w-3/4" />
        <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent className="space-y-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (error) {
     return (
      <div className="container mx-auto py-8 px-4 max-w-lg text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h1 className="text-xl font-bold text-destructive mb-2">Error</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={fetchInvites} variant="outline">Try Again</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl space-y-6">
      <div className="text-center">
        <Bell className="h-12 w-12 text-primary mx-auto mb-2" />
        <h1 className="text-3xl font-bold tracking-tight">Challenge Invites</h1>
        <p className="text-muted-foreground">Accept or reject challenges from your friends.</p>
      </div>

      {invites.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="text-muted-foreground">You have no pending challenge invites.</p>
            <Button asChild variant="link" className="mt-2">
                <Link href="/challenge/create">Create a new challenge?</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {invites.map((invite) => (
            <Card key={invite.challengeCode} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">Challenge from {invite.creatorName || 'A friend'}</CardTitle>
                <CardDescription>
                  Test: {invite.testName} ({invite.numQuestions} Qs)
                  <br />
                  <span className="text-xs text-muted-foreground">
                    Created: {new Date(invite.createdAt).toLocaleString()} | Expires: {new Date(invite.expiresAt).toLocaleString()}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardFooter className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAction(invite.challengeCode, 'reject')}
                  disabled={actionLoading[invite.challengeCode]}
                >
                  {actionLoading[invite.challengeCode] ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="mr-1 h-4 w-4" />}
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAction(invite.challengeCode, 'accept')}
                  disabled={actionLoading[invite.challengeCode]}
                >
                   {actionLoading[invite.challengeCode] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                  Accept & Join Lobby
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
