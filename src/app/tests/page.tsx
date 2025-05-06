
// src/app/tests/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, ArrowRight, Tag, BookOpen, CalendarDays, CheckSquare, Loader2, Clock, HelpCircle } from "lucide-react"; // Added Clock, HelpCircle
import { Badge } from "@/components/ui/badge";
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { GeneratedTest, Exam, PricingType, UserModel } from '@/types'; // Use new GeneratedTest type
import { exams, pricingTypes } from '@/types'; // Import options
import { getAllGeneratedTests } from '@/actions/generated-test-actions'; // Import action to get new tests
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context'; // Import useAuth to get user model

// Define default filter options
const defaultExams: Exam[] = ["MHT-CET", "JEE Main", "JEE Advanced", "NEET"];
// const defaultModels: TestModel[] = ["chapterwise", "full_length", "topicwise", "combo"]; // Obsolete filter
const defaultPricings: PricingType[] = ["FREE", "PAID", "FREE_PREMIUM"]; // Updated pricing types

export default function TestsPage() {
  const { user, loading: authLoading } = useAuth(); // Get user and auth loading state
  const [allTestItems, setAllTestItems] = useState<GeneratedTest[]>([]); // State holds GeneratedTest[] now
  const [isLoadingTests, setIsLoadingTests] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]); // Filter by subject string array
  const [selectedPricingFilter, setSelectedPricingFilter] = useState<PricingType | 'all'>('all'); // Filter by PricingType

  // Fetch generated tests on component mount
  useEffect(() => {
    setIsLoadingTests(true);
    setError(null);
    getAllGeneratedTests() // Use the new action
      .then(data => {
        setAllTestItems(data);
      })
      .catch(err => {
        console.error("Failed to fetch generated tests:", err);
        setError("Failed to load tests. Please try again later.");
      })
      .finally(() => {
        setIsLoadingTests(false);
      });
  }, []);

   // Extract unique subjects from loaded tests for filtering
   const availableSubjects = useMemo(() => {
       const subjects = new Set<string>();
       allTestItems.forEach(test => {
           test.test_subject.forEach(sub => subjects.add(sub));
       });
       return Array.from(subjects).sort();
   }, [allTestItems]);


  // Filter logic based on search, subject filters, pricing, and user model permissions
  const filteredTestItems = useMemo(() => {
    if (authLoading || isLoadingTests) return []; // Don't filter until everything is loaded

    // Filter by search term, selected subjects, and pricing first
    let initiallyFiltered = allTestItems
        // Filter by search term (check name and subjects)
        .filter(item => {
            const searchLower = searchTerm.toLowerCase();
            const nameMatch = item.name.toLowerCase().includes(searchLower);
            const subjectMatch = item.test_subject.some(sub => sub.toLowerCase().includes(searchLower));
            return nameMatch || subjectMatch;
        })
        // Filter by selected subjects (if any selected)
        .filter(item => {
            return selectedSubjects.length === 0 || item.test_subject.some(sub => selectedSubjects.includes(sub));
        })
        // Filter by selected Pricing Type dropdown
        .filter(item => {
            return selectedPricingFilter === 'all' || item.type === selectedPricingFilter;
        });

    // Now, apply filtering based on the user's access permissions
    if (user) {
       const userModel = user.model;
       return initiallyFiltered.filter(item => {
         // Everyone sees FREE tests
         if (item.type === 'FREE') return true;
         // FREE_PREMIUM tests are visible to all premium users
         if (item.type === 'FREE_PREMIUM') return userModel !== 'free';
         // PAID tests require specific premium plans
         if (item.type === 'PAID') {
            // Determine if the test is chapterwise or full_length based on subjects/structure (heuristic)
            // This logic might need refinement based on how tests are truly categorized.
            // Simple assumption: if only one subject, it *might* be chapterwise.
            const isPotentiallyChapterwise = item.test_subject.length === 1 && (!item.maths && !item.biology); // Example heuristic
            const isPotentiallyFullLength = item.test_subject.length > 1 || item.maths || item.biology; // Example heuristic

            switch (userModel) {
              case 'chapterwise':
                // Chapterwise premium users see PAID chapterwise tests (based on heuristic)
                 return isPotentiallyChapterwise;
              case 'full_length':
                // Full_length premium users see PAID full_length tests (based on heuristic)
                return isPotentiallyFullLength;
              case 'combo':
                // Combo users see all PAID tests
                return true;
              case 'free':
              default:
                // Free users don't see any PAID tests
                return false;
            }
         }
         return false; // Should not happen if type is handled
       });
    } else {
      // If not logged in, only show FREE tests
      return initiallyFiltered.filter(item => item.type === 'FREE');
    }

  }, [searchTerm, selectedSubjects, selectedPricingFilter, allTestItems, user, authLoading, isLoadingTests]);


   const handleSubjectFilterChange = (subject: string) => {
    setSelectedSubjects(prev =>
      prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]
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
                 </div>
                 <Skeleton className="h-6 w-3/4 mt-1" />
                 <Skeleton className="h-4 w-1/2 mt-1" />
                 <div className="flex justify-between mt-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                 </div>
                 <div className="pt-2 mt-auto">
                    <Skeleton className="h-9 w-full mt-auto" />
                 </div>
             </CardContent>
         </Card>
     ));
  }

   const formatPricing = (pricing: PricingType) => {
     switch (pricing) {
       case 'FREE': return 'Free';
       case 'PAID': return 'Paid';
       case 'FREE_PREMIUM': return 'Free Premium';
       default: return pricing;
     }
   };

  const totalLoading = authLoading || isLoadingTests;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Test Series</h1>
          <p className="text-muted-foreground">Browse generated tests for MHT-CET, JEE & NEET.</p>
           {user && (
             <p className="text-sm text-primary mt-1">Your current plan: <span className="font-semibold capitalize">{user.model?.replace('_', ' ')}</span></p>
           )}
           {!user && !authLoading && (
              <p className="text-sm text-muted-foreground mt-1">Log in to see tests based on your plan.</p>
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
            {/* Pricing Filter Dropdown */}
            <div className="w-full sm:w-auto">
             <Select onValueChange={(value) => setSelectedPricingFilter(value as PricingType | 'all')} value={selectedPricingFilter}>
               <SelectTrigger className="w-full sm:w-[180px]">
                 <SelectValue placeholder="Filter by Type" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">All Types</SelectItem>
                 {defaultPricings.map((pt) => (
                   <SelectItem key={pt} value={pt} className="capitalize">
                     {formatPricing(pt)}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
           {/* Subject Filter Popover */}
           <Popover>
             <PopoverTrigger asChild>
               <Button variant="outline">
                 <Filter className="mr-2 h-4 w-4" />
                 Subjects ({selectedSubjects.length > 0 ? selectedSubjects.length : 'All'})
               </Button>
             </PopoverTrigger>
             <PopoverContent className="w-60" align="end">
               <div className="grid gap-4">
                 <div className="space-y-2">
                   <h4 className="font-medium leading-none">Filter by Subject</h4>
                   <p className="text-sm text-muted-foreground">
                     Select the subjects to display.
                   </p>
                 </div>
                 <div className="grid gap-2 max-h-48 overflow-y-auto">
                    {availableSubjects.map((sub) => (
                         <div key={sub} className="flex items-center space-x-2">
                            <Checkbox
                                id={`subject-${sub.replace(/\s+/g, '-')}`} // Create unique ID
                                checked={selectedSubjects.includes(sub)}
                                onCheckedChange={() => handleSubjectFilterChange(sub)}
                            />
                            <label
                                htmlFor={`subject-${sub.replace(/\s+/g, '-')}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                {sub}
                            </label>
                        </div>
                       ))}
                 </div>
                 <Button variant="ghost" size="sm" onClick={() => setSelectedSubjects([])}>Clear Subject Filter</Button>
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
                <Card key={item.test_code} className="overflow-hidden hover:shadow-lg transition-shadow duration-200 flex flex-col group bg-card">
                <CardContent className="p-4 flex flex-col flex-grow space-y-2">
                    <div className="flex justify-between items-start mb-2">
                         {/* Test Subjects Badges */}
                        <div className="flex flex-wrap gap-1 flex-grow mr-2">
                            {item.test_subject.map(sub => (
                                <Badge key={sub} variant="secondary" className="text-xs capitalize">
                                    <BookOpen className="h-3 w-3 mr-1" />{sub}
                                </Badge>
                            ))}
                        </div>
                        {/* Pricing Badge */}
                        <Badge variant={item.type === 'FREE' ? 'default' : (item.type === 'PAID' ? 'destructive' : 'secondary')} className={`text-xs flex-shrink-0 ${item.type === 'FREE' ? 'bg-green-600 text-white border-green-600' : item.type === 'PAID' ? 'bg-red-600 text-white border-red-600' : 'bg-blue-600 text-white border-blue-600'}`}>
                            <Tag className="h-3 w-3 mr-1"/> {formatPricing(item.type)}
                        </Badge>
                    </div>

                    <CardTitle className="text-lg mb-1 leading-tight group-hover:text-primary transition-colors">{item.name}</CardTitle>
                    {/* <CardDescription className="text-sm text-muted-foreground line-clamp-2 pt-1">
                       {item.total_questions} Questions | {item.duration} Mins
                    </CardDescription> */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground pt-1">
                         <div className="flex items-center gap-1.5">
                            <HelpCircle className="h-4 w-4 text-primary" />
                            <span>{item.total_questions} Questions</span>
                         </div>
                         <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-primary" />
                            <span>{item.duration} min</span>
                         </div>
                           <div className="flex items-center gap-1.5 col-span-2">
                            <CheckSquare className="h-4 w-4 text-primary" />
                            <span>{item.count} selected ({item.test_subject.join(', ')})</span>
                           </div>
                    </div>


                    <div className="pt-2 mt-auto">
                        {/* Link to a future test taking page, using test_code */}
                        <Link href={`/take-test/${item.test_code}`} passHref className="mt-auto block">
                            <Button variant="secondary" className="w-full" disabled={item.type === 'PAID' && (!user || user.model === 'free')}> {/* Disable paid for free users */}
                                {item.type === 'PAID' && (!user || user.model === 'free') ? 'Upgrade to Access' : 'Start Test'}
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
                    No tests found matching your criteria and plan. Try adjusting the filters or check the admin panel to create tests.
                </CardContent>
            </Card>
         ) : null /* Don't show anything if there was an error and no tests */ }
      </div>
    </div>
  );
}

