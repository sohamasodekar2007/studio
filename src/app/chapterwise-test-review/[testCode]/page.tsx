// src/app/chapterwise-test-review/[testCode]/page.tsx
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle, HelpCircle, Info, Loader2, XCircle } from 'lucide-react';
import Link from 'next/link';
import type { TestSession, GeneratedTest, QuestionStatus, TestQuestion, QuestionType } from '@/types';
import { QuestionStatus as QuestionStatusEnum } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { getGeneratedTestByCode } from '@/actions/generated-test-actions';
import { getTestReport } from '@/actions/test-report-actions'; // Import action to get specific report
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Script from 'next/script'; // Ensure Script is imported

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
  // For image questions where there's no explicit "selected" state but we want to highlight the correct one
  correctImageOption: "border-green-500 bg-green-500/10 text-green-700 dark:border-green-400 dark:bg-green-700/20 dark:text-green-300",

};


export default function TestReviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const testCode = params.testCode as string;
  const userId = searchParams.get('userId');
  const attemptTimestampStr = searchParams.get('attemptTimestamp'); // Get timestamp as string

  const [testReport, setTestReport] = useState<TestResultSummary | null>(null); // Store the full report
  const [testDefinition, setTestDefinition] = useState<GeneratedTest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionReviewIndex, setCurrentQuestionReviewIndex] = useState(0);

   const typesetMathJax = useCallback(() => {
       if (typeof window !== 'undefined' && (window as any).MathJax) {
           console.log("Attempting MathJax typesetting on review page...");
           (window as any).MathJax.typesetPromise?.().catch((err: any) => console.error("MathJax typeset error in review page:", err));
       }
   }, []);

   // Typeset whenever the current question index changes, or when data loads initially
   useEffect(() => {
       if (testDefinition && testReport) {
           typesetMathJax();
       }
   }, [currentQuestionReviewIndex, testDefinition, testReport, typesetMathJax]);

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
        // Fetch both concurrently
        const [reportData, testDefData] = await Promise.all([
            getTestReport(userId, testCode, attemptTimestamp),
            getGeneratedTestByCode(testCode).catch(err => {
                console.error("Failed to fetch test definition for review:", err);
                return null; // Allow review even if definition fetch fails (use report data)
            })
        ]);

        if (!reportData) {
            throw new Error(`Test attempt data not found for this attempt.`);
        }

        setTestDefinition(testDefData); // Can be null if fetch failed
        setTestReport(reportData);

    } catch (err: any) {
      console.error("Error fetching review data:", err);
      setError(err.message || "Failed to load test review.");
    } finally {
      setIsLoading(false);
    }
  }, [testCode, userId, attemptTimestampStr]);

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


    const allQuestionsFromReport = useMemo(() => testReport?.detailedAnswers || [], [testReport]);

  const currentReviewAnswer = allQuestionsFromReport?.[currentQuestionReviewIndex];

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

  // Check if report and the specific answer detail exist
  if (!testReport || !currentReviewAnswer) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl text-center">
        <HelpCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Review Data Not Available</h1>
        <p className="text-muted-foreground mb-6">We could not load the necessary data for this test review.</p>
         <Button asChild>
          <Link href={`/chapterwise-test-results/${testCode}?userId=${userId}&attemptTimestamp=${attemptTimestampStr}`}>Back to Results</Link>
        </Button>
      </div>
    );
  }

  const totalQuestions = allQuestionsFromReport.length || 0;
  const optionKeys = ["A", "B", "C", "D"];
  const correctOptionKey = currentReviewAnswer?.correctAnswer; // Already stored as key "A", "B", etc.
  const userSelectedOptionKey = currentReviewAnswer?.userAnswer;
  const isUserCorrect = currentReviewAnswer?.isCorrect;
  const questionStatus = currentReviewAnswer?.status || QuestionStatusEnum.NotVisited;

  // Get options from the test definition if available, otherwise use placeholder
  const currentQuestionDefinition = testDefinition ? getAllQuestionsFromTest(testDefinition)[currentQuestionReviewIndex] : null;
  const optionsToDisplay = currentQuestionDefinition?.options || ["A", "B", "C", "D"]; // Fallback if definition fails


    // Function to render content, handling both text and image, and applying MathJax transformation
    const renderContentWithMathJax = (
        textContent: string | undefined | null,
        imageUrl: string | undefined | null, // This is the RELATIVE public URL from report/definition
        context: 'question' | 'explanation'
    ) => {
        let contentToRender: React.ReactNode = null;

        // Determine if it's an image content
        const isImageContent = !!imageUrl;

        if (isImageContent && imageUrl) {
            contentToRender = (
                 <div className="relative w-full max-w-lg h-64 mx-auto md:h-80 lg:h-96 my-4">
                    <Image
                        src={imageUrl} // Use the URL directly
                        alt={context === 'question' ? "Question Image" : "Explanation Image"}
                        layout="fill"
                        objectFit="contain"
                        className="rounded-md border"
                        data-ai-hint={context === 'question' ? "question diagram" : "explanation image"}
                        onError={(e) => console.error(`Error loading image: ${imageUrl}`, e)} // Add error handling for images
                    />
                 </div>
             );
        } else if (textContent) {
            // Render using dangerouslySetInnerHTML for MathJax to process
            contentToRender = (
                <div
                    className="prose prose-sm dark:prose-invert max-w-none text-foreground mathjax-content" // Added class for targeting
                    dangerouslySetInnerHTML={{ __html: textContent }} // Assume textContent already has MathJax delimiters if needed
                 />
            );
        } else {
            contentToRender = <p className="text-sm text-muted-foreground">{`[${context === 'question' ? 'Question' : 'Explanation'} content not available]`}</p>;
        }

        return contentToRender;
    };


  return (
    <>
     {/* MathJax Script */}
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
        <Button variant="outline" asChild>
            <Link href={`/chapterwise-test-results/${testCode}?userId=${userId}&attemptTimestamp=${attemptTimestampStr}`}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Results
            </Link>
        </Button>
         <h1 className="text-2xl font-bold text-center truncate flex-1 mx-4">{testReport.testName || 'Test Review'}</h1>
         {/* Placeholder for potential navigation buttons or info */}
         <div className="w-24"></div>
      </div>

      <Card className="shadow-md bg-card text-card-foreground">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Question {currentQuestionReviewIndex + 1} of {totalQuestions}</CardTitle>
             {/* Use total marks from report if available */}
             <Badge variant="outline">Marks: {currentQuestionDefinition?.marks ?? (testReport?.totalMarks ? (testReport.totalMarks / totalQuestions) : 1)}</Badge>
          </div>
           {currentReviewAnswer?.status && (
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
                 {renderContentWithMathJax(currentReviewAnswer?.questionText, currentReviewAnswer?.questionImageUrl, 'question')}
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

              return (
                <div key={optionKey} className={cn("flex items-start space-x-3 p-3 border rounded-md", optionStyleClass)}>
                  <span className="font-medium mt-0.5">{optionKey}.</span>
                   <div className="flex-1">
                        {/* Render option text with MathJax support */}
                         {renderContentWithMathJax(optionText, null, 'question')}
                   </div>
                  {isSelected && isCorrect && <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 ml-auto flex-shrink-0" />}
                  {isSelected && !isCorrect && <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 ml-auto flex-shrink-0" />}
                  {!isSelected && isCorrect && <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 ml-auto flex-shrink-0 opacity-70" />}
                </div>
              );
            })}
          </div>

          {/* Render Explanation */}
           {(currentReviewAnswer.explanationText || currentReviewAnswer.explanationImageUrl) && (
            <div className="mt-6 pt-4 border-t border-border">
              <h4 className="font-semibold text-lg mb-2 flex items-center text-card-foreground">
                 <Info className="h-5 w-5 mr-2 text-primary"/> Explanation
              </h4>
              <div className="bg-muted/50 dark:bg-muted/20 p-3 rounded-md">
                 {renderContentWithMathJax(currentReviewAnswer.explanationText, currentReviewAnswer.explanationImageUrl, 'explanation')}
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
    </>
  );
}
