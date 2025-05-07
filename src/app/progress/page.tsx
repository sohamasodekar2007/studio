
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, History, Eye } from 'lucide-react';
import type { TestSession, TestResultSummary, GeneratedTest } from '@/types'; // Assuming TestResultSummary might be used or adapted
import { getGeneratedTestByCode } from '@/actions/generated-test-actions'; // Import the missing function

// Helper function to calculate basic summary from session data if full result summary isn't stored
// This is a simplified version. Ideally, the full TestResultSummary should be stored and retrieved.
function calculateBasicSummary(session: TestSession, testDef: GeneratedTest | null): Partial<TestResultSummary> {
    if (!testDef || !testDef.questions) {
      return { testName: 'Unknown Test', submittedAt: new Date(session.startTime).toISOString(), totalQuestions: 0, score: 0, percentage: 0 };
    }
    let correct = 0;
    let attempted = 0;
    session.answers.forEach((ans, index) => {
        if (ans.selectedOption) attempted++;
        const qDef = testDef.questions?.[index];
        if (qDef && ans.selectedOption === qDef.answer.replace('Option ', '').trim()) {
            correct++;
        }
    });
    const totalQuestions = testDef.questions.length;
    const score = correct * (testDef.questions[0]?.marks || 1); // Assuming uniform marks
    const percentage = totalQuestions > 0 ? (score / (totalQuestions * (testDef.questions[0]?.marks || 1))) * 100 : 0;

    return {
        testName: testDef.name,
        submittedAt: new Date(session.endTime || session.startTime).toISOString(),
        totalQuestions,
        correct,
        attempted,
        score,
        percentage,
    };
}


export default function ProgressPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [testHistory, setTestHistory] = useState<Array<Partial<TestResultSummary> & { attemptId: string; testCode: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/auth/login?redirect=/progress');
      return;
    }

    async function fetchTestHistory() {
      setIsLoading(true);
      setError(null);
      try {
        const history: Array<Partial<TestResultSummary> & { attemptId: string; testCode: string }> = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(`testResult-`) && key.includes(`-${user.id}-`)) {
            const sessionJson = localStorage.getItem(key);
            if (sessionJson) {
              const sessionData: TestSession = JSON.parse(sessionJson);
              // Extract testCode and attemptId from the key or sessionData
              const parts = key.replace('testResult-', '').split('-');
              const testCode = parts[0];
              const attemptId = key.replace('testResult-', ''); // Full key as attemptId

              // Fetch test definition to get name and total questions
              const testDef = await getGeneratedTestByCode(sessionData.testId);
              const summary = calculateBasicSummary(sessionData, testDef);
              
              history.push({
                ...summary,
                attemptId: attemptId,
                testCode: sessionData.testId, // Ensure testCode is correctly set
                userId: sessionData.userId, // Keep userId if needed for links
              });
            }
          }
        }
        // Sort history by submission date, newest first
        history.sort((a, b) => new Date(b.submittedAt!).getTime() - new Date(a.submittedAt!).getTime());
        setTestHistory(history);
      } catch (err: any) {
        console.error("Error fetching test history:", err);
        setError(err.message || "Failed to load your test history.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchTestHistory();
  }, [user, authLoading, router]);

  if (isLoading || authLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold tracking-tight mb-2">My Progress</h1>
        <p className="text-muted-foreground mb-6">Review your past test attempts and performance.</p>
        <Card>
          <CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader>
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
        <Button onClick={() => window.location.reload()}>Try Again</Button>
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
                    <TableCell className="text-center">{attempt.score ?? 'N/A'}/{attempt.totalQuestions ? attempt.totalQuestions * 1 : 'N/A'}</TableCell>
                    <TableCell className="text-center hidden sm:table-cell">{attempt.percentage?.toFixed(2) ?? 'N/A'}%</TableCell>
                    <TableCell className="hidden md:table-cell">{new Date(attempt.submittedAt!).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
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

