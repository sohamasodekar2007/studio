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
import { AlertTriangle, History, Eye, Loader2 } from 'lucide-react'; // Added Loader2
import type { TestSession, TestResultSummary, GeneratedTest, UserProfile } from '@/types';
import { getGeneratedTestByCode } from '@/actions/generated-test-actions'; // Action to get test definition

// Helper to calculate results (reuse from results page)
function calculateBasicSummary(session: TestSession, testDef: GeneratedTest | null): Partial<TestResultSummary> & { totalMarks: number } {
    if (!testDef || !session.answers) {
      return { testName: testDef?.name || 'Unknown Test', submittedAt: new Date(session.endTime || session.startTime).toISOString(), totalQuestions: 0, score: 0, percentage: 0, totalMarks: 0 };
    }

    const allQuestions = (testDef.testType === 'chapterwise' && testDef.questions)
                         ? testDef.questions
                         : (testDef.testType === 'full_length')
                           ? [...(testDef.physics ?? []), ...(testDef.chemistry ?? []), ...(testDef.maths ?? []), ...(testDef.biology ?? [])]
                           : [];

    if (allQuestions.length === 0 || allQuestions.length !== session.answers.length) {
         console.warn("Mismatch calculating summary for history:", session.testId);
         return { testName: testDef.name, submittedAt: new Date(session.endTime || session.startTime).toISOString(), totalQuestions: allQuestions.length, score: undefined, percentage: undefined, totalMarks: 0 };
     }


    let correct = 0;
    let score = 0;
    let totalMarksPossible = 0;

    session.answers.forEach((ans, index) => {
        const qDef = allQuestions[index];
        if (qDef) {
             const currentMarks = qDef.marks || 1;
             totalMarksPossible += currentMarks;
             const correctAnswerKey = qDef.answer?.replace('Option ', '').trim();
             if (ans.selectedOption === correctAnswerKey) {
                 correct++;
                 score += currentMarks;
             }
        }
    });

    const percentage = totalMarksPossible > 0 ? (score / totalMarksPossible) * 100 : 0;

    return {
        testName: testDef.name,
        submittedAt: new Date(session.endTime || session.startTime).toISOString(),
        totalQuestions: allQuestions.length,
        correct: correct,
        score: score,
        percentage: percentage,
        totalMarks: totalMarksPossible, // Include total possible marks
    };
}


export default function ProgressPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [testHistory, setTestHistory] = useState<Array<Partial<TestResultSummary> & { attemptId: string; testCode: string; totalMarks?: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // useCallback to memoize the fetch function
  const fetchTestHistory = useCallback(async () => {
    if (!user || !user.id || typeof window === 'undefined') {
        if (!authLoading) setIsLoading(false); // Stop loading if auth is done and no user
        return;
    };

    setIsLoading(true);
    setError(null);
    console.log("Fetching test history for user:", user.id);

    try {
      const history: Array<Partial<TestResultSummary> & { attemptId: string; testCode: string; totalMarks?: number }> = [];
      const keysToFetchDefs: string[] = [];
      const sessions: { [key: string]: TestSession } = {};

      // 1. Iterate localStorage to find relevant session keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        // Key format: testResult-testCode-userId-timestamp
        if (key && key.startsWith(`testResult-`) && key.includes(`-${user.id}-`)) {
           const sessionJson = localStorage.getItem(key);
           if (sessionJson) {
                try {
                    const sessionData: TestSession = JSON.parse(sessionJson);
                     const attemptId = key.replace('testResult-', '');
                     sessions[attemptId] = sessionData;
                     if (!keysToFetchDefs.includes(sessionData.testId)) {
                        keysToFetchDefs.push(sessionData.testId);
                     }
                } catch (e) {
                    console.warn(`Failed to parse session data for key ${key}:`, e);
                }
           }
        }
      }
      console.log(`Found ${Object.keys(sessions).length} session(s) in localStorage.`);

       // 2. Fetch Test Definitions concurrently
       const testDefsMap = new Map<string, GeneratedTest | null>();
       if (keysToFetchDefs.length > 0) {
           console.log("Fetching definitions for test codes:", keysToFetchDefs);
           const definitionPromises = keysToFetchDefs.map(code =>
                getGeneratedTestByCode(code).catch(err => {
                    console.error(`Failed to fetch definition for ${code}:`, err);
                    return null; // Return null on error for specific test
                })
           );
           const definitions = await Promise.all(definitionPromises);
           keysToFetchDefs.forEach((code, index) => {
                testDefsMap.set(code, definitions[index]);
           });
       }


      // 3. Calculate summary for each session using fetched definitions
      for (const attemptId in sessions) {
          const sessionData = sessions[attemptId];
          const testDef = testDefsMap.get(sessionData.testId) || null; // Get definition or null
          const summary = calculateBasicSummary(sessionData, testDef);
          history.push({
            ...summary,
            attemptId: attemptId,
            testCode: sessionData.testId,
            userId: sessionData.userId,
          });
      }

      // Sort history by submission date, newest first
      history.sort((a, b) => {
          const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
          const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
          return dateB - dateA;
      });

      setTestHistory(history);
      console.log("Processed test history:", history);

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
            <CardDescription>A log of all your completed tests stored locally.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test Name</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">Percentage</TableHead>
                  <TableHead className="hidden md:table-cell">Submitted On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testHistory.map((attempt) => (
                  <TableRow key={attempt.attemptId}>
                    <TableCell className="font-medium">{attempt.testName || 'N/A'}</TableCell>
                     <TableCell className="text-center">{attempt.score ?? 'N/A'} / {attempt.totalMarks ?? attempt.totalQuestions ?? 'N/A'}</TableCell> {/* Show total marks if available */}
                    <TableCell className="text-center hidden sm:table-cell">{attempt.percentage?.toFixed(2) ?? 'N/A'}%</TableCell>
                    <TableCell className="hidden md:table-cell">{attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : 'N/A'}</TableCell>
                    <TableCell className="text-right space-x-2">
                       {/* Link to Results Page */}
                       <Button variant="secondary" size="sm" asChild>
                            <Link href={`/chapterwise-test-results/${attempt.testCode}?userId=${user?.id}&attemptId=${attempt.attemptId}`}>
                                View Result
                            </Link>
                       </Button>
                       {/* Link to Review Page */}
                      <Button variant="outline" size="sm" asChild>
                        {/* Ensure the link points to the correct review page structure */}
                        <Link href={`/chapterwise-test-review/${attempt.testCode}?userId=${user?.id}&attemptId=${attempt.attemptId}`}>
                          <Eye className="mr-1.5 h-4 w-4" /> Review
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

