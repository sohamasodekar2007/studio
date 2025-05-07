// src/app/chapterwise-test-results/[testCode]/page.tsx
 'use client';

 import { useEffect, useState, useCallback } from 'react';
 import { useParams, useSearchParams, useRouter } from 'next/navigation';
 import { useAuth } from '@/context/auth-context';
 import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Progress } from '@/components/ui/progress';
 import { AlertTriangle, Award, BarChart2, CheckCircle, Clock, HelpCircle, MessageSquare, RefreshCw, Share2, XCircle, Sparkles, Star, Info, BarChartBig, BrainCircuit, TrendingUp } from 'lucide-react'; // Added BrainCircuit, TrendingUp
 import Link from 'next/link';
 import type { TestResultSummary, GeneratedTest, UserProfile } from '@/types';
 import { Skeleton } from '@/components/ui/skeleton';
 import { getGeneratedTestByCode } from '@/actions/generated-test-actions';
 import { getTestReport, getAllReportsForTest } from '@/actions/test-report-actions'; // Import report actions
 import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
 import TestRankingDialog from '@/components/admin/test-ranking-dialog'; // Re-use ranking dialog
 import Script from 'next/script'; // Added Script for MathJax
 import { predictRank, type PredictRankOutput } from '@/ai/flows/predict-rank-flow'; // Import the new AI flow action
 import { useToast } from '@/hooks/use-toast'; // Import toast


 export default function TestResultsPage() {
   const params = useParams();
   const searchParams = useSearchParams();
   const router = useRouter();
   const { user, loading: authLoading } = useAuth();
   const { toast } = useToast(); // Initialize toast

   const testCode = params.testCode as string;
   const userId = searchParams.get('userId');
   const attemptTimestampStr = searchParams.get('attemptTimestamp'); // Get timestamp as string

   const [results, setResults] = useState<TestResultSummary | null>(null);
   const [testDefinition, setTestDefinition] = useState<GeneratedTest | null>(null);
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [isRankingDialogOpen, setIsRankingDialogOpen] = useState(false); // State for ranking dialog
   const [isLoadingRankPrediction, setIsLoadingRankPrediction] = useState(false); // Loading state for rank prediction
   const [rankPrediction, setRankPrediction] = useState<PredictRankOutput | null>(null); // State for rank prediction result


    const typesetMathJax = useCallback(() => {
       if (typeof window !== 'undefined' && (window as any).MathJax) {
          console.log("Attempting MathJax typesetting on results page...");
          (window as any).MathJax.typesetPromise?.().catch((err: any) => console.error("MathJax typesetting error on results page:", err));
       }
    }, []);

    useEffect(() => {
      // Typeset when results are loaded
      if (results) {
        typesetMathJax();
      }
    }, [results, typesetMathJax]);

   const fetchTestAndResults = useCallback(async () => {
       if (!testCode || !userId || !attemptTimestampStr) {
         setError("Missing test information to load results.");
         setIsLoading(false);
         return;
       }

       // Convert timestamp string to number for action
       const attemptTimestamp = parseInt(attemptTimestampStr, 10);
        if (isNaN(attemptTimestamp)) {
           setError("Invalid attempt identifier.");
           setIsLoading(false);
           return;
        }


       setIsLoading(true);
       setError(null);
       setRankPrediction(null); // Reset prediction on new load
       try {
         // Fetch both concurrently
         const [reportData, testDefData] = await Promise.all([
           getTestReport(userId, testCode, attemptTimestamp),
           getGeneratedTestByCode(testCode).catch(err => {
               console.error("Failed to fetch test definition for results:", err);
               // Don't throw, allow results page to show basic info if report exists
               return null;
           })
         ]);

          if (!reportData) {
              console.error(`Report data not found for user ${userId}, test ${testCode}, attempt ${attemptTimestamp}`);
              throw new Error(`Could not find the results for this specific test attempt.`);
          }

          // If definition fetch failed, reportData might still be valid but missing some context
           if (!testDefData) {
               console.warn(`Test definition for ${testCode} not found. Results might lack some context (e.g., total marks if not stored in report).`);
           }

         setTestDefinition(testDefData);
         setResults(reportData); // Set the fetched report data

       } catch (err: any) {
         console.error("Error fetching results/definition:", err);
         setError(err.message || "Failed to load test results.");
         setResults(null); // Clear results on error
         setTestDefinition(null);
       } finally {
         setIsLoading(false);
       }
   }, [testCode, userId, attemptTimestampStr]);

   useEffect(() => {
     if (authLoading) return;
     if (!user) {
         router.push(`/auth/login?redirect=/chapterwise-test-results/${testCode}?userId=${userId}&attemptTimestamp=${attemptTimestampStr}`);
         return;
     }
      // Ensure the logged-in user matches the userId in the URL
      if (user && userId && user.id !== userId) {
          setError("You are not authorized to view these results.");
          setIsLoading(false);
          return;
      }

      if (user) {
          fetchTestAndResults();
      }
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [testCode, userId, attemptTimestampStr, authLoading, user, router]); // removed fetchTestAndResults

   // Function to open ranking dialog
    const handleViewRanking = () => {
        setIsRankingDialogOpen(true);
    };

    // Function to handle AI Rank Prediction
    const handlePredictRank = async () => {
       if (!results || !user || !userId || !testDefinition) {
            toast({ variant: "destructive", title: "Error", description: "Cannot predict rank without complete test data and user session." });
            return;
       }
       setIsLoadingRankPrediction(true);
       setRankPrediction(null); // Clear previous prediction

       try {
           const predictionInput = {
                userId: userId,
                testCode: testCode,
                userScore: results.score,
                totalMarks: results.totalMarks,
                timeTakenMinutes: results.timeTakenMinutes,
                durationMinutes: testDefinition.duration, // Use definition duration
           };
           const predictionResult = await predictRank(predictionInput);
           setRankPrediction(predictionResult);
       } catch (error: any) {
            console.error("Rank prediction error:", error);
            toast({ variant: "destructive", title: "Prediction Failed", description: error.message || "Could not predict rank." });
       } finally {
           setIsLoadingRankPrediction(false);
       }
    };


   if (isLoading || authLoading) {
     return (
       <div className="container mx-auto py-8 px-4 max-w-4xl">
         <Skeleton className="h-10 w-3/4 mb-4" />
         <Skeleton className="h-8 w-1/2 mb-8" />
         <Card>
           <CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader>
           <CardContent className="space-y-4">
             <Skeleton className="h-6 w-full" />
             <Skeleton className="h-6 w-5/6" />
             <Skeleton className="h-10 w-1/4 mt-4" />
           </CardContent>
         </Card>
       </div>
     );
   }

   if (error) {
     return (
       <div className="container mx-auto py-8 px-4 max-w-4xl text-center">
         <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
         <h1 className="text-2xl font-bold text-destructive mb-2">Error Loading Results</h1>
         <p className="text-muted-foreground mb-6">{error}</p>
         <Button asChild>
           <Link href="/tests">Go to Test Series</Link>
         </Button>
       </div>
     );
   }

   // Check if results are loaded
   if (!results) {
     return (
       <div className="container mx-auto py-8 px-4 max-w-4xl text-center">
         <HelpCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
         <h1 className="text-2xl font-bold mb-2">Results Not Available</h1>
         <p className="text-muted-foreground mb-6">We could not find or process the results for this attempt.</p>
          <Button asChild>
           <Link href="/tests">Go to Test Series</Link>
         </Button>
       </div>
     );
   }


   // Use testDefinition data if available, otherwise use results data
   const testName = results.testName || testDefinition?.name || 'Unknown Test';
   const duration = results.duration || testDefinition?.duration || 0; // Prefer duration from results if stored
   const totalQs = results.totalQuestions; // Always use totalQuestions from results
   const totalPossibleMarks = results.totalMarks || totalQs; // Use totalMarks from results, fallback to totalQs

    // AI Analysis (remains the same logic)
   const aiAnalysis = `Based on your performance in ${testName}:
 - You demonstrated strength in questions related to topics where you answered correctly (${results.correct ?? 0} questions).
 - Areas for improvement include topics related to the ${results.incorrect ?? 0} questions you answered incorrectly and the ${results.unanswered ?? 0} you skipped.
 - Focus on revising fundamentals for weaker topics and practicing more problems. Pay attention to the explanations provided in the review.
 - Your time management (${results.timeTakenMinutes ?? 0} mins used) seems ${results.timeTakenMinutes < (duration * 0.8) ? 'efficient' : results.timeTakenMinutes > duration ? 'like it could be improved' : 'reasonable'}.
 Keep practicing! Consistency is key.`;


   return (
      <>
       <Script
          id="mathjax-script-results" // Unique ID
          src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
          strategy="lazyOnload"
          onLoad={() => {
            console.log('MathJax loaded for results page.');
            // Initial typeset after script loads and component mounts
            typesetMathJax();
          }}
        />
     <div className="container mx-auto py-8 px-4 max-w-4xl space-y-8">
       <Card className="shadow-lg bg-card text-card-foreground">
         <CardHeader className="bg-primary/10 dark:bg-primary/20 p-6">
           <CardTitle className="text-3xl font-bold text-primary text-center">{testName} - Results</CardTitle>
            <CardDescription className="text-center text-muted-foreground">
                 Attempt Timestamp: <span className="font-mono text-xs">{results.attemptTimestamp}</span> | Submitted: {new Date(results.submittedAt).toLocaleString()}
            </CardDescription>
         </CardHeader>
         <CardContent className="p-6 space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
             <Card className="p-4 bg-muted dark:bg-muted/50">
               <CardTitle className="text-4xl font-bold text-green-600 dark:text-green-400">{results.score ?? 'N/A'}</CardTitle>
               <CardDescription>Score / {totalPossibleMarks}</CardDescription>
             </Card>
             <Card className="p-4 bg-muted dark:bg-muted/50">
               <CardTitle className="text-4xl font-bold text-blue-600 dark:text-blue-400">{results.percentage?.toFixed(2) ?? 'N/A'}%</CardTitle>
               <CardDescription>Percentage</CardDescription>
             </Card>
             <Card className="p-4 bg-muted dark:bg-muted/50">
               <CardTitle className="text-4xl font-bold text-purple-600 dark:text-purple-400">{results.timeTakenMinutes ?? 'N/A'} mins</CardTitle>
                <CardDescription>Time Taken / {duration || 'N/A'} mins</CardDescription>
             </Card>
           </div>

           <div>
             <h3 className="text-xl font-semibold mb-2 text-card-foreground">Performance Summary</h3>
             <div className="space-y-2">
               <div className="flex justify-between items-center">
                 <span className="text-muted-foreground">Total Questions:</span>
                 <span className="font-medium text-card-foreground">{totalQs || 'N/A'}</span>
               </div>
                {totalQs > 0 && (
                  <>
                     <Progress value={(results.attempted / totalQs) * 100} className="h-2 bg-gray-200 dark:bg-gray-700 [&>div]:bg-gray-500 dark:[&>div]:bg-gray-400" aria-label={`${((results.attempted / totalQs) * 100).toFixed(0)}% Attempted`}/>

                     <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                         <span><CheckCircle className="inline h-4 w-4 mr-1"/>Correct Answers:</span>
                         <span className="font-medium">{results.correct ?? 'N/A'}</span>
                     </div>
                     <Progress value={(results.correct / totalQs) * 100} className="h-2 bg-green-100 dark:bg-green-800/30 [&>div]:bg-green-500 dark:[&>div]:bg-green-400" aria-label={`${((results.correct / totalQs) * 100).toFixed(0)}% Correct`}/>

                     <div className="flex justify-between items-center text-red-600 dark:text-red-400">
                         <span><XCircle className="inline h-4 w-4 mr-1"/>Incorrect Answers:</span>
                         <span className="font-medium">{results.incorrect ?? 'N/A'}</span>
                     </div>
                     <Progress value={(results.incorrect / totalQs) * 100} className="h-2 bg-red-100 dark:bg-red-800/30 [&>div]:bg-red-500 dark:[&>div]:bg-red-400" aria-label={`${((results.incorrect / totalQs) * 100).toFixed(0)}% Incorrect`}/>

                     <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                         <span><HelpCircle className="inline h-4 w-4 mr-1"/>Unanswered:</span>
                         <span className="font-medium">{results.unanswered ?? 'N/A'}</span>
                     </div>
                     <Progress value={(results.unanswered / totalQs) * 100} className="h-2 bg-gray-100 dark:bg-gray-800/30 [&>div]:bg-gray-400 dark:[&>div]:bg-gray-500" aria-label={`${((results.unanswered / totalQs) * 100).toFixed(0)}% Unanswered`}/>
                  </>
                 )}
             </div>
           </div>

            <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700/50 dark:text-blue-300">
                <Info className="h-4 w-4 !text-blue-600 dark:!text-blue-400" />
                <AlertTitle>Local Storage Note</AlertTitle>
                <AlertDescription>
                  Results and history are stored locally. Clearing browser data may remove this history. Rankings require fetching data for all users.
                </AlertDescription>
            </Alert>

             {testDefinition && ( // Only show AI insights if definition was loaded
              <Card className="bg-primary/5 dark:bg-primary/10 border-primary/20 dark:border-primary/30">
                 <CardHeader>
                 <CardTitle className="text-xl flex items-center gap-2 text-primary dark:text-primary-light">
                     <Sparkles className="h-5 w-5" /> AI Performance Insights (Example)
                 </CardTitle>
                 </CardHeader>
                 <CardContent id="ai-analysis-content" className="prose prose-sm dark:prose-invert max-w-none text-primary/80 dark:text-primary-light/80">
                     {/* Render AI analysis text */}
                     <div dangerouslySetInnerHTML={{ __html: aiAnalysis.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }} />
                 </CardContent>
             </Card>
             )}

            {/* --- AI Rank Prediction Section --- */}
            <Card className="bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-purple-900/10 dark:via-background dark:to-blue-900/10 border-border">
                 <CardHeader>
                     <CardTitle className="text-xl flex items-center gap-2 text-purple-700 dark:text-purple-300">
                         <BrainCircuit className="h-5 w-5" /> AI Rank Prediction
                     </CardTitle>
                     <CardDescription>Get an estimated rank based on performance relative to others (requires comparison data).</CardDescription>
                 </CardHeader>
                 <CardContent>
                     {isLoadingRankPrediction ? (
                        <div className="flex items-center justify-center space-x-2">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground"/>
                            <span className="text-muted-foreground">Predicting rank...</span>
                        </div>
                     ) : rankPrediction ? (
                         <div className="space-y-2">
                            <p className="font-semibold text-lg text-center text-purple-800 dark:text-purple-200">{rankPrediction.predictedRankRange}</p>
                             <p className="text-sm text-muted-foreground text-center">{rankPrediction.feedback}</p>
                         </div>
                     ) : (
                         <p className="text-sm text-muted-foreground text-center">Click the button below to generate a rank prediction.</p>
                     )}
                 </CardContent>
                 <CardFooter className="justify-center">
                    <Button
                        variant="secondary"
                        className="bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/50 dark:text-purple-200 dark:hover:bg-purple-800/60 border border-purple-200 dark:border-purple-700"
                        onClick={handlePredictRank}
                        disabled={isLoadingRankPrediction || !testDefinition || !user}
                    >
                        {isLoadingRankPrediction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
                         Predict My Rank
                    </Button>
                 </CardFooter>
             </Card>


         </CardContent>
         <CardFooter className="flex flex-col sm:flex-row justify-center gap-3 p-6 border-t border-border">
             {/* Link to review page, pass attemptTimestamp */}
             <Button variant="outline" asChild>
                 <Link href={`/chapterwise-test-review/${testCode}?userId=${userId}&attemptTimestamp=${results.attemptTimestamp}`}>
                     <BarChart2 className="mr-2 h-4 w-4" /> Review Answers
                 </Link>
             </Button>
             {/* Ranking Button */}
             <Button variant="outline" onClick={handleViewRanking}>
                 <BarChartBig className="mr-2 h-4 w-4" /> View Ranking
             </Button>
             <Button asChild>
                 <Link href="/tests"><RefreshCw className="mr-2 h-4 w-4" /> Take Another Test</Link>
             </Button>
              {/* Share button remains disabled */}
              <Button variant="secondary" disabled>
                 <Share2 className="mr-2 h-4 w-4" /> Share Results (Coming Soon)
             </Button>
         </CardFooter>
       </Card>

        {/* Ranking Dialog */}
        {testDefinition && ( // Only enable ranking if test definition is loaded
            <TestRankingDialog
              isOpen={isRankingDialogOpen}
              onClose={() => setIsRankingDialogOpen(false)}
              test={testDefinition}
              fetchTestAttempts={() => getAllReportsForTest(testCode)} // Pass the correct fetch function
            />
         )}
     </div>
     </>
   );
 }
 
  