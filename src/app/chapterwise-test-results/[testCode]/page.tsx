// src/app/chapterwise-test-results/[testCode]/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Award, BarChart2, CheckCircle, Clock, HelpCircle, MessageSquare, RefreshCw, Share2, XCircle, Sparkles, Star, Info } from 'lucide-react';
import Link from 'next/link';
import type { TestSession, TestResultSummary, GeneratedTest, TestQuestion, UserProfile } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { getGeneratedTestByCode } from '@/actions/generated-test-actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Script from 'next/script'; // Added Script for MathJax

// Helper to get all questions from a test definition, regardless of type
function getAllQuestionsFromTest(testDef: GeneratedTest | null): TestQuestion[] {
    if (!testDef) return [];
    if (testDef.testType === 'chapterwise' && testDef.questions) {
        return testDef.questions;
    } else if (testDef.testType === 'full_length') {
        // Ensure we handle potentially undefined subject arrays
        const physics = testDef.physics || [];
        const chemistry = testDef.chemistry || [];
        const maths = testDef.maths || [];
        const biology = testDef.biology || [];
        return [...physics, ...chemistry, ...maths, ...biology].filter(q => q); // filter out undefined/null
    }
    return [];
}

// Helper to calculate results
function calculateResults(session: TestSession, testDef: GeneratedTest | null): TestResultSummary | null {
    if (!testDef) return null;
    const allQuestions = getAllQuestionsFromTest(testDef);
    if (allQuestions.length === 0 || !session.answers) {
         console.error("Test definition has no questions or session answers are missing.");
         return null; // Cannot calculate results
    }
     if (allQuestions.length !== session.answers.length) {
         console.warn("Mismatch between questions in definition and session answers. Calculation might be inaccurate.");
         // Decide how to handle: return null, or proceed with caution?
         // For now, proceed but log the warning.
     }

    let correctCount = 0;
    let incorrectCount = 0;
    let attemptedCount = 0;
    let totalMarksPossible = 0;
    let score = 0;

    const detailedAnswers = session.answers.map((userAns, index) => {
        const questionDef = allQuestions[index];
        if (!questionDef) {
             console.error(`Definition missing for question index ${index}`);
             return {
                questionIndex: index,
                questionText: 'Error: Question definition missing',
                questionImageUrl: null,
                userAnswer: userAns.selectedOption,
                correctAnswer: 'Error',
                isCorrect: false,
                status: userAns.status,
                explanationText: null,
                explanationImageUrl: null,
             };
        }

        const currentMarks = questionDef.marks || 1; // Default to 1 mark if missing
        totalMarksPossible += currentMarks;
        let isCorrect = false;
        const correctAnswerKey = questionDef.answer?.replace('Option ', '').trim();

        if (userAns.selectedOption) {
            attemptedCount++;
            if (userAns.selectedOption === correctAnswerKey) {
                isCorrect = true;
                correctCount++;
                score += currentMarks;
            } else {
                incorrectCount++;
                // Handle negative marking if applicable (assuming no negative marking for now)
            }
        }
        return {
            questionIndex: index,
            questionText: questionDef.question_text || questionDef.question, // Use either field
            questionImageUrl: questionDef.question_image_url, // Prefer specific field
            userAnswer: userAns.selectedOption,
            correctAnswer: correctAnswerKey || 'N/A',
            isCorrect,
            status: userAns.status,
            explanationText: questionDef.explanation_text, // Prefer specific field
            explanationImageUrl: questionDef.explanation_image_url, // Prefer specific field
        };
    });

    const unansweredCount = Math.max(0, allQuestions.length - attemptedCount); // Ensure non-negative
    const percentage = totalMarksPossible > 0 ? (score / totalMarksPossible) * 100 : 0;
    const timeTakenSeconds = session.endTime && session.startTime ? Math.max(0, (session.endTime - session.startTime) / 1000) : 0; // Ensure non-negative
    const timeTakenMinutes = Math.round(timeTakenSeconds / 60);


    return {
        testCode: session.testId,
        userId: session.userId,
        testName: testDef.name,
        attemptId: `${session.testId}-${session.userId}-${session.startTime}`,
        submittedAt: session.endTime ? new Date(session.endTime).toISOString() : new Date().toISOString(),
        totalQuestions: allQuestions.length,
        attempted: attemptedCount,
        correct: correctCount,
        incorrect: incorrectCount,
        unanswered: unansweredCount,
        score,
        percentage,
        timeTakenMinutes,
        detailedAnswers,
    };
}


