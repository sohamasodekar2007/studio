// src/app/chapterwise-test-results/[testCode]/page.tsx
'use client';

 import { useEffect, useState, useCallback, useMemo } from 'react';
 import { useParams, useSearchParams, useRouter } from 'next/navigation';
 import { useAuth } from '@/context/auth-context';
 import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Progress } from '@/components/ui/progress';
 import { AlertTriangle, Award, BarChart2, CheckCircle, Clock, HelpCircle, MessageSquare, RefreshCw, Share2, XCircle, Sparkles, Star, Info, BarChartBig, BrainCircuit, TrendingUp, Loader2, ListOrdered, Gauge, UserCircle, LineChart, Edit3, Timer, Target, Eye, Users } from 'lucide-react'; // Added Users icon
 import Link from 'next/link';
 import type { TestResultSummary, GeneratedTest, UserProfile, ChapterwiseTestJson } from '@/types';
 import { Skeleton } from '@/components/ui/skeleton';
 import { getGeneratedTestByCode } from '@/actions/generated-test-actions';
 import { getTestReport, getAllReportsForTest } from '@/actions/test-report-actions';
 import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
 import TestRankingDialog from '@/components/admin/test-ranking-dialog';
 import Script from 'next/script';
 import { predictRank, type PredictRankOutput } from '@/ai/flows/predict-rank-flow';
 import { useToast } from '@/hooks/use-toast';
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
 import { ResponsiveContainer, PieChart, Pie, Cell, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, Label as RechartsLabel } from 'recharts';
 import {
   ChartContainer,
   ChartTooltip,
   ChartTooltipContent,
   type ChartConfig, 
 } from "@/components/ui/chart"; 

 const chartConfig = {
   value: { label: "Questions" },
   Correct: { label: "Correct", color: "hsl(var(--chart-2))" }, 
   Incorrect: { label: "Incorrect", color: "hsl(var(--chart-5))" }, 
   Unattempted: { label: "Unattempted", color: "hsl(var(--chart-3))" }, 
 } satisfies ChartConfig;


 export default function TestResultsPage() {
   const params = useParams();
   const searchParams = useSearchParams();
   const router = useRouter();
   const { user, loading: authLoading } = useAuth();
   const { toast } = useToast();

   const testCode = params.testCode as string;
   const userId = searchParams.get('userId');
   const attemptTimestampStr = searchParams.get('attemptTimestamp');

   const [results, setResults] = useState<TestResultSummary | null>(null);
   const [testDefinition, setTestDefinition] = useState<GeneratedTest | null>(null); 
   const [allAttempts, setAllAttempts] = useState<Array<TestResultSummary & { rank?: number }>>([]); 
   const [isLoading, setIsLoading] = useState(true);
   const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [isRankingDialogOpen, setIsRankingDialogOpen] = useState(false);
   const [isLoadingRankPrediction, setIsLoadingRankPrediction] = useState(false);
   const [rankPrediction, setRankPrediction] = useState<PredictRankOutput | null>(null);


   // --- Fetching Data ---
   const fetchTestAndResults = useCallback(async () => {
       if (!testCode || !userId || !attemptTimestampStr) {
         setError("Missing test information to load results.");
         setIsLoading(false);
         setIsLoadingLeaderboard(false); 
         return;
       }
       const attemptTimestamp = parseInt(attemptTimestampStr, 10);
       if (isNaN(attemptTimestamp)) {
           setError("Invalid attempt identifier.");
           setIsLoading(false);
           setIsLoadingLeaderboard(false);
           return;
       }

       setIsLoading(true);
       setError(null);
       setRankPrediction(null);
       try {
         
         const [reportData, testDefData] = await Promise.all([
           getTestReport(userId, testCode, attemptTimestamp),
           getGeneratedTestByCode(testCode).catch(() => null) 
         ]);

         if (!reportData) throw new Error(`Could not find results for this attempt.`);

         
         if (testDefData && testDefData.testType !== 'chapterwise') {
             console.warn("Viewing non-chapterwise results on chapterwise page. This page might need to be generalized or removed.");
             // This page might need to be updated or redirected if it's strictly for chapterwise
         }

         setTestDefinition(testDefData as ChapterwiseTestJson | null); 
         setResults(reportData);

       } catch (err: any) {
         setError(err.message || "Failed to load test results.");
         setResults(null);
         setTestDefinition(null);
       } finally {
         setIsLoading(false);
       }
   }, [testCode, userId, attemptTimestampStr, router]); 

   
   const fetchAllAttemptsData = useCallback(async () => {
       if (!testCode) return;
       setIsLoadingLeaderboard(true); 
       try {
           const attempts = await getAllReportsForTest(testCode);
           const sorted = attempts.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                                  .map((att, index) => ({ ...att, rank: index + 1 }));
           setAllAttempts(sorted); 
           console.log(`Fetched ${sorted.length} total attempts for ranking.`);
       } catch (err) {
            console.error("Error fetching all attempts:", err);
           
           toast({ variant: "destructive", title: "Ranking Error", description: "Could not load full ranking data."})
       } finally {
           setIsLoadingLeaderboard(false);
       }
   }, [testCode, toast]);

   useEffect(() => {
     if (authLoading) return;
     if (!user) {
         router.push(`/auth/login?redirect=/chapterwise-test-results/${testCode}?userId=${userId}&attemptTimestamp=${attemptTimestampStr}`);
         return;
     }
      if (user && userId && user.id !== userId) {
          setError("You are not authorized to view these results.");
          setIsLoading(false);
          return;
      }
      if (user) {
          fetchTestAndResults();
          fetchAllAttemptsData(); 
      }
   }, [testCode, userId, attemptTimestampStr, authLoading, user, router, fetchTestAndResults, fetchAllAttemptsData]);


   
   const testName = results?.testName || testDefinition?.name || 'Test Results';
   const duration = results?.duration || testDefinition?.duration || 0;
   const totalQs = results?.totalQuestions ?? 0;
   const totalPossibleMarks = results?.totalMarks || totalQs || 0;

    
    const userRankData = useMemo(() => allAttempts.find(entry => entry.userId === userId && entry.attemptTimestamp === parseInt(attemptTimestampStr ?? '0', 10)), [allAttempts, userId, attemptTimestampStr]);
    const userRank = userRankData?.rank ?? 'N/A';
    const totalStudents = allAttempts.length;
    const percentile = useMemo(() => {
       if (typeof userRank === 'number' && totalStudents > 0) {
           return (((totalStudents - userRank) / totalStudents) * 100).toFixed(1); 
       }
       return 'N/A';
    }, [userRank, totalStudents]);

   const accuracy = results?.percentage ? results.percentage.toFixed(1) : 'N/A'; 
   const timePerQues = totalQs > 0 && results?.timeTakenMinutes ? `${(results.timeTakenMinutes * 60 / totalQs).toFixed(0)}s` : 'N/A';
   const chapterwiseSubject = (testDefinition as ChapterwiseTestJson)?.test_subject?.[0] || 'Subject'; 

   
   const overviewChartData = useMemo(() => [
        { name: 'Correct', value: results?.correct ?? 0, fill: 'hsl(var(--chart-2))' },
        { name: 'Incorrect', value: results?.incorrect ?? 0, fill: 'hsl(var(--chart-5))' },
        { name: 'Unattempted', value: results?.unanswered ?? 0, fill: 'hsl(var(--chart-3))' },
   ], [results]);


    
    const topLeaderboardData = useMemo(() => allAttempts.slice(0, 5), [allAttempts]);

    
    const topperData = useMemo(() => {
        if (allAttempts.length === 0) return null;
        const topper = allAttempts[0]; 
        return {
            name: topper.user?.name ?? 'Topper',
            score: topper.score ?? 0,
            accuracy: topper.percentage ? topper.percentage.toFixed(1) : 'N/A',
            correct: topper.correct ?? 0,
            incorrect: topper.incorrect ?? 0,
            time: topper.timeTakenMinutes ? `${topper.timeTakenMinutes} min` : 'N/A'
        };
    }, [allAttempts]);


    if (isLoading || authLoading || isLoadingLeaderboard) { 
        
        return (
            <div className="container mx-auto py-6 px-4 max-w-7xl space-y-6">
                
                <Skeleton className="h-8 w-1/3 mb-4" />
                <Skeleton className="h-6 w-1/2 mb-6" />

                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>

                 
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                     <Skeleton className="h-64 md:col-span-1" /> 
                     <Skeleton className="h-64 md:col-span-1" /> 
                     <Skeleton className="h-64 md:col-span-1" /> 
                 </div>

                 
                 <Skeleton className="h-40 w-full" /> 

                  
                 <Skeleton className="h-60 w-full" />
             </div>
        );
    }

   if (error) {
     return (
       <div className="container mx-auto py-8 px-4 max-w-4xl text-center">
         <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
         <h1 className="text-2xl font-bold text-destructive mb-2">Error Loading Results</h1>
         <p className="text-muted-foreground mb-6">{error}</p>
         <Button asChild variant="outline">
           <Link href="/progress">Back to Progress</Link>
         </Button>
       </div>
     );
   }

   if (!results) {
     return (
       <div className="container mx-auto py-8 px-4 max-w-4xl text-center">
         <HelpCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
         <h1 className="text-2xl font-bold mb-2">Results Not Found</h1>
         <p className="text-muted-foreground mb-6">Could not retrieve results for this specific test attempt.</p>
          <Button asChild variant="outline">
           <Link href="/progress">Back to Progress</Link>
         </Button>
       </div>
     );
   }

   return (
      <>
       <Script
          id="mathjax-script-results" 
          src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
          strategy="lazyOnload"
        />
     <div className="container mx-auto py-6 px-4 max-w-7xl space-y-6"> 
       
        <div className="flex justify-between items-center flex-wrap gap-y-2">
            <div>
                
                <p className="text-sm text-muted-foreground">
                    <Link href="/" className="hover:text-primary">Home</Link> &gt;
                    <Link href="/progress" className="hover:text-primary"> My Tests</Link> &gt;
                    <span className="font-medium text-foreground"> Performance Analysis</span> &gt;
                    <span className="font-medium text-foreground"> {results.testName || testCode}</span>
                </p>
                 <h1 className="text-2xl font-bold mt-1">Your performance report for {results.testName || testCode}</h1>
            </div>
             <div className="flex gap-2">
                <Button variant="default" size="sm" asChild>
                     <Link href={`/chapterwise-test-review/${results.testCode}?userId=${user?.id}&attemptTimestamp=${results.attemptTimestamp}`}>
                        <Eye className="mr-1.5 h-4 w-4" /> View Solution
                     </Link>
                </Button>
             </div>
        </div>

        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="text-center p-4 bg-card border hover:shadow-md transition-shadow">
                <CardDescription className="text-xs mb-1 flex items-center justify-center gap-1 text-muted-foreground"><BarChart2 className="h-3 w-3"/> SCORE</CardDescription>
                <CardTitle className="text-2xl font-bold">{results.score ?? 'N/A'} <span className="text-sm font-normal text-muted-foreground">/ {totalPossibleMarks}</span></CardTitle>
            </Card>
            <Card className="text-center p-4 bg-card border hover:shadow-md transition-shadow">
                <CardDescription className="text-xs mb-1 flex items-center justify-center gap-1 text-muted-foreground"><Gauge className="h-3 w-3"/> ACCURACY</CardDescription>
                <CardTitle className="text-2xl font-bold">{accuracy}%</CardTitle>
            </Card>
            <Card className="text-center p-4 bg-card border hover:shadow-md transition-shadow">
                <CardDescription className="text-xs mb-1 flex items-center justify-center gap-1 text-muted-foreground"><ListOrdered className="h-3 w-3"/> RANK</CardDescription>
                <CardTitle className="text-2xl font-bold">
                    {userRank}
                    <span className="text-sm font-normal text-muted-foreground"> / {totalStudents}</span>
                </CardTitle>
            </Card>
             <Card className="text-center p-4 bg-card border hover:shadow-md transition-shadow">
                <CardDescription className="text-xs mb-1 flex items-center justify-center gap-1 text-muted-foreground"><TrendingUp className="h-3 w-3"/> PERCENTILE</CardDescription>
                <CardTitle className="text-2xl font-bold">{percentile}%</CardTitle>
            </Card>
        </div>

        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             
             <Card className="md:col-span-1">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-base font-semibold">Leaderboard</CardTitle>
                    <Button variant="link" size="sm" className="text-xs h-auto p-0" onClick={() => setIsRankingDialogOpen(true)}>View All</Button>
                 </CardHeader>
                 <CardContent className="p-0">
                    {isLoadingLeaderboard ? <Skeleton className="h-40 w-full" /> : (
                        <ul className="divide-y">
                             {topLeaderboardData.map((entry) => (
                                 <li key={entry.attemptTimestamp} className="flex items-center justify-between px-4 py-2 text-sm">
                                     <span className="font-medium flex items-center gap-1.5">
                                         {entry.rank}.
                                         <UserCircle className="h-4 w-4 text-muted-foreground" />
                                         {entry.user?.name ?? 'Anonymous'}
                                      </span>
                                     <span className="text-muted-foreground">{entry.score ?? 'N/A'} / {entry.totalMarks ?? entry.totalQuestions}</span>
                                 </li>
                             ))}
                         </ul>
                    )}
                 </CardContent>
             </Card>

            
            <Card className="md:col-span-1 flex flex-col">
                <CardHeader className="items-center pb-0">
                    <CardTitle>Overview</CardTitle>
                     <CardDescription>Based on questions attempted</CardDescription>
                </CardHeader>
                 <CardContent className="flex-1 pb-0 flex items-center justify-center">
                    <ChartContainer config={chartConfig} className="mx-auto aspect-square h-[200px] w-full">
                        <PieChart>
                            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                            <Pie data={overviewChartData} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5}>
                                <RechartsLabel
                                    content={({ viewBox }) => {
                                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                        return (
                                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle" >
                                            <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-3xl font-bold" >
                                                {totalQs.toLocaleString()}
                                            </tspan>
                                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground" >
                                            Questions
                                            </tspan>
                                        </text>
                                        )
                                    }
                                    return null;
                                    }}
                                />
                            </Pie>
                         </ChartContainer>
                </CardContent>
                 <CardFooter className="flex-col gap-2 text-sm pt-4"> 
                    <div className="flex items-center gap-2 font-medium leading-none">
                        Hover over chart for details
                     </div>
                     <div className="leading-none text-muted-foreground text-center">
                        Your overall performance for the test. Click or hover over an area to view its value.
                     </div>
                 </CardFooter>
            </Card>

            
            <Card className="md:col-span-1">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">You vs Topper</CardTitle>
                 </CardHeader>
                 <CardContent>
                    {topperData ? (
                        <div className="overflow-x-auto">
                          <Table>
                              <TableHeader>
                                  <TableRow>
                                      <TableHead></TableHead>
                                      <TableHead className="text-right">You</TableHead>
                                      <TableHead className="text-right">Topper</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  <TableRow><TableCell>Score</TableCell><TableCell className="text-right font-medium">{results.score?.toFixed(1)}</TableCell><TableCell className="text-right">{topperData.score.toFixed(1)}</TableCell></TableRow>
                                  <TableRow><TableCell>Accuracy</TableCell><TableCell className="text-right font-medium">{accuracy}%</TableCell><TableCell className="text-right">{topperData.accuracy}%</TableCell></TableRow>
                                  <TableRow><TableCell>Correct</TableCell><TableCell className="text-right font-medium">{results.correct}</TableCell><TableCell className="text-right">{topperData.correct}</TableCell></TableRow>
                                  <TableRow><TableCell>Incorrect</TableCell><TableCell className="text-right font-medium">{results.incorrect}</TableCell><TableCell className="text-right">{topperData.incorrect}</TableCell></TableRow>
                                  <TableRow><TableCell>Total Time</TableCell><TableCell className="text-right font-medium">{results.timeTakenMinutes} min</TableCell><TableCell className="text-right">{topperData.time}</TableCell></TableRow>
                              </TableBody>
                          </Table>
                        </div>
                    ) : (
                         <p className="text-sm text-muted-foreground text-center py-4">Topper data not available.</p>
                    )}
                 </CardContent>
             </Card>
        </div>

        
        <Card>
            <CardHeader>
                <CardTitle>Subject Performance: {chapterwiseSubject}</CardTitle>
                 <CardDescription>Your performance in this specific chapter test.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
                
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                     <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-900/20">
                         <Edit3 className="h-5 w-5 text-blue-600 mx-auto mb-1"/>
                         <p className="font-semibold">{results.attempted} <span className="text-xs font-normal">of {totalQs}</span></p>
                         <p className="text-xs text-muted-foreground">ATTEMPTED</p>
                     </div>
                     <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-900/20">
                         <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1"/>
                         <p className="font-semibold">{results.correct} <span className="text-xs font-normal">of {results.attempted}</span></p>
                         <p className="text-xs text-muted-foreground">CORRECT</p>
                     </div>
                     <div className="p-3 rounded-lg border bg-red-50 dark:bg-red-900/20">
                         <XCircle className="h-5 w-5 text-red-600 mx-auto mb-1"/>
                         <p className="font-semibold">{results.incorrect} <span className="text-xs font-normal">of {results.attempted}</span></p>
                         <p className="text-xs text-muted-foreground">INCORRECT</p>
                     </div>
                     <div className="p-3 rounded-lg border bg-orange-50 dark:bg-orange-900/20">
                         <Timer className="h-5 w-5 text-orange-600 mx-auto mb-1"/>
                         <p className="font-semibold">{results.timeTakenMinutes} <span className="text-xs font-normal">min</span></p>
                         <p className="text-xs text-muted-foreground">TIME TAKEN</p>
                     </div>
                 </div>
                
                 <p className="text-sm text-muted-foreground my-4 text-center">
                    You scored <span className="font-semibold text-primary">{results.score?.toFixed(0)}/{totalPossibleMarks}</span> with an accuracy of <span className="font-semibold text-primary">{accuracy}%</span>. Keep practicing!
                </p>

            </CardContent>
        </Card>

        
        <Card>
             <CardHeader>
                <CardTitle>Attempt Breakdown</CardTitle>
                 <CardDescription>How you answered the questions in this test.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
                 <div className="grid grid-cols-3 gap-4 text-center">
                    
                    <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-900/20">
                         <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1"/>
                        <p className="font-semibold">{results.correct} <span className="text-xs font-normal">of {totalQs}</span></p>
                         <p className="text-xs text-muted-foreground">CORRECT</p>
                    </div>
                    
                    <div className="p-3 rounded-lg border bg-red-50 dark:bg-red-900/20">
                         <XCircle className="h-5 w-5 text-red-600 mx-auto mb-1"/>
                        <p className="font-semibold">{results.incorrect} <span className="text-xs font-normal">of {totalQs}</span></p>
                         <p className="text-xs text-muted-foreground">INCORRECT</p>
                    </div>
                     
                    <div className="p-3 rounded-lg border bg-gray-100 dark:bg-gray-800/20">
                         <HelpCircle className="h-5 w-5 text-gray-500 mx-auto mb-1"/>
                        <p className="font-semibold">{results.unanswered} <span className="text-xs font-normal">of {totalQs}</span></p>
                         <p className="text-xs text-muted-foreground">UNATTEMPTED</p>
                    </div>
                 </div>
             </CardContent>
        </Card>


        
        <div className="flex justify-center gap-4 mt-8">
            <Button variant="outline" asChild>
                <Link href={`/chapterwise-test-review/${results.testCode}?userId=${user?.id}&attemptTimestamp=${results.attemptTimestamp}`}>
                     <BarChart2 className="mr-2 h-4 w-4" /> Review Answers
                </Link>
            </Button>
             <Button asChild>
                <Link href="/tests"><RefreshCw className="mr-2 h-4 w-4" /> Take Another Test</Link>
            </Button>
        </div>


        
        {testDefinition && (
            <TestRankingDialog
              isOpen={isRankingDialogOpen}
              onClose={() => setIsRankingDialogOpen(false)}
              test={testDefinition}
              
              fetchTestAttempts={() => getAllReportsForTest(testCode)}
            />
         )}
     </div>
     </>
   );
 }

    
