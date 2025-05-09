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
import AddToNotebookDialog from '@/components/dpp/add-to-notebook-dialog';
import { getUserNotebooks, addQuestionToNotebooks, createNotebook } from '@/actions/notebook-actions';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import Script from 'next/script';

const QUESTION_STATUS_BADGE_VARIANTS: Record<QuestionStatus, "default" | "secondary" | "destructive" | "outline"> = {
    [QuestionStatusEnum.Answered]: "default",
    [QuestionStatusEnum.Unanswered]: "destructive",
    [QuestionStatusEnum.MarkedForReview]: "secondary",
    [QuestionStatusEnum.AnsweredAndMarked]: "default",
    [QuestionStatusEnum.NotVisited]: "outline",
};

const OPTION_STYLES = {
  base: "border-border hover:bg-muted/30 dark:hover:bg-muted/20",
  selectedCorrect: "border-green-500 bg-green-100 dark:bg-green-900/30 ring-2 ring-green-500 dark:ring-green-400 text-green-700 dark:text-green-300 font-medium",
  selectedIncorrect: "border-red-500 bg-red-100 dark:bg-red-900/30 ring-2 ring-red-500 dark:ring-red-400 text-red-700 dark:text-red-300 font-medium",
  correctButNotSelected: "border-green-600 border-dashed bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300",
};

