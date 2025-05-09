// src/app/challenge-test-result/[testCode]/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, AlertTriangle, Trophy, Award, Medal, ListOrdered, Clock } from 'lucide-react';
import type { Challenge, ChallengeParticipant } from '@/types';
import { getChallengeResults } from '@/actions/challenge-actions';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

export default function ChallengeTestResultPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const testCode = params.testCode as string; // Changed from challengeCode to testCode
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    if (!testCode) { 
      setError("Invalid challenge link.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await getChallengeResults(testCode); 
      if (!data || (data.testStatus !== 'completed' && data.testStatus !== 'expired')) {
        setError("Challenge results are not yet available or challenge has expired without completion.");
        setChallenge(data);
        if (data && (data.testStatus === 'waiting' || data?.testStatus === 'started')) {
           setTimeout(() => router.push(`/challenge/lobby/${testCode}`), 3000); // Use testCode
        }
      } else {
        setChallenge(data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load challenge results.");
    } finally {
      setIsLoading(false);
    }
  }, [testCode, router]); 

  useEffect(() => {
     if (!authLoading) {
        if (!user) {
            router.push(`/auth/login?redirect=/challenge-test-result/${testCode}`); // Use testCode
            return;
        }
        fetchResults();
    }
  }, [authLoading, user, testCode, fetchResults, router]); 

  const getInitials = (name?: string | null) => name ? name.charAt(0).toUpperCase() : '?';

  const getRankIcon = (rank?: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-orange-400" />;
    return <span className="font-semibold text-sm">{rank || 'N/A'}</span>;
  };

  const sortedParticipants = challenge?.participants ? 
    Object.values(challenge.participants)
        .filter(p => p.status === 'completed')
        .sort((a, b) => (a.rank || Infinity) - (b.rank || Infinity)) 
    : [];
  
  const winner = sortedParticipants.length > 0 ? sortedParticipants[0] : null;

  if (isLoading || authLoading) {
    return (
        <div className="container mx-auto py-8 px-4 max-w-2xl text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading Results...</p>
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
             <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Challenge results could not be loaded.</p>
        </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl space-y-6">
      <Card className="shadow-xl border-primary/20">
        <CardHeader className="text-center bg-gradient-to-br from-primary/80 to-accent/70 rounded-t-lg p-6">
          <Trophy className="h-16 w-16 text-yellow-300 mx-auto mb-2 drop-shadow-lg" />
          <CardTitle className="text-3xl font-bold text-primary-foreground">Challenge Results!</CardTitle>
          <CardDescription className="text-primary-foreground/80">
            {challenge.testConfig.subject} - {challenge.testConfig.lesson}
            <br/>Code: {challenge.challengeCode}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {winner && (
            <div className="text-center p-4 rounded-md border-2 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20">
              <h2 className="text-xl font-semibold text-yellow-600 dark:text-yellow-400">🎉 Winner: {winner.name || `User ${winner.userId.substring(0,6)}`} 🎉</h2>
              <p className="text-sm text-muted-foreground">Score: {winner.score} | Time: {winner.timeTaken ? `${Math.round(winner.timeTaken/60)}m ${winner.timeTaken%60}s` : 'N/A'}</p>
            </div>
          )}
          
          <div>
            <h3 className="font-semibold mb-2 text-lg flex items-center gap-2"><ListOrdered className="h-5 w-5 text-primary"/>Leaderboard</h3>
            <ScrollArea className="h-64 border rounded-md">
                {sortedParticipants.length > 0 ? (
                    <ul className="divide-y">
                    {sortedParticipants.map((p) => (
                        <li key={p.userId} className="flex items-center justify-between p-3 hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                            <div className="w-8 text-center">{getRankIcon(p.rank)}</div>
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={p.avatarUrl ? `/avatars/${p.avatarUrl}` : `https://avatar.vercel.sh/${p.userId}.png`} />
                                <AvatarFallback>{getInitials(p.name)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium truncate max-w-[120px] sm:max-w-[150px]">{p.name || `User ${p.userId.substring(0,6)}`}</span>
                             {p.userId === user?.id && <Badge variant="outline" className="text-xs">You</Badge>}
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-semibold">{p.score} <span className="text-xs text-muted-foreground">pts</span></p>
                            <p className="text-xs text-muted-foreground">
                                <Clock className="h-3 w-3 inline mr-0.5"/>
                                {p.timeTaken ? `${Math.round(p.timeTaken/60)}m ${p.timeTaken%60}s` : 'N/A'}
                            </p>
                        </div>
                        </li>
                    ))}
                    </ul>
                ) : (
                    <p className="text-center text-sm text-muted-foreground p-4">No completed attempts to rank.</p>
                )}
            </ScrollArea>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-center gap-3 pt-6 border-t">
            <Button variant="outline" asChild>
                <Link href={`/challenge-test-review/${testCode}?userId=${user?.id}`}> 
                    Review Your Answers
                </Link>
            </Button>
            <Button asChild>
                <Link href="/challenges/invites">
                    <ListOrdered className="mr-2 h-4 w-4"/> Back to Challenges
                </Link>
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
