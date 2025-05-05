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
import Link from 'next/link';
import type { Test } from '@/types'; // Use the actual Test type
import { getTests } from '@/actions/get-tests'; // Import the server action

// Remove mock data fetching function
// async function fetchTests(): Promise<TestData[]> { ... }

export default function AdminTestsPage() {
  const [tests, setTests] = useState<Test[]>([]); // Use Test type
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setIsLoading(true);
    // Fetch tests using the server action
    getTests()
      .then(data => {
        setTests(data);
      })
      .catch(error => {
         console.error("Failed to fetch tests:", error);
         // Handle error appropriately, maybe show a toast
         setTests([]); // Set to empty array on error
      })
      .finally(() => {
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
                    <TableCell>{test.questionsCount}</TableCell> {/* Updated field name */}
                    <TableCell>{test.durationMinutes}</TableCell> {/* Updated field name */}
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
