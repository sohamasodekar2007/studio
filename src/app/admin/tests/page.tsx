
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoreHorizontal, PlusCircle, Search, Edit, Trash2, Eye, ToggleLeft, ToggleRight, Filter } from "lucide-react"; // Added Icons
import { Skeleton } from "@/components/ui/skeleton";
import Link from 'next/link';
import type { Test, TestModel, PricingType } from '@/types'; // Updated types
import { testModels } from '@/types'; // Import test model options
import { getTests, updateTestInJson, deleteTestFromJson } from '@/actions/test-actions'; // Import actions
import { useToast } from '@/hooks/use-toast';

export default function AdminTestsPage() {
  const { toast } = useToast();
  const [tests, setTests] = useState<Test[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModelFilter, setSelectedModelFilter] = useState<TestModel | 'all'>('all');

  const fetchAllTests = () => {
    setIsLoading(true);
    getTests()
      .then(data => {
        setTests(data);
      })
      .catch(error => {
         console.error("Failed to fetch tests:", error);
         toast({ variant: "destructive", title: "Error", description: "Could not load tests." });
         setTests([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchAllTests();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter tests based on search term and selected model
  const filteredTests = useMemo(() => {
    return tests.filter(test =>
      (test.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      test.exam.toLowerCase().includes(searchTerm.toLowerCase()) ||
      test.subject.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (selectedModelFilter === 'all' || test.model === selectedModelFilter)
    );
  }, [tests, searchTerm, selectedModelFilter]);

  // Function to handle status toggle (Active/Inactive)
  const handleToggleStatus = async (testId: string, currentStatus: boolean) => {
     // Optimistic update
     const originalTests = [...tests];
     setTests(prevTests =>
         prevTests.map(test =>
             test.id === testId ? { ...test, published: !currentStatus } : test
         )
     );

     try {
         const result = await updateTestInJson(testId, { published: !currentStatus });
         if (!result.success) {
             // Revert optimistic update on failure
             setTests(originalTests);
             toast({ variant: "destructive", title: "Update Failed", description: result.message });
         } else {
              toast({ title: "Status Updated", description: `Test status changed to ${!currentStatus ? 'Active' : 'Inactive'}.` });
              // No need to re-fetch, optimistic update succeeded
         }
     } catch (error) {
         console.error("Failed to toggle test status:", error);
         // Revert optimistic update on error
         setTests(originalTests);
         toast({ variant: "destructive", title: "Error", description: "Could not update test status." });
     }
  };

  // Function to handle test deletion
  const handleDeleteTest = async (testId: string) => {
     // Optional: Add confirmation dialog here

     const originalTests = [...tests];
      // Optimistic update
     setTests(prevTests => prevTests.filter(test => test.id !== testId));

     try {
        const result = await deleteTestFromJson(testId);
        if (!result.success) {
            // Revert optimistic update
            setTests(originalTests);
            toast({ variant: "destructive", title: "Delete Failed", description: result.message });
        } else {
            toast({ title: "Test Deleted", description: "The test has been removed." });
            // Optimistic update succeeded
        }
     } catch (error) {
         console.error("Failed to delete test:", error);
          // Revert optimistic update
         setTests(originalTests);
         toast({ variant: "destructive", title: "Error", description: "Could not delete test." });
     }
  };

  const formatTestModel = (model: TestModel) => {
    switch (model) {
      case 'chapterwise': return 'Chapterwise';
      case 'full_length': return 'Full Length';
      case 'topicwise': return 'Topicwise';
      case 'combo': return 'Combo';
      case 'DPP': return 'DPP';
      default: return model;
    }
  };

   const formatPricing = (pricing: PricingType) => {
     switch (pricing) {
       case 'free': return 'Free';
       case 'paid': return 'Paid';
       case 'FREE_PREMIUM': return 'Free Premium'; // Display name for the new type
       default: return pricing;
     }
   };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <div>
            <h1 className="text-3xl font-bold tracking-tight">Manage Tests</h1>
            <p className="text-muted-foreground">View, edit, or remove tests (Chapterwise, Full Length, DPPs).</p>
         </div>
         {/* Updated Link to point to the new creation page */}
         <Link href="/admin/tests/create" passHref>
           <Button>
             <PlusCircle className="mr-2 h-4 w-4" /> Add New Test
           </Button>
         </Link>
      </div>


      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 md:grow-0">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input
               placeholder="Search by title, exam, subject..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="pl-10 w-full md:w-80"
             />
           </div>
           {/* Filter Dropdown */}
           <div className="flex items-center gap-2">
             <Filter className="h-4 w-4 text-muted-foreground" />
             <Select onValueChange={(value) => setSelectedModelFilter(value as TestModel | 'all')} value={selectedModelFilter}>
               <SelectTrigger className="w-full md:w-[180px]">
                 <SelectValue placeholder="Filter by Type" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">All Test Types</SelectItem>
                 {testModels.map((model) => (
                   <SelectItem key={model} value={model}>
                     {formatTestModel(model)}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Exam</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Pricing</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={`skeleton-${index}`}>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                     <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredTests.length > 0 ? (
                filteredTests.map((test) => (
                  <TableRow key={test.id}>
                    <TableCell className="font-medium">{test.title}</TableCell>
                    <TableCell>{test.exam}</TableCell>
                    <TableCell>{formatTestModel(test.model)}</TableCell>
                    <TableCell>
                       <Badge variant={test.pricing === 'free' ? 'default' : (test.pricing === 'paid' ? 'destructive' : 'secondary')} // Adjust variant logic
                         className={`capitalize ${
                           test.pricing === 'free' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' :
                           test.pricing === 'paid' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' :
                           'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' // Style for FREE_PREMIUM
                         }`}>
                        {formatPricing(test.pricing)}
                      </Badge>
                    </TableCell>
                    <TableCell>{test.questionsCount}</TableCell>
                    <TableCell>{test.durationMinutes} min</TableCell>
                    <TableCell>
                      <Badge variant={test.published ? 'secondary' : 'outline'}
                       className={test.published ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'} >
                        {test.published ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
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
                               {/* Link to view test detail page (if it exists) */}
                               <Link href={`/tests/${test.id}`} target="_blank">
                                <Eye className="mr-2 h-4 w-4" /> View Test
                               </Link>
                           </DropdownMenuItem>
                           {/* TODO: Link Edit button to an editing form/modal */}
                          <DropdownMenuItem disabled>
                             <Edit className="mr-2 h-4 w-4" /> Edit Test
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStatus(test.id, test.published)}>
                             {test.published ? <ToggleLeft className="mr-2 h-4 w-4" /> : <ToggleRight className="mr-2 h-4 w-4" />}
                             Set {test.published ? 'Inactive' : 'Active'}
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled>
                             Manage Questions
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => handleDeleteTest(test.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Test
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    No tests found matching your criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter>
           <div className="text-xs text-muted-foreground">
            Showing <strong>{filteredTests.length}</strong> of <strong>{tests.length}</strong> total tests.
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
```