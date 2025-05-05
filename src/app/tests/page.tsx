'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, ArrowRight, Tag, BookOpen, CalendarDays, CheckSquare, Loader2 } from "lucide-react"; // Added Loader2
import Image from 'next/image';
import { Badge } from "@/components/ui/badge";
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { Test, Exam, TestModel, PricingType } from '@/types'; // Import types
import { getTests } from '@/actions/get-tests'; // Import the server action to fetch tests
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton

// Remove static test data
// const allTestItems = [ ... ];

// Extract filter options from types or define them
const exams: Exam[] = ["MHT-CET", "JEE Main", "JEE Advanced", "NEET"];
const models: TestModel[] = ["chapterwise", "full_length", "topicwise", "combo"];
const pricings: PricingType[] = ["free", "paid"];

export default function TestsPage() {
  const [allTestItems, setAllTestItems] = useState<Test[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExams, setSelectedExams] = useState<Exam[]>([]);
  const [selectedModels, setSelectedModels] = useState<TestModel[]>([]);
  const [selectedPricing, setSelectedPricing] = useState<PricingType | 'all'>('all');

  // Fetch tests on component mount
  useEffect(() => {
    setIsLoading(true);
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
        setIsLoading(false);
      });
  }, []);

  // Filter logic - filter only PUBLISHED tests
  const filteredTestItems = useMemo(() => {
    return allTestItems
        .filter(item => item.published) // Only show published tests
        .filter(item => {
            const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                item.subject.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesExam = selectedExams.length === 0 || selectedExams.includes(item.exam as Exam);
            const matchesModel = selectedModels.length === 0 || selectedModels.includes(item.model as TestModel);
            const matchesPricing = selectedPricing === 'all' || item.pricing === selectedPricing;

            return matchesSearch && matchesExam && matchesModel && matchesPricing;
     });
  }, [searchTerm, selectedExams, selectedModels, selectedPricing, allTestItems]);

  // Handlers for filter changes
  const handleExamChange = (exam: Exam) => {
    setSelectedExams(prev =>
      prev.includes(exam) ? prev.filter(e => e !== exam) : [...prev, exam]
    );
  };

  const handleModelChange = (model: TestModel) => {
    setSelectedModels(prev =>
      prev.includes(model) ? prev.filter(m => m !== model) : [...prev, model]
    );
  };

  const renderSkeletons = (count: number) => {
     return Array.from({ length: count }).map((_, index) => (
         <Card key={`skeleton-${index}`} className="overflow-hidden flex flex-col group bg-card">
             <Skeleton className="w-full h-40" />
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Test Series</h1>
          <p className="text-muted-foreground">Browse tests for MHT-CET, JEE & NEET.</p>
        </div>
         <div className="flex flex-wrap gap-2 w-full sm:w-auto">
           <div className="relative flex-grow sm:flex-grow-0 w-full sm:w-64">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input
               placeholder="Search tests..."
               className="pl-10 w-full"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
           </div>
           {/* Filter Popover */}
           <Popover>
             <PopoverTrigger asChild>
               <Button variant="outline">
                 <Filter className="mr-2 h-4 w-4" />
                 Filter ({selectedExams.length + selectedModels.length + (selectedPricing !== 'all' ? 1 : 0)})
               </Button>
             </PopoverTrigger>
             <PopoverContent className="w-80" align="end">
               <div className="grid gap-4">
                 <div className="space-y-2">
                   <h4 className="font-medium leading-none">Filters</h4>
                   <p className="text-sm text-muted-foreground">
                     Refine tests by exam, type, and pricing.
                   </p>
                 </div>
                 <div className="grid gap-3">
                   {/* Exam Filter */}
                   <div className="space-y-2">
                     <Label>Exam</Label>
                     <div className="flex flex-wrap gap-2">
                       {exams.map((exam) => (
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
                   </div>
                   {/* Model Filter */}
                   <div className="space-y-2">
                     <Label>Test Model</Label>
                      <div className="flex flex-wrap gap-2">
                       {models.map((model) => (
                         <div key={model} className="flex items-center space-x-2">
                            <Checkbox
                                id={`model-${model}`}
                                checked={selectedModels.includes(model)}
                                onCheckedChange={() => handleModelChange(model)}
                            />
                            <label
                                htmlFor={`model-${model}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize"
                            >
                                {model.replace('_', ' ')}
                            </label>
                        </div>
                       ))}
                     </div>
                   </div>
                   {/* Pricing Filter */}
                   <div className="space-y-2">
                     <Label>Pricing</Label>
                     <Select onValueChange={(value) => setSelectedPricing(value as PricingType | 'all')} value={selectedPricing}>
                       <SelectTrigger>
                         <SelectValue placeholder="Select Pricing" />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="all">All</SelectItem>
                         {pricings.map((price) => (
                           <SelectItem key={price} value={price} className="capitalize">{price}</SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>
                 </div>
                 <Button onClick={() => { setSelectedExams([]); setSelectedModels([]); setSelectedPricing('all'); }}>Clear Filters</Button>
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
         {isLoading ? (
             renderSkeletons(8) // Show 8 skeletons while loading
         ) : filteredTestItems.length > 0 ? (
             filteredTestItems.map((item) => (
                <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow duration-200 flex flex-col group bg-card">
                <CardHeader className="p-0 relative">
                    <Image
                        // Use imageUrl from data if available, otherwise fallback to picsum
                        src={item.imageUrl || `https://picsum.photos/seed/${item.id}/400/200`}
                        alt={item.title}
                        width={400}
                        height={200}
                        className="w-full h-40 object-cover"
                        data-ai-hint={item.imageHint || `${item.exam} ${item.subject} test`} // Use hint or generate one
                    />
                    <div className="absolute top-2 right-2 flex gap-1">
                        {item.status && (
                            <Badge variant={item.status === 'Popular' ? 'destructive' : 'secondary'} className="text-xs">
                            {item.status}
                            </Badge>
                        )}
                        <Badge variant={item.pricing === 'free' ? 'default' : 'outline'} className={`text-xs ${item.pricing === 'free' ? 'bg-green-600 text-white border-green-600' : ''}`}>
                            {item.pricing === 'free' ? 'Free' : 'Paid'}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-4 flex flex-col flex-grow space-y-2">
                    <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-xs w-fit"><CalendarDays className="h-3 w-3 mr-1"/>{item.exam}</Badge>
                    <Badge variant="secondary" className="text-xs w-fit capitalize"><CheckSquare className="h-3 w-3 mr-1"/>{item.model.replace('_', ' ')}</Badge>
                    <Badge variant="secondary" className="text-xs w-fit"><BookOpen className="h-3 w-3 mr-1"/>{item.subject}</Badge>
                    </div>
                    <CardTitle className="text-lg mb-1 leading-tight group-hover:text-primary transition-colors">{item.title}</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground line-clamp-2">
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
                    No tests found matching your criteria. Try adjusting the filters.
                </CardContent>
            </Card>
         ) : null /* Don't show anything if there was an error and no tests */ }
      </div>
    </div>
  );
}
