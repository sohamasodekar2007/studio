// src/app/pyq-dpps/[examName]/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { getSubjectsAndLessonsForPyqExam, getPyqQuestionsForLesson } from '@/actions/question-bank-query-actions';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Search, BookCopy, ChevronRight, ArrowLeft, AlertTriangle, Lock, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';
import type { QuestionBankItem } from '@/types';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface SubjectLessons {
  subject: string;
  lessons: string[];
  accessibleLessons?: string[]; // Lessons accessible to the current user based on plan
}

export default function PyqDppsExamPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const examName = decodeURIComponent(params.examName as string);

  const [subjectsWithLessons, setSubjectsWithLessons] = useState<SubjectLessons[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const processAndSetLessons = useCallback(async (fetchedSubjectsAndLessons: { subject: string; lessons: string[] }[]) => {
    if (!user && !authLoading) { // If auth is done and no user, treat as free user
      const currentYear = new Date().getFullYear();
      const allowedYearForFreeUsers = currentYear - 1;
      const processed: SubjectLessons[] = [];

      for (const sl of fetchedSubjectsAndLessons) {
        const accessibleLessonsForSubject: string[] = [];
        for (const lesson of sl.lessons) {
          const questions = await getPyqQuestionsForLesson(examName, sl.subject, lesson);
          const hasAllowedYearPyqs = questions.some(q => q.isPyq && q.pyqDetails?.date && new Date(q.pyqDetails.date).getFullYear() === allowedYearForFreeUsers);
          if (hasAllowedYearPyqs) {
            accessibleLessonsForSubject.push(lesson);
          }
        }
        if (accessibleLessonsForSubject.length > 0) {
          processed.push({ ...sl, accessibleLessons: accessibleLessonsForSubject });
        } else {
           // Optionally, still show the subject but indicate no accessible lessons
           processed.push({ ...sl, accessibleLessons: [] });
        }
      }
      setSubjectsWithLessons(processed);
      return;
    }

    if (!user) { // Still loading auth or no user context yet
        setSubjectsWithLessons(fetchedSubjectsAndLessons.map(sl => ({...sl, accessibleLessons: []}))); // Show all initially if user is not determined
        return;
    }
    
    const currentYear = new Date().getFullYear();
    const isPremiumUser = user.model !== 'free';
    const allowedYearForFreeUsers = currentYear - 1;
    const processed: SubjectLessons[] = [];

    for (const sl of fetchedSubjectsAndLessons) {
      if (isPremiumUser) {
        processed.push({ ...sl, accessibleLessons: sl.lessons }); // Premium sees all lessons
      } else {
        const accessibleLessonsForSubject: string[] = [];
        for (const lesson of sl.lessons) {
          const questions = await getPyqQuestionsForLesson(examName, sl.subject, lesson);
          const hasAllowedYearPyqs = questions.some(q => q.isPyq && q.pyqDetails?.date && new Date(q.pyqDetails.date).getFullYear() === allowedYearForFreeUsers);
          if (hasAllowedYearPyqs) {
            accessibleLessonsForSubject.push(lesson);
          }
        }
        // Only add subject if it has accessible lessons for free users, or always show subject but filter lessons in render
         if (accessibleLessonsForSubject.length > 0) {
            processed.push({ ...sl, lessons: sl.lessons, accessibleLessons: accessibleLessonsForSubject });
         } else {
            // Keep original lessons to show them as locked, but mark accessible as empty
            processed.push({ ...sl, lessons: sl.lessons, accessibleLessons: [] });
         }
      }
    }
    setSubjectsWithLessons(processed);

  }, [user, authLoading, examName]);


  useEffect(() => {
    if (!examName) {
      setError("Exam name not specified.");
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const results = await getSubjectsAndLessonsForPyqExam(examName);
        await processAndSetLessons(results);
      } catch (err) {
        console.error(`Failed to load PYQ data for ${examName}:`, err);
        setError(`Could not load PYQ subjects and lessons for ${examName}.`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [examName, processAndSetLessons]);

  const filteredData = useMemo(() => {
    if (!searchTerm) {
      return subjectsWithLessons;
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    return subjectsWithLessons
      .map(subjectGroup => {
        // Filter original lessons for search, then check accessibility
        const searchedLessons = subjectGroup.lessons.filter(lesson =>
          lesson.toLowerCase().includes(lowerSearchTerm)
        );
        if (subjectGroup.subject.toLowerCase().includes(lowerSearchTerm) || searchedLessons.length > 0) {
           const lessonsToDisplay = subjectGroup.subject.toLowerCase().includes(lowerSearchTerm) && searchedLessons.length === 0
                                    ? subjectGroup.lessons // If subject matches, show all its lessons (accessibility check done in map)
                                    : searchedLessons;
            return { ...subjectGroup, lessons: lessonsToDisplay }; // Keep original accessibleLessons for now
        }
        return null;
      })
      .filter((group): group is SubjectLessons => group !== null && group.lessons.length > 0);
  }, [searchTerm, subjectsWithLessons]);

  const currentYear = new Date().getFullYear();
  const isPremiumUser = user?.model !== 'free';

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
       <div className="mb-4">
          <Link href="/pyq-dpps" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Back to Exams List
          </Link>
        </div>
      <h1 className="text-3xl font-bold tracking-tight text-center">PYQ DPPs: {examName}</h1>
      <p className="text-muted-foreground text-center">Select a lesson to practice PYQs for {examName}.</p>

      {!isPremiumUser && !authLoading && (
         <Alert variant="default" className="text-left bg-amber-50 border-amber-300 dark:bg-amber-900/20 dark:border-amber-700">
            <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="text-amber-700 dark:text-amber-300">Free Access Information</AlertTitle>
            <AlertDescription className="text-amber-600 dark:text-amber-400 text-sm">
                As a free user, you have access to PYQs from {currentYear - 1}. 
                Lessons containing PYQs from other years will be marked with a <Lock className="inline h-3 w-3 mx-0.5"/> icon. 
                Upgrade to premium to unlock all PYQs!
                <Button variant="link" size="sm" className="p-0 h-auto ml-1 text-amber-700 dark:text-amber-300 underline" asChild>
                     <Link href="/#pricing">Upgrade Plan</Link>
                </Button>
            </AlertDescription>
        </Alert>
      )}


      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search subjects or lessons..."
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
      ) : filteredData.length === 0 ? (
         <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
                 {searchTerm
                    ? `No subjects or lessons found matching "${searchTerm}" for ${examName} PYQs.`
                    : `No PYQs found for ${examName} in the question bank yet.`}
            </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Available Lessons for {examName} PYQs</CardTitle>
            <CardDescription>Lessons containing Previous Year Questions for {examName}.</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {filteredData.map(({ subject, lessons, accessibleLessons }) => (
                <AccordionItem key={subject} value={subject}>
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                    {subject} ({lessons.length})
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2 pt-2">
                      {lessons.map((lesson) => {
                        const isLessonAccessible = accessibleLessons?.includes(lesson) || isPremiumUser;
                        return (
                        <li key={lesson}>
                          {isLessonAccessible ? (
                             <Link
                                href={`/pyq-dpps/${encodeURIComponent(examName)}/${encodeURIComponent(subject)}/${encodeURIComponent(lesson)}`}
                                className="flex items-center justify-between p-3 rounded-md hover:bg-muted transition-colors group"
                             >
                              <div className="flex items-center gap-2">
                                 <BookCopy className="h-4 w-4 text-primary group-hover:text-primary-dark" />
                                 <span className="text-sm group-hover:text-primary-dark">{lesson}</span>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary-dark transition-transform group-hover:translate-x-1" />
                            </Link>
                          ) : (
                            <div className="flex items-center justify-between p-3 rounded-md bg-muted/50 cursor-not-allowed opacity-70">
                                <div className="flex items-center gap-2">
                                    <Lock className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">{lesson}</span>
                                </div>
                                <span className="text-xs text-amber-600 dark:text-amber-400">Premium</span>
                            </div>
                          )}
                        </li>
                      )})}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
