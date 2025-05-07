// src/app/dpp/[...slug]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getQuestionsForLesson } from '@/actions/question-bank-query-actions';
import type { QuestionBankItem } from '@/types';
import { AlertTriangle, BookOpen, Construction } from 'lucide-react';

export default function DppLessonPage() {
  const params = useParams();
  const router = useRouter();
  const { slug } = params;

  const [subject, setSubject] = useState<string | null>(null);
  const [lesson, setLesson] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Array.isArray(slug) && slug.length === 2) {
      const decodedSubject = decodeURIComponent(slug[0]);
      const decodedLesson = decodeURIComponent(slug[1]);
      setSubject(decodedSubject);
      setLesson(decodedLesson);

      const fetchQuestions = async () => {
        setIsLoading(true);
        setError(null);
        try {
          // Fetch questions without class/exam filters for DPP
          const fetchedQuestions = await getQuestionsForLesson({
            subject: decodedSubject,
            lesson: decodedLesson,
          });
          setQuestions(fetchedQuestions);
        } catch (err) {
          console.error(`Failed to load questions for ${decodedSubject}/${decodedLesson}:`, err);
          setError('Could not load practice questions for this lesson.');
        } finally {
          setIsLoading(false);
        }
      };
      fetchQuestions();
    } else {
      setError('Invalid lesson URL.');
      setIsLoading(false);
      // Optionally redirect or show error
    }
  }, [slug]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
        <Skeleton className="h-8 w-1/2 mb-2" />
        <Skeleton className="h-6 w-3/4 mb-6" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full mb-2" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
        <h1 className="text-2xl font-bold text-destructive">Error</h1>
        <p className="text-muted-foreground">{error}</p>
        <Button asChild variant="outline">
          <Link href="/dpp">Back to DPP List</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
      <div className="mb-4">
        <Link href="/dpp" className="text-sm text-muted-foreground hover:text-primary">
          &larr; Back to DPP List
        </Link>
      </div>
      <h1 className="text-3xl font-bold tracking-tight">DPP: {lesson}</h1>
      <p className="text-muted-foreground">Subject: {subject}</p>

      <Card>
        <CardHeader>
          <CardTitle>Practice Interface (Coming Soon)</CardTitle>
          <CardDescription>
            A dedicated interface to practice these {questions.length} questions is under development.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center p-10">
            <Construction className="h-16 w-16 text-primary mx-auto mb-4" />
             <p className="text-muted-foreground">
                The practice interface for DPPs will allow you to attempt questions, view solutions, and track your progress for this lesson.
            </p>
             {/* You could list the question count or basic info here */}
             <p className="mt-4 text-sm">Number of questions in this lesson: <strong>{questions.length}</strong></p>
              {/* Placeholder button */}
              <Button className="mt-6" disabled>Start Practice (Coming Soon)</Button>
        </CardContent>
      </Card>

       {/* Optional: List questions briefly (remove if too long) */}
        {/* <Card>
            <CardHeader><CardTitle>Questions in this Lesson</CardTitle></CardHeader>
            <CardContent>
                {questions.length > 0 ? (
                    <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                       {questions.slice(0, 10).map(q => ( // Show first 10 as example
                            <li key={q.id} className="truncate">
                                {q.question.text ? q.question.text.substring(0, 80) + '...' : `[Image Question: ${q.id}]`}
                            </li>
                       ))}
                        {questions.length > 10 && <li>...and {questions.length - 10} more</li>}
                    </ul>
                ) : (
                    <p>No questions found for this lesson.</p>
                )}
            </CardContent>
        </Card> */}
    </div>
  );
}