// src/app/challenges/invites/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, Check, X, Loader2, AlertTriangle, Eye, History, ClockIcon, Info } from 'lucide-react';
import type { ChallengeInvite } from '@/types';
import { getUserChallengeInvites, acceptChallenge, rejectChallenge } from '@/actions/challenge-actions';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


export default function ChallengeInvitesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [pendingActiveInvites, setPendingActiveInvites] = useState<ChallengeInvite[]>([]);
  const [pastInvites, setPastInvites] = useState<ChallengeInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && "Notification" in window) {
      setNotificationPermissionStatus(Notification.permission);
    }
  }, []);

  const fetchInvites = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await getUserChallengeInvites(user.id);
      const now = Date.now();
      
      const currentPending = data.invites.filter(inv => inv.status === 'pending' && inv.expiresAt > now)
                                        .sort((a, b) => b.createdAt - a.createdAt);
      
      const currentPast = data.invites.filter(inv => inv.status !== 'pending' || inv.expiresAt <= now)
                                    .sort((a, b) => b.createdAt - a.createdAt); 

      setPendingActiveInvites(currentPending);
      setPastInvites(currentPast);

      // Update local storage for notification simulation when this page is visited
      if (typeof window !== 'undefined') {
        localStorage.setItem(`userChallengeInvites_${user.id}`, JSON.stringify(data.invites));
        localStorage.setItem(`lastSeenInvitesCount_${user.id}_header`, currentPending.length.toString());
         // Trigger a custom event to let AppHeader know that invites page was visited, so it can refresh its dot
         window.dispatchEvent(new CustomEvent('invitesPageVisited'));
      }

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
        fetchInvites(); 
        if (action === 'accept' && result.challenge) {
          router.push(`/challenge/lobby/${result.challenge.challengeCode}`); // Use challengeCode from result (which is the testCode)
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

  const getInviteStatusBadge = (invite: ChallengeInvite) => {
    const now = Date.now();
    if (invite.status === 'pending' && invite.expiresAt <= now) {
      return <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">Expired</Badge>;
    }
    switch (invite.status) {
      case 'accepted':
        return <Badge variant="default" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Accepted</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="text-xs">Rejected</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400">Pending</Badge>;
      case 'expired': 
        return <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">Expired</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{invite.status}</Badge>;
    }
  };

  const handleRequestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && "Notification" in window) {
        const permission = await Notification.requestPermission();
        setNotificationPermissionStatus(permission);
        if (permission === 'granted') {
            toast({ title: "Notifications Enabled!", description: "You'll now receive real-time challenge invites." });
        } else {
            toast({ variant: "default", title: "Notifications Blocked", description: "You can enable notifications from browser settings." });
        }
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
    <div className="container mx-auto py-8 px-4 max-w-2xl space-y-8">
      <div className="text-center">
        <Bell className="h-12 w-12 text-primary mx-auto mb-2" />
        <h1 className="text-3xl font-bold tracking-tight">Challenge Invites</h1>
        <p className="text-muted-foreground">Accept or reject challenges from your friends.</p>
      </div>

      {notificationPermissionStatus && notificationPermissionStatus !== 'granted' && (
        <Alert variant="default" className="mb-6 bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
          <Info className="h-4 w-4 !text-blue-600 dark:!text-blue-400" />
          <AlertTitle className="text-blue-700 dark:text-blue-300">Enable Notifications for Real-time Invites</AlertTitle>
          <AlertDescription className="text-blue-600 dark:text-blue-400 text-xs">
            To get instant notifications for new challenges, please allow browser notifications.
            If you've recently changed permissions, a page reload might be needed for it to take effect.
            <Button variant="link" size="sm" className="p-0 h-auto ml-1 text-blue-700 dark:text-blue-300 underline" onClick={handleRequestNotificationPermission}>
              Request Permission
            </Button>
          </AlertDescription>
        </Alert>
      )}


      {/* Pending Active Invites */}
      {pendingActiveInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Pending Invites</CardTitle>
             <CardDescription>These challenges are waiting for your response.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingActiveInvites.map((invite) => (
              <Card key={invite.challengeCode} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">Challenge from {invite.creatorName || 'A friend'}</CardTitle>
                  <CardDescription>
                    Test: {invite.testName} ({invite.numQuestions} Qs)
                    <br />
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <ClockIcon className="h-3 w-3"/> Expires: {new Date(invite.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                    Accept & Join
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}
      
      {(pendingActiveInvites.length === 0 && pastInvites.length === 0 && !isLoading) && (
         <Card>
          <CardContent className="p-10 text-center">
            <p className="text-muted-foreground">You have no challenge invites at the moment.</p>
            <Button asChild variant="link" className="mt-2">
                <Link href="/challenge/create">Create a new challenge?</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Past/Responded Invites */}
      {pastInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2"><History className="h-5 w-5"/>Past Invites</CardTitle>
             <CardDescription>History of your challenge invitations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pastInvites.map((invite) => (
              <div key={invite.challengeCode + invite.status + invite.createdAt} className="flex items-center justify-between p-3 border rounded-md bg-muted/20 hover:bg-muted/30 transition-colors">
                <div>
                  <p className="text-sm font-medium">
                    Challenge from {invite.creatorName || 'A friend'}
                     <span className="text-xs text-muted-foreground ml-2">({invite.testName})</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(invite.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getInviteStatusBadge(invite)}
                   {invite.status === 'accepted' && ( // This should ideally check if the challenge itself is completed/started
                     <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
                        <Link href={`/challenge-test-result/${invite.challengeCode}`}>View Result</Link>
                     </Button>
                   )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
