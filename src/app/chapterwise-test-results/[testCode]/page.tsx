// src/app/chapterwise-test-results/[testCode]/page.tsx
'use client';

 import { useEffect, useState, useCallback, useMemo } from 'react';
 import { useParams, useSearchParams, useRouter } from 'next/navigation';
 import { useAuth } from '@/context/auth-context';
 import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Progress } from '@/components/ui/progress';
 import { AlertTriangle, Award, BarChart2, CheckCircle, Clock, HelpCircle, MessageSquare, RefreshCw, Share2, XCircle, Sparkles, Star, Info, BarChartBig, BrainCircuit, TrendingUp, Loader2, ListOrdered, Gauge, UserCircle, LineChart, Edit3, Timer, Target, Eye } from 'lucide-react'; // Added Eye
 import Link from 'next/link';
 import type { TestResultSummary, GeneratedTest, UserProfile, ChapterwiseTestJson } from '@/types'; // Import ChapterwiseTestJson
 import { Skeleton } from '@/components/ui/skeleton';
 import { getGeneratedTestByCode } from '@/actions/generated-test-actions';
 import { getTestReport, getAllReportsForTest } from '@/actions/test-report-actions';
 import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
 import TestRankingDialog from '@/components/admin/test-ranking-dialog';
 import Script from 'next/script';
 import { predictRank, type PredictRankOutput } from '@/ai/flows/predict-rank-flow';
 import { useToast } from '@/hooks/use-toast';
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
 // Import Label from recharts
 import { ResponsiveContainer, PieChart, Pie, Cell, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, Label } from 'recharts';
 import {
   ChartContainer,
   ChartTooltip,
   ChartTooltipContent,
   type ChartConfig, // Import ChartConfig type
 } from "@/components/ui/chart"; // Import ShadCN chart components

 // Placeholder data for charts - Replace with real data later
 const overviewChartData = [
     { name: 'Correct', value: 0, fill: 'hsl(var(--chart-2))' }, // Green
     { name: 'Incorrect', value: 0, fill: 'hsl(var(--chart-5))' }, // Red
     { name: 'Unattempted', value: 0, fill: 'hsl(var(--chart-3))' }, // Gray/Orange
 ];
 const overviewChartConfig = {
    value: { label: "Questions" },
    Correct: { label: "Correct", color: "hsl(var(--chart-2))" },
    Incorrect: { label: "Incorrect", color: "hsl(var(--chart-5))" },
    Unattempted: { label: "Unattempted", color: "hsl(var(--chart-3))" },
 } satisfies ChartConfig;


 // Removed placeholder for section-wise performance (not applicable here)

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
   const [testDefinition, setTestDefinition] = useState<GeneratedTest | null>(null); // Use GeneratedTest type
   const [leaderboardData, setLeaderboardData] = useState<Array<TestResultSummary & { rank?: number }>>([]); // For top ranks display
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
         setIsLoadingLeaderboard(false); // Stop leaderboard loading too
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
           getGeneratedTestByCode(testCode).catch(() => null) // Don't fail if definition is missing
         ]);

         if (!reportData) throw new Error(`Could not find results for this attempt.`);

         // Ensure it's a chapterwise test for this page
         if (testDefData && testDefData.testType !== 'chapterwise') {
             console.warn("Attempting to view non-chapterwise test results on chapterwise page. Redirecting or showing error might be appropriate.");
             setError("This results page is for chapterwise tests only.");
             setTestDefinition(null);
             setResults(null);
             setIsLoading(false);
             return;
         }

         setTestDefinition(testDefData as ChapterwiseTestJson | null); // Cast to specific type if needed
         setResults(reportData);

         // Update overview chart data based on results
         if (reportData.totalQuestions > 0) {
             overviewChartData[0].value = reportData.correct ?? 0;
             overviewChartData[1].value = reportData.incorrect ?? 0;
             overviewChartData[2].value = reportData.unanswered ?? 0;
         }

       } catch (err: any) {
         setError(err.message || "Failed to load test results.");
         setResults(null);
         setTestDefinition(null);
       } finally {
         setIsLoading(false);
       }
   }, [testCode, userId, attemptTimestampStr]);

   // Fetch Leaderboard (Top 5-6 for display)
   const fetchLeaderboardData = useCallback(async () => {
       if (!testCode) return;
       setIsLoadingLeaderboard(true);
       try {
           const allAttempts = await getAllReportsForTest(testCode);
           const sorted = allAttempts.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                                  .map((att, index) => ({ ...att, rank: index + 1 }));
           setLeaderboardData(sorted.slice(0, 6)); // Get top 6
       } catch (err) {
            console.error("Error fetching leaderboard:", err);
           // Don't set main error, just log it
       } finally {
           setIsLoadingLeaderboard(false);
       }
   }, [testCode]);

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
          fetchLeaderboardData(); // Fetch leaderboard after main data
      }
   }, [testCode, userId, attemptTimestampStr, authLoading, user, router, fetchTestAndResults, fetchLeaderboardData]);


   // --- Calculations & Placeholders ---
   const testName = results?.testName || testDefinition?.name || 'Test Results';
   const duration = results?.duration || testDefinition?.duration || 0;
   const totalQs = results?.totalQuestions ?? 0;
   const totalPossibleMarks = results?.totalMarks || totalQs || 0;
   const userRank = leaderboardData.find(entry => entry.userId === userId)?.rank ?? 'N/A'; // Find user's rank
   const totalAttempts = leaderboardData.length > 0 ? '210' : 'N/A'; // Placeholder total attempts for rank display
   const percentile = results?.percentage ? (results.percentage * 0.95).toFixed(2) : 'N/A'; // Placeholder percentile calc
   const timePerQues = totalQs > 0 && results?.timeTakenMinutes ? `${(results.timeTakenMinutes * 60 / totalQs).toFixed(0)}s` : 'N/A';
   const chapterwiseSubject = (testDefinition as ChapterwiseTestJson)?.test_subject?.[0] || 'Subject'; // Get the single subject


    // Placeholder Topper Data (replace with actual fetch logic)
    const topperData = leaderboardData.length > 0 ? {
        name: leaderboardData[0].user?.name ?? 'Topper',
        score: leaderboardData[0].score ?? 0,
        accuracy: leaderboardData[0].percentage ? (leaderboardData[0].percentage).toFixed(2) : 'N/A', // Use actual percentage
        correct: leaderboardData[0].correct ?? 0,
        incorrect: leaderboardData[0].incorrect ?? 0,
        time: leaderboardData[0].timeTakenMinutes ? `${leaderboardData[0].timeTakenMinutes} min` : 'N/A'
    } : null;


    if (isLoading || authLoading) {
        // More detailed skeleton matching the new layout
        return (
            <div className="container mx-auto py-6 px-4 max-w-7xl space-y-6">
                {/* Header Skeleton */}
                <Skeleton className="h-8 w-1/3 mb-4" />
                <Skeleton className="h-6 w-1/2 mb-6" />

                {/* Top Metrics Skeleton */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>

                 {/* Leaderboard & Overview Skeleton */}
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                     <Skeleton className="h-64 md:col-span-1" /> {/* Leaderboard */}
                     <Skeleton className="h-64 md:col-span-1" /> {/* Overview Chart */}
                     <Skeleton className="h-64 md:col-span-1" /> {/* You vs Topper */}
                 </div>

                 {/* Section Analysis Skeleton */}
                 <Skeleton className="h-40 w-full" /> {/* Adjusted height */}

                  {/* Attempted Efficiency Skeleton */}
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
          id="mathjax-script-results" // Unique ID
          src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
          strategy="lazyOnload"
        />
     <div className="container mx-auto py-6 px-4 max-w-7xl space-y-6"> {/* Increased max-width */}
       {/* Header Area */}
        <div className="flex justify-between items-center flex-wrap gap-y-2">
            <div>
                {/* Breadcrumbs */}
                <p className="text-sm text-muted-foreground">
                    <Link href="/" className="hover:text-primary">Home</Link> &gt;
                    <Link href="/progress" className="hover:text-primary"> My Tests</Link> &gt;
                    <span className="font-medium text-foreground"> Performance Analysis</span> &gt;
                    <span className="font-medium text-foreground"> {results.testName || testCode}</span>
                </p>
                 <h1 className="text-2xl font-bold mt-1">Your performance report for {results.testName || testCode}</h1>
            </div>
             <div className="flex gap-2">
                {/* Removed Reading Mode button */}
                <Button variant="default" size="sm" asChild>
                     <Link href={`/chapterwise-test-review/${results.testCode}?userId=${user?.id}&attemptTimestamp=${results.attemptTimestamp}`}>
                        <Eye className="mr-1.5 h-4 w-4" /> View Solution
                     </Link>
                </Button>
             </div>
        </div>

        {/* Top Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="text-center p-4">
                <CardDescription className="text-xs mb-1">SCORE</CardDescription>
                <CardTitle className="text-2xl font-bold">{results.score ?? 'N/A'} <span className="text-sm font-normal text-muted-foreground">/ {totalPossibleMarks}</span></CardTitle>
            </Card>
            <Card className="text-center p-4">
                <CardDescription className="text-xs mb-1">ACCURACY</CardDescription>
                <CardTitle className="text-2xl font-bold">{results.percentage?.toFixed(2) ?? 'N/A'}%</CardTitle>
            </Card>
            <Card className="text-center p-4">
                <CardDescription className="text-xs mb-1">RANK</CardDescription>
                <CardTitle className="text-2xl font-bold">{userRank} <span className="text-sm font-normal text-muted-foreground">/ {totalAttempts}</span></CardTitle>
            </Card>
             <Card className="text-center p-4">
                <CardDescription className="text-xs mb-1">PERCENTILE</CardDescription>
                <CardTitle className="text-2xl font-bold">{percentile}%</CardTitle>
            </Card>
        </div>

        {/* Leaderboard, Overview, You vs Topper Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {/* Leaderboard */}
             <Card className="md:col-span-1">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">Leaderboard</CardTitle>
                 </CardHeader>
                 <CardContent className="p-0">
                    {isLoadingLeaderboard ? <Skeleton className="h-40 w-full" /> : (
                        <ul className="divide-y">
                             {leaderboardData.map((entry) => (
                                 <li key={entry.attemptTimestamp} className="flex items-center justify-between px-4 py-2 text-sm">
                                     <span className="font-medium">{entry.rank}. {entry.user?.name ?? 'Anonymous'}</span>
                                     <span className="text-muted-foreground">{entry.score ?? 'N/A'} / {entry.totalMarks ?? entry.totalQuestions}</span>
                                 </li>
                             ))}
                         </ul>
                    )}
                 </CardContent>
             </Card>

            {/* Overview Chart */}
            <Card className="md:col-span-1">
                <CardHeader className="items-center pb-0">
                    <CardTitle>Overview</CardTitle>
                     <CardDescription>Based on questions attempted</CardDescription>
                </CardHeader>
                 <CardContent className="flex-1 pb-0">
                    <ChartContainer config={overviewChartConfig} className="mx-auto aspect-square h-[200px]">
                        <PieChart>
                            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                            <Pie data={overviewChartData} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5}>
                                <Label
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
                                    }}
                                />
                            </Pie>
                        </PieChart>
                     </ChartContainer>
                </CardContent>
                 <CardFooter className="flex-col gap-2 text-sm pt-0">
                    <div className="flex items-center gap-2 font-medium leading-none">
                        Hover over chart for details
                     </div>
                     <div className="leading-none text-muted-foreground text-center">
                        Your overall performance for the test. Click or hover over an area to view its value.
                     </div>
                 </CardFooter>
            </Card>

            {/* You vs Topper */}
            <Card className="md:col-span-1">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">You vs Topper</CardTitle>
                 </CardHeader>
                 <CardContent>
                    {topperData ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead></TableHead>
                                    <TableHead className="text-right">You</TableHead>
                                    <TableHead className="text-right">Topper</TableHead>
                                </TableRow>
                             </TableHeader>
                            <TableBody>
                                <TableRow><TableCell>Score</TableCell><TableCell className="text-right font-medium">{results.score?.toFixed(2)}</TableCell><TableCell className="text-right">{topperData.score.toFixed(2)}</TableCell></TableRow>
                                <TableRow><TableCell>Accuracy</TableCell><TableCell className="text-right font-medium">{results.percentage?.toFixed(2)}%</TableCell><TableCell className="text-right">{topperData.accuracy}%</TableCell></TableRow>
                                <TableRow><TableCell>Correct</TableCell><TableCell className="text-right font-medium">{results.correct}</TableCell><TableCell className="text-right">{topperData.correct}</TableCell></TableRow>
                                <TableRow><TableCell>Incorrect</TableCell><TableCell className="text-right font-medium">{results.incorrect}</TableCell><TableCell className="text-right">{topperData.incorrect}</TableCell></TableRow>
                                <TableRow><TableCell>Total Time</TableCell><TableCell className="text-right font-medium">{results.timeTakenMinutes} min</TableCell><TableCell className="text-right">{topperData.time}</TableCell></TableRow>
                            </TableBody>
                         </Table>
                    ) : (
                         <p className="text-sm text-muted-foreground text-center py-4">Topper data not available.</p>
                    )}
                 </CardContent>
             </Card>
        </div>

        {/* Subject Performance Card (Chapterwise) */}
        <Card>
            <CardHeader>
                <CardTitle>Subject Performance: {chapterwiseSubject}</CardTitle>
                 <CardDescription>Your performance in this specific chapter test.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
                {/* Simplified Performance Summary */}
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
                {/* Simple message */}
                 <p className="text-sm text-muted-foreground my-4 text-center">
                    You scored <span className="font-semibold text-primary">{results.score?.toFixed(0)}/{totalPossibleMarks}</span> with an accuracy of <span className="font-semibold text-primary">{results.percentage?.toFixed(1)}%</span>. Keep practicing!
                </p>

            </CardContent>
        </Card>

        {/* Attempted Efficiency - Simplified for Chapterwise */}
        <Card>
             <CardHeader>
                <CardTitle>Attempt Breakdown</CardTitle>
                 <CardDescription>How you answered the questions in this test.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
                 <div className="grid grid-cols-3 gap-4 text-center">
                    {/* Correct */}
                    <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-900/20">
                         <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1"/>
                        <p className="font-semibold">{results.correct} <span className="text-xs font-normal">of {totalQs}</span></p>
                         <p className="text-xs text-muted-foreground">CORRECT</p>
                    </div>
                    {/* Incorrect */}
                    <div className="p-3 rounded-lg border bg-red-50 dark:bg-red-900/20">
                         <XCircle className="h-5 w-5 text-red-600 mx-auto mb-1"/>
                        <p className="font-semibold">{results.incorrect} <span className="text-xs font-normal">of {totalQs}</span></p>
                         <p className="text-xs text-muted-foreground">INCORRECT</p>
                    </div>
                     {/* Unattempted */}
                    <div className="p-3 rounded-lg border bg-gray-100 dark:bg-gray-800/20">
                         <HelpCircle className="h-5 w-5 text-gray-500 mx-auto mb-1"/>
                        <p className="font-semibold">{results.unanswered} <span className="text-xs font-normal">of {totalQs}</span></p>
                         <p className="text-xs text-muted-foreground">UNATTEMPTED</p>
                    </div>
                 </div>
                  {/* Time Spent Deciding - Removed as it's less relevant for single subject */}
                 {/* Efficiency Chart Placeholder - Removed as less relevant for single subject */}
             </CardContent>
        </Card>


        {/* Action Buttons */}
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


        {/* Ranking Dialog - If testDefinition exists */}
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
