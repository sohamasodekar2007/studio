
// src/app/admin/tests/manage/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react'; // Added useCallback
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Search, Edit, Trash2, Eye, BookOpen, FileJson, Clock, HelpCircle } from "lucide-react"; // Added icons
import { Skeleton } from "@/components/ui/skeleton";
import Link from 'next/link';
import type { GeneratedTest, PricingType } from '@/types'; // Use new GeneratedTest type
import { getAllGeneratedTests, deleteGeneratedTest } from '@/actions/generated-test-actions'; // Import actions for generated tests
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"


export default function ManageTestsPage() {
  const { toast } = useToast();
  const [tests, setTests] = useState<GeneratedTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false); // State for delete confirmation

  const fetchAllGeneratedTests = useCallback(() => {
    setIsLoading(true);
    getAllGeneratedTests()
      .then(data => {
        setTests(data);
      })
      .catch(error => {
         console.error("Failed to fetch generated tests:", error);
         toast({ variant: "destructive", title: "Error", description: "Could not load generated tests." });
         setTests([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [toast]); // Add toast as dependency

  useEffect(() => {
    fetchAllGeneratedTests();
  }, [fetchAllGeneratedTests]); // Depend on the memoized fetch function

  // Filter tests based on search term (name, code, subjects)
  const filteredTests = useMemo(() => {
    return tests.filter(test =>
      (test.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      test.test_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      test.test_subject.join(', ').toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [tests, searchTerm]);


  // Function to handle test deletion
  const handleDeleteTest = async (testCode: string) => {
     setIsDeleting(true);
     const originalTests = [...tests];
      // Optimistic update
     setTests(prevTests => prevTests.filter(test => test.test_code !== testCode));

     try {
        const result = await deleteGeneratedTest(testCode);
        if (!result.success) {
            // Revert optimistic update
            setTests(originalTests);
            toast({ variant: "destructive", title: "Delete Failed", description: result.message });
        } else {
            toast({ title: "Test Deleted", description: `Test ${testCode} has been removed.` });
            // Optimistic update succeeded, no explicit refetch needed unless state is complex
        }
     } catch (error) {
         console.error("Failed to delete test:", error);
          // Revert optimistic update
         setTests(originalTests);
         toast({ variant: "destructive", title: "Error", description: "Could not delete test." });
     } finally {
         setIsDeleting(false);
     }
  };

   const formatPricing = (pricing: PricingType) => {
     switch (pricing) {
       case 'FREE': return 'Free';
       case 'PAID': return 'Paid';
       case 'FREE_PREMIUM': return 'Free Premium';
       default: return pricing;
     }
   };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <div>
            <h1 className="text-3xl font-bold tracking-tight">Manage Generated Tests</h1>
            <p className="text-muted-foreground">View, edit details, or delete generated test configurations.</p>
         </div>
         <Link href="/admin/tests/create" passHref>
           <Button>
             <PlusCircle className="mr-2 h-4 w-4" /> Create New Test
           </Button>
         </Link>
      </div>


      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 md:grow-0">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input
               placeholder="Search by name, code, subject..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="pl-10 w-full md:w-80"
             />
           </div>
           {/* Add Filters here if needed (e.g., by subject, type) */}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Test Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Subjects</TableHead>
                <TableHead>Type</TableHead>
                <TableHead><HelpCircle className="h-4 w-4 inline-block mr-1"/>#</TableHead>
                <TableHead><Clock className="h-4 w-4 inline-block mr-1"/>Mins</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={`skeleton-${index}`}>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredTests.length > 0 ? (
                filteredTests.map((test) => (
                  <TableRow key={test.test_code}>
                    <TableCell className="font-mono text-xs">{test.test_code}</TableCell>
                    <TableCell className="font-medium">{test.name}</TableCell>
                    <TableCell>
                        <div className="flex flex-wrap gap-1">
                            {test.test_subject.map(sub => (
                                <Badge key={sub} variant="secondary" className="text-xs capitalize">{sub}</Badge>
                            ))}
                        </div>
                    </TableCell>
                    <TableCell>
                       <Badge variant={test.type === 'FREE' ? 'default' : (test.type === 'PAID' ? 'destructive' : 'secondary')}
                         className={`capitalize text-xs ${
                           test.type === 'FREE' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' :
                           test.type === 'PAID' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' :
                           'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' // Style for FREE_PREMIUM
                         }`}>
                        {formatPricing(test.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>{test.total_questions}</TableCell>
                    <TableCell>{test.duration}</TableCell>
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
                           <DropdownMenuItem disabled> {/* TODO: Implement View/Edit JSON */}
                               <FileJson className="mr-2 h-4 w-4" /> View/Edit JSON
                           </DropdownMenuItem>
                           <DropdownMenuItem disabled> {/* TODO: Implement Edit Test Metadata */}
                             <Edit className="mr-2 h-4 w-4" /> Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {/* Delete Confirmation */}
                          <AlertDialog>
                             <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="w-full justify-start px-2 py-1.5 text-sm text-destructive focus:text-destructive focus:bg-destructive/10 hover:bg-destructive/10 hover:text-destructive relative flex cursor-default select-none items-center rounded-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                  disabled={isDeleting}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete Test
                                </Button>
                             </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the test file
                                    for <span className="font-semibold">{test.name}</span> (<span className="font-mono text-xs">{test.test_code}</span>).
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteTest(test.test_code)} className="bg-destructive hover:bg-destructive/90">
                                      Yes, delete test
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                           </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    No generated tests found. <Link href="/admin/tests/create" className="text-primary underline">Create one now</Link>.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter>
           <div className="text-xs text-muted-foreground">
            Showing <strong>{filteredTests.length}</strong> of <strong>{tests.length}</strong> total generated tests.
          </div>
           {/* TODO: Add Pagination */}
        </CardFooter>
      </Card>
    </div>
  );
}

