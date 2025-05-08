// src/app/progress/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react'; // Added useCallback
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, History, Eye, Loader2, RefreshCw } from 'lucide-react'; // Added Loader2, RefreshCw
import type { TestResultSummary } from '@/types';
import { getAllTestReportsForUser } from '@/actions/test-report-actions'; // Import the new action

export default function ProgressPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  // State holds partial summaries as some data might be missing if parsing failed on backend
  const [testHistory, setTestHistory] = useState<Array<Partial<TestResultSummary> & { attemptTimestamp: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // useCallback to memoize the fetch function
  const fetchTestHistory = useCallback(async () => {
    if (!user || !user.id) {
        if (!authLoading) setIsLoading(false); // Stop loading if auth is done and no user
        return;
    };

    setIsLoading(true);
    setError(null);
    console.log("ProgressPage: Fetching test history for user:", user.id);

    try {
        // Fetch history using the server action
        const history = await getAllTestReportsForUser(user.id);

        // Ensure attemptTimestamp is present for key generation (should be, as it's startTime)
        const validatedHistory = history.filter(h => h.attemptTimestamp !== undefined) as Array<Partial<TestResultSummary> & { attemptTimestamp: number }>;

        setTestHistory(validatedHistory);
        console.log("ProgressPage: Processed test history:", validatedHistory);

    } catch (err: any) {
      console.error("Error fetching test history:", err);
      setError(err.message || "Failed to load your test history.");
      setTestHistory([]); // Clear history on error
    } finally {
      setIsLoading(false);
    }
  }, [user, authLoading]); // Add authLoading dependency

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login?redirect=/progress');
      return;
    }
    if (user) {
        fetchTestHistory();
    }
  }, [user, authLoading, router, fetchTestHistory]); // Run fetchTestHistory when dependencies change

  if (isLoading || authLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold tracking-tight mb-2">My Progress</h1>
        <p className="text-muted-foreground mb-6">Review your past test attempts and performance.</p>
        <Card>
           <CardHeader className="flex flex-row items-center justify-center p-6">
             <Loader2 className="h-6 w-6 animate-spin text-primary mr-3" />
             <CardTitle>Loading History...</CardTitle>
           </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full mb-2" />
            <Skeleton className="h-10 w-full mb-2" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-destructive mb-2">Error Loading Progress</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={fetchTestHistory}> <RefreshCw className="mr-2 h-4 w-4"/> Try Again</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold tracking-tight mb-2">My Progress</h1>
      <p className="text-muted-foreground mb-6">Review your past test attempts and performance.</p>

      {testHistory.length === 0 && !isLoading ? (
        <Card>
          <CardContent className="p-10 text-center">
            <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">You haven't attempted any tests yet.</p>
            <Button asChild className="mt-4">
              <Link href="/tests">Browse Tests</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Test History</CardTitle>
            <CardDescription>A log of all your completed tests.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Responsive Table Approach */}
            {/* For smaller screens (e.g., mobile): Use Cards */}
            <div className="space-y-4 sm:hidden">
              {testHistory.map((attempt) => (
                <Card key={attempt.attemptTimestamp} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-medium text-sm flex-1 mr-2">{attempt.testName || 'N/A'}</p>
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

            {/* For larger screens: Use Table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test Name</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-center hidden md:table-cell">Percentage</TableHead> {/* Hide Percentage on medium */}
                    <TableHead className="hidden lg:table-cell">Submitted On</TableHead> {/* Hide Submitted On for medium */}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {testHistory.map((attempt) => (
                    <TableRow key={attempt.attemptTimestamp}>{/* Remove whitespace here */}
                      <TableCell className="font-medium">{attempt.testName || 'N/A'}</TableCell>
                      <TableCell className="text-center">{attempt.score ?? 'N/A'} / {attempt.totalMarks ?? attempt.totalQuestions ?? 'N/A'}</TableCell>
                      <TableCell className="text-center hidden md:table-cell">{attempt.percentage?.toFixed(2) ?? 'N/A'}%</TableCell>
                      <TableCell className="hidden lg:table-cell">{attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2"> {/* Ensure buttons stay together */}
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
