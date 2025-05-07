
'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle, HelpCircle, Info, Loader2, XCircle } from 'lucide-react';
import Link from 'next/link';
import type { TestSession, TestResultSummary, GeneratedTest, QuestionStatus } from '@/types'; // Added QuestionStatus
import { QuestionStatus as QuestionStatusEnum } from '@/types'; // Import enum directly for usage
import { Skeleton } from '@/components/ui/skeleton';
import { getGeneratedTestByCode } from '@/actions/generated-test-actions';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const QUESTION_STATUS_DISPLAY_CLASSES: Record<QuestionStatus, string> = {
    [QuestionStatusEnum.Answered]: "border-green-500 bg-green-50",
    [QuestionStatusEnum.Unanswered]: "border-red-500 bg-red-50",
    [QuestionStatusEnum.MarkedForReview]: "border-purple-500 bg-purple-50",
    [QuestionStatusEnum.AnsweredAndMarked]: "border-blue-500 bg-blue-50",
    [QuestionStatusEnum.NotVisited]: "border-gray-300 bg-gray-50",
};


export default function TestReviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const testCode = params.testCode as string;
  const userId = searchParams.get('userId');
  const attemptId = searchParams.get('attemptId');

  const [testSession, setTestSession] = useState<TestSession | null>(null);
  const [testDefinition, setTestDefinition] = useState<GeneratedTest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionReviewIndex, setCurrentQuestionReviewIndex] = useState(0);

  // MathJax typesetting
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).MathJax) {
      (window as any).MathJax.typesetPromise?.();
    }
  }, [currentQuestionReviewIndex, testDefinition, testSession]);


  useEffect(() => {
    if (authLoading) return;
    if (!user) {
        router.push(`/auth/login?redirect=/chapterwise-test-review/${testCode}?userId=${userId}&attemptId=${attemptId}`);
        return;
    }
    if (user.id.toString() !== userId) {
        setError("You are not authorized to view this review.");
        setIsLoading(false);
        return;
    }

    async function fetchReviewData() {
      if (!testCode || !userId || !attemptId) {
        setError("Missing information to load test review.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const testDefData = await getGeneratedTestByCode(testCode);
        if (!testDefData || testDefData.testType !== 'chapterwise' || !testDefData.questions) {
          throw new Error("Original test definition not found or invalid.");
        }
        setTestDefinition(testDefData);

        const storedSessionJson = localStorage.getItem(`testResult-${attemptId}`);
        if (!storedSessionJson) {
          throw new Error("Test attempt data not found for review.");
        }
        const sessionData: TestSession = JSON.parse(storedSessionJson);
        setTestSession(sessionData);

      } catch (err: any) {
        console.error("Error fetching review data:", err);
        setError(err.message || "Failed to load test review.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchReviewData();
  }, [testCode, userId, attemptId, authLoading, user, router]);

  const currentReviewQuestion = testDefinition?.questions?.[currentQuestionReviewIndex];
  const currentUserAnswerDetailed = testSession?.answers.find(ans => {
    // Heuristic: Try to match by question text/image if ID is not available from TestQuestion
    const qDef = testDefinition?.questions?.[ans.questionId ? parseInt(ans.questionId.replace('q-','')) : -1 ];
    if (qDef && ans.questionId === (currentReviewQuestion?.id || `q-${currentQuestionReviewIndex}`)) return true;
    // Fallback match by index if questionId is not available or doesn't match
    return testDefinition?.questions?.[currentQuestionReviewIndex] === qDef;
  });


  if (isLoading || authLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Skeleton className="h-10 w-3/4 mb-4" />
        <Skeleton className="h-8 w-1/2 mb-8" />
        <Card>
          <CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-20 w-full" />
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
        <h1 className="text-2xl font-bold text-destructive mb-2">Error Loading Review</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button asChild>
          <Link href={`/chapterwise-test-results/${testCode}?userId=${userId}&attemptId=${attemptId}`}>Back to Results</Link>
        </Button>
      </div>
    );
  }

  if (!testDefinition || !testSession || !currentReviewQuestion) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl text-center">
        <HelpCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Review Data Not Available</h1>
        <p className="text-muted-foreground mb-6">Could not load the necessary data for this test review.</p>
         <Button asChild>
          <Link href={`/chapterwise-test-results/${testCode}?userId=${userId}&attemptId=${attemptId}`}>Back to Results</Link>
        </Button>
      </div>
    );
  }
  const totalQuestions = testDefinition.questions?.length || 0;
  const optionKeys = ["A", "B", "C", "D"];
  const correctOptionKey = currentReviewQuestion.answer.replace('Option ', '').trim();
  const userSelectedOptionKey = currentUserAnswerDetailed?.selectedOption;
  const isUserCorrect = userSelectedOptionKey === correctOptionKey;


  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl space-y-6">
      <div className="flex justify-between items-center">
        <Button variant="outline" asChild>
            <Link href={`/chapterwise-test-results/${testCode}?userId=${userId}&attemptId=${attemptId}`}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Results
            </Link>
        </Button>
         <h1 className="text-2xl font-bold text-center truncate flex-1 mx-4">Review: {testDefinition.name}</h1>
      </div>


      <Card className={cn("shadow-md", currentUserAnswerDetailed && QUESTION_STATUS_DISPLAY_CLASSES[currentUserAnswerDetailed.status])}>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Question {currentQuestionReviewIndex + 1} of {totalQuestions}</span>
            <Badge variant="secondary">Marks: {currentReviewQuestion.marks}</Badge>
          </CardTitle>
           {currentUserAnswerDetailed?.status && (
                <Badge
                    variant={isUserCorrect ? 'default' : 'destructive'}
                    className={cn("text-xs w-fit", isUserCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}
                 >
                   Status: {currentUserAnswerDetailed.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} {/* Nicer formatting */}
                </Badge>
            )}
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none prose-sm md:prose-base space-y-4">
          {currentReviewQuestion.type === 'image' && currentReviewQuestion.image_url ? (
            <Image src={currentReviewQuestion.image_url} alt={`Question ${currentQuestionReviewIndex + 1}`} width={600} height={400} className="rounded-md border max-w-full h-auto mx-auto" data-ai-hint="question diagram physics"/>
          ) : currentReviewQuestion.question ? (
            <div dangerouslySetInnerHTML={{ __html: currentReviewQuestion.question.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }} />
          ) : (
            <p>Question content not available.</p>
          )}

          <div className="space-y-2 pt-4 border-t mt-4">
            <p className="font-semibold">Options:</p>
            {currentReviewQuestion.options.map((optionText, idx) => {
              const optionKey = optionKeys[idx];
              const isSelected = userSelectedOptionKey === optionKey;
              const isCorrect = correctOptionKey === optionKey;
              let optionStyle = "border-gray-300";
              if (isSelected && isCorrect) optionStyle = "border-green-500 bg-green-50 text-green-700 ring-2 ring-green-500";
              else if (isSelected && !isCorrect) optionStyle = "border-red-500 bg-red-50 text-red-700 ring-2 ring-red-500";
              else if (isCorrect) optionStyle = "border-green-500 bg-green-50 text-green-700";

              return (
                <div key={optionKey} className={cn("flex items-start space-x-3 p-3 border rounded-md", optionStyle)}>
                  <span className="font-medium">{optionKey}.</span>
                  {currentReviewQuestion.type === 'text' && optionText ? (
                     <div className="prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: optionText.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }} />
                  ) : (
                    <span>{optionText}</span>
                  )}
                  {isSelected && isCorrect && <CheckCircle className="h-5 w-5 text-green-600 ml-auto flex-shrink-0" />}
                  {isSelected && !isCorrect && <XCircle className="h-5 w-5 text-red-600 ml-auto flex-shrink-0" />}
                  {!isSelected && isCorrect && <CheckCircle className="h-5 w-5 text-green-600 ml-auto flex-shrink-0 opacity-70" />}
                </div>
              );
            })}
          </div>

          {/* Explanation Section */}
          {(currentReviewQuestion.explanation || (currentUserAnswerDetailed && !isUserCorrect)) && (
            <div className="mt-6 pt-4 border-t">
              <h4 className="font-semibold text-lg mb-2 flex items-center">
                 <Info className="h-5 w-5 mr-2 text-primary"/> Explanation
              </h4>
              {currentReviewQuestion.explanation ? (
                  <div className="prose-sm dark:prose-invert max-w-none bg-muted/30 p-3 rounded-md"
                       dangerouslySetInnerHTML={{ __html: currentReviewQuestion.explanation.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }} />
              ) : (
                 <p className="text-muted-foreground text-sm">No detailed explanation provided for this question.</p>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between mt-4">
          <Button onClick={() => setCurrentQuestionReviewIndex(prev => Math.max(0, prev - 1))} disabled={currentQuestionReviewIndex === 0}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Previous
          </Button>
          <Button onClick={() => setCurrentQuestionReviewIndex(prev => Math.min(totalQuestions - 1, prev + 1))} disabled={currentQuestionReviewIndex === totalQuestions - 1}>
            Next <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}


