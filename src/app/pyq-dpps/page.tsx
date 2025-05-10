// src/app/pyq-dpps/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Search, Target, ChevronRight, AlertTriangle, Lock, Sparkles } from 'lucide-react';
import { getAvailablePyqExams, getPyqQuestionsForLesson } from '@/actions/question-bank-query-actions';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface ExamWithAccessibility {
  name: string;
  isAccessible: boolean;
}

export default function PyqDppsIndexPage() {
  const { user, loading: authLoading } = useAuth();
  const [allAvailableExams, setAllAvailableExams] = useState<string[]>([]);
  const [processedExams, setProcessedExams] = useState<ExamWithAccessibility[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchAndProcessExams = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const exams = await getAvailablePyqExams();
      setAllAvailableExams(exams.sort());

      if (authLoading) return; // Wait for auth state to resolve

      const currentYear = new Date().getFullYear();
      const isPremiumUser = user?.model !== 'free';
      const allowedYearForFreeUsers = currentYear - 1;
      
      const examAccessibilityPromises = exams.map(async (examName) => {
        if (isPremiumUser || !user) { // Premium or guest (who will be prompted to log in/upgrade)
          return { name: examName, isAccessible: true };
        }
        // For free users, check if there are PYQs from the allowed year
        // This is a simplified check; ideally, backend would tell us if an exam has *any* accessible PYQs.
        // For now, we assume an exam is accessible if it *could* have PYQs for the allowed year.
        // A more robust check might involve checking actual question data, but can be slow.
        // Let's assume for now that if an exam is listed, it *might* have accessible PYQs.
        // The true filtering will happen on the next page (lessons for that exam).
        // So, for free users, all exams are initially "accessible" to click, but content might be locked.
        return { name: examName, isAccessible: true }; 
      });

      const processed = await Promise.all(examAccessibilityPromises);
      setProcessedExams(processed);

    } catch (err) {
      console.error("Failed to load PYQ exams:", err);
      setError("Could not load available PYQ exams. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, user]);

  useEffect(() => {
    fetchAndProcessExams();
  }, [fetchAndProcessExams]);


  const filteredExams = useMemo(() => {
    return processedExams.filter(exam =>
      exam.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [processedExams, searchTerm]);

  const currentYear = new Date().getFullYear();
  const isPremiumUser = user?.model !== 'free';

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-center">PYQ Daily Practice Problems</h1>
      <p className="text-muted-foreground text-center">Select an exam to practice with questions from previous years.</p>

      {!isPremiumUser && !authLoading && (
         <Alert variant="default" className="text-left bg-amber-50 border-amber-300 dark:bg-amber-900/20 dark:border-amber-700">
            <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="text-amber-700 dark:text-amber-300">Free Access Information</AlertTitle>
            <AlertDescription className="text-amber-600 dark:text-amber-400 text-sm">
                As a free user, you have access to PYQs from {currentYear - 1}. 
                Exams or lessons containing PYQs from other years might appear locked.
                <Button variant="link" size="sm" className="p-0 h-auto ml-1 text-amber-700 dark:text-amber-300 underline" asChild>
                     <Link href="/#pricing">Upgrade to Premium</Link>
                </Button>
            </AlertDescription>
        </Alert>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search exams..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading || authLoading ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-8 w-1/3 mb-4" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive bg-destructive/10">
           <CardContent className="p-6 text-center text-destructive flex items-center justify-center gap-2">
              <AlertTriangle className="h-5 w-5"/>
               {error}
           </CardContent>
       </Card>
      ) : filteredExams.length === 0 ? (
        <Card>
           <CardContent className="p-6 text-center text-muted-foreground">
                {searchTerm ? `No exams found matching "${searchTerm}".` : "No PYQs found in the question bank yet."}
           </CardContent>
       </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Available Exams for PYQ Practice</CardTitle>
            <CardDescription>Select an exam to view available subjects and lessons.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 pt-2">
              {filteredExams.map((exam) => (
                <li key={exam.name}>
                  <Link
                    href={`/pyq-dpps/${encodeURIComponent(exam.name)}`}
                    className="flex items-center justify-between p-3 rounded-md hover:bg-muted transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary group-hover:text-primary-dark" />
                      <span className="text-sm font-medium group-hover:text-primary-dark">{exam.name}</span>
                    </div>
                     <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary-dark transition-transform group-hover:translate-x-1" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
