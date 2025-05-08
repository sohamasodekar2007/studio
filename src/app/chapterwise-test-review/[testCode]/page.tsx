// src/app/chapterwise-test-review/[testCode]/page.tsx
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle, HelpCircle, Info, Loader2, XCircle, Eye } from 'lucide-react';
import Link from 'next/link';
import type { TestResultSummary, QuestionStatus, TestQuestion } from '@/types'; // Removed GeneratedTest import
import { QuestionStatus as QuestionStatusEnum } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { getTestReport } from '@/actions/test-report-actions'; // Import action to get specific report
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Script from 'next/script';
import ImageViewDialog from '@/components/notebooks/image-view-dialog';

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
  correctUnselected: "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300",
  correctImageOption: "border-green-500 bg-green-500/10 text-green-700 dark:border-green-400 dark:bg-green-700/20 dark:text-green-300",
};

// Removed constructImagePath helper as paths should be directly in reportData

export default function TestReviewPage() {
  // --- Hooks called unconditionally at the top ---
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [testReport, setTestReport] = useState<TestResultSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionReviewIndex, setCurrentQuestionReviewIndex] = useState(0);
  const [isImageViewOpen, setIsImageViewOpen] = useState(false);
  const [imageToView, setImageToView] = useState<{url: string, alt: string} | null>(null);

  const testCode = params.testCode as string;
  const userId = searchParams.get('userId');
  const attemptTimestampStr = searchParams.get('attemptTimestamp'); // Get timestamp as string

  const typesetMathJax = useCallback(() => {
       if (typeof window !== 'undefined' && (window as any).MathJax) {
           console.log("Attempting MathJax typesetting on review page...");
           (window as any).MathJax.typesetPromise?.().catch((err: any) => console.error("MathJax typeset error in review page:", err));
       }
   }, []);

  const fetchReviewData = useCallback(async () => {
    if (!testCode || !userId || !attemptTimestampStr) {
      setError("Missing information to load test review.");
      setIsLoading(false);
      return;
    }
    const attemptTimestamp = parseInt(attemptTimestampStr, 10);
    if (isNaN(attemptTimestamp)) {
        setError("Invalid attempt identifier.");
        setIsLoading(false);
        return;
    }

    setIsLoading(true);
    setError(null);
    try {
        const reportData = await getTestReport(userId, testCode, attemptTimestamp);

        if (!reportData) {
            throw new Error(`Test attempt data not found for this attempt.`);
        }
         console.log("Fetched report data:", reportData); // Debug log
        setTestReport(reportData);

    } catch (err: any) {
      console.error("Error fetching review data:", err);
      setError(err.message || "Failed to load test review.");
    } finally {
      setIsLoading(false);
    }
  }, [testCode, userId, attemptTimestampStr]);

  // --- Effects ---
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
        router.push(`/auth/login?redirect=/chapterwise-test-review/${testCode}?userId=${userId}&attemptTimestamp=${attemptTimestampStr}`);
        return;
    }
     if (user && userId && user.id !== userId) {
        setError("You are not authorized to view this review.");
        setIsLoading(false);
        return;
    }
    fetchReviewData();
  }, [testCode, userId, attemptTimestampStr, authLoading, user, router, fetchReviewData]);

  useEffect(() => {
      if (testReport) {
          typesetMathJax();
      }
  }, [currentQuestionReviewIndex, testReport, typesetMathJax]);

  // --- Memoized values (called after hooks) ---
  const allAnswersFromReport = useMemo(() => testReport?.detailedAnswers || [], [testReport]);
  const currentUserAnswerDetailed = useMemo(() => allAnswersFromReport?.[currentQuestionReviewIndex], [allAnswersFromReport, currentQuestionReviewIndex]);
  const totalQuestions = useMemo(() => allAnswersFromReport.length || 0, [allAnswersFromReport]);
  const optionKeys = useMemo(() => ["A", "B", "C", "D"], []);
  // Updated correctAnswer logic
  const correctOptionKey = useMemo(() => {
    const answer = currentUserAnswerDetailed?.correctAnswer;
    if (!answer) return undefined;
    // Handle both "Option X" and just "X" formats
    return answer.startsWith("Option ") ? answer.replace('Option ', '').trim() : answer.trim();
  }, [currentUserAnswerDetailed]);
  const userSelectedOptionKey = useMemo(() => currentUserAnswerDetailed?.selectedOption, [currentUserAnswerDetailed]);
  const isUserCorrect = useMemo(() => userSelectedOptionKey === correctOptionKey, [userSelectedOptionKey, correctOptionKey]);
  const questionStatus = useMemo(() => currentUserAnswerDetailed?.status || QuestionStatusEnum.NotVisited, [currentUserAnswerDetailed]);

  const optionsToDisplay = useMemo(() => {
    if (!currentUserAnswerDetailed || !currentUserAnswerDetailed.options) {
      return ['', '', '', ''];
    }
    // Ensure options array has 4 elements, padding with empty strings if necessary
    const opts = currentUserAnswerDetailed.options;
    return Array.from({ length: 4 }, (_, i) => opts[i] ?? '');
  }, [currentUserAnswerDetailed]);


  // --- Event Handlers ---
  const handleViewImage = (url: string | null, alt: string) => {
      if (url) {
          setImageToView({ url, alt });
          setIsImageViewOpen(true);
      }
  }

   // --- Conditional Rendering (Moved after all hooks) ---
  if (isLoading || authLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        {/* Skeleton remains the same */}
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

  if (!authLoading && !user) {
     // Handled by useEffect redirect, showing skeleton or nothing while redirecting
     return null;
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-destructive mb-2">Error Loading Review</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button asChild variant="outline">
          <Link href="/tests">Go to Test Series</Link>
        </Button>
      </div>
    );
  }

  if (!testReport) {
      return (
        <div className="container mx-auto py-8 px-4 max-w-3xl text-center">
            <HelpCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Report Data Not Found</h1>
            <p className="text-muted-foreground mb-6">Could not load the test report data for this attempt.</p>
            <Button asChild variant="outline">
                <Link href="/progress">Back to Progress</Link>
            </Button>
        </div>
      );
  }

  if (!currentUserAnswerDetailed) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl text-center">
        <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Question Data Error</h1>
        <p className="text-muted-foreground mb-6">Could not load the details for this specific question ({currentQuestionReviewIndex + 1}).</p>
        <Button onClick={() => setCurrentQuestionReviewIndex(0)} variant="outline">Go to First Question</Button>
      </div>
    );
  }

  // --- Render Content Functions (Now safe to call hooks within) ---
   const renderContentWithMathJax = (
        textContent: string | undefined | null,
        imageUrl: string | undefined | null, // This is the absolute public URL from the report
        context: 'question' | 'explanation'
    ) => {
        let contentToRender: React.ReactNode = null;
        // Ensure the image URL is valid (starts with /)
        const finalImagePath = imageUrl && imageUrl.startsWith('/') ? imageUrl : null;

        if (finalImagePath) {
            contentToRender = (
                 <div className="relative w-full max-w-lg h-64 mx-auto md:h-80 lg:h-96 my-4 cursor-pointer" onClick={() => handleViewImage(finalImagePath, `${context} Image`)}>
                    <Image
                        src={finalImagePath}
                        alt={context === 'question' ? "Question Image" : "Explanation Image"}
                        layout="fill"
                        objectFit="contain"
                        className="rounded-md border"
                        data-ai-hint={context === 'question' ? "question diagram" : "explanation image"}
                        onError={(e) => { console.error(`Error loading image: ${finalImagePath}`, e); (e.target as HTMLImageElement).style.display = 'none'; }}
                        unoptimized
                    />
                 </div>
             );
        } else if (textContent) {
            contentToRender = (
                <div
                    className="prose prose-sm dark:prose-invert max-w-none text-foreground mathjax-content"
                    dangerouslySetInnerHTML={{ __html: textContent.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}
                 />
            );
        } else {
            contentToRender = <p className="text-sm text-muted-foreground">{`[${context === 'question' ? 'Question' : 'Explanation'} content not available]`}</p>;
        }

        return contentToRender;
    };

  // --- Main Render ---
  return (
    <>
     <Script
        id="mathjax-script-review" // Unique ID
        src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
        strategy="lazyOnload"
        onLoad={() => {
            console.log('MathJax loaded for review page.');
            // Initial typeset after script loads and component mounts
            typesetMathJax();
        }}
      />
    <div className="container mx-auto py-8 px-4 max-w-3xl space-y-6">
      <div className="flex justify-between items-center">
        <Button variant="outline" size="sm" asChild>
            <Link href={`/chapterwise-test-results/${testCode}?userId=${userId}&attemptTimestamp=${attemptTimestampStr}`}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Results
            </Link>
        </Button>
         <h1 className="text-2xl font-bold text-center truncate flex-1 mx-4">{testReport.testName || 'Test Review'}</h1>
         <div className="w-24"></div>
      </div>

      <Card className="shadow-md bg-card text-card-foreground">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Question {currentQuestionReviewIndex + 1} of {totalQuestions}</CardTitle>
             <Badge variant="outline">Marks: {currentUserAnswerDetailed.marks ?? (testReport?.totalMarks ? (testReport.totalMarks / totalQuestions) : 1)}</Badge>
          </div>
           {currentUserAnswerDetailed.status && (
                <Badge
                    variant={QUESTION_STATUS_BADGE_VARIANTS[questionStatus]}
                    className={cn("text-xs w-fit mt-2", {
                        "bg-green-100 text-green-700 dark:bg-green-700/20 dark:text-green-300 border-green-500": questionStatus === QuestionStatusEnum.Answered && isUserCorrect,
                        "bg-red-100 text-red-700 dark:bg-red-700/20 dark:text-red-300 border-red-500": (questionStatus === QuestionStatusEnum.Answered && !isUserCorrect) || questionStatus === QuestionStatusEnum.Unanswered,
                        "bg-purple-100 text-purple-700 dark:bg-purple-700/20 dark:text-purple-300 border-purple-500": questionStatus === QuestionStatusEnum.MarkedForReview,
                        "bg-blue-100 text-blue-700 dark:bg-blue-700/20 dark:text-blue-300 border-blue-500": questionStatus === QuestionStatusEnum.AnsweredAndMarked,
                        "border-gray-400 text-gray-600 dark:border-gray-600 dark:text-gray-400": questionStatus === QuestionStatusEnum.NotVisited,
                    })}
                 >
                   Status: {questionStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Badge>
            )}
        </CardHeader>
        <CardContent className="space-y-4">
            {/* Render Question */}
            <div className="mb-4 pb-4 border-b border-border">
                 {renderContentWithMathJax(currentUserAnswerDetailed.questionText, currentUserAnswerDetailed.questionImageUrl, 'question')}
            </div>

          {/* Render Options */}
          <div className="space-y-2 pt-4">
            <p className="font-semibold text-card-foreground">Options:</p>
            {optionsToDisplay.map((optionText, idx) => {
              const optionKey = optionKeys[idx];
              const isSelected = userSelectedOptionKey === optionKey;
              const isCorrect = correctOptionKey === optionKey;

              let optionStyleClass = OPTION_STYLES.base;
              if (isSelected && isCorrect) optionStyleClass = cn(OPTION_STYLES.base, OPTION_STYLES.selectedCorrect);
              else if (isSelected && !isCorrect) optionStyleClass = cn(OPTION_STYLES.base, OPTION_STYLES.selectedIncorrect);
              else if (isCorrect) optionStyleClass = cn(OPTION_STYLES.base, OPTION_STYLES.correctUnselected);

              // If it's an image question, use different styling for the correct option label
              if (!currentUserAnswerDetailed.questionText && currentUserAnswerDetailed.questionImageUrl && isCorrect) {
                  optionStyleClass = cn(OPTION_STYLES.base, OPTION_STYLES.correctImageOption)
              }


              return (
                <div key={optionKey} className={cn("flex items-start space-x-3 p-3 border rounded-md", optionStyleClass)}>
                  <span className="font-medium mt-0.5">{optionKey}.</span>
                   <div className="flex-1 mathjax-content" dangerouslySetInnerHTML={{ __html: (optionText || '').replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}>
                   </div>
                  {isSelected && isCorrect && <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 ml-auto flex-shrink-0" />}
                  {isSelected && !isCorrect && <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 ml-auto flex-shrink-0" />}
                  {!isSelected && isCorrect && <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 ml-auto flex-shrink-0 opacity-70" />}
                </div>
              );
            })}
          </div>

          {/* Render Explanation */}
           {(currentUserAnswerDetailed.explanationText || currentUserAnswerDetailed.explanationImageUrl) && (
            <div className="mt-6 pt-4 border-t border-border">
              <h4 className="font-semibold text-lg mb-2 flex items-center text-card-foreground">
                 <Info className="h-5 w-5 mr-2 text-primary"/> Explanation
              </h4>
              <div className="bg-muted/50 dark:bg-muted/20 p-3 rounded-md">
                 {renderContentWithMathJax(currentUserAnswerDetailed.explanationText, currentUserAnswerDetailed.explanationImageUrl, 'explanation')}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between mt-4 p-6 border-t border-border">
          <Button onClick={() => setCurrentQuestionReviewIndex(prev => Math.max(0, prev - 1))} disabled={currentQuestionReviewIndex === 0}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Previous
          </Button>
          <Button onClick={() => setCurrentQuestionReviewIndex(prev => Math.min(totalQuestions - 1, prev + 1))} disabled={currentQuestionReviewIndex >= totalQuestions - 1}>
            Next <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </div>

    {/* Image View Dialog */}
     {imageToView && (
        <ImageViewDialog
            isOpen={isImageViewOpen}
            onClose={() => setIsImageViewOpen(false)}
            imageUrl={imageToView.url}
            altText={imageToView.alt}
        />
    )}
    </>
  );
}
