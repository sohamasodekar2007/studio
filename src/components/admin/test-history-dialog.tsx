// src/components/admin/test-history-dialog.tsx
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import type { GeneratedTest, TestResultSummary, UserProfile } from '@/types';
import { Eye, Loader2 } from 'lucide-react';

// Define the expected signature for the fetch function
type FetchAttemptsFunction = (testCode: string) => Promise<Array<TestResultSummary & { user?: Omit<UserProfile, 'password'> | null }>>;

interface TestHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  test: GeneratedTest;
  // Update the type hint for the fetch function
  fetchTestAttempts: FetchAttemptsFunction;
}

export default function TestHistoryDialog({ isOpen, onClose, test, fetchTestAttempts }: TestHistoryDialogProps) {
  // Update state type to match the expected return type of the fetch function
  const [attempts, setAttempts] = useState<Array<TestResultSummary & { user?: Omit<UserProfile, 'password'> | null }>>([]);
  const [isLoadingAttempts, setIsLoadingAttempts] = useState(false);

  useEffect(() => {
    if (isOpen && test) {
      setIsLoadingAttempts(true);
      fetchTestAttempts(test.test_code)
        .then(data => setAttempts(data))
        .catch(err => console.error("Failed to fetch attempts:", err))
        .finally(() => setIsLoadingAttempts(false));
    }
  }, [isOpen, test, fetchTestAttempts]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl"> {/* Wider dialog */}
        <DialogHeader>
          <DialogTitle>Attempt History: {test?.name}</DialogTitle>
          <DialogDescription>
            Showing all recorded attempts for test code: {test?.test_code}. Results are based on locally stored data.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoadingAttempts ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : attempts.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User Name</TableHead><TableHead>Email</TableHead><TableHead className="text-center">Score</TableHead><TableHead className="text-center">Percentage</TableHead><TableHead>Submitted On</TableHead><TableHead className="text-right">Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.map((attempt) => (
                    // Use attemptTimestamp for the key as it's guaranteed unique per attempt
                    <TableRow key={attempt.attemptTimestamp}>
                      <TableCell>{attempt.user?.name || 'N/A'}</TableCell><TableCell>{attempt.user?.email || 'N/A'}</TableCell>{/* Display Email */}
                      {/* Display total marks if available */}
                      <TableCell className="text-center">{attempt.score ?? 'N/A'} / {attempt.totalMarks ?? attempt.totalQuestions ?? 'N/A'}</TableCell><TableCell className="text-center">{attempt.percentage?.toFixed(2) ?? 'N/A'}%</TableCell><TableCell>{new Date(attempt.submittedAt!).toLocaleString()}</TableCell><TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          {/* Pass attemptTimestamp to review link */}
                          <Link href={`/chapterwise-test-review/${attempt.testCode}?userId=${attempt.userId}&attemptTimestamp=${attempt.attemptTimestamp}`} target="_blank">
                            <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="p-4 text-center text-muted-foreground">No attempts found for this test.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

    