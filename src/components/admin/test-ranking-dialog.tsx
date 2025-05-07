// src/components/admin/test-ranking-dialog.tsx
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import type { GeneratedTest, TestResultSummary, UserProfile } from '@/types';
import { Award } from 'lucide-react';

interface TestRankingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  test: GeneratedTest;
  fetchTestAttempts: (testCode: string) => Promise<Array<Partial<TestResultSummary> & { attemptId: string; user?: UserProfile }>>;
}

export default function TestRankingDialog({ isOpen, onClose, test, fetchTestAttempts }: TestRankingDialogProps) {
  const [rankedAttempts, setRankedAttempts] = useState<Array<Partial<TestResultSummary> & { attemptId: string; user?: UserProfile; rank?: number }>>([]);
  const [isLoadingAttempts, setIsLoadingAttempts] = useState(false);

  useEffect(() => {
    if (isOpen && test) {
      setIsLoadingAttempts(true);
      fetchTestAttempts(test.test_code)
        .then(data => {
          // Sort by score descending, then by time taken ascending (if available)
          const sorted = data.sort((a, b) => {
            const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
            if (scoreDiff !== 0) return scoreDiff;
            return (a.timeTakenMinutes ?? Infinity) - (b.timeTakenMinutes ?? Infinity);
          });
          // Assign ranks
          const ranked = sorted.map((attempt, index) => ({ ...attempt, rank: index + 1 }));
          setRankedAttempts(ranked);
        })
        .catch(err => console.error("Failed to fetch attempts for ranking:", err))
        .finally(() => setIsLoadingAttempts(false));
    }
  }, [isOpen, test, fetchTestAttempts]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Ranking: {test?.name}</DialogTitle>
          <DialogDescription>
            Users ranked by score for test code: {test?.test_code}.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoadingAttempts ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : rankedAttempts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Rank</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Percentage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankedAttempts.map((attempt) => (
                  <TableRow key={attempt.attemptId}>
                    <TableCell className="font-medium text-center">
                      {attempt.rank === 1 && <Award className="h-4 w-4 inline text-yellow-500 mr-1" />}
                      {attempt.rank === 2 && <Award className="h-4 w-4 inline text-gray-400 mr-1" />}
                      {attempt.rank === 3 && <Award className="h-4 w-4 inline text-orange-400 mr-1" />}
                      {attempt.rank}
                    </TableCell>
                    <TableCell>{attempt.user?.name || 'N/A'} ({attempt.user?.email || 'N/A'})</TableCell>
                    <TableCell className="text-center">{attempt.score ?? 'N/A'} / {attempt.totalQuestions ?? 'N/A'}</TableCell>
                    <TableCell className="text-center">{attempt.percentage?.toFixed(2) ?? 'N/A'}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="p-4 text-center text-muted-foreground">No attempts found to rank for this test.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
