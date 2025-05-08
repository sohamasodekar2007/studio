// src/app/chapterwise-test-review/[testCode]/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import Link from 'next/link';
// Import CardFooter
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle, HelpCircle, Info, Loader2, XCircle, Eye, Bookmark, Timer } from 'lucide-react';
import type { TestResultSummary, QuestionStatus, Notebook, BookmarkedQuestion, DetailedAnswer, ChapterwiseTestJson } from '@/types'; // Added ChapterwiseTestJson
import { QuestionStatus as QuestionStatusEnum } from '@/types';
import { getTestReport } from '@/actions/test-report-actions';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Script from 'next/script';
import AddToNotebookDialog from '@/components/dpp/add-to-notebook-dialog';
import { getUserNotebooks, addQuestionToNotebooks } from '@/actions/notebook-actions';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

const QUESTION_STATUS_BADGE_VARIANTS: Record<QuestionStatus, "default" | "secondary" | "destructive" | "outline"> = {
    [QuestionStatusEnum.Answered]: "default",
    [QuestionStatusEnum.Unanswered]: "destructive",
    [QuestionStatusEnum.MarkedForReview]: "secondary",
    [QuestionStatusEnum.AnsweredAndMarked]: "default",
    [QuestionStatusEnum.NotVisited]: "outline",
};

const OPTION_STYLES = {
  base: "border-border hover:bg-muted/30 dark:border-gray-700 dark:hover:bg-muted/20",
  selectedCorrect: "border-green-500 bg-green-100 dark:bg-green-900/30 ring-2 ring-green-500 dark:ring-green-400 text-green-800 dark:text-green-300 font-medium",
  selectedIncorrect: "border-red-500 bg-red-100 dark:bg-red-900/30 ring-2 ring-red-500 dark:ring-red-400 text-red-800 dark:text-red-300 font-medium",
  correctUnselected: "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300",
  correctButNotSelected: "border-green-600 border-dashed bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400",
};


// Helper function to construct image paths relative to the public directory
const constructImagePath = (subject: string | null | undefined, lesson: string | null | undefined, filename: string | null | undefined): string | null => {
    if (!subject || !lesson || !filename) return null;
    const basePath = '/question_bank_images'; // Base path within public
    return `${basePath}/${encodeURIComponent(subject)}/${encodeURIComponent(lesson)}/images/${encodeURIComponent(filename)}`;
};


