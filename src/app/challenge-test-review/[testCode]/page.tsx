// src/app/challenge-test-review/[testCode]/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle, HelpCircle, Info, Loader2, XCircle, Eye, Bookmark, Timer, Tag, FileText, ImageIcon } from 'lucide-react';
import type { Challenge, TestQuestion, UserAnswer, QuestionStatus, Notebook, BookmarkedQuestion, DetailedAnswer } from '@/types';
import { QuestionStatus as QuestionStatusEnum } from '@/types';
import { getChallengeDetails } from '@/actions/challenge-actions';
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
    if (imagePath.startsWith('/') || imagePath.startsWith('http')) return imagePath;
    // This path construction might need adjustment if challenge question images are stored differently
    // For now, assuming a similar structure to question_bank for consistency.
    // If challenge images are directly in /public/challenge_images/{testCode}/ for example, adjust accordingly.
    console.warn(`constructPublicImagePath in challenge review received: ${imagePath}. Assuming it's a direct public path or needs context.`);
    return imagePath; 
};


export default function ChallengeTestReviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const testCode = params.testCode as string; // Changed from challengeCode to testCode
  const viewingUserId = searchParams.get('userId'); 

  const [challengeData, setChallengeData] = useState<Challenge | null>(null);
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
                    .catch((err: any) => console.error("MathJax typeset error in review page (elements):", err));
            } else {
                 (window as any).MathJax.typesetPromise() 
                    .catch((err: any) => console.error("MathJax typeset error in review page (fallback):", err));
            }
       } else {
           console.warn("MathJax or typesetPromise not available yet for typesetting on review page.");
       }
   }, []);

  const fetchChallengeData = useCallback(async () => {
    if (!testCode || !viewingUserId) { 
      setError("Missing information to load challenge review.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
        const data = await getChallengeDetails(testCode); 
        if (!data) throw new Error(`Challenge data not found for code ${testCode}.`); 
        
        if (!data.participants[viewingUserId] || data.participants[viewingUserId].status !== 'completed') {
            setError("This user did not complete the challenge, or results are not available.");
            setChallengeData(null);
            return;
        }
        setChallengeData(data);
    } catch (err: any) {
      setError(err.message || "Failed to load challenge review.");
    } finally {
      setIsLoading(false);
    }
  }, [testCode, viewingUserId]); 

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push(`/auth/login?redirect=/challenge-test-review/${testCode}?userId=${viewingUserId}`); 
      } else if (user.id !== viewingUserId) {
        console.warn("Attempting to view another user's challenge review. Current implementation might restrict this.");
        fetchChallengeData();
      } else {
        fetchChallengeData();
      }
    }
  }, [user, authLoading, router, testCode, viewingUserId, fetchChallengeData]); 

  useEffect(() => {
    if (user?.id) {
         setIsLoadingNotebooks(true);
         getUserNotebooks(user.id)
             .then(data => setNotebooks(data.notebooks || []))
             .catch(err => console.error("Failed to load notebooks:", err))
             .finally(() => setIsLoadingNotebooks(false));
    }
  }, [user?.id]);
  
  const currentQuestionFromChallenge: TestQuestion | undefined = useMemo(() => challengeData?.questions?.[currentQuestionReviewIndex], [challengeData, currentQuestionReviewIndex]);

  useEffect(() => {
    if (!isLoading && challengeData && currentQuestionFromChallenge) {
        const timerId = setTimeout(() => {
            typesetMathJax();
        }, 50);
        return () => clearTimeout(timerId);
    }
  }, [isLoading, challengeData, currentQuestionFromChallenge, currentQuestionReviewIndex, typesetMathJax]);


  const participantData = challengeData?.participants[viewingUserId || ''];
  const allQuestionsFromChallenge = useMemo(() => challengeData?.questions || [], [challengeData]);
  const totalQuestions = useMemo(() => allQuestionsFromChallenge.length || 0, [allQuestionsFromChallenge]);
  const optionKeys = useMemo(() => ["A", "B", "C", "D"], []);

  // Get detailed answer for the current question from participant's answers
  const currentUserAnswerDetailed: UserAnswer | undefined = useMemo(() => {
      if (!participantData?.answers || !currentQuestionFromChallenge?.id) return undefined;
      return participantData.answers.find(ans => ans.questionId === currentQuestionFromChallenge.id);
  }, [participantData, currentQuestionFromChallenge]);

  const userSelectedOptionKey = currentUserAnswerDetailed?.selectedOption;
  const correctOptionKey = currentQuestionFromChallenge?.answer;
  const questionStatus = currentUserAnswerDetailed?.status || QuestionStatusEnum.NotVisited;

  const renderContent = useCallback((context: 'question' | 'explanation') => {
    if (!currentQuestionFromChallenge) return <p className="text-sm text-muted-foreground">Content not available.</p>;
    const textContent = context === 'question' ? currentQuestionFromChallenge.question_text : currentQuestionFromChallenge.explanation_text;
    const imagePathFromReport = context === 'question' ? currentQuestionFromChallenge.question_image_url : currentQuestionFromChallenge.explanation_image_url;
    const publicImagePath = constructPublicImagePath(imagePathFromReport);

    if (publicImagePath) {
      return (
         <div className="relative w-full max-w-xl h-auto mx-auto my-4">
            <Image src={publicImagePath} alt={context === 'question' ? "Question Image" : "Explanation Image"} width={800} height={600} className="rounded-md border bg-card object-contain" data-ai-hint={context === 'question' ? "question diagram" : "explanation image"} priority={currentQuestionReviewIndex < 3 && context === 'question'} unoptimized onError={(e) => { (e.target as HTMLImageElement).style.display = 'none';}} />
        </div>
      );
    } else if (textContent) {
      return <div className="prose prose-sm dark:prose-invert max-w-none text-foreground mathjax-content" dangerouslySetInnerHTML={{ __html: textContent.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }} />;
    }
    return <p className="text-sm text-muted-foreground">{context === 'question' ? 'Question content not available.' : 'Explanation not available.'}</p>;
  }, [currentQuestionFromChallenge, currentQuestionReviewIndex]);

  const renderOptions = useCallback(() => { 
    if (!currentQuestionFromChallenge || !currentQuestionFromChallenge.options) return null;
    const selectedOption = userSelectedOptionKey;
    const correctOpt = correctOptionKey;

    return (
      <div className="space-y-3 mt-4">
        {currentQuestionFromChallenge.options.map((optionText, idx) => {
          const optionKey = optionKeys[idx];
          const isSelected = selectedOption === optionKey;
          const isCorrectOption = optionKey === correctOpt;
          let optionStyle = OPTION_STYLES.base;

          if (isSelected && isCorrectOption) optionStyle = OPTION_STYLES.selectedCorrect;
          else if (isSelected && !isCorrectOption) optionStyle = OPTION_STYLES.selectedIncorrect;
          else if (!isSelected && isCorrectOption) optionStyle = OPTION_STYLES.correctButNotSelected;

          const displayValue = typeof optionText === 'string' ? optionText : `Option ${optionKey}`;

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
  }, [optionKeys, userSelectedOptionKey, correctOptionKey, currentQuestionFromChallenge]); 
  const navigateReview = (direction: 'prev' | 'next') => { 
      setCurrentQuestionReviewIndex(prev => {
      const newIndex = direction === 'prev' ? prev - 1 : prev + 1;
      return Math.max(0, Math.min(totalQuestions - 1, newIndex));
    });
  };
  const handleOpenNotebookModal = () => { 
     if (isLoadingNotebooks) return;
    if (!currentQuestionFromChallenge) return;
    setIsNotebookModalOpen(true);
  };
  const handleCloseNotebookModal = () => setIsNotebookModalOpen(false);
  const handleSaveToNotebooks = async (selectedNotebookIds: string[], tags: string[]) => { 
     if (!user?.id || !currentQuestionFromChallenge?.id || !challengeData ) return;
     const subject = challengeData.testConfig.subject;
     const lesson = challengeData.testConfig.lesson;
     const questionData: BookmarkedQuestion = { questionId: currentQuestionFromChallenge.id, subject, lesson, addedAt: Date.now(), tags };
     setIsSavingToNotebook(true);
     try {
         const result = await addQuestionToNotebooks(user.id, selectedNotebookIds, questionData);
         if (result.success) toast({ title: "Saved!", description: "Question added to selected notebooks." });
         else throw new Error(result.message || "Failed to save to notebooks.");
         handleCloseNotebookModal();
     } catch (error: any) { toast({ variant: "destructive", title: "Save Failed", description: error.message }); }
     finally { setIsSavingToNotebook(false); }
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
        <Skeleton className="h-8 w-1/4 mb-4" /> <Skeleton className="h-10 w-full mb-6" />
        <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent className="space-y-4"><Skeleton className="h-48 w-full mb-4" /><Skeleton className="h-12 w-full mb-2" /><Skeleton className="h-12 w-full mb-2" /></CardContent><CardFooter className="flex justify-between"><Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-24" /></CardFooter></Card>
      </div>
    );
  }
  if (error) { 
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" /> <h1 className="text-2xl font-bold text-destructive mb-2">Error Loading Review</h1> <p className="text-muted-foreground mb-6">{error}</p>
        <Button asChild variant="outline"><Link href={`/challenge-test-result/${testCode}`}>Back to Results</Link></Button> 
      </div>
    );
  }
  if (!challengeData || !participantData || !currentQuestionFromChallenge) { 
     return (
       <div className="container mx-auto py-8 px-4 max-w-3xl text-center">
         <HelpCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" /> <h1 className="text-2xl font-bold mb-2">Challenge Review Data Not Found</h1> <p className="text-muted-foreground mb-6">Could not load the details for this challenge review.</p>
         <Button asChild variant="outline"><Link href={`/challenge-test-result/${testCode}`}>Back to Results</Link></Button> 
       </div>
     );
  }
  
  return (
    <>
      <Script id="mathjax-script-challenge-review" src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" strategy="lazyOnload" onLoad={typesetMathJax} />
    <div className="container mx-auto py-8 px-4 max-w-3xl space-y-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild><Link href={`/challenge-test-result/${testCode}`}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Results</Link></Button> 
          <h1 className="text-xl md:text-2xl font-bold text-center flex-grow mx-2 truncate" title={`${challengeData.testConfig.subject} - ${challengeData.testConfig.lesson}`}>
            Challenge Review: {challengeData.testConfig.subject} - {challengeData.testConfig.lesson}
          </h1>
          <div className="w-20 hidden sm:block"></div>
        </div>
        <Card className="shadow-lg border-border">
          <CardHeader className="p-4 sm:p-6">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <CardTitle className="text-lg sm:text-xl">Question {currentQuestionReviewIndex + 1} <span className="font-normal text-muted-foreground">of {totalQuestions}</span></CardTitle>
              <Badge variant={QUESTION_STATUS_BADGE_VARIANTS[questionStatus]} className="capitalize text-xs sm:text-sm">{questionStatus.replace('_', ' & ')}</Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground pt-1">Marks: {currentQuestionFromChallenge.marks ?? 1} | ID: {currentQuestionFromChallenge.id}</CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="mb-5 min-h-[100px]">{renderContent('question')}</div>
            <Separator className="my-5" />
            <h4 className="font-semibold mb-3 text-base">Your Answer & Options:</h4>
            {renderOptions()}
            {(currentQuestionFromChallenge.explanation_text || currentQuestionFromChallenge.explanation_image_url) && (
              <><Separator className="my-5" /><div className="space-y-2"><h4 className="font-semibold text-base">Explanation:</h4>{renderContent('explanation')}</div></>
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
      {currentQuestionFromChallenge && user && challengeData && (<AddToNotebookDialog isOpen={isNotebookModalOpen} onClose={handleCloseNotebookModal} notebooks={notebooks} onSave={handleSaveToNotebooks} isLoading={isSavingToNotebook} userId={user.id} onNotebookCreated={handleCreateNotebookCallback} />)}
    </>
  );
}
