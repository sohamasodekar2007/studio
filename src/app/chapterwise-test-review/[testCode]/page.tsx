// src/app/chapterwise-test-review/[testCode]/page.tsx
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle, HelpCircle, Info, Loader2, XCircle, Eye, Bookmark } from 'lucide-react';
import Link from 'next/link';
import type { TestResultSummary, QuestionStatus, Notebook, BookmarkedQuestion, DetailedAnswer } from '@/types'; // Use DetailedAnswer
import { QuestionStatus as QuestionStatusEnum } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { getTestReport } from '@/actions/test-report-actions'; // Action to get specific report
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Script from 'next/script';
import AddToNotebookDialog from '@/components/dpp/add-to-notebook-dialog'; // Import notebook dialog
import { getUserNotebooks, addQuestionToNotebooks } from '@/actions/notebook-actions'; // Import notebook actions
import { useToast } from '@/hooks/use-toast';

const QUESTION_STATUS_BADGE_VARIANTS: Record<QuestionStatus, "default" | "secondary" | "destructive" | "outline"> = {
    [QuestionStatusEnum.Answered]: "default",
    [QuestionStatusEnum.Unanswered]: "destructive",
    [QuestionStatusEnum.MarkedForReview]: "secondary",
    [QuestionStatusEnum.AnsweredAndMarked]: "default",
    [QuestionStatusEnum.NotVisited]: "outline",
};

const OPTION_STYLES = {
  base: "border-border hover:border-primary dark:border-gray-700 dark:hover:border-primary",
  selectedCorrect: "border-green-500 bg-green-100 dark:bg-green-900/30 ring-2 ring-green-500 dark:ring-green-400 text-green-700 dark:text-green-300",
  selectedIncorrect: "border-red-500 bg-red-100 dark:bg-red-900/30 ring-2 ring-red-500 dark:ring-red-400 text-red-700 dark:text-red-300",
  correctUnselected: "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300",
  correctImageOption: "border-green-500 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
};

// Helper function remains the same - it constructs the path based on the input string
const constructImagePath = (relativePath: string | null | undefined): string | null => {
    if (!relativePath) return null;
    // Ensure the path starts with '/' for it to be relative to the domain root
    if (relativePath.startsWith('/')) {
        return relativePath;
    }
    // Handle cases where it might be missing the leading slash
    if (relativePath.startsWith('question_bank_images')) {
        return `/${relativePath}`;
    }
    // If it's just a filename, we cannot reliably construct the path without subject/lesson
    // This scenario shouldn't happen if the report saves the correct path
    console.warn("constructImagePath received potentially just a filename:", relativePath);
    return null;
};