const constructPublicImagePath = (imagePath: string | null | undefined): string | null => {
    if (!imagePath) return null;
    if (imagePath.startsWith('/question_bank_images/')) return imagePath;
    if (imagePath.startsWith('Q_') || imagePath.startsWith('E_')) {
        // This case implies the path might be missing subject/lesson context from the report
        // This function should ideally receive subject/lesson if paths in reports are relative to lesson
        console.warn(`Constructing image path for potentially relative filename: ${imagePath}. This might fail if subject/lesson context is missing.`);
        // Attempt a generic path, but this is fragile. The report should provide full relative paths.
        return `/question_bank_images/unknown_subject/unknown_lesson/images/${imagePath}`;
    }
    // If it's already a seemingly valid public path or full URL
    if (imagePath.startsWith('/') || imagePath.startsWith('http')) return imagePath;
    
    console.warn(`constructPublicImagePath received an unexpected path format: ${imagePath}. Attempting to use as is, but may fail.`);
    return imagePath;
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

  const [isNotebookModalOpen, setIsNotebookModalOpen] = useState(false);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [isLoadingNotebooks, setIsLoadingNotebooks] = useState(false);
  const [isSavingToNotebook, setIsSavingToNotebook] = useState<boolean>(false);

 const typesetMathJax = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).MathJax && typeof (window as any).MathJax.typesetPromise === 'function') {
        const elements = document.querySelectorAll('.mathjax-content');
        if (elements.length > 0) {
            (window as any).MathJax.typesetPromise(Array.from(elements))
                .catch((err: any) => console.error("MathJax typeset error (elements):", err));
        } else {
            // Fallback for cases where '.mathjax-content' might not be immediately available or if global typesetting is preferred initially
            (window as any).MathJax.typesetPromise()
                .catch((err: any) => console.error("MathJax typeset error (fallback):", err));
        }
    } else {
        // console.warn("MathJax or typesetPromise not available yet for typesetting on review page.");
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

  useEffect(() => {
    if (!isLoading && testReport) {
        const timerId = setTimeout(() => {
            typesetMathJax();
        }, 50); // Small delay to ensure DOM is ready
        return () => clearTimeout(timerId);
    }
  }, [isLoading, testReport, currentQuestionReviewIndex, typesetMathJax]);


  const allAnswersFromReport = useMemo(() => testReport?.detailedAnswers || [], [testReport]);
  const currentReviewQuestion: DetailedAnswer | undefined = useMemo(() => allAnswersFromReport?.[currentQuestionReviewIndex], [allAnswersFromReport, currentQuestionReviewIndex]);
  const totalQuestions = useMemo(() => allAnswersFromReport.length || 0, [allAnswersFromReport]);
  const optionKeys = useMemo(() => ["A", "B", "C", "D"], []);

  const correctOptionKey = currentReviewQuestion?.correctAnswer?.replace('Option ', '').trim() ?? currentReviewQuestion?.correctAnswer;
  const userSelectedOptionKey = currentReviewQuestion?.userAnswer;
  const questionStatus = currentReviewQuestion?.status || QuestionStatusEnum.NotVisited;


  const renderContent = useCallback((context: 'question' | 'explanation') => {
    if (!currentReviewQuestion) return <p className="text-sm text-muted-foreground">Content not available.</p>;

    const textContent = context === 'question' ? currentReviewQuestion.questionText : currentReviewQuestion.explanationText;
    const imagePathFromReport = context === 'question' ? currentReviewQuestion.questionImageUrl : currentReviewQuestion.explanationImageUrl;
    
    // The imagePathFromReport should already be the correct public path if test report generation is correct
    const publicImagePath = imagePathFromReport;

    if (publicImagePath && (publicImagePath.startsWith('/') || publicImagePath.startsWith('http'))) {
      return (
         <div className="relative w-full max-w-xl h-auto mx-auto my-4">
            <Image
                src={publicImagePath}
                alt={context === 'question' ? "Question Image" : "Explanation Image"}
                width={800}
                height={600}
                className="rounded-md border bg-card object-contain"
                data-ai-hint={context === 'question' ? "question diagram" : "explanation image"}
                priority={currentQuestionReviewIndex < 3 && context === 'question'}
                unoptimized
                onError={(e) => { console.error(`Error loading image: ${publicImagePath}`, e); (e.target as HTMLImageElement).style.display = 'none';}}
            />
        </div>
      );
    }
    
    if (textContent) {
      return (
         <div
            className="prose prose-sm dark:prose-invert max-w-none text-foreground mathjax-content"
            dangerouslySetInnerHTML={{ __html: textContent.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}
         />
      );
    }
    return <p className="text-sm text-muted-foreground">{context === 'question' ? 'Question content not available.' : 'Explanation not available.'}</p>;
  }, [currentReviewQuestion, currentQuestionReviewIndex]);


  const renderOptions = useCallback(() => {
    if (!currentReviewQuestion || !currentReviewQuestion.options) return null;
    const selectedOption = userSelectedOptionKey;
    const correctOpt = correctOptionKey;

    return (
      <div className="space-y-3 mt-4">
        {currentReviewQuestion.options.map((optionText, idx) => {
          const optionKey = optionKeys[idx];
          const isSelected = selectedOption === optionKey;
          const isCorrectOption = optionKey === correctOpt;
          let optionStyle = OPTION_STYLES.base;

          if (isSelected && isCorrectOption) optionStyle = OPTION_STYLES.selectedCorrect;
          else if (isSelected && !isCorrectOption) optionStyle = OPTION_STYLES.selectedIncorrect;
          else if (!isSelected && isCorrectOption) optionStyle = OPTION_STYLES.correctButNotSelected;

          const displayValue = typeof optionText === 'string' ? optionText : `Option ${optionKey}`; // Fallback if optionText is null

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
  }, [optionKeys, userSelectedOptionKey, correctOptionKey, currentReviewQuestion]);

  const navigateReview = (direction: 'prev' | 'next') => {
    setCurrentQuestionReviewIndex(prev => {
      const newIndex = direction === 'prev' ? prev - 1 : prev + 1;
      return Math.max(0, Math.min(totalQuestions - 1, newIndex));
    });
  };

  const handleOpenNotebookModal = () => {
    if (isLoadingNotebooks) {
         toast({ variant: "default", title: "Loading notebooks..." });
         return;
    }
    if (!currentReviewQuestion) return;
    setIsNotebookModalOpen(true);
  };

  const handleCloseNotebookModal = () => setIsNotebookModalOpen(false);

  const handleSaveToNotebooks = async (selectedNotebookIds: string[], tags: string[]) => {
     if (!user?.id || !currentReviewQuestion?.questionId || !testReport ) {
        toast({ variant: "destructive", title: "Error", description: "Missing required data to save bookmark." });
        return;
     }
     // Extract subject and lesson from the testReport or currentReviewQuestion if available
     const subject = (testReport as ChapterwiseTestJson)?.test_subject?.[0] || 'Unknown Subject';
     const lesson = (testReport as ChapterwiseTestJson)?.lesson || testReport.testName || 'Unknown Lesson';


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
  };

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

  if (isLoading || authLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <Skeleton className="h-8 w-1/4 mb-4" />
        <Skeleton className="h-10 w-full mb-6" />
        <Card>
          <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-48 w-full mb-4" /> {/* Skeleton for image area */}
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
      <div className="container mx-auto py-8 px-4 max-w-3xl text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" /> <h1 className="text-2xl font-bold text-destructive mb-2">Error Loading Review</h1> <p className="text-muted-foreground mb-6">{error}</p>
        <Button asChild variant="outline"><Link href={`/chapterwise-test-results/${testCode}?userId=${userId}&attemptTimestamp=${attemptTimestampStr}`}>Back to Results</Link></Button>
      </div>
    );
  }

   if (!testReport || !currentReviewQuestion) {
     return (
       <div className="container mx-auto py-8 px-4 max-w-3xl text-center">
         <HelpCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" /> <h1 className="text-2xl font-bold mb-2">Review Data Not Found</h1> <p className="text-muted-foreground mb-6">Could not load the details for this test attempt review.</p>
         <Button asChild variant="outline"><Link href={`/chapterwise-test-results/${testCode}?userId=${userId}&attemptTimestamp=${attemptTimestampStr}`}>Back to Results</Link></Button>
       </div>
     );
   }
  
  return (
    <>
      <Script
        id="mathjax-script-review"
        src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
        strategy="lazyOnload"
        onLoad={() => {
             typesetMathJax(); // Ensure typesetting happens after script load
        }}
      />
    <div className="container mx-auto py-8 px-4 max-w-3xl space-y-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild><Link href={`/chapterwise-test-results/${testCode}?userId=${userId}&attemptTimestamp=${attemptTimestampStr}`}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Results</Link></Button>
          <h1 className="text-xl md:text-2xl font-bold text-center flex-grow mx-2 truncate" title={testReport.testName || testCode}>
            Test Review: {testReport.testName || testCode}
          </h1>
          <div className="w-20 hidden sm:block"></div> {/* Spacer for alignment */}
        </div>

        <Card className="shadow-lg border-border">
          <CardHeader className="p-4 sm:p-6">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <CardTitle className="text-lg sm:text-xl">Question {currentQuestionReviewIndex + 1} <span className="font-normal text-muted-foreground">of {totalQuestions}</span></CardTitle>
              <Badge variant={QUESTION_STATUS_BADGE_VARIANTS[questionStatus]} className="capitalize text-xs sm:text-sm">{questionStatus.replace('_', ' & ')}</Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground pt-1">
              Marks: {currentReviewQuestion.marks ?? 1} | ID: {currentReviewQuestion.questionId}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-4 sm:px-6">
            <div className="mb-5 min-h-[100px]">{renderContent('question')}</div> {/* Min height for question area */}
            <Separator className="my-5" />
            <h4 className="font-semibold mb-3 text-base">Your Answer & Options:</h4>
            {renderOptions()}
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

           <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-2 pt-6 border-t px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="flex gap-2 w-full sm:w-auto justify-center sm:justify-start">
              <Button variant="outline" size="sm" onClick={handleOpenNotebookModal} disabled={isLoadingNotebooks || isSavingToNotebook}><Bookmark className="mr-2 h-4 w-4" />{isSavingToNotebook ? <Loader2 className="h-4 w-4 animate-spin" /> : "Bookmark"}</Button>
            </div>
            <div className="flex gap-2 w-full sm:w-auto justify-center sm:justify-end mt-2 sm:mt-0">
              <Button variant="outline" onClick={() => navigateReview('prev')} disabled={currentQuestionReviewIndex === 0} className="flex-1 sm:flex-none"><ArrowLeft className="mr-2 h-4 w-4" /> Previous</Button>
              <Button onClick={() => navigateReview('next')} disabled={currentQuestionReviewIndex === totalQuestions - 1} className="flex-1 sm:flex-none">Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
          </CardFooter>
        </Card>
      </div>

       {currentReviewQuestion && user && testReport && (<AddToNotebookDialog isOpen={isNotebookModalOpen} onClose={handleCloseNotebookModal} notebooks={notebooks} onSave={handleSaveToNotebooks} isLoading={isSavingToNotebook} userId={user.id} onNotebookCreated={handleCreateNotebookCallback} />)}
    </>
  );
}

