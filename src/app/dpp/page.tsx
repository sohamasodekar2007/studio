// src/app/dpp/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { getSubjects, getLessonsForSubject } from '@/actions/question-bank-query-actions';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Search, BookCopy, ChevronRight } from 'lucide-react';

interface SubjectLessons {
  subject: string;
  lessons: string[];
}

export default function DppPage() {
  const [subjectsWithLessons, setSubjectsWithLessons] = useState<SubjectLessons[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedSubjects = await getSubjects();
        const lessonsPromises = fetchedSubjects.map(async (subject) => {
          const lessons = await getLessonsForSubject(subject);
          return { subject, lessons };
        });
        const results = await Promise.all(lessonsPromises);
        setSubjectsWithLessons(results);
      } catch (err) {
        console.error("Failed to load DPP data:", err);
        setError("Could not load practice problems. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllData();
  }, []);

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
        // Keep the subject group if it matches or has matching lessons
        if (subjectGroup.subject.toLowerCase().includes(lowerSearchTerm) || filteredLessons.length > 0) {
            // If the subject matched but no lessons did, show all lessons for that subject.
            // If lessons matched, show only those lessons.
             const lessonsToShow = subjectGroup.subject.toLowerCase().includes(lowerSearchTerm) && filteredLessons.length === 0
                                    ? subjectGroup.lessons
                                    : filteredLessons;
            return { ...subjectGroup, lessons: lessonsToShow };
        }
        return null; // Remove subject group if neither subject nor lessons match
      })
      .filter((group): group is SubjectLessons => group !== null && group.lessons.length > 0); // Filter out nulls and empty groups
  }, [searchTerm, subjectsWithLessons]);

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-center">Daily Practice Problems (DPP)</h1>
      <p className="text-muted-foreground text-center">Select a lesson to start practicing problems.</p>

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
            <CardContent className="p-6 text-center text-destructive">
                {error}
            </CardContent>
        </Card>
      ) : filteredData.length === 0 ? (
         <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
                 No lessons found matching your search term "{searchTerm}".
            </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Available Lessons</CardTitle>
            <CardDescription>Lessons are grouped by subject.</CardDescription>
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
                          {/* Make each lesson a link (points to placeholder for now) */}
                          <Link
                            href={`/dpp/${encodeURIComponent(subject)}/${encodeURIComponent(lesson)}`} // Placeholder link structure
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