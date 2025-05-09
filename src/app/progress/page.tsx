// src/app/progress/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, History, Eye, Loader2, RefreshCw, Swords } from 'lucide-react';
import type { TestResultSummary, UserChallengeHistoryItem } from '@/types';
import { getAllTestReportsForUser } from '@/actions/test-report-actions';
import { getCompletedChallengesForUser } from '@/actions/challenge-actions'; // Updated import
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ProgressPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [regularTestHistory, setRegularTestHistory] = useState<Array<Partial<TestResultSummary> & { attemptTimestamp: number }>>([]);
  const [challengeTestHistory, setChallengeTestHistory] = useState<UserChallengeHistoryItem[]>([]);
  const [isLoadingRegular, setIsLoadingRegular] = useState(true);
  const [isLoadingChallenges, setIsLoadingChallenges] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRegularTestHistory = useCallback(async () => {
    if (!user || !user.id) {
        if (!authLoading) setIsLoadingRegular(false);
        return;
    };
    setIsLoadingRegular(true);
    setError(null);
    try {
        const history = await getAllTestReportsForUser(user.id);
        const validatedHistory = history.filter(h => h.attemptTimestamp !== undefined) as Array<Partial<TestResultSummary> & { attemptTimestamp: number }>;
        setRegularTestHistory(validatedHistory);
    } catch (err: any) {
      console.error("Error fetching regular test history:", err);
      setError(err.message || "Failed to load your regular test history.");
      setRegularTestHistory([]);
    } finally {
      setIsLoadingRegular(false);
    }
  }, [user, authLoading]);

  const fetchChallengeTestHistory = useCallback(async () => {
    if (!user || !user.id) {
        if (!authLoading) setIsLoadingChallenges(false);
        return;
    };
    setIsLoadingChallenges(true);
    setError(null); 
    try {
        const challenges = await getCompletedChallengesForUser(user.id);
        setChallengeTestHistory(challenges);
    } catch (err: any) {
      console.error("Error fetching challenge test history:", err);
      setError(err.message || "Failed to load your challenge test history.");
      setChallengeTestHistory([]);
    } finally {
      setIsLoadingChallenges(false);
    }
  }, [user, authLoading]);


  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login?redirect=/progress');
      return;
    }
    if (user) {
        fetchRegularTestHistory();
        fetchChallengeTestHistory();
    }
  }, [user, authLoading, router, fetchRegularTestHistory, fetchChallengeTestHistory]);

  const isLoading = isLoadingRegular || isLoadingChallenges || authLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">My Progress</h1>
        <p className="text-muted-foreground mb-6">Review your past test attempts and performance.</p>
        <Card>
           <CardHeader className="flex flex-row items-center justify-center p-6">
             <Loader2 className="h-6 w-6 animate-spin text-primary mr-3" />
             <CardTitle className="text-lg sm:text-xl">Loading History...</CardTitle>
           </CardHeader>
          <CardContent className="space-y-3 p-4 sm:p-6">
            <Skeleton className="h-10 w-full mb-2" />
            <Skeleton className="h-10 w-full mb-2" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !isLoadingRegular && !isLoadingChallenges) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <AlertTriangle className="h-12 w-12 sm:h-16 sm:w-16 text-destructive mx-auto mb-4" />
        <h1 className="text-xl sm:text-2xl font-bold text-destructive mb-2">Error Loading Progress</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => { fetchRegularTestHistory(); fetchChallengeTestHistory(); }}> <RefreshCw className="mr-2 h-4 w-4"/> Try Again</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">My Progress</h1>
      <p className="text-muted-foreground mb-6">Review your past test attempts and performance.</p>

    <Tabs defaultValue="regular_tests" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="regular_tests">Regular Tests</TabsTrigger>
            <TabsTrigger value="challenge_tests">Challenge Tests</TabsTrigger>
        </TabsList>

        <TabsContent value="regular_tests">
          {regularTestHistory.length === 0 && !isLoadingRegular ? (
            <Card>
              <CardContent className="p-6 sm:p-10 text-center">
                <History className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">You haven't attempted any regular tests yet.</p>
                <Button asChild className="mt-4">
                  <Link href="/tests">Browse Tests</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Regular Test History</CardTitle>
                <CardDescription>A log of all your completed regular tests.</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Responsive Card View for Mobile */}
                <div className="space-y-4 sm:hidden">
                  {regularTestHistory.map((attempt) => (
                    <Card key={attempt.attemptTimestamp} className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-medium text-sm flex-1 mr-2 truncate">{attempt.testName || 'N/A'}</p>
                        <p className="text-sm font-semibold whitespace-nowrap">
                          {attempt.score ?? 'N/A'} / {attempt.totalMarks ?? attempt.totalQuestions ?? 'N/A'}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Submitted: {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : 'N/A'}
                      </p>
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" asChild>
                          <Link href={`/chapterwise-test-results/${attempt.testCode}?userId=${user?.id}&attemptTimestamp=${attempt.attemptTimestamp}`}>
                            Result
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/chapterwise-test-review/${attempt.testCode}?userId=${user?.id}&attemptTimestamp=${attempt.attemptTimestamp}`}>
                            <Eye className="mr-1 h-3.5 w-3.5" /> Review
                          </Link>
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
                {/* Table View for Desktop */}
                <div className="hidden sm:block">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Test Name</TableHead>
                          <TableHead className="text-center">Score</TableHead>
                          <TableHead className="text-center hidden md:table-cell">Percentage</TableHead>
                          <TableHead className="hidden lg:table-cell">Submitted On</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {regularTestHistory.map((attempt) => (
                          <TableRow key={attempt.attemptTimestamp}>
                            <TableCell className="font-medium truncate max-w-xs">{attempt.testName || 'N/A'}</TableCell>
                            <TableCell className="text-center">{attempt.score ?? 'N/A'} / {attempt.totalMarks ?? attempt.totalQuestions ?? 'N/A'}</TableCell>
                            <TableCell className="text-center hidden md:table-cell">{attempt.percentage?.toFixed(2) ?? 'N/A'}%</TableCell>
                            <TableCell className="hidden lg:table-cell">{attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : 'N/A'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="secondary" size="sm" asChild>
                                  <Link href={`/chapterwise-test-results/${attempt.testCode}?userId=${user?.id}&attemptTimestamp=${attempt.attemptTimestamp}`}>
                                    View Result
                                  </Link>
                                </Button>
                                <Button variant="outline" size="sm" asChild>
                                  <Link href={`/chapterwise-test-review/${attempt.testCode}?userId=${user?.id}&attemptTimestamp=${attempt.attemptTimestamp}`}>
                                    <Eye className="mr-1.5 h-4 w-4" /> Review
                                  </Link>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="challenge_tests">
          {challengeTestHistory.length === 0 && !isLoadingChallenges ? (
            <Card>
              <CardContent className="p-6 sm:p-10 text-center">
                <Swords className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">You haven't participated in any challenges yet.</p>
                 <Button asChild className="mt-4">
                  <Link href="/challenge/create">Create or Join a Challenge</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Challenge Test History</CardTitle>
                <CardDescription>A log of all your completed challenge tests.</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Responsive Card View for Mobile */}
                <div className="space-y-4 sm:hidden">
                    {challengeTestHistory.map((challenge) => (
                         <Card key={challenge.challengeCode + challenge.completedAt} className="p-4">
                            <div className="flex justify-between items-start mb-2">
                                <p className="font-medium text-sm flex-1 mr-2 truncate">{challenge.testName}</p>
                                <p className="text-sm font-semibold whitespace-nowrap">
                                     {challenge.userScore} / {challenge.totalPossibleScore}
                                </p>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                                With: {challenge.opponentNames.join(', ') || 'Solo'} | Rank: {challenge.rank || 'N/A'}
                            </p>
                            <p className="text-xs text-muted-foreground mb-3">
                                Completed: {new Date(challenge.completedAt).toLocaleString()}
                            </p>
                             <div className="flex justify-end gap-2">
                                <Button variant="secondary" size="sm" asChild>
                                    <Link href={`/challenge-test-result/${challenge.challengeCode}`}>
                                        Result
                                    </Link>
                                </Button>
                                <Button variant="outline" size="sm" asChild>
                                    <Link href={`/challenge-test-review/${challenge.challengeCode}?userId=${user?.id}`}>
                                        <Eye className="mr-1 h-3.5 w-3.5" /> Review
                                    </Link>
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
                {/* Table View for Desktop */}
                 <div className="hidden sm:block">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead>Test Name</TableHead>
                                <TableHead>Opponent(s)</TableHead>
                                <TableHead className="text-center">Score</TableHead>
                                <TableHead className="text-center hidden md:table-cell">Rank</TableHead>
                                <TableHead className="hidden lg:table-cell">Completed On</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {challengeTestHistory.map((challenge) => (
                                <TableRow key={challenge.challengeCode + challenge.completedAt}>
                                    <TableCell className="font-medium truncate max-w-xs">{challenge.testName}</TableCell>
                                    <TableCell className="truncate max-w-xs">{challenge.opponentNames.join(', ') || 'Solo Challenge'}</TableCell>
                                    <TableCell className="text-center">{challenge.userScore} / {challenge.totalPossibleScore}</TableCell>
                                    <TableCell className="text-center hidden md:table-cell">{challenge.rank || 'N/A'}</TableCell>
                                    <TableCell className="hidden lg:table-cell">{new Date(challenge.completedAt).toLocaleString()}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                        <Button variant="secondary" size="sm" asChild>
                                            <Link href={`/challenge-test-result/${challenge.challengeCode}`}>
                                                View Result
                                            </Link>
                                        </Button>
                                        <Button variant="outline" size="sm" asChild>
                                             <Link href={`/challenge-test-review/${challenge.challengeCode}?userId=${user?.id}`}>
                                                <Eye className="mr-1.5 h-4 w-4" /> Review
                                            </Link>
                                        </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            </TableBody>
                        </Table>
                    </div>
                 </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
    </Tabs>
    </div>
  );
}
