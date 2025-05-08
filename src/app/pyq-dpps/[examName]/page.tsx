// src/app/pyq-dpps/[examName]/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { getSubjectsAndLessonsForPyqExam } from '@/actions/question-bank-query-actions'; // Action to get filtered subjects/lessons
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Search, BookCopy, ChevronRight, ArrowLeft, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SubjectLessons {
  subject: string;
  lessons: string[];
}

export default function PyqDppsExamPage() {
  const params = useParams();
  const router = useRouter();
  const examName = decodeURIComponent(params.examName as string);

  const [subjectsWithLessons, setSubjectsWithLessons] = useState<SubjectLessons[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

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
        setSubjectsWithLessons(results);
      } catch (err) {
        console.error(`Failed to load PYQ data for ${examName}:`, err);
        setError(`Could not load PYQ subjects and lessons for ${examName}.`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [examName]);

  const filteredData = useMemo(() => {
    if (!searchTerm) {
      return subjectsWithLessons;
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    return subjectsWithLessons
      .map(subjectGroup => {
        const filteredLessons = subjectGroup.lessons.filter(lesson =>
          lesson.toLowerCase().includes(lowerSearchTerm) ||
          subjectGroup.subject.toLowerCase().includes(lowerSearchTerm)
        );
        if (subjectGroup.subject.toLowerCase().includes(lowerSearchTerm) || filteredLessons.length > 0) {
           const lessonsToShow = subjectGroup.subject.toLowerCase().includes(lowerSearchTerm) && filteredLessons.length === 0
                                    ? subjectGroup.lessons
                                    : filteredLessons;
            return { ...subjectGroup, lessons: lessonsToShow };
        }
        return null;
      })
      .filter((group): group is SubjectLessons => group !== null && group.lessons.length > 0);
  }, [searchTerm, subjectsWithLessons]);

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
       <div className="mb-4">
          <Link href="/pyq-dpps" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Back to Exams List
          </Link>
        </div>
      <h1 className="text-3xl font-bold tracking-tight text-center">PYQ DPPs: {examName}</h1>
      <p className="text-muted-foreground text-center">Select a lesson to practice PYQs for {examName}.</p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search subjects or lessons..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
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
              {filteredData.map(({ subject, lessons }) => (
                <AccordionItem key={subject} value={subject}>
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                    {subject} ({lessons.length})
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2 pt-2">
                      {lessons.map((lesson) => (
                        <li key={lesson}>
                          <Link
                             // Construct the link for the specific PYQ DPP practice page
                             href={`/pyq-dpps/${encodeURIComponent(examName)}/${encodeURIComponent(subject)}/${encodeURIComponent(lesson)}`}
                             className="flex items-center justify-between p-3 rounded-md hover:bg-muted transition-colors group"
                           >
                            <div className="flex items-center gap-2">
                               <BookCopy className="h-4 w-4 text-primary group-hover:text-primary-dark" />
                               <span className="text-sm group-hover:text-primary-dark">{lesson}</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary-dark transition-transform group-hover:translate-x-1" />
                          </Link>
                        </li>
                      ))}
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
