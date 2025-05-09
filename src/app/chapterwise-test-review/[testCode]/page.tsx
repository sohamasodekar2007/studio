// src/app/chapterwise-test-review/[testCode]/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle, HelpCircle, Info, Loader2, XCircle, Eye, Bookmark, Timer, Tag, FileText, ImageIcon } from 'lucide-react';
import type { TestResultSummary, QuestionStatus, Notebook, BookmarkedQuestion, DetailedAnswer, ChapterwiseTestJson } from '@/types';
import { QuestionStatus as QuestionStatusEnum } from '@/types';
import { getTestReport } from '@/actions/test-report-actions';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Script from 'next/script';
import AddToNotebookDialog from '@/components/dpp/add-to-notebook-dialog';
import { getUserNotebooks, addQuestionToNotebooks, createNotebook } from '@/actions/notebook-actions';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label'; // Ensure Label is imported if used within options

// Color mapping for question status badges
const QUESTION_STATUS_BADGE_VARIANTS: Record<QuestionStatus, "default" | "secondary" | "destructive" | "outline"> = {
    [QuestionStatusEnum.Answered]: "default",
    [QuestionStatusEnum.Unanswered]: "destructive",
    [QuestionStatusEnum.MarkedForReview]: "secondary",
    [QuestionStatusEnum.AnsweredAndMarked]: "default",
    [QuestionStatusEnum.NotVisited]: "outline",
};

// Class names for option styling based on correctness and selection
const OPTION_STYLES = {
  base: "border-border hover:bg-muted/30 dark:hover:bg-muted/20",
  selectedCorrect: "border-green-500 bg-green-100 dark:bg-green-900/30 ring-2 ring-green-500 dark:ring-green-400 text-green-700 dark:text-green-300 font-medium",
  selectedIncorrect: "border-red-500 bg-red-100 dark:bg-red-900/30 ring-2 ring-red-500 dark:ring-red-400 text-red-700 dark:text-red-300 font-medium",
  correctButNotSelected: "border-green-600 border-dashed bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300",
};

// Helper function to construct public image paths
// Assumes URLs in detailedAnswers are already relative paths starting with '/'
const constructPublicImagePath = (relativePath: string | null | undefined): string | null => {
    if (!relativePath || !relativePath.startsWith('/')) return null; // Validate it's a relative path
    return relativePath;
};


