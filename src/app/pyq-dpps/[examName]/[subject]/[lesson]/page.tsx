// src/app/pyq-dpps/[examName]/[subject]/[lesson]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Script from 'next/script';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getPyqQuestionsForLesson } from '@/actions/question-bank-query-actions';
import { savePyqDppAttempt, getPyqDppProgress } from '@/actions/pyq-dpp-progress-actions';
import type { QuestionBankItem, DifficultyLevel, UserDppLessonProgress, DppAttempt, Notebook } from '@/types';
import { AlertTriangle, Filter, ArrowUpNarrowWide, CheckCircle, XCircle, Loader2, History, Bookmark, ArrowLeft } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { getUserNotebooks, addQuestionToNotebooks, createNotebook } from '@/actions/notebook-actions';
import AddToNotebookDialog from '@/components/dpp/add-to-notebook-dialog';

type DifficultyFilter = DifficultyLevel | 'All';

const constructImagePath = (subject: string, lesson: string, filename: string | null | undefined): string | null => {
    if (!filename) return null;
    const basePath = '/question_bank_images'; 
    return `${basePath}/${encodeURIComponent(subject)}/${encodeURIComponent(lesson)}/images/${encodeURIComponent(filename)}`;
};

export default function PyqDppPracticePage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const examName = decodeURIComponent(params.examName as string);
  const subject = decodeURIComponent(params.subject as string);
  const lesson = decodeURIComponent(params.lesson as string);

  const [allQuestions, setAllQuestions] = useState<QuestionBankItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyFilter>('All');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string | null>>({});
  const [showSolution, setShowSolution] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [dppProgress, setDppProgress] = useState<UserDppLessonProgress | null>(null);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);

  const [isNotebookModalOpen, setIsNotebookModalOpen] = useState(false);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [isLoadingNotebooks, setIsLoadingNotebooks] = useState(false);

  const typesetMathJax = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).MathJax && typeof (window as any).MathJax.typesetPromise === 'function') {
        const elements = document.querySelectorAll('.mathjax-content');
        if (elements.length > 0) {
            (window as any).MathJax.typesetPromise(Array.from(elements))
                .catch((err: any) => console.error("MathJax typeset error (elements):", err));
        } else {
             (window as any).MathJax.typesetPromise()
                .catch((err: any) => console.error("MathJax typeset error (fallback):", err));
        }
    }
  }, []);
  
  const currentQuestion = useMemo(() => {
    const filtered = selectedDifficulty === 'All' 
      ? allQuestions 
      : allQuestions.filter(q => q.difficulty === selectedDifficulty);
    return filtered[currentQuestionIndex];
  }, [allQuestions, selectedDifficulty, currentQuestionIndex]);

  useEffect(() => {
     if (!isLoading && currentQuestion) {
        const timerId = setTimeout(() => {
            typesetMathJax();
        }, 50);
        return () => clearTimeout(timerId);
    }
  }, [isLoading, currentQuestion, showSolution, typesetMathJax]);

  useEffect(() => {
    if (!examName || !subject || !lesson) {
      setError('Invalid lesson URL.');
      setIsLoading(false);
      return;
    }
    const fetchQuestions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedQuestions = await getPyqQuestionsForLesson(examName, subject, lesson);
        setAllQuestions(fetchedQuestions);
        setCurrentQuestionIndex(0);
        setUserAnswers({});
        setShowSolution(false);
        setIsCorrect(null);
      } catch (err) {
        console.error(`Failed to load PYQ questions for ${examName}/${subject}/${lesson}:`, err);
        setError(`Could not load PYQ questions for this lesson.`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuestions();
  }, [examName, subject, lesson]);

  useEffect(() => {
       if (user?.id && examName && subject && lesson) {
            setIsLoadingProgress(true);
            getPyqDppProgress(user.id, examName, subject, lesson)
                .then(progress => {
                    setDppProgress(progress);
                })
                .catch(err => console.error("Failed to load PYQ DPP progress:", err))
                .finally(() => setIsLoadingProgress(false));
            setIsLoadingNotebooks(true);
            getUserNotebooks(user.id)
                .then(data => {
                     setNotebooks(data.notebooks || []);
                })
                .catch(err => console.error("Failed to load notebooks:", err))
                .finally(() => setIsLoadingNotebooks(false));
       }
   }, [user, examName, subject, lesson]);

  const filteredQuestions = useMemo(() => {
    if (selectedDifficulty === 'All') {
      return allQuestions;
    }
    return allQuestions.filter(q => q.difficulty === selectedDifficulty);
  }, [allQuestions, selectedDifficulty]);

  const previousAttempts = currentQuestion ? dppProgress?.questionAttempts[currentQuestion.id] : [];
  const lastAttempt = previousAttempts?.[0];

  const handleDifficultyFilter = (difficulty: DifficultyFilter) => {
    setSelectedDifficulty(difficulty);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setShowSolution(false);
    setIsCorrect(null);
  };

  const handleOptionSelect = (questionId: string, selectedOption: string) => {
      if (showSolution) return;
      setUserAnswers(prev => ({ ...prev, [questionId]: selectedOption }));
      setIsCorrect(null);
      setShowSolution(false);
  };

   const checkAnswer = async () => {
       if (!currentQuestion || !user?.id || !examName || !subject || !lesson) return;
       const selected = userAnswers[currentQuestion.id];
       if (selected === null || selected === undefined) {
           toast({ variant: "destructive", title: "No Answer Selected", description: "Please select an option first."});
           return;
       }
       const correct = selected === currentQuestion.correct;
       setIsCorrect(correct);
       setShowSolution(true);
       setIsSaving(true);
       try {
           const result = await savePyqDppAttempt(user.id, examName, subject, lesson, currentQuestion.id, selected, correct);
           if (!result.success) {
               throw new Error(result.message || "Failed to save PYQ attempt.");
           }
           const newAttempt: DppAttempt = { timestamp: Date.now(), selectedOption: selected, isCorrect: correct };
           setDppProgress(prev => {
               const newAttempts = { ...(prev?.questionAttempts || {}) };
               newAttempts[currentQuestion.id] = [newAttempt, ...(newAttempts[currentQuestion.id] || [])];
               return {
                   ...(prev || { userId: user?.id || '', subject: subject || '', lesson: lesson || '', questionAttempts: {} }), 
                   questionAttempts: newAttempts,
                   lastAccessed: Date.now()
               };
           });
       } catch (error: any) {
           toast({ variant: "destructive", title: "Save Failed", description: error.message });
       } finally {
           setIsSaving(false);
       }
   };

   const goToNextQuestion = () => {
       if (currentQuestionIndex < filteredQuestions.length - 1) {
           setCurrentQuestionIndex(prev => prev + 1);
           setShowSolution(false);
           setIsCorrect(null);
           const nextQuestionId = filteredQuestions[currentQuestionIndex + 1]?.id;
           if (nextQuestionId && userAnswers[nextQuestionId] === undefined) {
               setUserAnswers(prev => ({ ...prev, [nextQuestionId]: null }));
           }
       } else {
           toast({ title: "PYQ DPP Completed", description: "You've reached the end of this set."});
           router.push(`/pyq-dpps/${encodeURIComponent(examName)}`); 
       }
   };

    const renderQuestionContent = (q: QuestionBankItem) => {
        const imagePath = constructImagePath(q.subject, q.lesson, q.question.image);
        if (q.type === 'image' && imagePath) {
             return (
                 <div className="relative w-full max-w-lg h-64 mx-auto my-4">
                     <Image
                        src={imagePath}
                        alt={`Question Image: ${q.id}`}
                        layout="fill"
                        objectFit="contain"
                        className="rounded border"
                        data-ai-hint="question diagram"
                        priority={currentQuestionIndex < 2}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        unoptimized
                     />
                 </div>
             );
        } else if (q.type === 'text' && q.question.text) {
             return (
                  <div className="prose dark:prose-invert max-w-none mathjax-content mb-4"
                       dangerouslySetInnerHTML={{ __html: q.question.text.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }} />
             );
        }
        return <p className="text-muted-foreground">Question content not available.</p>;
    };

     const renderOptions = (q: QuestionBankItem) => {
         const questionId = q.id;
         const selectedOption = userAnswers[questionId];
         const isAnswerChecked = showSolution;
         const correctOption = q.correct;
         return (
             <RadioGroup
                 value={selectedOption ?? undefined}
                 onValueChange={(value) => handleOptionSelect(questionId, value)}
                 className="space-y-3 mt-4"
                 disabled={showSolution || isSaving}
             >
                 {Object.entries(q.options).map(([key, value]) => {
                     const isSelected = selectedOption === key;
                     const isCorrectOption = key === correctOption;
                     let optionStyle = "border-border hover:border-primary";
                     if (isAnswerChecked) {
                          if (isSelected && isCorrectOption) optionStyle = "border-primary bg-green-100 dark:bg-green-900/30 ring-2 ring-green-500 dark:ring-green-400 text-green-700 dark:text-green-300";
                          else if (isSelected && !isCorrectOption) optionStyle = "border-destructive bg-red-100 dark:bg-red-900/30 ring-2 ring-red-500 dark:ring-red-400 text-red-700 dark:text-red-300";
                          else if (!isSelected && isCorrectOption) optionStyle = "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300";
                     } else if (isSelected) optionStyle = "border-primary ring-2 ring-primary bg-primary/5";
                     return (
                          <Label key={key} htmlFor={`${questionId}-${key}`} className={cn("flex items-start space-x-3 p-4 border rounded-lg transition-all", optionStyle, (showSolution || isSaving) ? "cursor-default opacity-70" : "cursor-pointer")}>
                             <RadioGroupItem value={key} id={`${questionId}-${key}`} className="mt-1"/>
                             <span className="font-medium">{key}.</span>
                             <div className="flex-1 mathjax-content" dangerouslySetInnerHTML={{ __html: value.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}></div>
                              {isAnswerChecked && isCorrectOption && <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 ml-auto flex-shrink-0" />}
                              {isAnswerChecked && isSelected && !isCorrectOption && <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 ml-auto flex-shrink-0" />}
                          </Label>
                     );
                 })}
             </RadioGroup>
         );
     };

     const renderExplanation = (q: QuestionBankItem) => {
         const hasText = q.explanation.text && q.explanation.text.trim().length > 0;
         const explanationImagePath = constructImagePath(q.subject, q.lesson, q.explanation.image);
         const hasImage = !!explanationImagePath;
         if (!hasText && !hasImage) return null;
         return (
              <Card className="mt-6 bg-muted/40 dark:bg-muted/20 border-border">
                  <CardHeader> <CardTitle className="text-lg">Explanation</CardTitle> </CardHeader>
                  <CardContent>
                      {hasText && <div className="prose dark:prose-invert max-w-none mathjax-content" dangerouslySetInnerHTML={{ __html: q.explanation.text!.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}></div>}
                      {hasImage && <div className="relative w-full max-w-lg h-64 mx-auto mt-4"><Image src={explanationImagePath!} alt={`Explanation Image`} layout="fill" objectFit="contain" className="rounded border" data-ai-hint="explanation image" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} unoptimized /></div>}
                  </CardContent>
              </Card>
         );
     };

      const renderPyqInfo = (q: QuestionBankItem) => {
         if (!q.isPyq || !q.pyqDetails) return null;
         const { exam, date, shift } = q.pyqDetails;
         return <Badge variant="outline" className="text-xs text-muted-foreground">PYQ: {exam} ({new Date(date).getFullYear()} Shift {shift})</Badge>;
      };

      const renderPreviousAttemptStatus = () => {
         if (isLoadingProgress) return <Skeleton className="h-4 w-24" />;
         if (lastAttempt) {
             const attemptDate = new Date(lastAttempt.timestamp).toLocaleDateString();
             const statusText = lastAttempt.isCorrect ? "Correct" : "Incorrect";
             const statusClass = lastAttempt.isCorrect ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
             return <span className={`text-xs flex items-center gap-1 ${statusClass}`}><History className="h-3 w-3" /> Last Attempt ({attemptDate}): {statusText}</span>;
         }
         return <span className="text-xs text-muted-foreground">Not Attempted Before</span>;
     };
   
   const handleOpenNotebookModal = () => {
       if (isLoadingNotebooks) return;
       if (!currentQuestion) return;
       setIsNotebookModalOpen(true);
   };
   const handleCloseNotebookModal = () => setIsNotebookModalOpen(false);
    const handleSaveToNotebooks = async (selectedNotebookIds: string[], tags: string[]) => {
        if (!user?.id || !currentQuestion) return;
        const questionData = { questionId: currentQuestion.id, subject: currentQuestion.subject, lesson: currentQuestion.lesson, addedAt: Date.now(), tags: tags };
        setIsSaving(true); 
        try {
            const result = await addQuestionToNotebooks(user.id, selectedNotebookIds, questionData);
            if (result.success) toast({ title: "Saved!", description: "Question added to notebooks." });
            else throw new Error(result.message || "Failed to save.");
            handleCloseNotebookModal();
        } catch (error: any) { toast({ variant: "destructive", title: "Save Failed", description: error.message }); }
        finally { setIsSaving(false); }
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
        <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
            <Skeleton className="h-6 w-1/4 mb-4" />
            <Skeleton className="h-8 w-1/2 mb-2" />
            <Skeleton className="h-6 w-3/4 mb-6" />
            <div className="flex gap-2 mb-4"> <Skeleton className="h-10 w-20" /> <Skeleton className="h-10 w-24" /> </div>
            <Card>
            <CardHeader><Skeleton className="h-6 w-1/4" /><Skeleton className="h-4 w-1/3" /></CardHeader>
            <CardContent><Skeleton className="h-40 w-full mb-4" /><Skeleton className="h-10 w-full mb-2" /><Skeleton className="h-10 w-full" /></CardContent>
            <CardFooter className="flex justify-between"><Skeleton className="h-10 w-28" /><Skeleton className="h-10 w-28" /></CardFooter>
            </Card>
        </div>
     );
   }
    if (!user) { router.push('/auth/login?redirect=/pyq-dpps'); return null; } 
    if (error) { return ( 
         <div className="container mx-auto py-8 px-4 max-w-4xl text-center space-y-4">
           <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
           <h1 className="text-2xl font-bold text-destructive">Error</h1>
           <p className="text-muted-foreground">{error}</p>
           <Button asChild variant="outline"><Link href={`/pyq-dpps/${encodeURIComponent(examName)}`}>Back to Lessons</Link></Button>
         </div>
    ); }
    if (filteredQuestions.length === 0) { return ( 
         <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
             <div className="mb-4"><Link href={`/pyq-dpps/${encodeURIComponent(examName)}`} className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> Back to {examName} Lessons</Link></div>
             <h1 className="text-3xl font-bold tracking-tight">PYQ DPP: {lesson}</h1>
             <p className="text-muted-foreground">Subject: {subject} | Exam: {examName}</p>
              <div className="flex flex-wrap items-center gap-2 mb-4 border-b pb-4"> <Filter className="h-5 w-5 text-muted-foreground" /> <span className="font-medium mr-2">Difficulty:</span> {(['All', 'Easy', 'Medium', 'Hard'] as DifficultyFilter[]).map(diff => (<Button key={diff} variant={selectedDifficulty === diff ? 'default' : 'outline'} size="sm" onClick={() => handleDifficultyFilter(diff)}>{diff}</Button>))} </div>
             <Card><CardContent className="p-10 text-center text-muted-foreground">No PYQs found matching the '{selectedDifficulty}' filter for this lesson.</CardContent></Card>
          </div>
     ); }


   return (
     <>
       <Script id="mathjax-script-pyq-dpp" src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" strategy="lazyOnload" onLoad={() => typesetMathJax()} />
       <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
         <div className="mb-4"> <Link href={`/pyq-dpps/${encodeURIComponent(examName)}`} className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> Back to {examName} Lessons</Link> </div>
         <h1 className="text-3xl font-bold tracking-tight">PYQ DPP: {lesson}</h1>
         <p className="text-muted-foreground">Subject: {subject} | Exam: {examName}</p>
         <div className="flex flex-wrap items-center gap-2 mb-4 border-b pb-4"> <Filter className="h-5 w-5 text-muted-foreground" /> <span className="font-medium mr-2">Difficulty:</span> {(['All', 'Easy', 'Medium', 'Hard'] as DifficultyFilter[]).map(diff => (<Button key={diff} variant={selectedDifficulty === diff ? 'default' : 'outline'} size="sm" onClick={() => handleDifficultyFilter(diff)}>{diff}</Button>))} </div>

         {currentQuestion ? (
             <Card className="shadow-md">
             <CardHeader>
                 <div className="flex justify-between items-start flex-wrap gap-2">
                     <CardTitle>Question {currentQuestionIndex + 1} of {filteredQuestions.length}</CardTitle>
                     <div className="flex items-center gap-2 flex-wrap"> {renderPyqInfo(currentQuestion)} <Badge variant="secondary">{currentQuestion.difficulty}</Badge> {renderPreviousAttemptStatus()} </div>
                 </div>
             </CardHeader>
             <CardContent> {renderQuestionContent(currentQuestion)} {renderOptions(currentQuestion)} {showSolution && renderExplanation(currentQuestion)} </CardContent>
             <CardFooter className="flex justify-between items-center flex-wrap gap-2">
                  <div className="flex gap-2"> <Button variant="secondary" onClick={checkAnswer} disabled={showSolution || userAnswers[currentQuestion.id] === null || userAnswers[currentQuestion.id] === undefined || isSaving}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Check Answer</Button> <Button variant="outline" onClick={handleOpenNotebookModal} disabled={!user || isLoadingNotebooks || isSaving}><Bookmark className="mr-2 h-4 w-4" />Bookmark</Button> </div>
                 {isCorrect !== null && (<span className={`font-medium ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>{isCorrect ? 'Correct!' : 'Incorrect'}</span>)}
                 <Button onClick={goToNextQuestion} disabled={!showSolution || isSaving}>{currentQuestionIndex === filteredQuestions.length - 1 ? 'Finish DPP' : 'Next Question'}</Button>
             </CardFooter>
             </Card>
         ) : (
              <Card><CardContent className="p-10 text-center text-muted-foreground">Loading question...</CardContent></Card>
         )}
       </div>
        {currentQuestion && user && (<AddToNotebookDialog isOpen={isNotebookModalOpen} onClose={handleCloseNotebookModal} notebooks={notebooks} onSave={handleSaveToNotebooks} isLoading={isSaving} userId={user.id} onNotebookCreated={handleCreateNotebookCallback} />)}
     </>
   );
 }

