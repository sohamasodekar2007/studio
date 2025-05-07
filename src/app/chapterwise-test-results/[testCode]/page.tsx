
'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Award, BarChart2, CheckCircle, Clock, HelpCircle, MessageSquare, RefreshCw, Share2, XCircle, Sparkles } from 'lucide-react'; // Added Sparkles
import Link from 'next/link';
import type { TestSession, TestResultSummary, GeneratedTest } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
// Placeholder for fetching actual test data to get total marks, etc.
import { getGeneratedTestByCode } from '@/actions/generated-test-actions';

// This would eventually come from a server action that processes the TestSession
// and compares against correct answers from the original TestDefinition JSON
function calculateResults(session: TestSession, testDef: GeneratedTest | null): TestResultSummary | null {
    if (!testDef || !testDef.questions) return null;

    let correctCount = 0;
    let incorrectCount = 0;
    let attemptedCount = 0;
    let totalMarksPossible = 0;
    let score = 0;

    const detailedAnswers = session.answers.map((userAns, index) => {
        const questionDef = testDef.questions?.[index];
        if (!questionDef) return { questionIndex: index, userAnswer: null, correctAnswer: 'N/A', isCorrect: false, status: userAns.status, questionTextOrImage: 'Error: Question not found' };

        totalMarksPossible += questionDef.marks;
        let isCorrect = false;
        const correctAnswerKey = questionDef.answer.replace('Option ', '').trim(); // "Option A" -> "A"

        if (userAns.selectedOption) {
            attemptedCount++;
            if (userAns.selectedOption === correctAnswerKey) {
                isCorrect = true;
                correctCount++;
                score += questionDef.marks;
            } else {
                incorrectCount++;
                // Add negative marking logic here if applicable
            }
        }
        return {
            questionIndex: index,
            questionTextOrImage: questionDef.question, // Or image_url
            userAnswer: userAns.selectedOption,
            correctAnswer: correctAnswerKey,
            isCorrect,
            status: userAns.status,
            explanation: questionDef.explanation,
        };
    });

    const unansweredCount = testDef.questions.length - attemptedCount;
    const percentage = totalMarksPossible > 0 ? (score / totalMarksPossible) * 100 : 0;
    const timeTakenSeconds = session.endTime ? (session.endTime - session.startTime) / 1000 : 0;
    const timeTakenMinutes = Math.round(timeTakenSeconds / 60);


    return {
        testCode: session.testId,
        userId: session.userId,
        testName: testDef.name,
        attemptId: `${session.testId}-${session.userId}-${session.startTime}`, // Reconstruct or pass from URL
        submittedAt: session.endTime ? new Date(session.endTime).toISOString() : new Date().toISOString(),
        totalQuestions: testDef.questions.length,
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
  const attemptId = searchParams.get('attemptId'); // Used to fetch specific attempt

  const [results, setResults] = useState<TestResultSummary | null>(null);
  const [testDefinition, setTestDefinition] = useState<GeneratedTest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
        router.push(`/auth/login?redirect=/chapterwise-test-results/${testCode}?userId=${userId}&attemptId=${attemptId}`);
        return;
    }
    if (user.id.toString() !== userId) {
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
        setTestDefinition(testDefData);

        // 2. Fetch the specific test attempt from local storage
        const storedSessionJson = localStorage.getItem(`testResult-${attemptId}`);
        if (!storedSessionJson) {
          throw new Error("Test attempt data not found. Results might be processed or missing.");
        }
        const sessionData: TestSession = JSON.parse(storedSessionJson);

        // 3. Calculate results (client-side for this demo)
        const calculated = calculateResults(sessionData, testDefData);
        if (!calculated) {
            throw new Error("Could not process test results.");
        }
        setResults(calculated);

      } catch (err: any) {
        console.error("Error fetching results:", err);
        setError(err.message || "Failed to load test results.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchResults();
  }, [testCode, userId, attemptId, authLoading, user, router]);

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

  if (!results) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl text-center">
        <HelpCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Results Not Available</h1>
        <p className="text-muted-foreground mb-6">We could not find the results for this test attempt.</p>
        <Button asChild>
          <Link href="/tests">Go to Test Series</Link>
        </Button>
      </div>
    );
  }

  // AI Performance Analysis Placeholder
  const aiAnalysis = `Based on your performance in ${results.testName}:
- You demonstrated strength in questions related to [Strong Topic 1] and [Strong Topic 2].
- Areas for improvement include [Weak Topic 1] and concepts like [Specific Concept].
- Focus on revising [Weak Topic 1] fundamentals and practicing more problems from [Specific Concept].
- Your time management was [Good/Okay/Needs Improvement]. Try to allocate time more evenly across questions.
Keep practicing! Consistency is key.`;


  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl space-y-8">
      <Card className="shadow-lg">
        <CardHeader className="bg-primary/10 p-6">
          <CardTitle className="text-3xl font-bold text-primary text-center">{results.testName} - Results</CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Attempt ID: {results.attemptId} | Submitted: {new Date(results.submittedAt).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <Card className="p-4 bg-muted/40">
              <CardTitle className="text-4xl font-bold text-green-600">{results.score}</CardTitle>
              <CardDescription>Score / {results.totalQuestions * (testDefinition?.questions?.[0]?.marks || 1)}</CardDescription>
            </Card>
            <Card className="p-4 bg-muted/40">
              <CardTitle className="text-4xl font-bold text-blue-600">{results.percentage.toFixed(2)}%</CardTitle>
              <CardDescription>Percentage</CardDescription>
            </Card>
            <Card className="p-4 bg-muted/40">
              <CardTitle className="text-4xl font-bold text-purple-600">{results.timeTakenMinutes} mins</CardTitle>
              <CardDescription>Time Taken</CardDescription>
            </Card>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-2">Performance Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>Total Questions:</span>
                <span className="font-medium">{results.totalQuestions}</span>
              </div>
              <Progress value={(results.attempted / results.totalQuestions) * 100} className="h-2 bg-gray-200 [&>div]:bg-gray-500" />

              <div className="flex justify-between items-center text-green-600">
                <span><CheckCircle className="inline h-4 w-4 mr-1"/>Correct Answers:</span>
                <span className="font-medium">{results.correct}</span>
              </div>
              <Progress value={(results.correct / results.totalQuestions) * 100} className="h-2 bg-green-100 [&>div]:bg-green-500" />

              <div className="flex justify-between items-center text-red-600">
                <span><XCircle className="inline h-4 w-4 mr-1"/>Incorrect Answers:</span>
                <span className="font-medium">{results.incorrect}</span>
              </div>
              <Progress value={(results.incorrect / results.totalQuestions) * 100} className="h-2 bg-red-100 [&>div]:bg-red-500"/>

              <div className="flex justify-between items-center text-gray-600">
                <span><HelpCircle className="inline h-4 w-4 mr-1"/>Unanswered:</span>
                <span className="font-medium">{results.unanswered}</span>
              </div>
               <Progress value={(results.unanswered / results.totalQuestions) * 100} className="h-2 bg-gray-100 [&>div]:bg-gray-400"/>
            </div>
          </div>

          {/* AI Generated Performance Analysis */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2 text-primary">
                <Sparkles className="h-5 w-5" /> AI Performance Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-line text-primary/80">{aiAnalysis}</p>
            </CardContent>
          </Card>

        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-center gap-3 p-6 border-t">
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
  );
}

