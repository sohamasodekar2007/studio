'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Link from 'next/link'; // Import Link

// Placeholder test data type (matching the structure in tests/page.tsx)
interface TestData {
  id: string;
  title: string;
  type: string;
  exam: string;
  subject: string;
  model: string; // chapterwise, full_length, combo, topicwise
  pricing: string; // free, paid
  status: string; // New, Popular, ''
  questions: number;
  duration: number;
  // Add other relevant fields like 'published', 'createdAt' if available
}

// Mock data fetching function - replace with actual Firestore query
async function fetchTests(): Promise<TestData[]> {
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate loading
  // In a real app, fetch from Firestore or your database
  return [
    { id: "mht-cet-phy-1", title: "MHT-CET Physics Mock Test 1", type: "Mock Test", exam: "MHT-CET", subject: "Physics", imageHint: "physics formula atoms", status: "New", model: "full_length", pricing: "paid", questions: 50, duration: 90 },
    { id: "jee-main-full-3", title: "JEE Main Full Syllabus Test 3", type: "Full Syllabus Test", exam: "JEE Main", subject: "PCM", imageHint: "jee exam students writing", status: "Popular", model: "full_length", pricing: "paid", questions: 90, duration: 180 },
    { id: "neet-bio-ch-cell", title: "NEET Biology: Cell Structure", type: "Chapter Test", exam: "NEET", subject: "Biology", imageHint: "biology cell microscope dna", status: "", model: "chapterwise", pricing: "free", questions: 45, duration: 45 },
    { id: "jee-adv-math-calc", title: "JEE Advanced Maths: Calculus", type: "Topic Test", exam: "JEE Advanced", subject: "Maths", imageHint: "mathematics calculus graph", status: "New", model: "topicwise", pricing: "paid", questions: 30, duration: 120 },
    { id: "mht-cet-chem-org", title: "MHT-CET Chemistry: Organic Basics", type: "Chapter Test", exam: "MHT-CET", subject: "Chemistry", imageHint: "chemistry beakers science lab", status: "", model: "chapterwise", pricing: "free", questions: 50, duration: 60 },
    { id: "neet-phy-mock-2", title: "NEET Physics Mock Test 2", type: "Mock Test", exam: "NEET", subject: "Physics", imageHint: "physics concepts motion energy", status: "Popular", model: "full_length", pricing: "paid", questions: 180, duration: 180 },
    { id: "jee-main-combo-1", title: "JEE Main Physics & Chem Combo", type: "Combo Test", exam: "JEE Main", subject: "Physics, Chemistry", imageHint: "physics chemistry combo equations", status: "", model: "combo", pricing: "paid", questions: 60, duration: 120 },
    { id: "mht-cet-full-free", title: "MHT-CET Full Syllabus Free Mock", type: "Mock Test", exam: "MHT-CET", subject: "PCM", imageHint: "free exam access student", status: "Popular", model: "full_length", pricing: "free", questions: 150, duration: 180 },
  ];
}

export default function AdminTestsPage() {
  const [tests, setTests] = useState<TestData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchTests().then(data => {
      setTests(data);
      setIsLoading(false);
    });
  }, []);

  const filteredTests = tests.filter(test =>
    test.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    test.exam.toLowerCase().includes(searchTerm.toLowerCase()) ||
    test.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    test.model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <div>
            <h1 className="text-3xl font-bold tracking-tight">Manage Tests</h1>
            <p className="text-muted-foreground">Add, edit, or remove tests.</p>
         </div>
         <Button disabled> {/* TODO: Implement Add Test functionality */}
           <PlusCircle className="mr-2 h-4 w-4" /> Add New Test
         </Button>
      </div>


      <Card>
        <CardHeader>
            <div className="flex items-center gap-2">
             <Search className="h-4 w-4 text-muted-foreground" />
             <Input
               placeholder="Search by title, exam, subject, model..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="max-w-sm"
             />
           </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Exam</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Pricing</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Duration (min)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                     <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : filteredTests.length > 0 ? (
                filteredTests.map((test) => (
                  <TableRow key={test.id}>
                    <TableCell className="font-medium">{test.title}</TableCell>
                    <TableCell>{test.exam}</TableCell>
                    <TableCell className="capitalize">{test.model.replace('_', ' ')}</TableCell>
                    <TableCell>
                       <Badge variant={test.pricing === 'free' ? 'default' : 'outline'}
                         className={`capitalize ${test.pricing === 'free' ? 'bg-green-100 text-green-800' : ''}`}>
                        {test.pricing}
                      </Badge>
                    </TableCell>
                    <TableCell>{test.questions}</TableCell>
                    <TableCell>{test.duration}</TableCell>
                    <TableCell>
                      {test.status ? (
                        <Badge variant={test.status === 'Popular' ? 'destructive' : 'secondary'}>
                          {test.status}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                           <DropdownMenuItem asChild>
                               <Link href={`/tests/${test.id}`} target="_blank">View Test</Link>
                           </DropdownMenuItem>
                          <DropdownMenuItem disabled>Edit Test</DropdownMenuItem>
                          <DropdownMenuItem disabled>Manage Questions</DropdownMenuItem>
                          <DropdownMenuItem disabled>View Results</DropdownMenuItem>
                          <DropdownMenuItem disabled className="text-destructive">Delete Test</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    No tests found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter>
          {/* Optional: Add pagination controls */}
           <div className="text-xs text-muted-foreground">
            Showing <strong>{filteredTests.length}</strong> of <strong>{tests.length}</strong> tests
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
