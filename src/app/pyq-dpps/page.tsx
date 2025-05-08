// src/app/pyq-dpps/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Search, Target, ChevronRight, AlertTriangle } from 'lucide-react';
import { getAvailablePyqExams } from '@/actions/question-bank-query-actions'; // Action to get unique PYQ exams
import { Input } from '@/components/ui/input';

export default function PyqDppsIndexPage() {
  const [availableExams, setAvailableExams] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const exams = await getAvailablePyqExams();
        setAvailableExams(exams.sort()); // Sort exams alphabetically
      } catch (err) {
        console.error("Failed to load PYQ exams:", err);
        setError("Could not load available PYQ exams. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredExams = availableExams.filter(exam =>
    exam.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-center">PYQ Daily Practice Problems</h1>
      <p className="text-muted-foreground text-center">Select an exam to practice with questions from previous years.</p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search exams..."
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
                <li key={exam}>
                  <Link
                    href={`/pyq-dpps/${encodeURIComponent(exam)}`}
                    className="flex items-center justify-between p-3 rounded-md hover:bg-muted transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary group-hover:text-primary-dark" />
                      <span className="text-sm font-medium group-hover:text-primary-dark">{exam}</span>
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
