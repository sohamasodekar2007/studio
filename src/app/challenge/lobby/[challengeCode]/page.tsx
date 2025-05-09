// src/app/challenge/lobby/[challengeCode]/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, AlertTriangle, PlayCircle, UserCircle, CheckCircle, XCircle, Hourglass } from 'lucide-react';
import type { Challenge, ChallengeParticipant } from '@/types';
import { getChallengeDetails, startChallenge } from '@/actions/challenge-actions';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default function ChallengeLobbyPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const challengeCode = params.challengeCode as string;
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const fetchChallenge = useCallback(async () => {
    if (!challengeCode) {
      setError("Invalid challenge link.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await getChallengeDetails(challengeCode);
      if (!data) {
        setError("Challenge not found or has expired.");
        setChallenge(null);
      } else {
        setChallenge(data);
        // Use challenge.challengeCode (which is the actual test code) for navigation
        if (data.testStatus === 'started' && user) {
           router.replace(`/challenge-test/${data.challengeCode}?userId=${user.id}`);
        }
        if (data.testStatus === 'completed' || data.testStatus === 'expired') {
            // Allow viewing results if completed/expired
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load challenge details.");
    } finally {
      setIsLoading(false);
    }
  }, [challengeCode, router, user]);

  useEffect(() => {
    if (!authLoading) {
        if (!user) {
            router.push(`/auth/login?redirect=/challenge/lobby/${challengeCode}`);
            return;
        }
        fetchChallenge();
    }
  }, [authLoading, user, challengeCode, fetchChallenge, router]);

  // Basic polling for demo "real-time" participant status updates
  useEffect(() => {
    if (challenge && challenge.testStatus === 'waiting' && user?.id !== challenge.creatorId) {
      const intervalId = setInterval(() => {
        getChallengeDetails(challengeCode).then(data => {
          if (data) {
            setChallenge(currentChallenge => {
              if (JSON.stringify(currentChallenge?.participants) !== JSON.stringify(data.participants) || currentChallenge?.testStatus !== data.testStatus) {
                return data;
              }
              return currentChallenge;
            });
            if (data.testStatus === 'started') {
              clearInterval(intervalId);
              // Use data.challengeCode for navigation
              router.replace(`/challenge-test/${data.challengeCode}?userId=${user!.id}`);
            }
          }
        });
      }, 5000); 
      return () => clearInterval(intervalId);
    }
  }, [challenge, user, challengeCode, router]);


  const handleStartChallenge = async () => {
    if (!challenge || !user || user.id !== challenge.creatorId) return;
    setIsStarting(true);
    try {
      const result = await startChallenge(challengeCode, user.id);
      if (result.success) {
        toast({ title: "Challenge Started!", description: "The test is now live for all participants." });
        // Use challenge.challengeCode for navigation
        router.push(`/challenge-test/${challenge.challengeCode}?userId=${user.id}`);
      } else {
        throw new Error(result.message || "Failed to start challenge.");
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Start Failed', description: error.message });
    } finally {
      setIsStarting(false);
    }
  };

  const getParticipantStatusIcon = (status: ChallengeParticipant['status']) => {
    switch (status) {
      case 'accepted': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending': return <Hourglass className="h-4 w-4 text-yellow-500 animate-pulse" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <UserCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };
  const getInitials = (name?: string | null) => name ? name.charAt(0).toUpperCase() : 'U';


  if (isLoading || authLoading) {
    return (
        <div className="container mx-auto py-8 px-4 max-w-lg text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading Challenge Lobby...</p>
        </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-lg text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h1 className="text-xl font-bold text-destructive mb-2">Error</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button asChild variant="outline"><Link href="/challenges/invites">Back to Invites</Link></Button>
      </div>
    );
  }

  if (!challenge) {
    return (
        <div className="container mx-auto py-8 px-4 max-w-lg text-center">
             <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-muted-foreground">Challenge data not found.</p>
        </div>
    );
  }
  
  const isCreator = user?.id === challenge.creatorId;
  const allAccepted = Object.values(challenge.participants).every(p => p.status === 'accepted' || p.userId === challenge.creatorId); // Creator is always accepted
  const canStart = isCreator && challenge.testStatus === 'waiting' && allAccepted;


  return (
    <div className="container mx-auto py-8 px-4 max-w-lg space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Challenge Lobby</CardTitle>
          <CardDescription>
            Test: {challenge.testConfig.subject} - {challenge.testConfig.lesson} ({challenge.testConfig.numQuestions} Qs)
            <br/>Created by: {challenge.creatorName || 'Unknown'}
          </CardDescription>
          <Badge variant="outline" className="mx-auto w-fit">Code: {challenge.challengeCode}</Badge>
        </CardHeader>
        <CardContent>
          <h3 className="font-semibold mb-2 text-center">Participants:</h3>
          <ul className="space-y-2 max-h-60 overflow-y-auto">
            {Object.values(challenge.participants).map(participant => (
              <li key={participant.userId} className="flex items-center justify-between p-2 border rounded-md bg-muted/30">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                     <AvatarImage src={participant.avatarUrl ? `/avatars/${participant.avatarUrl}` : `https://avatar.vercel.sh/${participant.userId}.png`} />
                     <AvatarFallback>{getInitials(participant.name)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{participant.name || `User ${participant.userId.substring(0,6)}`}</span>
                  {participant.userId === user?.id && <Badge variant="secondary" className="text-xs">You</Badge>}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground capitalize">
                    {getParticipantStatusIcon(participant.status)}
                    {participant.status}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          {challenge.testStatus === 'waiting' && (
            <>
              {isCreator ? (
                <Button onClick={handleStartChallenge} disabled={isStarting || !allAccepted} className="w-full">
                  {isStarting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                  Start Challenge for All
                </Button>
              ) : (
                <div className="text-center text-sm text-muted-foreground p-3 border rounded-md bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700">
                    <Hourglass className="h-5 w-5 mx-auto mb-1 text-amber-600 dark:text-amber-400"/>
                    Waiting for {challenge.creatorName || 'the host'} to start the test...
                </div>
              )}
              {!allAccepted && isCreator && <p className="text-xs text-muted-foreground text-center">Waiting for all invited friends to accept the challenge.</p>}
            </>
          )}
          {challenge.testStatus === 'started' && user && (
             <Button onClick={() => router.push(`/challenge-test/${challenge.challengeCode}?userId=${user.id}`)} className="w-full">
                <PlayCircle className="mr-2 h-4 w-4" /> Join Ongoing Test
             </Button>
          )}
          {challenge.testStatus === 'completed' && (
             <Button onClick={() => router.push(`/challenge-test-result/${challenge.challengeCode}`)} className="w-full">
                View Results
             </Button>
          )}
           {challenge.testStatus === 'expired' && (
             <p className="text-sm text-destructive text-center">This challenge has expired.</p>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