export default function TestResultsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const testCode = params.testCode as string;
  const userId = searchParams.get('userId');
  const attemptId = searchParams.get('attemptId');

  const [results, setResults] = useState<TestResultSummary | null>(null);
  const [testDefinition, setTestDefinition] = useState<GeneratedTest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
        router.push(`/auth/login?redirect=/chapterwise-test-results/${testCode}?userId=${userId}&attemptId=${attemptId}`);
        return;
    }
     // Ensure the logged-in user matches the userId in the URL
     if (user && userId && user.id !== userId) {
         setError("You are not authorized to view these results.");
         setIsLoading(false);
         return;
     }

    async function fetchResults() {
      if (!testCode || !userId || !attemptId) {
        setError("Missing test information to load results.");
        setIsLoading(false);
        return;
      }
       // Ensure this runs only on the client
       if (typeof window === 'undefined') {
           setError("Cannot load results on the server.");
           setIsLoading(false);
           return;
       }

      setIsLoading(true);
      setError(null);
      try {
        // 1. Fetch the test definition (This should ideally come from a source available on the client or passed props, but using action for now)
        // Note: Actions might run on the server even in client components if not explicitly prevented.
        // For a pure local storage approach, the test definition might need to be stored alongside the result,
        // or fetched via a client-side mechanism if not too large.
        let testDefData: GeneratedTest | null = null;
        try {
             testDefData = await getGeneratedTestByCode(testCode);
              if (!testDefData) {
                  throw new Error("Original test definition could not be fetched.");
              }
             setTestDefinition(testDefData);
        } catch (fetchError: any) {
             console.error("Failed to fetch test definition:", fetchError);
             // Try to load definition from localStorage if stored there? (Less common)
             // For now, we'll proceed without it, results will be basic.
             // setError("Could not load test details needed for full results analysis.");
        }


        // 2. Retrieve the specific test session from local storage using the attemptId
        const storageKey = `testResult-${attemptId}`;
        const storedSessionJson = localStorage.getItem(storageKey);
        if (!storedSessionJson) {
           console.error(`Attempt data not found in localStorage for key: ${storageKey}`);
          throw new Error(`Test attempt data not found. Results might be missing or cleared.`);
        }

        const sessionData: TestSession = JSON.parse(storedSessionJson);

        // 3. Calculate results (pass potentially null testDefData)
        const calculated = calculateResults(sessionData, testDefData);
        if (!calculated && testDefData) { // Only error if definition was fetched but calculation failed
            throw new Error("Could not process test results. Mismatch in data structure.");
        }
        // If testDefData is null, calculated might still have basic info
        setResults(calculated);

      } catch (err: any) {
        console.error("Error fetching results:", err);
        setError(err.message || "Failed to load test results.");
      } finally {
        setIsLoading(false);
      }
    }

     if (user) {
       fetchResults();
     }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testCode, userId, attemptId, authLoading, user, router]); // Add dependencies

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

  // Check if results are partially loaded (due to missing definition) or fully loaded
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
  const duration = testDefinition?.duration || 0;
  const totalQs = results.totalQuestions || testDefinition?.total_questions || 0;

  // Calculate total marks based on the definition if possible
   const allQuestionsInTest = testDefinition ? getAllQuestionsFromTest(testDefinition) : [];
   const totalPossibleMarks = allQuestionsInTest.reduce((sum, q) => sum + (q.marks || 1), 0);

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
           typesetMathJax(); // Initial typeset after load
         }}
       />
    <div className="container mx-auto py-8 px-4 max-w-4xl space-y-8">
      <Card className="shadow-lg bg-card text-card-foreground">
        <CardHeader className="bg-primary/10 dark:bg-primary/20 p-6">
          <CardTitle className="text-3xl font-bold text-primary text-center">{testName} - Results</CardTitle>
           <CardDescription className="text-center text-muted-foreground">
                Attempt ID: <span className="font-mono text-xs">{results.attemptId}</span> | Submitted: {new Date(results.submittedAt).toLocaleString()}
           </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <Card className="p-4 bg-muted dark:bg-muted/50">
              <CardTitle className="text-4xl font-bold text-green-600 dark:text-green-400">{results.score ?? 'N/A'}</CardTitle>
              <CardDescription>Score / {totalPossibleMarks || totalQs}</CardDescription>
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
                 Results and history are stored in your browser's local storage. Clearing browser data will remove this history. Rankings across users require a server backend.
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

        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-center gap-3 p-6 border-t border-border">
            {/* Link to review page remains the same */}
            <Button variant="outline" asChild>
                <Link href={`/chapterwise-test-review/${testCode}?userId=${userId}&attemptId=${attemptId}`}>
                    <BarChart2 className="mr-2 h-4 w-4" /> Review Answers
                </Link>
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
    </div>
    </>
  );
}

