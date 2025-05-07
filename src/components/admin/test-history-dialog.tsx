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

interface TestHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  test: GeneratedTest;
  fetchTestAttempts: (testCode: string) => Promise<Array<Partial<TestResultSummary> & { attemptId: string; user?: UserProfile }>>;
}

export default function TestHistoryDialog({ isOpen, onClose, test, fetchTestAttempts }: TestHistoryDialogProps) {
  const [attempts, setAttempts] = useState<Array<Partial<TestResultSummary> & { attemptId: string; user?: UserProfile }>>([]);
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Attempt History: {test?.name}</DialogTitle>
          <DialogDescription>
            Showing all recorded attempts for test code: {test?.test_code}.
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Percentage</TableHead>
                  <TableHead>Submitted On</TableHead>
                  <TableHead className="text-right">Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((attempt) => (
                  <TableRow key={attempt.attemptId}>
                    <TableCell>{attempt.user?.name || 'N/A'}</TableCell>
                    <TableCell>{attempt.user?.email || 'N/A'}</TableCell>
                    <TableCell className="text-center">{attempt.score ?? 'N/A'} / {attempt.totalQuestions ?? 'N/A'}</TableCell>
                    <TableCell className="text-center">{attempt.percentage?.toFixed(2) ?? 'N/A'}%</TableCell>
                    <TableCell>{new Date(attempt.submittedAt!).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/chapterwise-test-review/${attempt.testCode}?userId=${attempt.userId}&attemptId=${attempt.attemptId}`} target="_blank">
                          <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="p-4 text-center text-muted-foreground">No attempts found for this test.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
