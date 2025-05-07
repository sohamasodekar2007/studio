// src/app/chapterwise-test-review/[testCode]/page.tsx
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle, HelpCircle, Info, Loader2, XCircle } from 'lucide-react';
import Link from 'next/link';
import type { TestSession, GeneratedTest, QuestionStatus, TestQuestion } from '@/types';
import { QuestionStatus as QuestionStatusEnum } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { getGeneratedTestByCode } from '@/actions/generated-test-actions';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Script from 'next/script';

const QUESTION_STATUS_BADGE_VARIANTS: Record<QuestionStatus, "default" | "secondary" | "destructive" | "outline"> = {
    [QuestionStatusEnum.Answered]: "default",
    [QuestionStatusEnum.Unanswered]: "destructive",
    [QuestionStatusEnum.MarkedForReview]: "secondary",
    [QuestionStatusEnum.AnsweredAndMarked]: "default",
    [QuestionStatusEnum.NotVisited]: "outline",
};

const OPTION_STYLES = {
  base: "border-border hover:border-primary dark:border-gray-700 dark:hover:border-primary",
  selectedCorrect: "border-green-500 bg-green-500/10 text-green-700 dark:border-green-400 dark:bg-green-700/20 dark:text-green-300 ring-2 ring-green-500 dark:ring-green-400",
  selectedIncorrect: "border-red-500 bg-red-500/10 text-red-700 dark:border-red-400 dark:bg-red-700/20 dark:text-red-300 ring-2 ring-red-500 dark:ring-red-400",
  correctUnselected: "border-green-500 bg-green-500/10 text-green-700 dark:border-green-400 dark:bg-green-700/20 dark:text-green-300",
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

   const typesetMathJax = useCallback(() => {
       if (typeof window !== 'undefined' && (window as any).MathJax) {
           (window as any).MathJax.typesetPromise?.().catch((err: any) => console.error("MathJax typeset error in review page:", err));
       }
   }, []);

   useEffect(() => {
       // Typeset MathJax when the relevant data changes
       typesetMathJax();
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [currentQuestionReviewIndex, testDefinition, testSession, typesetMathJax]);

  const fetchReviewData = useCallback(async () => {
    if (!testCode || !userId || !attemptId) {
      setError("Missing information to load test review.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const testDefData = await getGeneratedTestByCode(testCode);
      if (!testDefData) {
          throw new Error("Original test definition not found.");
      }
       if (testDefData.testType === 'chapterwise' && (!testDefData.questions || testDefData.questions.length === 0)) {
          throw new Error("Test definition is invalid or has no questions.");
       } else if (testDefData.testType === 'full_length' && 
                  !(testDefData.physics || testDefData.chemistry || testDefData.maths || testDefData.biology)?.some(arr => arr && arr.length > 0)
       ) {
           throw new Error("Full length test definition is invalid or has no questions in any subject section.");
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
  }, [testCode, userId, attemptId]);

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
    fetchReviewData();
  }, [testCode, userId, attemptId, authLoading, user, router, fetchReviewData]);


    const allQuestions = useMemo(() => {
        if (!testDefinition) return [];
        if (testDefinition.testType === 'chapterwise') {
            return testDefinition.questions || [];
        } else if (testDefinition.testType === 'full_length') {
            return [
                ...(testDefinition.physics || []),
                ...(testDefinition.chemistry || []),
                ...(testDefinition.maths || []),
                ...(testDefinition.biology || []),
            ].filter(q => q); // Filter out undefined arrays if a subject is missing
        }
        return [];
    }, [testDefinition]);


  const currentReviewQuestion: TestQuestion | undefined = allQuestions?.[currentQuestionReviewIndex];
  const currentUserAnswerDetailed = testSession?.answers?.[currentQuestionReviewIndex];


  if (isLoading || authLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
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
      <div className="container mx-auto py-8 px-4 max-w-3xl text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-destructive mb-2">Error Loading Review</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button asChild>
          <Link href="/tests">Go to Test Series</Link>
        </Button>
      </div>
    );
  }

  if (!testDefinition || !testSession || !currentReviewQuestion || !currentUserAnswerDetailed) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl text-center">
        <HelpCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Review Data Not Available</h1>
        <p className="text-muted-foreground mb-6">We could not load the necessary data for this test review.</p>
         <Button asChild>
          <Link href={`/chapterwise-test-results/${testCode}?userId=${userId}&attemptId=${attemptId}`}>Back to Results</Link>
        </Button>
      </div>
    );
  }

  const totalQuestions = allQuestions.length || 0;
  const optionKeys = ["A", "B", "C", "D"];
  // Handle cases where answer might not start with "Option "
  const correctOptionKey = currentReviewQuestion.answer?.startsWith('Option ') 
                           ? currentReviewQuestion.answer.replace('Option ', '').trim() 
                           : currentReviewQuestion.answer;
  const userSelectedOptionKey = currentUserAnswerDetailed?.selectedOption;
  const isUserCorrect = userSelectedOptionKey === correctOptionKey;
  const questionStatus = currentUserAnswerDetailed?.status || QuestionStatusEnum.NotVisited;

    const renderContent = (text: string | undefined | null, imageUrl: string | undefined | null, isQuestion: boolean = false) => {
        // For image questions/explanations, imageUrl will be the direct public path
        if (imageUrl && (isQuestion && currentReviewQuestion.type === 'image' || !isQuestion)) {
            return (
                 <div className="relative w-full max-w-lg h-64 mx-auto md:h-80 lg:h-96 my-4">
                    <Image src={imageUrl} alt={isQuestion ? "Question Image" : "Explanation Image"} layout="fill" objectFit="contain" className="rounded-md border" data-ai-hint={isQuestion ? "question diagram" : "explanation image"}/>
                 </div>
             );
        } else if (text) { // For text questions/explanations
             return (
                 <div
                    className="prose prose-sm dark:prose-invert max-w-none text-foreground"
                    dangerouslySetInnerHTML={{ __html: text.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}
                 />
             );
        }
        return <p className="text-muted-foreground text-sm">[Content not available]</p>;
    };


  return (
    <>
    <Script
        src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
        strategy="lazyOnload"
        onLoad={() => {
            console.log('MathJax loaded for review page');
            typesetMathJax(); // Typeset MathJax once the script is loaded
        }}
      />
    <div className="container mx-auto py-8 px-4 max-w-3xl space-y-6">
      <div className="flex justify-between items-center">
        <Button variant="outline" asChild>
            <Link href={`/chapterwise-test-results/${testCode}?userId=${userId}&attemptId=${attemptId}`}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Results
            </Link>
        </Button>
         <h1 className="text-2xl font-bold text-center truncate flex-1 mx-4">{testDefinition.name}</h1>
      </div>

      <Card className="shadow-md bg-card text-card-foreground">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Question {currentQuestionReviewIndex + 1} of {totalQuestions}</CardTitle>
            <Badge variant="outline">Marks: {currentReviewQuestion.marks}</Badge>
          </div>
           {currentUserAnswerDetailed?.status && (
                <Badge
                    variant={QUESTION_STATUS_BADGE_VARIANTS[questionStatus]}
                    className={cn("text-xs w-fit mt-2", {
                        "bg-green-100 text-green-700 dark:bg-green-700/20 dark:text-green-300": questionStatus === QuestionStatusEnum.Answered && isUserCorrect,
                        "bg-red-100 text-red-700 dark:bg-red-700/20 dark:text-red-300": (questionStatus === QuestionStatusEnum.Answered && !isUserCorrect) || questionStatus === QuestionStatusEnum.Unanswered,
                        "bg-purple-100 text-purple-700 dark:bg-purple-700/20 dark:text-purple-300": questionStatus === QuestionStatusEnum.MarkedForReview,
                        "bg-blue-100 text-blue-700 dark:bg-blue-700/20 dark:text-blue-300": questionStatus === QuestionStatusEnum.AnsweredAndMarked,
                        "border-gray-400 text-gray-600 dark:border-gray-600 dark:text-gray-400": questionStatus === QuestionStatusEnum.NotVisited,
                    })}
                 >
                   Status: {questionStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Badge>
            )}
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="mb-4 pb-4 border-b border-border">
                 {renderContent(currentReviewQuestion?.question_text, currentReviewQuestion?.question_image_url, true)}
            </div>

          <div className="space-y-2 pt-4">
            <p className="font-semibold text-card-foreground">Options:</p>
            {currentReviewQuestion?.options.map((optionText, idx) => {
              const optionKey = optionKeys[idx];
              const isSelected = userSelectedOptionKey === optionKey;
              const isCorrectOption = correctOptionKey === optionKey;
              let optionStyleClass = OPTION_STYLES.base;
              if (isSelected && isCorrectOption) optionStyleClass = cn(OPTION_STYLES.base, OPTION_STYLES.selectedCorrect);
              else if (isSelected && !isCorrectOption) optionStyleClass = cn(OPTION_STYLES.base, OPTION_STYLES.selectedIncorrect);
              else if (isCorrectOption) optionStyleClass = cn(OPTION_STYLES.base, OPTION_STYLES.correctUnselected);

              return (
                <div key={optionKey} className={cn("flex items-start space-x-3 p-3 border rounded-md", optionStyleClass)}>
                  <span className="font-medium mt-0.5">{optionKey}.</span>
                   <div className="flex-1">
                        {renderContent(optionText, null)}
                   </div>
                  {isSelected && isCorrectOption && <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 ml-auto flex-shrink-0" />}
                  {isSelected && !isCorrectOption && <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 ml-auto flex-shrink-0" />}
                  {!isSelected && isCorrectOption && <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 ml-auto flex-shrink-0 opacity-70" />}
                </div>
              );
            })}
          </div>

          {(currentReviewQuestion.explanation_text || currentReviewQuestion.explanation_image_url) && (
            <div className="mt-6 pt-4 border-t border-border">
              <h4 className="font-semibold text-lg mb-2 flex items-center text-card-foreground">
                 <Info className="h-5 w-5 mr-2 text-primary"/> Explanation
              </h4>
              <div className="bg-muted/50 dark:bg-muted/20 p-3 rounded-md">
                 {renderContent(currentReviewQuestion.explanation_text, currentReviewQuestion.explanation_image_url, false)}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between mt-4 p-8 border-t border-border">
          <Button onClick={() => setCurrentQuestionReviewIndex(prev => Math.max(0, prev - 1))} disabled={currentQuestionReviewIndex === 0}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Previous
          </Button>
          <Button onClick={() => setCurrentQuestionReviewIndex(prev => Math.min(totalQuestions - 1, prev + 1))} disabled={currentQuestionReviewIndex === totalQuestions - 1}>
            Next <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </div>
    </>
  );
}