export default function TestReviewPage() {
  const params = useParams();
  const searchParams = useSearchParams(); // Use searchParams hook
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const testCode = params.testCode as string;
  const userId = searchParams.get('userId');
  const attemptTimestampStr = searchParams.get('attemptTimestamp');

  const [testReport, setTestReport] = useState<TestResultSummary | null>(null); // Renamed state for clarity
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionReviewIndex, setCurrentQuestionReviewIndex] = useState(0);

  // --- Notebook/Bookmark State ---
  const [isNotebookModalOpen, setIsNotebookModalOpen] = useState(false);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [isLoadingNotebooks, setIsLoadingNotebooks] = useState(false);
  const [isSavingToNotebook, setIsSavingToNotebook] = useState<boolean>(false); // State for saving to notebook
  // --- End Notebook/Bookmark State ---

  const typesetMathJax = useCallback(() => {
       if (typeof window !== 'undefined' && (window as any).MathJax) {
           console.log("Attempting MathJax typesetting on review page...");
            const elements = document.querySelectorAll('.mathjax-content');
            if (elements.length > 0) {
                 (window as any).MathJax.typesetPromise(elements)
                    .catch((err: any) => console.error("MathJax typeset error in review page:", err));
            } else {
                 (window as any).MathJax.typesetPromise()
                    .catch((err: any) => console.error("MathJax typeset error (fallback):", err));
            }
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
  }, [user, authLoading, router, testCode, userId, attemptTimestampStr, fetchReviewData]); // Removed typesetMathJax from here

  // Call MathJax typesetting after data loads or index changes
  useEffect(() => {
      if (!isLoading && testReport) {
          typesetMathJax();
      }
  }, [isLoading, testReport, currentQuestionReviewIndex, typesetMathJax]);


  const allAnswersFromReport = useMemo(() => testReport?.detailedAnswers || [], [testReport]);
  const currentReviewQuestion: DetailedAnswer | undefined = useMemo(() => allAnswersFromReport?.[currentQuestionReviewIndex], [allAnswersFromReport, currentQuestionReviewIndex]);
  const totalQuestions = useMemo(() => allAnswersFromReport.length || 0, [allAnswersFromReport]);
  const optionKeys = useMemo(() => ["A", "B", "C", "D"], []);

  // Determine correct option key, handling potential "Option X" prefix or just "X"
   const correctOptionKey = useMemo(() => {
     const answer = currentReviewQuestion?.correctAnswer;
     if (!answer) return undefined;
     return typeof answer === 'string' ? answer.replace('Option ', '').trim() : answer;
   }, [currentReviewQuestion?.correctAnswer]);


  const userSelectedOptionKey = useMemo(() => currentReviewQuestion?.userAnswer, [currentReviewQuestion]);
  const isUserCorrect = useMemo(() => !!userSelectedOptionKey && userSelectedOptionKey === correctOptionKey, [userSelectedOptionKey, correctOptionKey]);
  const questionStatus = useMemo(() => currentReviewQuestion?.status || QuestionStatusEnum.NotVisited, [currentReviewQuestion]);


  // --- Enhanced Rendering Functions ---

  const renderContent = (contentData: { text?: string | null, imageUrl?: string | null, imageAlt: string, subject?: string | null, lesson?: string | null }) => {
        const { text, imageUrl, imageAlt, subject, lesson } = contentData;

        const imagePath = constructImagePath(subject, lesson, imageUrl); // Pass subject/lesson

        if (imagePath) {
            return (
                 <div className="relative w-full max-w-xl h-auto mx-auto my-4"> {/* Adjusted size and margin */}
                    <Image
                        src={imagePath} // Use the verified path
                        alt={imageAlt}
                        width={600} // Adjust as needed
                        height={400} // Adjust as needed
                        style={{ maxWidth: '100%', height: 'auto', objectFit: 'contain' }} // Responsive styles
                        className="rounded-md border bg-white" // Add bg-white for better image visibility
                        data-ai-hint="question diagram" // Keep hint
                        priority={currentQuestionReviewIndex < 3} // Prioritize initial images
                        onError={(e) => { console.error(`Error loading image: ${imagePath}`, e); }} // Simplified onError
                        unoptimized // Keep for local/dynamic images
                     />
                 </div>
            );
        } else if (text) {
            return (
                <div
                    className="prose prose-sm dark:prose-invert max-w-none text-foreground mathjax-content mb-4" // Ensure text color contrasts
                    dangerouslySetInnerHTML={{ __html: text.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}
                 />
            );
        }
        return <p className="text-sm text-muted-foreground">Content not available.</p>;
    };

    const renderOptions = (question: DetailedAnswer | undefined) => {
        if (!question || !question.options) return null; // No options to render

        const questionId = question.questionId || `q-${question.questionIndex}`; // Fallback ID
        const selectedOption = userSelectedOptionKey; // User's selected option for this question
        const correctOption = correctOptionKey; // Correct option key

        return (
             <RadioGroup
                value={selectedOption ?? undefined} // Display the user's selection
                className="space-y-3 mt-4"
                disabled={true} // Options are not clickable in review mode
            >
                {question.options.map((optionText, idx) => {
                     const optionKey = optionKeys[idx];
                     const isSelected = selectedOption === optionKey;
                     const isCorrectOption = optionKey === correctOption;
                     let optionStyle = OPTION_STYLES.base;

                    if (isSelected && isCorrectOption) {
                        optionStyle = OPTION_STYLES.selectedCorrect;
                    } else if (isSelected && !isCorrectOption) {
                        optionStyle = OPTION_STYLES.selectedIncorrect;
                    } else if (!isSelected && isCorrectOption) {
                        optionStyle = OPTION_STYLES.correctButNotSelected; // Highlight correct if unselected
                    }

                    // Ensure optionText is a string before processing
                    const displayValue = typeof optionText === 'string' ? optionText : '[Option Text Missing]';

                    return (
                         <Label
                            key={optionKey}
                            htmlFor={`${questionId}-${optionKey}`} // Keep unique ID
                            className={cn(
                                "flex items-start space-x-3 p-4 border rounded-lg transition-all cursor-default opacity-90", // Non-interactive style
                                optionStyle
                            )}
                        >
                            <span className="font-medium">{optionKey}.</span>
                            <div className="flex-1 mathjax-content" dangerouslySetInnerHTML={{ __html: displayValue.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}></div>
                             {/* Icons for Correct/Incorrect */}
                             {isSelected && isCorrectOption && <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 ml-auto flex-shrink-0" />}
                             {isSelected && !isCorrectOption && <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 ml-auto flex-shrink-0" />}
                             {!isSelected && isCorrectOption && <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 ml-auto flex-shrink-0 opacity-70" />} {/* Indicate correct but unselected */}
                         </Label>
                    );
                })}
            </RadioGroup>
        );
    };

    const renderExplanation = (question: DetailedAnswer | undefined) => {
        if (!question) return null;

        const hasText = question.explanationText && question.explanationText.trim().length > 0;
        // Derive subject/lesson from the test report for image path construction
        const subject = testReport?.test_subject?.[0]; // Use the subject array if present
        const lesson = (testReport as ChapterwiseTestJson | null)?.lesson; // Use lesson if present
        const hasImage = !!question.explanationImageUrl; // Image URL is directly in detailed answer

        if (!hasText && !hasImage) {
            return ( // Return null or a placeholder if no explanation
                <p className="text-sm text-muted-foreground mt-4">No explanation available for this question.</p>
            );
        }

        // If there IS explanation content, render the card
         return (
             <Card className="mt-6 bg-muted/30 dark:bg-muted/20 border-border">
                 <CardHeader>
                     <CardTitle className="text-lg">Explanation</CardTitle>
                 </CardHeader>
                 <CardContent>
                     {renderContent({
                         text: question.explanationText,
                         imageUrl: question.explanationImageUrl,
                         imageAlt: "Explanation Image",
                         subject: subject, // Pass derived subject
                         lesson: lesson, // Pass derived lesson
                     })}
                 </CardContent>
             </Card>
         );
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
         if (!user?.id || !currentReviewQuestion?.questionId || !testReport) return;

         // Derive subject/lesson from test report
          const subject = testReport.test_subject?.[0] || "Unknown";
          const lesson = (testReport as ChapterwiseTestJson | null)?.lesson || testReport.testName || "Unknown"; // Use lesson if present


         const questionData: BookmarkedQuestion = {
             questionId: currentReviewQuestion.questionId,
             subject: subject,
             lesson: lesson,
             addedAt: Date.now(),
             tags: tags,
         };

         setIsSavingToNotebook(true); // Set saving state
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
              setIsSavingToNotebook(false); // Reset saving state
         }
     }
     // --- End Notebook/Bookmark Handlers ---

   if (isLoading || authLoading) {
     return (
       <div className="container mx-auto py-8 px-4 max-w-3xl">
         <Skeleton className="h-8 w-1/4 mb-4" />
         <Skeleton className="h-10 w-1/2 mb-6" />
         <Card>
           <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
           <CardContent>
             <Skeleton className="h-40 w-full mb-4" />
             <Skeleton className="h-12 w-full mb-2" />
             <Skeleton className="h-12 w-full mb-2" />
           </CardContent>
           {/* CardFooter needs to be imported */}
           <CardFooter><Skeleton className="h-10 w-24" /></CardFooter>
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
       <div className="container mx-auto py-8 px-4 max-w-4xl text-center">
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
        id="mathjax-script-review" // Unique ID
        src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
        strategy="lazyOnload"
        onLoad={() => {
            console.log('MathJax loaded for review page.');
            if (!isLoading) typesetMathJax(); // Typeset if data is already loaded
        }}
      />
    <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
      <div className="flex justify-between items-center">
        <Button variant="outline" size="sm" asChild>
            <Link href={`/chapterwise-test-results/${testCode}?userId=${userId}&attemptTimestamp=${attemptTimestampStr}`}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Results
            </Link>
        </Button>
         <h1 className="text-xl md:text-2xl font-bold text-center flex-grow">Test Review</h1>
         <div className="w-10"></div> {/* Spacer */}
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-center flex-wrap gap-2">
            <CardTitle>Question {currentQuestionReviewIndex + 1} of {totalQuestions}</CardTitle>
             <Badge variant={QUESTION_STATUS_BADGE_VARIANTS[questionStatus]} className="capitalize">
                {questionStatus.replace('_', ' ')}
             </Badge>
          </div>
           {/* Optional: Add question-specific info like marks */}
           <CardDescription className="text-xs text-muted-foreground pt-1">
              Marks: {currentReviewQuestion.marks ?? 1} | ID: {currentReviewQuestion.questionId}
           </CardDescription>
        </CardHeader>
        <CardContent>
             {renderContent({
                 text: currentReviewQuestion.questionText,
                 imageUrl: currentReviewQuestion.questionImageUrl,
                 imageAlt: "Question Image",
                 subject: testReport.test_subject?.[0], // Pass subject
                 lesson: (testReport as ChapterwiseTestJson | null)?.lesson, // Pass lesson
             })}
             <Separator className="my-5" />
             <h4 className="font-medium mb-3">Options:</h4>
             {renderOptions(currentReviewQuestion)}
             {renderExplanation(currentReviewQuestion)}
        </CardContent>
        <CardFooter className="flex justify-between items-center flex-wrap gap-2">
           <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleOpenNotebookModal} disabled={isLoadingNotebooks || isSavingToNotebook}>
                   <Bookmark className="mr-2 h-4 w-4" />
                   {isSavingToNotebook ? <Loader2 className="h-4 w-4 animate-spin"/> : "Save to Notebook"}
                </Button>
                 {/* <Button variant="ghost" size="sm" className="text-muted-foreground">
                     <AlertTriangle className="mr-2 h-4 w-4"/> Report Issue
                </Button> */}
           </div>
           <div className="flex gap-2">
                <Button
                   variant="outline"
                   onClick={() => setCurrentQuestionReviewIndex(prev => Math.max(0, prev - 1))}
                   disabled={currentQuestionReviewIndex === 0}
                >
                    <ArrowLeft className="mr-2 h-4 w-4"/> Previous
                </Button>
                <Button
                   onClick={() => setCurrentQuestionReviewIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
                   disabled={currentQuestionReviewIndex === totalQuestions - 1}
                >
                    Next <ArrowRight className="ml-2 h-4 w-4"/>
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
                userId={user.id} // Pass userId to dialog for creating new notebooks
                onNotebookCreated={(newNotebook) => setNotebooks(prev => [...prev, newNotebook])} // Update local state
            />
        )}
    </>
  );
}