export default function TestReviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const testCode = params.testCode as string;
  const userId = searchParams.get('userId');
  const attemptTimestampStr = searchParams.get('attemptTimestamp');

  const [testReport, setTestReport] = useState<TestResultSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionReviewIndex, setCurrentQuestionReviewIndex] = useState(0);

  // --- Notebook/Bookmark State ---
  const [isNotebookModalOpen, setIsNotebookModalOpen] = useState(false);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [isLoadingNotebooks, setIsLoadingNotebooks] = useState(false);
  const [isSavingToNotebook, setIsSavingToNotebook] = useState<boolean>(false);
  // --- End Notebook/Bookmark State ---

  // MathJax Typesetting Hook
   const typesetMathJax = useCallback(() => {
       if (typeof window !== 'undefined' && (window as any).MathJax) {
           console.log("Attempting MathJax typesetting on review page...");
            const elements = document.querySelectorAll('.mathjax-content');
            if (elements.length > 0) {
                 (window as any).MathJax.typesetPromise(elements)
                    .catch((err: any) => console.error("MathJax typeset error in review page:", err));
            } else {
                 // Fallback if no specific elements found
                 (window as any).MathJax.typesetPromise()
                    .catch((err: any) => console.error("MathJax typeset error (fallback):", err));
            }
       } else {
           console.warn("MathJax not available yet for typesetting.");
       }
   }, []);


  // Fetch Test Report Data
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
            throw new Error(`Test attempt data not found.`);
        }
        if (!reportData.detailedAnswers || !Array.isArray(reportData.detailedAnswers)) {
             console.error("Report data is missing or has invalid detailedAnswers:", reportData);
             throw new Error("Invalid report data structure received.");
        }
        setTestReport(reportData);
    } catch (err: any) {
      console.error("Error fetching review data:", err);
      setError(err.message || "Failed to load test review.");
    } finally {
      setIsLoading(false);
    }
  }, [testCode, userId, attemptTimestampStr]);

  // Fetch User Notebooks
  useEffect(() => {
    if (user?.id) {
         setIsLoadingNotebooks(true);
         getUserNotebooks(user.id)
             .then(data => {
                  setNotebooks(data.notebooks || []);
             })
             .catch(err => console.error("Failed to load notebooks:", err))
             .finally(() => setIsLoadingNotebooks(false));
    }
  }, [user?.id]);

  // Authentication and Initial Data Fetch
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push(`/auth/login?redirect=/chapterwise-test-review/${testCode}?userId=${userId}&attemptTimestamp=${attemptTimestampStr}`);
      } else if (user.id !== userId) {
        setError("You are not authorized to view this review.");
        setIsLoading(false);
      } else {
        fetchReviewData();
      }
    }
  }, [user, authLoading, router, testCode, userId, attemptTimestampStr, fetchReviewData]);

  // Typeset MathJax on data load or question change
  useEffect(() => {
    if (!isLoading && testReport) {
        typesetMathJax();
    }
  }, [isLoading, testReport, currentQuestionReviewIndex, typesetMathJax]);

  // --- Memoized Data ---
  const allAnswersFromReport = useMemo(() => testReport?.detailedAnswers || [], [testReport]);
  const currentReviewQuestion: DetailedAnswer | undefined = useMemo(() => allAnswersFromReport?.[currentQuestionReviewIndex], [allAnswersFromReport, currentQuestionReviewIndex]);
  const totalQuestions = useMemo(() => allAnswersFromReport.length || 0, [allAnswersFromReport]);
  const optionKeys = useMemo(() => ["A", "B", "C", "D"], []);

  // --- Derived State ---
  const correctOptionKey = useMemo(() => currentReviewQuestion?.correctAnswer, [currentReviewQuestion]);
  const userSelectedOptionKey = useMemo(() => currentReviewQuestion?.userAnswer, [currentReviewQuestion]);
  const isUserCorrect = useMemo(() => !!userSelectedOptionKey && userSelectedOptionKey === correctOptionKey, [userSelectedOptionKey, correctOptionKey]);
  const questionStatus = useMemo(() => currentReviewQuestion?.status || QuestionStatusEnum.NotVisited, [currentReviewQuestion]);

  // --- Rendering Functions ---
  const renderContent = useCallback((context: 'question' | 'explanation') => {
    if (!currentReviewQuestion) return <p className="text-sm text-muted-foreground">Content not available.</p>;

    const text = context === 'question' ? currentReviewQuestion.questionText : currentReviewQuestion.explanationText;
    const relativeImageUrl = context === 'question' ? currentReviewQuestion.questionImageUrl : currentReviewQuestion.explanationImageUrl;
    const publicImagePath = constructPublicImagePath(relativeImageUrl);
    const altText = context === 'question' ? `Question ${currentQuestionReviewIndex + 1}` : "Explanation Image";

    if (publicImagePath) {
      return (
        <div className="relative w-full max-w-xl mx-auto my-4">
          <Image
            src={publicImagePath}
            alt={altText}
            width={800} // Provide a base width
            height={600} // Provide a base height
            layout="intrinsic" // Use intrinsic for aspect ratio, or responsive if you prefer fill
            objectFit="contain"
            className="rounded-md border bg-white dark:bg-gray-800"
            data-ai-hint={context === 'question' ? 'question diagram' : 'explanation image'}
            priority={currentQuestionReviewIndex < 3 && context === 'question'}
            onError={(e) => {
              console.error(`Error loading ${context} image: ${publicImagePath}`, e);
              // Optionally hide the image container or show a placeholder
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              // You could also set a flag to render fallback text here
            }}
            unoptimized
          />
        </div>
      );
    } else if (text) {
      return (
        <div
          className="prose prose-sm dark:prose-invert max-w-none text-foreground mathjax-content"
          dangerouslySetInnerHTML={{ __html: text.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}
        />
      );
    }

    if (context === 'question') return <p className="text-sm text-muted-foreground">Question content not available.</p>;
    if (context === 'explanation' && (!text && !publicImagePath)) return <p className="text-sm text-muted-foreground">Explanation not available for this question.</p>;

    return null;
  }, [currentReviewQuestion, currentQuestionReviewIndex]);

  const renderOptions = useCallback((question: DetailedAnswer | undefined) => {
    if (!question || !question.options) return null;

    const questionId = question.questionId || `q-${question.questionIndex}`;
    const selectedOption = userSelectedOptionKey;
    const correctOption = correctOptionKey;

    return (
      <div className="space-y-3 mt-4">
        {question.options.map((optionText, idx) => {
          const optionKey = optionKeys[idx];
          const isSelected = selectedOption === optionKey;
          const isCorrectOption = optionKey === correctOption;
          let optionStyle = OPTION_STYLES.base;

          if (isSelected && isCorrectOption) optionStyle = OPTION_STYLES.selectedCorrect;
          else if (isSelected && !isCorrectOption) optionStyle = OPTION_STYLES.selectedIncorrect;
          else if (!isSelected && isCorrectOption) optionStyle = OPTION_STYLES.correctButNotSelected;

          const displayValue = typeof optionText === 'string' ? optionText : '[Option Text Missing]';

          return (
            <div key={optionKey} className={cn("flex items-start space-x-3 p-4 border rounded-lg transition-all", optionStyle)}>
              <span className="font-medium mt-0.5">{optionKey}.</span>
              <div className="flex-1 mathjax-content" dangerouslySetInnerHTML={{ __html: displayValue.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}></div>
              {isSelected && isCorrectOption && <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 ml-auto flex-shrink-0 mt-0.5" />}
              {isSelected && !isCorrectOption && <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 ml-auto flex-shrink-0 mt-0.5" />}
              {!isSelected && isCorrectOption && <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 ml-auto flex-shrink-0 opacity-70 mt-0.5" />}
            </div>
          );
        })}
      </div>
    );
  }, [optionKeys, userSelectedOptionKey, correctOptionKey]);


  // --- Navigation ---
  const navigateReview = (direction: 'prev' | 'next') => {
    setCurrentQuestionReviewIndex(prev => {
      const newIndex = direction === 'prev' ? prev - 1 : prev + 1;
      return Math.max(0, Math.min(totalQuestions - 1, newIndex));
    });
  };

  // --- Notebook/Bookmark Handlers ---
    const handleOpenNotebookModal = () => {
        if (isLoadingNotebooks) {
             toast({ variant: "default", title: "Loading notebooks..." });
             return;
        }
        if (!currentReviewQuestion) return;
        setIsNotebookModalOpen(true);
    }

    const handleCloseNotebookModal = () => {
         setIsNotebookModalOpen(false);
    }

     const handleSaveToNotebooks = async (selectedNotebookIds: string[], tags: string[]) => {
         if (!user?.id || !currentReviewQuestion?.questionId || !testReport ) { // Removed subject/lesson check as it might be in report object
            toast({ variant: "destructive", title: "Error", description: "Missing required data to save bookmark." });
            return;
         }

          // Determine subject and lesson from report data OR currentReviewQuestion if available
          const subject = currentReviewQuestion.subject || testReport.test_subject?.[0] || "Unknown Subject";
          const lesson = currentReviewQuestion.lesson || testReport.lesson || testReport.testName || "Unknown Lesson";


         const questionData: BookmarkedQuestion = {
             questionId: currentReviewQuestion.questionId,
             subject: subject,
             lesson: lesson,
             addedAt: Date.now(),
             tags: tags,
         };

         setIsSavingToNotebook(true);
         try {
             const result = await addQuestionToNotebooks(user.id, selectedNotebookIds, questionData);
             if (result.success) {
                 toast({ title: "Saved!", description: "Question added to selected notebooks." });
                 handleCloseNotebookModal();
             } else {
                  throw new Error(result.message || "Failed to save to notebooks.");
             }
         } catch (error: any) {
              toast({ variant: "destructive", title: "Save Failed", description: error.message });
         } finally {
              setIsSavingToNotebook(false);
         }
     }

      const handleCreateNotebookCallback = useCallback(async (name: string) => {
        if (!user?.id) return null;
        const result = await createNotebook(user.id, name);
        if (result.success && result.notebook) {
          setNotebooks((prev) => [...prev, result.notebook!]);
          return result.notebook;
        } else {
          toast({ variant: "destructive", title: "Failed to Create Notebook", description: result.message });
          return null;
        }
      }, [user?.id, toast]);

     // --- End Notebook/Bookmark Handlers ---


  // --- Loading & Error States ---
  if (isLoading || authLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl"> {/* Adjusted max-width for better desktop view */}
        <Skeleton className="h-8 w-1/4 mb-4" />
        <Skeleton className="h-10 w-full mb-6" />
        <Card>
          <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
          <CardContent>
            <Skeleton className="h-40 w-full mb-4" />
            <Skeleton className="h-12 w-full mb-2" />
            <Skeleton className="h-12 w-full mb-2" />
          </CardContent>
           <CardFooter className="flex justify-between"><Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-24" /></CardFooter>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl text-center"> {/* Adjusted max-width */}
        <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-destructive mb-2">Error Loading Review</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button asChild variant="outline">
            <Link href={`/chapterwise-test-results/${testCode}?userId=${userId}&attemptTimestamp=${attemptTimestampStr}`}>
             Back to Results
           </Link>
         </Button>
      </div>
    );
  }

   if (!testReport || !currentReviewQuestion) {
     return (
       <div className="container mx-auto py-8 px-4 max-w-4xl text-center"> {/* Adjusted max-width */}
         <HelpCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
         <h1 className="text-2xl font-bold mb-2">Review Data Not Found</h1>
         <p className="text-muted-foreground mb-6">Could not load the details for this test attempt review.</p>
         <Button asChild variant="outline">
            <Link href={`/chapterwise-test-results/${testCode}?userId=${userId}&attemptTimestamp=${attemptTimestampStr}`}>
             Back to Results
           </Link>
         </Button>
       </div>
     );
   }


  return (
    <>
      <Script
        id="mathjax-script-review-page-2"
        src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
        strategy="lazyOnload"
        onLoad={() => {
          console.log('MathJax loaded for review page.');
          typesetMathJax();
        }}
      />
      <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6"> {/* Increased max-width */}
        {/* Header with Back Button and Title */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/chapterwise-test-results/${testCode}?userId=${userId}&attemptTimestamp=${attemptTimestampStr}`}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Results
            </Link>
          </Button>
          <h1 className="text-xl md:text-2xl font-bold text-center flex-grow mx-4 truncate" title={testReport.testName || testCode}>
            Test Review: {testReport.testName || testCode}
          </h1>
          <div className="w-20 hidden sm:block"></div> {/* Spacer, hidden on small screens */}
        </div>

        {/* Main Question Review Card */}
        <Card className="shadow-lg border-border">
          <CardHeader>
            <div className="flex justify-between items-center flex-wrap gap-2">
              <CardTitle>Question {currentQuestionReviewIndex + 1} <span className="font-normal text-muted-foreground">of {totalQuestions}</span></CardTitle>
              <Badge variant={QUESTION_STATUS_BADGE_VARIANTS[questionStatus]} className="capitalize">
                {questionStatus.replace('_', ' & ')}
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground pt-1">
              Marks: {currentReviewQuestion.marks ?? 1} | ID: {currentReviewQuestion.questionId}
            </CardDescription>
          </CardHeader>

          {/* Question Content */}
          <CardContent className="px-4 sm:px-6"> {/* Responsive padding */}
            <div className="mb-5">
              {renderContent('question')}
            </div>

            <Separator className="my-5" />

            {/* Options Section */}
            <h4 className="font-semibold mb-3 text-base">Your Answer & Options:</h4>
            {renderOptions(currentReviewQuestion)}

            {/* Explanation Section */}
            {(currentReviewQuestion.explanationText || currentReviewQuestion.explanationImageUrl) && (
              <>
                <Separator className="my-5" />
                <div className="space-y-2">
                  <h4 className="font-semibold text-base">Explanation:</h4>
                   {renderContent('explanation')}
                </div>
              </>
            )}
          </CardContent>

          {/* Footer with Navigation and Actions */}
          <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-6 border-t px-4 sm:px-6">
            <div className="flex gap-2 w-full sm:w-auto justify-center sm:justify-start">
              <Button variant="outline" size="sm" onClick={handleOpenNotebookModal} disabled={isLoadingNotebooks || isSavingToNotebook}>
                <Bookmark className="mr-2 h-4 w-4" />
                {isSavingToNotebook ? <Loader2 className="h-4 w-4 animate-spin" /> : "Bookmark"}
              </Button>
            </div>
            <div className="flex gap-2 w-full sm:w-auto justify-center sm:justify-end mt-2 sm:mt-0">
              <Button
                variant="outline"
                onClick={() => navigateReview('prev')}
                disabled={currentQuestionReviewIndex === 0}
                className="flex-1 sm:flex-none"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              <Button
                onClick={() => navigateReview('next')}
                disabled={currentQuestionReviewIndex === totalQuestions - 1}
                className="flex-1 sm:flex-none"
              >
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Add to Notebook Dialog */}
       {currentReviewQuestion && user && testReport && (
            <AddToNotebookDialog
                isOpen={isNotebookModalOpen}
                onClose={handleCloseNotebookModal}
                notebooks={notebooks}
                onSave={handleSaveToNotebooks}
                isLoading={isSavingToNotebook}
                userId={user.id}
                onNotebookCreated={handleCreateNotebookCallback}
            />
        )}
    </>
  );
}
