// src/app/tests/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, ArrowRight, Tag, BookOpen, CalendarDays, CheckSquare, Loader2, Clock, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label"; // Corrected import
import { Checkbox } from "@/components/ui/checkbox";
import type { GeneratedTest, ExamOption, PricingType, UserModel } from '@/types';
import { exams, pricingTypes } from '@/types';
import { getAllGeneratedTests } from '@/actions/generated-test-actions';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context';
import StartTestButton from '@/components/test-interface/start-test-button';

const defaultPricings: PricingType[] = ["FREE", "PAID", "FREE_PREMIUM"];

export default function TestsPage() {
  const { user, loading: authLoading } = useAuth();
  const [allTestItems, setAllTestItems] = useState<GeneratedTest[]>([]);
  const [isLoadingTests, setIsLoadingTests] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedPricingFilter, setSelectedPricingFilter] = useState<PricingType | 'all'>('all');

  useEffect(() => {
    setIsLoadingTests(true);
    setError(null);
    getAllGeneratedTests()
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

   const availableSubjects = useMemo(() => {
       const subjects = new Set<string>();
       allTestItems.forEach(test => {
           test.test_subject.forEach(sub => subjects.add(sub));
       });
       return Array.from(subjects).sort();
   }, [allTestItems]);

  const filteredTestItems = useMemo(() => {
    if (authLoading || isLoadingTests) return [];

    const userModel = user?.model || 'free';

    return allTestItems
      .filter(item => { // Initial search and subject filtering
        const searchLower = searchTerm.toLowerCase();
        const nameMatch = item.name.toLowerCase().includes(searchLower);
        const subjectMatchArray = Array.isArray(item.test_subject) ? item.test_subject : [item.test_subject];
        const subjectMatch = subjectMatchArray.some(sub => sub.toLowerCase().includes(searchLower));
        const codeMatch = item.test_code.toLowerCase().includes(searchLower);
        const searchPass = nameMatch || subjectMatch || codeMatch;

        const subjectFilterPass = selectedSubjects.length === 0 || subjectMatchArray.some(sub => selectedSubjects.includes(sub));
        
        const pricingFilterPass = selectedPricingFilter === 'all' || item.type === selectedPricingFilter;

        return searchPass && subjectFilterPass && pricingFilterPass;
      })
      .filter(item => { // Plan-based filtering logic
        switch (userModel) {
          case 'free':
            return item.type === 'FREE' || item.type === 'FREE_PREMIUM';
          case 'chapterwise':
            if (item.testType === 'chapterwise') {
              return item.type === 'FREE' || item.type === 'FREE_PREMIUM' || item.type === 'PAID';
            } else if (item.testType === 'full_length') {
              return item.type === 'FREE' || item.type === 'FREE_PREMIUM';
            }
            return false;
          case 'full_length':
            if (item.testType === 'full_length') {
              return item.type === 'FREE' || item.type === 'FREE_PREMIUM' || item.type === 'PAID';
            } else if (item.testType === 'chapterwise') {
              return item.type === 'FREE' || item.type === 'FREE_PREMIUM';
            }
            return false;
          case 'combo':
            return true; // Combo users see all tests that passed previous filters
          default:
            // Fallback for unknown userModel, show only free tests
            return item.type === 'FREE' || item.type === 'FREE_PREMIUM';
        }
      });
  }, [searchTerm, selectedSubjects, selectedPricingFilter, allTestItems, user, authLoading, isLoadingTests]);


   const handleSubjectFilterChange = (subject: string) => {
    setSelectedSubjects(prev =>
      prev.includes(subject) ? prev.filter(s => s !== subject) : [...prev, subject]
    );
  };

  const renderSkeletons = (count: number) => {
     return Array.from({ length: count }).map((_, index) => (
         <Card key={`skeleton-${index}`} className="overflow-hidden flex flex-col group bg-card">
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
       case 'PAID': return 'Premium';
       case 'FREE_PREMIUM': return 'Free Premium';
       default: return pricing;
     }
   };

   const getPricingBadgeVariant = (pricing: PricingType): "default" | "secondary" | "destructive" | "outline" => {
      switch (pricing) {
          case 'FREE': return 'default';
          case 'PAID': return 'destructive';
          case 'FREE_PREMIUM': return 'secondary';
          default: return 'outline';
      }
   }

   const getPricingBadgeClasses = (pricing: PricingType): string => {
       switch (pricing) {
           case 'FREE': return 'bg-green-600 text-white border-green-600';
           case 'PAID': return 'bg-red-600 text-white border-red-600';
           case 'FREE_PREMIUM': return 'bg-blue-600 text-white border-blue-600';
           default: return '';
       }
   }

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
            <div className="w-full sm:w-auto">
             <Select onValueChange={(value) => setSelectedPricingFilter(value as PricingType | 'all')} value={selectedPricingFilter}>
               <SelectTrigger className="w-full sm:w-[180px]">
                 <SelectValue placeholder="Filter by Type" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">All Access Types</SelectItem>
                 {defaultPricings.map((pt) => (
                   <SelectItem key={pt} value={pt} className="capitalize">
                     {formatPricing(pt)}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
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
                                id={`subject-${sub.replace(/\s+/g, '-')}`}
                                checked={selectedSubjects.includes(sub)}
                                onCheckedChange={() => handleSubjectFilterChange(sub)}
                            />
                            <Label
                                htmlFor={`subject-${sub.replace(/\s+/g, '-')}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                {sub}
                            </Label>
                        </div>
                       ))}
                 </div>
                 <Button variant="ghost" size="sm" onClick={() => setSelectedSubjects([])}>Clear Subject Filter</Button>
               </div>
             </PopoverContent>
           </Popover>
         </div>
      </div>

       {error && (
         <Card className="md:col-span-2 lg:col-span-3 xl:col-span-4 border-destructive bg-destructive/10">
            <CardContent className="p-6 text-center text-destructive">
                {error}
            </CardContent>
        </Card>
       )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:col-span-4">
         {totalLoading ? (
             renderSkeletons(6) 
         ) : filteredTestItems.length > 0 ? (
             filteredTestItems.map((item) => (
                <Card key={item.test_code} className="overflow-hidden hover:shadow-lg transition-shadow duration-200 flex flex-col group bg-card">
                <CardContent className="p-4 flex flex-col flex-grow space-y-2">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-wrap gap-1 flex-grow mr-2">
                            {Array.isArray(item.test_subject) && item.test_subject.map(sub => (
                                <Badge key={sub} variant="secondary" className="text-xs capitalize">
                                    <BookOpen className="h-3 w-3 mr-1" />{sub}
                                </Badge>
                            ))}
                        </div>
                         <Badge
                            variant={getPricingBadgeVariant(item.type)}
                            className={`text-xs flex-shrink-0 ${getPricingBadgeClasses(item.type)}`}
                         >
                           <Tag className="h-3 w-3 mr-1"/> {formatPricing(item.type)}
                         </Badge>
                    </div>

                    <CardTitle className="text-lg mb-1 leading-tight group-hover:text-primary transition-colors">{item.name}</CardTitle>

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
                            <span>For: {item.audience} {item.testType === 'full_length' && item.stream ? `(${item.stream})` : item.testType === 'chapterwise' ? '(Chapterwise)' : ''}</span>
                           </div>
                    </div>


                    <div className="pt-2 mt-auto">
                         {/* Updated Link construction for test details page */}
                         <Link href={`/tests/${item.test_code}`} passHref>
                           <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                               View Details <ArrowRight className="ml-2 h-4 w-4" />
                           </Button>
                         </Link>
                    </div>
                </CardContent>
                </Card>
            ))
            ) : !error ? (
            <Card className="md:col-span-2 lg:col-span-3 xl:col-span-4">
                <CardContent className="p-6 text-center text-muted-foreground">
                    No tests found matching your criteria and plan. Try adjusting the filters or check the admin panel to create tests.
                </CardContent>
            </Card>
         ) : null }
      </div>
    </div>
  );
}

