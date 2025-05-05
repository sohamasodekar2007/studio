// src/app/tests/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, ArrowRight, Tag, BookOpen, CalendarDays, CheckSquare, Loader2 } from "lucide-react";
// Remove Image import as it's no longer used in the cards
// import Image from 'next/image';
import { Badge } from "@/components/ui/badge";
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { Test, Exam, TestModel, PricingType, UserModel } from '@/types'; // Import UserModel
import { exams, testModels, pricingTypes } from '@/types'; // Import options
import { getTests } from '@/actions/get-tests';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context'; // Import useAuth to get user model

// Define default filter options
const defaultExams: Exam[] = ["MHT-CET", "JEE Main", "JEE Advanced", "NEET"];
const defaultModels: TestModel[] = ["chapterwise", "full_length", "topicwise", "combo"];
const defaultPricings: PricingType[] = ["free", "paid"];

export default function TestsPage() {
  const { user, loading: authLoading } = useAuth(); // Get user and auth loading state
  const [allTestItems, setAllTestItems] = useState<Test[]>([]);
  const [isLoadingTests, setIsLoadingTests] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExams, setSelectedExams] = useState<Exam[]>([]);
  // Filter by Test Model (Chapterwise / Full Syllabus / etc.)
  const [selectedTestModelFilter, setSelectedTestModelFilter] = useState<TestModel | 'all'>('all');

  // Fetch tests on component mount
  useEffect(() => {
    setIsLoadingTests(true);
    setError(null);
    getTests()
      .then(data => {
        setAllTestItems(data);
      })
      .catch(err => {
        console.error("Failed to fetch tests:", err);
        setError("Failed to load tests. Please try again later.");
      })
      .finally(() => {
        setIsLoadingTests(false);
      });
  }, []);

  // Filter logic based on search, exam filters, and user model permissions
  const filteredTestItems = useMemo(() => {
    if (authLoading || isLoadingTests) return []; // Don't filter until everything is loaded

    // Filter by search term and selected exams first
    let initiallyFiltered = allTestItems
        .filter(item => item.published) // Only show published tests
        .filter(item => {
            const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                item.subject.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesExam = selectedExams.length === 0 || selectedExams.includes(item.exam as Exam);
            // Filter by selected Test Model dropdown
            const matchesTestModel = selectedTestModelFilter === 'all' || item.model === selectedTestModelFilter;

            return matchesSearch && matchesExam && matchesTestModel;
     });

    // Now, apply filtering based on the user's model
    if (user) {
       const userModel = user.model;
       return initiallyFiltered.filter(item => {
         // Everyone sees free tests
         if (item.pricing === 'free') return true;

         // Paid tests filtering based on user model
         switch (userModel) {
           case 'chapterwise':
             // Chapterwise premium users see paid chapterwise tests
             return item.model === 'chapterwise' && item.pricing === 'paid';
           case 'full_length':
             // Full_length premium users see paid full_length tests
             return item.model === 'full_length' && item.pricing === 'paid';
           case 'combo':
             // Combo users see all paid tests
             return item.pricing === 'paid';
           case 'free':
           default:
             // Free users don't see any paid tests
             return false;
         }
       });
    } else {
      // If not logged in, only show free tests
      return initiallyFiltered.filter(item => item.pricing === 'free');
    }

  }, [searchTerm, selectedExams, selectedTestModelFilter, allTestItems, user, authLoading, isLoadingTests]);


   const handleExamChange = (exam: Exam) => {
    setSelectedExams(prev =>
      prev.includes(exam) ? prev.filter(e => e !== exam) : [...prev, exam]
    );
  };

  const renderSkeletons = (count: number) => {
     return Array.from({ length: count }).map((_, index) => (
         <Card key={`skeleton-${index}`} className="overflow-hidden flex flex-col group bg-card">
             {/* No Skeleton for image */}
             <CardContent className="p-4 flex flex-col flex-grow space-y-2">
                 <div className="flex flex-wrap gap-1">
                     <Skeleton className="h-5 w-16" />
                     <Skeleton className="h-5 w-20" />
                     <Skeleton className="h-5 w-12" />
                 </div>
                 <Skeleton className="h-6 w-3/4 mt-1" />
                 <Skeleton className="h-4 w-1/2 mt-1" />
                 <div className="pt-2 mt-auto">
                    <Skeleton className="h-9 w-full mt-auto" />
                 </div>
             </CardContent>
         </Card>
     ));
  }

  const totalLoading = authLoading || isLoadingTests;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Test Series</h1>
          <p className="text-muted-foreground">Browse tests for MHT-CET, JEE & NEET.</p>
           {user && (
             <p className="text-sm text-primary mt-1">Your current plan: <span className="font-semibold capitalize">{user.model}</span></p>
           )}
        </div>
         <div className="flex flex-wrap gap-2 w-full sm:w-auto">
           <div className="relative flex-grow sm:flex-grow-0 w-full sm:w-48">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input
               placeholder="Search tests..."
               className="pl-10 w-full"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
           </div>
            {/* Test Model Filter Dropdown */}
            <div className="w-full sm:w-auto">
             <Select onValueChange={(value) => setSelectedTestModelFilter(value as TestModel | 'all')} value={selectedTestModelFilter}>
               <SelectTrigger className="w-full sm:w-[180px]">
                 <SelectValue placeholder="Filter by Type" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">All Test Types</SelectItem>
                 {testModels.map((model) => (
                   <SelectItem key={model} value={model} className="capitalize">
                     {model.replace('_', ' ')}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
           {/* Exam Filter Popover */}
           <Popover>
             <PopoverTrigger asChild>
               <Button variant="outline">
                 <Filter className="mr-2 h-4 w-4" />
                 Exams ({selectedExams.length > 0 ? selectedExams.length : 'All'})
               </Button>
             </PopoverTrigger>
             <PopoverContent className="w-60" align="end">
               <div className="grid gap-4">
                 <div className="space-y-2">
                   <h4 className="font-medium leading-none">Filter by Exam</h4>
                   <p className="text-sm text-muted-foreground">
                     Select the exams to display.
                   </p>
                 </div>
                 <div className="grid gap-2">
                    {defaultExams.map((exam) => (
                         <div key={exam} className="flex items-center space-x-2">
                            <Checkbox
                                id={`exam-${exam}`}
                                checked={selectedExams.includes(exam)}
                                onCheckedChange={() => handleExamChange(exam)}
                            />
                            <label
                                htmlFor={`exam-${exam}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                {exam}
                            </label>
                        </div>
                       ))}
                 </div>
                 <Button variant="ghost" size="sm" onClick={() => { setSelectedExams([]); }}>Clear Exam Filter</Button>
               </div>
             </PopoverContent>
           </Popover>
         </div>
      </div>

       {/* Error Display */}
       {error && (
         <Card className="md:col-span-2 lg:col-span-3 xl:col-span-4 border-destructive bg-destructive/10">
            <CardContent className="p-6 text-center text-destructive">
                {error}
            </CardContent>
        </Card>
       )}

      {/* Test Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
         {totalLoading ? (
             renderSkeletons(8) // Show skeletons while loading tests or auth state
         ) : filteredTestItems.length > 0 ? (
             filteredTestItems.map((item) => (
                <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow duration-200 flex flex-col group bg-card">
                 {/* Removed CardHeader with Image */}
                <CardContent className="p-4 flex flex-col flex-grow space-y-2">
                     {/* Badges moved inside CardContent */}
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-wrap gap-1">
                            <Badge variant="outline" className="text-xs"><CalendarDays className="h-3 w-3 mr-1"/>{item.exam}</Badge>
                            <Badge variant="secondary" className="text-xs capitalize"><CheckSquare className="h-3 w-3 mr-1"/>{item.model.replace('_', ' ')}</Badge>
                        </div>
                         <div className="flex gap-1 flex-shrink-0">
                           {item.status && (
                                <Badge variant={item.status === 'Popular' ? 'destructive' : 'secondary'} className="text-xs">
                                {item.status}
                                </Badge>
                            )}
                            <Badge variant={item.pricing === 'free' ? 'default' : 'outline'} className={`text-xs ${item.pricing === 'free' ? 'bg-green-600 text-white border-green-600' : ''}`}>
                                <Tag className="h-3 w-3 mr-1"/> {item.pricing === 'free' ? 'Free' : 'Paid'}
                            </Badge>
                        </div>
                    </div>

                    <CardTitle className="text-lg mb-1 leading-tight group-hover:text-primary transition-colors">{item.title}</CardTitle>
                     <Badge variant="secondary" className="text-xs w-fit"><BookOpen className="h-3 w-3 mr-1"/>{item.subject}</Badge>
                    <CardDescription className="text-sm text-muted-foreground line-clamp-2 pt-1">
                    {item.questionsCount} Questions | {item.durationMinutes} Mins | {item.type}
                    </CardDescription>

                    <div className="pt-2 mt-auto">
                        <Link href={`/tests/${item.id}`} passHref className="mt-auto block">
                            <Button variant="secondary" className="w-full">
                                View Details
                                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </Link>
                    </div>
                </CardContent>
                </Card>
            ))
            ) : !error ? ( // Only show "No tests found" if there wasn't an error
            <Card className="md:col-span-2 lg:col-span-3 xl:col-span-4">
                <CardContent className="p-6 text-center text-muted-foreground">
                    No tests found matching your criteria and plan. Try adjusting the filters.
                </CardContent>
            </Card>
         ) : null /* Don't show anything if there was an error and no tests */ }
      </div>
    </div>
  );
}
