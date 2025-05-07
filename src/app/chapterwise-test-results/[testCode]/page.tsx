// src/app/chapterwise-test-results/[testCode]/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react'; // Added useCallback
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Award, BarChart2, CheckCircle, Clock, HelpCircle, MessageSquare, RefreshCw, Share2, XCircle, Sparkles, Star, Info } from 'lucide-react'; // Added Info
import Link from 'next/link';
import type { TestSession, TestResultSummary, GeneratedTest, TestQuestion, UserProfile } from '@/types'; // Added UserProfile
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
        return [
            ...(testDef.physics || []),
            ...(testDef.chemistry || []),
            ...(testDef.maths || []),
            ...(testDef.biology || []),
        ].filter(q => q);
    }
    return [];
}

// Helper to calculate results
function calculateResults(session: TestSession, testDef: GeneratedTest | null): TestResultSummary | null {
    if (!testDef) return null;
    const allQuestions = getAllQuestionsFromTest(testDef);
    if (allQuestions.length === 0 || allQuestions.length !== session.answers.length) {
         console.error("Mismatch between questions in definition and session answers.");
         return null; // Return null or handle error appropriately
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
             return { // Provide a default structure on error
                questionIndex: index,
                userAnswer: userAns.selectedOption,
                correctAnswer: 'Error',
                isCorrect: false,
                status: userAns.status,
                questionText: 'Error: Question definition missing',
                questionImageUrl: null,
                explanationText: null,
                explanationImageUrl: null,
             };
        }


        totalMarksPossible += questionDef.marks;
        let isCorrect = false;
        // Ensure correct answer format matches selected option format ("A", "B", etc.)
        const correctAnswerKey = questionDef.answer?.replace('Option ', '').trim();

        if (userAns.selectedOption) {
            attemptedCount++;
            if (userAns.selectedOption === correctAnswerKey) {
                isCorrect = true;
                correctCount++;
                score += questionDef.marks;
            } else {
                incorrectCount++;
            }
        }
        return {
            questionIndex: index,
            // Pass content directly for review page
            questionText: questionDef.question_text || questionDef.question, // Handle older format
            questionImageUrl: questionDef.question_image_url || (typeof questionDef.question === 'string' && questionDef.question.endsWith('.png') ? questionDef.question : null), // Handle older format
            userAnswer: userAns.selectedOption,
            correctAnswer: correctAnswerKey || 'N/A', // Handle missing answer key
            isCorrect,
            status: userAns.status,
            explanationText: questionDef.explanation_text || (typeof questionDef.explanation === 'string' ? questionDef.explanation : null), // Handle older format
            explanationImageUrl: questionDef.explanation_image_url || (typeof questionDef.explanation === 'string' && questionDef.explanation.endsWith('.png') ? questionDef.explanation : null), // Handle older format
        };
    });

    const unansweredCount = allQuestions.length - attemptedCount;
    const percentage = totalMarksPossible > 0 ? (score / totalMarksPossible) * 100 : 0;
    // Use start/end times from session for accurate calculation
    const timeTakenSeconds = session.endTime && session.startTime ? (session.endTime - session.startTime) / 1000 : 0;
    const timeTakenMinutes = Math.round(timeTakenSeconds / 60);


    return {
        testCode: session.testId,
        userId: session.userId,
        testName: testDef.name,
        attemptId: `${session.testId}-${session.userId}-${session.startTime}`, // Use consistent ID generation
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

      setIsLoading(true);
      setError(null);
      try {
        // 1. Fetch the test definition
        const testDefData = await getGeneratedTestByCode(testCode);
        if (!testDefData) {
          throw new Error("Original test definition not found.");
        }
        setTestDefinition(testDefData); // Store the fetched test definition

        // 2. Retrieve the specific test session from local storage using the attemptId
        const storageKey = `testResult-${attemptId}`;
        const storedSessionJson = localStorage.getItem(storageKey);
        if (!storedSessionJson) {
          // Fallback: try finding a matching session if attemptId is missing parts (less reliable)
          let foundSessionJson = null;
          for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith(`testResult-${testCode}-${userId}`)) {
                  // Found a potential match, use the latest one based on timestamp?
                  // For simplicity, just use the first one found for now.
                  console.warn(`Attempt ID key mismatch, trying fallback key: ${key}`);
                  foundSessionJson = localStorage.getItem(key);
                  break;
              }
          }
           if (!foundSessionJson) {
              throw new Error(`Test attempt data not found for attempt ID: ${attemptId}. Results might be missing or processed.`);
           }
           storedSessionJson = foundSessionJson;
        }

        const sessionData: TestSession = JSON.parse(storedSessionJson);

        // 3. Calculate results
        const calculated = calculateResults(sessionData, testDefData);
        if (!calculated) {
            throw new Error("Could not process test results. Check console for details.");
        }
        setResults(calculated);

      } catch (err: any) {
        console.error("Error fetching results:", err);
        setError(err.message || "Failed to load test results.");
      } finally {
        setIsLoading(false);
      }
    }

     if (user) { // Fetch only if user is confirmed
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

  if (!results || !testDefinition) { // Also check for testDefinition
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl text-center">
        <HelpCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Results Not Available</h1>
        <p className="text-muted-foreground mb-6">We could not find the results or test definition for this attempt.</p>
        <Button asChild>
          <Link href="/tests">Go to Test Series</Link>
        </Button>
      </div>
    );
  }

  // Calculate total marks based on the actual questions in the test definition
  const allQuestionsInTest = getAllQuestionsFromTest(testDefinition);
  const totalPossibleMarks = allQuestionsInTest.reduce((sum, q) => sum + q.marks, 0);


  const aiAnalysis = `Based on your performance in ${results.testName}:
- You demonstrated strength in questions related to topics where you answered correctly (${results.correct} questions).
- Areas for improvement include topics related to the ${results.incorrect} questions you answered incorrectly and the ${results.unanswered} you skipped.
- Focus on revising fundamentals for weaker topics and practicing more problems. Pay attention to the explanations provided in the review.
- Your time management (${results.timeTakenMinutes} mins used) seems ${results.timeTakenMinutes < (testDefinition.duration * 0.8) ? 'efficient' : results.timeTakenMinutes > testDefinition.duration ? 'like it could be improved' : 'reasonable'}.
Keep practicing! Consistency is key.`;


  return (
     <>
     {/* Ensure MathJax script is included */}
      <Script
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
          <CardTitle className="text-3xl font-bold text-primary text-center">{results.testName} - Results</CardTitle>
           <CardDescription className="text-center text-muted-foreground">
                Attempt ID: <span className="font-mono text-xs">{results.attemptId}</span> | Submitted: {new Date(results.submittedAt).toLocaleString()}
           </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <Card className="p-4 bg-muted dark:bg-muted/50">
              <CardTitle className="text-4xl font-bold text-green-600 dark:text-green-400">{results.score}</CardTitle>
              <CardDescription>Score / {totalPossibleMarks}</CardDescription>
            </Card>
            <Card className="p-4 bg-muted dark:bg-muted/50">
              <CardTitle className="text-4xl font-bold text-blue-600 dark:text-blue-400">{results.percentage.toFixed(2)}%</CardTitle>
              <CardDescription>Percentage</CardDescription>
            </Card>
            <Card className="p-4 bg-muted dark:bg-muted/50">
              <CardTitle className="text-4xl font-bold text-purple-600 dark:text-purple-400">{results.timeTakenMinutes} mins</CardTitle>
               <CardDescription>Time Taken / {testDefinition.duration} mins</CardDescription>
            </Card>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-2 text-card-foreground">Performance Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Questions:</span>
                <span className="font-medium text-card-foreground">{results.totalQuestions}</span>
              </div>
              <Progress value={(results.attempted / results.totalQuestions) * 100} className="h-2 bg-gray-200 dark:bg-gray-700 [&>div]:bg-gray-500 dark:[&>div]:bg-gray-400" aria-label={`${((results.attempted / results.totalQuestions) * 100).toFixed(0)}% Attempted`}/>

              <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                <span><CheckCircle className="inline h-4 w-4 mr-1"/>Correct Answers:</span>
                <span className="font-medium">{results.correct}</span>
              </div>
              <Progress value={(results.correct / results.totalQuestions) * 100} className="h-2 bg-green-100 dark:bg-green-800/30 [&>div]:bg-green-500 dark:[&>div]:bg-green-400" aria-label={`${((results.correct / results.totalQuestions) * 100).toFixed(0)}% Correct`}/>

              <div className="flex justify-between items-center text-red-600 dark:text-red-400">
                <span><XCircle className="inline h-4 w-4 mr-1"/>Incorrect Answers:</span>
                <span className="font-medium">{results.incorrect}</span>
              </div>
              <Progress value={(results.incorrect / results.totalQuestions) * 100} className="h-2 bg-red-100 dark:bg-red-800/30 [&>div]:bg-red-500 dark:[&>div]:bg-red-400" aria-label={`${((results.incorrect / results.totalQuestions) * 100).toFixed(0)}% Incorrect`}/>

              <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                <span><HelpCircle className="inline h-4 w-4 mr-1"/>Unanswered:</span>
                <span className="font-medium">{results.unanswered}</span>
              </div>
               <Progress value={(results.unanswered / results.totalQuestions) * 100} className="h-2 bg-gray-100 dark:bg-gray-800/30 [&>div]:bg-gray-400 dark:[&>div]:bg-gray-500" aria-label={`${((results.unanswered / results.totalQuestions) * 100).toFixed(0)}% Unanswered`}/>
            </div>
          </div>

           <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700/50 dark:text-blue-300">
               <Info className="h-4 w-4 !text-blue-600 dark:!text-blue-400" />
               <AlertTitle>Ranking & History Note</AlertTitle>
               <AlertDescription>
                 Overall ranking and history across multiple attempts require a backend database. This page shows results for this specific attempt stored locally.
               </AlertDescription>
           </Alert>

           <Card className="bg-primary/5 dark:bg-primary/10 border-primary/20 dark:border-primary/30">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2 text-primary dark:text-primary-light">
                <Sparkles className="h-5 w-5" /> AI Performance Insights
              </CardTitle>
            </CardHeader>
             {/* Container for MathJax rendering */}
             <CardContent id="ai-analysis-content" className="prose prose-sm dark:prose-invert max-w-none text-primary/80 dark:text-primary-light/80">
                {/* Render AI analysis text, replace MathJax delimiters */}
                <div dangerouslySetInnerHTML={{ __html: aiAnalysis.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }} />
            </CardContent>
          </Card>

        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-center gap-3 p-6 border-t border-border">
            <Button variant="outline" asChild>
                <Link href={`/chapterwise-test-review/${testCode}?userId=${userId}&attemptId=${attemptId}`}>
                    <BarChart2 className="mr-2 h-4 w-4" /> Review Answers
                </Link>
            </Button>
            <Button asChild>
                <Link href="/tests"><RefreshCw className="mr-2 h-4 w-4" /> Take Another Test</Link>
            </Button>
             <Button variant="secondary" disabled>
                <Share2 className="mr-2 h-4 w-4" /> Share Results (Coming Soon)
            </Button>
        </CardFooter>
      </Card>
    </div>
    </>
  );
}