export default function TestReviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [testReport, setTestReport] = useState<TestResultSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionReviewIndex, setCurrentQuestionReviewIndex] = useState(0);
  const { toast } = useToast();

  // --- Notebook/Bookmark State ---
  const [isNotebookModalOpen, setIsNotebookModalOpen] = useState(false);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]); // Corrected syntax
  const [isLoadingNotebooks, setIsLoadingNotebooks] = useState(false); // Corrected syntax
  const [isSavingToNotebook, setIsSavingToNotebook] = useState<boolean>(false); // Corrected syntax
  // --- End Notebook/Bookmark State ---

  const testCode = params.testCode as string;
  const userId = searchParams.get('userId');
  const attemptTimestampStr = searchParams.get('attemptTimestamp');

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
        console.log("Fetched report data for review:", reportData);
        // Ensure detailedAnswers exists and is an array
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

    // Fetch Notebooks when user is available
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
  }, [user, authLoading, router, testCode, userId, attemptTimestampStr, fetchReviewData]);

  useEffect(() => {
      // Only typeset if report data is present
      if (testReport && testReport.detailedAnswers && testReport.detailedAnswers.length > 0) {
          typesetMathJax();
      }
  }, [currentQuestionReviewIndex, testReport, typesetMathJax]); // Depend on index and data

  // Memoized values
  const allAnswersFromReport = useMemo(() => testReport?.detailedAnswers || [], [testReport]);
  const currentReviewQuestion : DetailedAnswer | undefined = useMemo(() => allAnswersFromReport?.[currentQuestionReviewIndex], [allAnswersFromReport, currentQuestionReviewIndex]); // Use DetailedAnswer type
  const totalQuestions = useMemo(() => allAnswersFromReport.length || 0, [allAnswersFromReport]);
  const optionKeys = useMemo(() => ["A", "B", "C", "D"], []);

  // Determine correct option key, handling potential "Option X" prefix or just "X"
   const correctOptionKey = useMemo(() => {
       const answer = currentReviewQuestion?.correctAnswer;
       if (!answer) return undefined;
       return answer.replace('Option ', '').trim();
   }, [currentReviewQuestion?.correctAnswer]);


  const userSelectedOptionKey = useMemo(() => currentReviewQuestion?.userAnswer, [currentReviewQuestion]);
  const isUserCorrect = useMemo(() => !!userSelectedOptionKey && userSelectedOptionKey === correctOptionKey, [userSelectedOptionKey, correctOptionKey]); // Check if selected is non-null
  const questionStatus = useMemo(() => currentReviewQuestion?.status || QuestionStatusEnum.NotVisited, [currentReviewQuestion]);

  const optionsToDisplay = useMemo(() => {
    if (!currentReviewQuestion || !currentReviewQuestion.options) {
      return ['', '', '', ''];
    }
    const opts = currentReviewQuestion.options;
    // Ensure it's always an array of 4, even if data is malformed
    return Array.from({ length: 4 }, (_, i) => (typeof opts[i] === 'string' ? opts[i] : ''));
  }, [currentReviewQuestion]);


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
         if (!user?.id || !currentReviewQuestion?.questionId || !testReport) return;

         // Determine subject/lesson from report (may need refinement based on full_length structure)
         // Assuming subject/lesson context might be missing in the report, get it from the question data if possible
          const subject = Array.isArray(testReport?.test_subject) && testReport.test_subject.length > 0
                          ? testReport.test_subject[0]
                          : 'Unknown'; // Fallback subject from report
         const lesson = (testReport as any).lesson || 'General'; // Fallback lesson from report

         const questionData: BookmarkedQuestion = {
             questionId: currentReviewQuestion.questionId,
             // Use subject/lesson from the question detail if available, otherwise fallback to report context
             subject: currentReviewQuestion.subject || subject, // Prioritize question's own subject if available
             lesson: currentReviewQuestion.lesson || lesson,   // Prioritize question's own lesson if available
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
     // --- End Notebook/Bookmark Handlers ---


  // Conditional Rendering
  if (isLoading || authLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <Skeleton className="h-8 w-1/4 mb-4" />
        <Skeleton className="h-10 w-full mb-6" />
        <Card>
          <CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-40 w-full mb-4" />
            <Skeleton className="h-10 w-full mb-2" />
            <Skeleton className="h-10 w-full mb-2" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
           <CardFooter><Skeleton className="h-10 w-24 ml-auto" /></CardFooter>
        </Card>
      </div>
    );
  }

  if (!authLoading && !user) {
     return null; // Redirect handled by useEffect
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-destructive mb-2">Error Loading Review</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button asChild variant="outline">
          <Link href="/progress">Back to Progress</Link>
        </Button>
      </div>
    );
  }

  if (!testReport || allAnswersFromReport.length === 0) {
      return (
        <div className="container mx-auto py-8 px-4 max-w-3xl text-center">
            <HelpCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Report Data Not Found</h1>
            <p className="text-muted-foreground mb-6">Could not load the test report data or answers for this attempt.</p>
            <Button asChild variant="outline">
                <Link href="/progress">Back to Progress</Link>
            </Button>
        </div>
      );
  }

   if (!currentReviewQuestion) {
    // This can happen momentarily if report loads but the index is out of bounds initially
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl text-center">
        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Loading question data...</p>
      </div>
    );
  }

   // --- Render Content Function ---
   const renderContentWithMathJax = (
       textContent: string | undefined | null,
       imageUrl: string | undefined | null, // Expects relative URL from report like /question_bank_images/...
       context: 'question' | 'explanation'
   ) => {
       const fullImagePath = constructImagePath(imageUrl); // Construct path relative to domain root

        if (fullImagePath) { // Display image if path exists and is valid
           return (
                <div className="relative w-full max-w-xl h-auto mx-auto my-4">
                   <Image
                       src={fullImagePath}
                       alt={context === 'question' ? "Question Image" : "Explanation Image"}
                       width={700}
                       height={500}
                       style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
                       className="rounded-md border"
                       data-ai-hint={context === 'question' ? "question diagram" : "explanation image"}
                       unoptimized // Can remove if deploying and optimizing images
                       onError={(e) => {
                           console.error(`Error loading ${context} image: ${fullImagePath}`, e);
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none'; // Hide broken image
                            // Optionally display a fallback text if image fails
                             const fallback = document.createElement('p');
                             fallback.textContent = `[${context} image failed to load]`;
                             fallback.className = 'text-xs text-destructive italic';
                             target.parentNode?.insertBefore(fallback, target.nextSibling);
                        }}
                    />
                </div>
            );
        } else if (textContent) { // Render text if no image or for explanation text
           // Use dangerouslySetInnerHTML for MathJax compatibility
           return (
               <div
                   className="prose prose-sm dark:prose-invert max-w-none text-foreground mathjax-content"
                   dangerouslySetInnerHTML={{ __html: textContent.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}
                />
           );
       } else {
           // Fallback if neither text nor image is available
           return <p className="text-sm text-muted-foreground">{`[${context === 'question' ? 'Question' : 'Explanation'} content not available]`}</p>;
       }
   };
   // --- End Render Content Function ---


  // --- Main Render ---
  return (
    <>
     <Script
        id="mathjax-script-review" // Unique ID
        src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
        strategy="lazyOnload"
        onLoad={() => {
            console.log('MathJax loaded for review page.');
            if (testReport) typesetMathJax();
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
             <Badge variant="outline">Marks: {currentReviewQuestion?.marks ?? 1}</Badge> {/* Default to 1 mark if missing */}
          </div>
           {currentReviewQuestion.status && (
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
                 {renderContentWithMathJax(
                    currentReviewQuestion.questionText,
                    currentReviewQuestion.questionImageUrl,
                    'question'
                 )}
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
                 // Use different styling for image question options if needed
                // const isImageQuestion = !currentReviewQuestion.questionText && !!currentReviewQuestion.questionImageUrl;
                // if (isImageQuestion && isCorrect) {
                //     optionStyleClass = cn(OPTION_STYLES.base, OPTION_STYLES.correctImageOption);
                // }

              return (
                <div key={optionKey} className={cn("flex items-start space-x-3 p-3 border rounded-md", optionStyleClass)}>
                  <span className="font-medium mt-0.5">{optionKey}.</span>
                   {/* Render option text, handling potential MathJax */}
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
           {(currentReviewQuestion.explanationText || currentReviewQuestion.explanationImageUrl) && (
            <div className="mt-6 pt-4 border-t border-border">
              <h4 className="font-semibold text-lg mb-2 flex items-center text-card-foreground">
                 <Info className="h-5 w-5 mr-2 text-primary"/> Explanation
              </h4>
              <div className="bg-muted/50 dark:bg-muted/20 p-3 rounded-md">
                 {renderContentWithMathJax(
                    currentReviewQuestion.explanationText,
                    currentReviewQuestion.explanationImageUrl,
                    'explanation'
                 )}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between items-center flex-wrap gap-3 mt-4 p-6 border-t border-border">
           {/* Bookmark Button */}
           <Button variant="outline" size="sm" onClick={handleOpenNotebookModal} disabled={isLoadingNotebooks || isSavingToNotebook}>
                 {isSavingToNotebook ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Bookmark className="mr-2 h-4 w-4" />}
                 Save to Notebook
            </Button>
            {/* Navigation Buttons */}
           <div className="flex gap-2">
             <Button onClick={() => setCurrentQuestionReviewIndex(prev => Math.max(0, prev - 1))} disabled={currentQuestionReviewIndex === 0}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              <Button onClick={() => setCurrentQuestionReviewIndex(prev => Math.min(totalQuestions - 1, prev + 1))} disabled={currentQuestionReviewIndex >= totalQuestions - 1}>
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
           </div>
        </CardFooter>
      </Card>
    </div>

     {/* Add to Notebook Dialog */}
     {currentReviewQuestion && user && (
            <AddToNotebookDialog
                isOpen={isNotebookModalOpen}
                onClose={handleCloseNotebookModal}
                notebooks={notebooks}
                onSave={handleSaveToNotebooks}
                isLoading={isSavingToNotebook} // Pass the correct loading state
                userId={user.id} // Pass userId to dialog for creating new notebooks
                onNotebookCreated={(newNotebook) => setNotebooks(prev => [...prev, newNotebook])} // Update local state
            />
        )}
    </>
  );
}
