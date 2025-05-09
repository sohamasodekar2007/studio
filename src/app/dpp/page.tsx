// src/app/dpp/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { getSubjects, getLessonsForSubject } from '@/actions/question-bank-query-actions';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Search, BookCopy, ChevronRight, AlertTriangle, Atom, FlaskConical, Sigma, Leaf, PackageOpen } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface SubjectLessons {
  subject: string;
  lessons: string[];
}

const subjectIcons: Record<string, React.ElementType> = {
  Physics: Atom,
  Chemistry: FlaskConical,
  Mathematics: Sigma,
  Biology: Leaf,
};

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
        setSubjectsWithLessons(results.filter(group => group.lessons.length > 0)); // Filter out subjects with no lessons
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
          lesson.toLowerCase().includes(lowerSearchTerm)
        );
        // Keep the subject group if it matches or has matching lessons
        if (subjectGroup.subject.toLowerCase().includes(lowerSearchTerm) || filteredLessons.length > 0) {
            const lessonsToShow = subjectGroup.subject.toLowerCase().includes(lowerSearchTerm) && filteredLessons.length === 0
                                    ? subjectGroup.lessons // Show all lessons if subject matches but no specific lesson did
                                    : filteredLessons; // Otherwise, show only the lessons that matched
            return { ...subjectGroup, lessons: lessonsToShow };
        }
        return null;
      })
      .filter((group): group is SubjectLessons => group !== null && group.lessons.length > 0);
  }, [searchTerm, subjectsWithLessons]);

  const renderSubjectIcon = (subjectName: string) => {
    const IconComponent = subjectIcons[subjectName] || BookCopy;
    return <IconComponent className="h-5 w-5 mr-2 text-primary" />;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl space-y-8">
      <header className="text-center">
        <BookCopy className="h-16 w-16 text-primary mx-auto mb-3" />
        <h1 className="text-4xl font-extrabold tracking-tight">Daily Practice Problems</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Sharpen your skills by solving chapter-wise problems.
        </p>
      </header>

      <Card className="shadow-md">
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search by subject or lesson name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 py-3 text-base rounded-lg"
              aria-label="Search DPP lessons"
            />
          </div>
        </CardHeader>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : error ? (
         <Alert variant="destructive" className="shadow-md">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle>Error Loading DPPs</AlertTitle>
            <AlertDescription>
              {error}
              <Button variant="link" onClick={() => window.location.reload()} className="p-0 h-auto ml-1">
                Try refreshing the page.
              </Button>
            </AlertDescription>
         </Alert>
      ) : filteredData.length === 0 ? (
        <Card className="text-center shadow-md">
            <CardContent className="p-8 space-y-3">
                <PackageOpen className="h-16 w-16 text-muted-foreground mx-auto" />
                <h3 className="text-xl font-semibold">No Lessons Found</h3>
                <p className="text-muted-foreground">
                 {searchTerm ? `No lessons match "${searchTerm}". Try a different search.` : "No DPP lessons are available at the moment. Check back soon!"}
                </p>
            </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="w-full space-y-3">
          {filteredData.map(({ subject, lessons }) => (
            <AccordionItem key={subject} value={subject} className="border border-border rounded-lg bg-card shadow-sm hover:shadow-md transition-shadow">
              <AccordionTrigger className="text-lg font-semibold px-6 py-4 hover:no-underline hover:bg-muted/50 rounded-t-lg transition-colors">
                <div className="flex items-center">
                  {renderSubjectIcon(subject)}
                  {subject} ({lessons.length})
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-2 sm:px-4 pb-4">
                {lessons.length > 0 ? (
                  <ul className="space-y-1.5">
                    {lessons.map((lesson) => (
                      <li key={lesson}>
                        <Link
                          href={`/dpp/${encodeURIComponent(subject)}/${encodeURIComponent(lesson)}`}
                          className="flex items-center justify-between p-3 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors group text-sm"
                        >
                          <span className="truncate">{lesson}</span>
                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-accent-foreground transition-transform group-hover:translate-x-1" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground px-4 py-2">No lessons found for this subject with the current filter.</p>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
