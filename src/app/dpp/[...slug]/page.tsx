// src/app/dpp/[...slug]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Script from 'next/script';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getQuestionsForLesson } from '@/actions/question-bank-query-actions';
import { saveDppAttempt, getDppProgress } from '@/actions/dpp-progress-actions';
import type { QuestionBankItem, DifficultyLevel, UserDppLessonProgress, DppAttempt, Notebook } from '@/types';
import { AlertTriangle, Filter, ArrowLeft, CheckCircle, XCircle, Loader2, History, Bookmark, BookOpen, ChevronRight, Tag, HelpCircle } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { getUserNotebooks, addQuestionToNotebooks, createNotebook } from '@/actions/notebook-actions';
import AddToNotebookDialog from '@/components/dpp/add-to-notebook-dialog';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

type DifficultyFilter = DifficultyLevel | 'All';

const constructImagePath = (subject: string, lesson: string, filename: string | null | undefined): string | null => {
    if (!filename) return null;
    const basePath = '/question_bank_images';
    return `${basePath}/${encodeURIComponent(subject)}/${encodeURIComponent(lesson)}/images/${encodeURIComponent(filename)}`;
};

const difficultyButtonVariants: Record<DifficultyFilter, string> = {
    'All': 'bg-primary text-primary-foreground hover:bg-primary/90',
    'Easy': 'bg-green-500 text-white hover:bg-green-600',
    'Medium': 'bg-yellow-500 text-white hover:bg-yellow-600',
    'Hard': 'bg-red-500 text-white hover:bg-red-600',
};


export default function DppLessonPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { slug } = params;

  const [subject, setSubject] = useState<string | null>(null);
  const [lesson, setLesson] = useState<string | null>(null);
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
                .catch((err: any) => console.error("MathJax typeset error (DPP elements):", err));
        } else {
            (window as any).MathJax.typesetPromise()
                .catch((err: any) => console.error("MathJax typeset error (DPP fallback):", err));
        }
    }
  }, []);

  const filteredQuestions = useMemo(() => {
    if (selectedDifficulty === 'All') {
      return allQuestions;
    }
    return allQuestions.filter(q => q.difficulty === selectedDifficulty);
  }, [allQuestions, selectedDifficulty]);

  const currentQuestion = useMemo(() => {
    return filteredQuestions[currentQuestionIndex];
  }, [filteredQuestions, currentQuestionIndex]);


  useEffect(() => {
    if (!isLoading && currentQuestion) {
        const timerId = setTimeout(() => {
            typesetMathJax();
        }, 50);
        return () => clearTimeout(timerId);
    }
  }, [isLoading, currentQuestion, showSolution, typesetMathJax]);

  useEffect(() => {
    if (Array.isArray(slug) && slug.length === 2) {
      const decodedSubject = decodeURIComponent(slug[0]);
      const decodedLesson = decodeURIComponent(slug[1]);
      setSubject(decodedSubject);
      setLesson(decodedLesson);

      const fetchQuestions = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const fetchedQuestions = await getQuestionsForLesson({
            subject: decodedSubject,
            lesson: decodedLesson,
          });
          setAllQuestions(fetchedQuestions);
          setCurrentQuestionIndex(0);
          setUserAnswers({});
          setShowSolution(false);
          setIsCorrect(null);
        } catch (err) {
          console.error(`Failed to load questions for ${decodedSubject}/${decodedLesson}:`, err);
          setError('Could not load practice questions for this lesson.');
        } finally {
          setIsLoading(false);
        }
      };
      fetchQuestions();
    } else {
      setError('Invalid lesson URL.');
      setIsLoading(false);
    }
  }, [slug]);

   useEffect(() => {
       if (user?.id && subject && lesson) {
            setIsLoadingProgress(true);
            getDppProgress(user.id, subject, lesson)
                .then(progress => {
                    setDppProgress(progress);
                })
                .catch(err => console.error("Failed to load DPP progress:", err))
                .finally(() => setIsLoadingProgress(false));

            setIsLoadingNotebooks(true);
            getUserNotebooks(user.id)
                .then(data => {
                     setNotebooks(data.notebooks || []);
                })
                .catch(err => console.error("Failed to load notebooks:", err))
                .finally(() => setIsLoadingNotebooks(false));
       }
   }, [user, subject, lesson]);


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
       if (!currentQuestion || !user?.id || !subject || !lesson) return;
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
           const result = await saveDppAttempt(user.id, subject, lesson, currentQuestion.id, selected, correct);
           if (!result.success) {
               throw new Error(result.message || "Failed to save attempt.");
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
           toast({ title: "DPP Set Completed!", description: "You've reached the end of this set."});
           router.push('/dpp');
       }
   };

   const renderQuestionContent = (q: QuestionBankItem) => {
       const imagePath = constructImagePath(q.subject, q.lesson, q.question.image);

       if (q.type === 'image' && imagePath) {
           return (
                <div className="relative w-full max-w-md h-56 md:h-64 mx-auto my-4">
                    <Image
                       src={imagePath}
                       alt={`Question Image: ${q.id}`}
                       layout="fill"
                       objectFit="contain"
                       className="rounded border bg-muted"
                       data-ai-hint="question diagram"
                       priority={currentQuestionIndex < 2}
                       onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; console.error(`Error loading image: ${imagePath}`);}}
                       unoptimized
                    />
                </div>
           );
       } else if (q.type === 'text' && q.question.text) {
           return (
                <div
                   className="prose dark:prose-invert max-w-none mathjax-content mb-4 text-base leading-relaxed"
                   dangerouslySetInnerHTML={{ __html: q.question.text.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}
                />
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
                className="space-y-3 mt-6"
                disabled={showSolution || isSaving}
            >
                {Object.entries(q.options).map(([key, value]) => {
                    const isSelected = selectedOption === key;
                    const isCorrectOption = key === correctOption;
                    let optionStyle = "border-border hover:border-primary bg-card";

                    if (isAnswerChecked) {
                        if (isSelected && isCorrectOption) {
                             optionStyle = "border-green-500 bg-green-100 dark:bg-green-900/30 ring-2 ring-green-500 dark:ring-green-400 text-green-700 dark:text-green-300";
                        } else if (isSelected && !isCorrectOption) {
                             optionStyle = "border-red-500 bg-red-100 dark:bg-red-900/30 ring-2 ring-red-500 dark:ring-red-400 text-red-700 dark:text-red-300";
                        } else if (!isSelected && isCorrectOption) {
                             optionStyle = "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300";
                        }
                    } else if (isSelected) {
                         optionStyle = "border-primary ring-2 ring-primary bg-primary/10";
                    }

                    return (
                         <Label
                            key={key}
                            htmlFor={`${questionId}-${key}`}
                            className={cn(
                                "flex items-start space-x-3 p-4 border rounded-lg transition-all shadow-sm hover:shadow-md",
                                optionStyle,
                                (showSolution || isSaving) ? "cursor-default opacity-80" : "cursor-pointer"
                            )}
                        >
                            <RadioGroupItem value={key} id={`${questionId}-${key}`} className="mt-1 border-muted-foreground data-[state=checked]:border-primary" />
                            <span className="font-semibold text-sm">{key}.</span>
                            <div className="flex-1 mathjax-content text-sm" dangerouslySetInnerHTML={{ __html: value.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}></div>
                              {isAnswerChecked && isCorrectOption && <CheckCircle className="h-5 w-5 text-green-500 ml-auto flex-shrink-0" />}
                              {isAnswerChecked && isSelected && !isCorrectOption && <XCircle className="h-5 w-5 text-red-500 ml-auto flex-shrink-0" />}
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
              <Card className="mt-8 bg-muted/40 dark:bg-muted/20 border-border shadow-inner">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-md font-semibold flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary"/>
                        Explanation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                      {hasText && (
                          <div className="prose dark:prose-invert max-w-none mathjax-content text-sm" dangerouslySetInnerHTML={{ __html: q.explanation.text!.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}></div>
                      )}
                      {hasImage && <div className="relative w-full max-w-md h-56 mx-auto mt-4"><Image src={explanationImagePath!}  alt={`Explanation Image`} layout="fill" objectFit="contain" className="rounded border" data-ai-hint="explanation diagram" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} unoptimized /></div>}
                  </CardContent>
              </Card>
         );
     };

      const renderPyqInfo = (q: QuestionBankItem) => {
         if (!q.isPyq || !q.pyqDetails) return null;
         const { exam, date, shift } = q.pyqDetails;
         return <Badge variant="outline" className="text-xs text-muted-foreground"><Tag className="h-3 w-3 mr-1"/>PYQ: {exam} ({new Date(date).getFullYear()} Shift {shift})</Badge>;
      };

      const renderPreviousAttemptStatus = () => {
         if (isLoadingProgress && !lastAttempt) return <Skeleton className="h-4 w-32" />;
         if (lastAttempt) {
             const attemptDate = new Date(lastAttempt.timestamp).toLocaleDateString();
             const statusText = lastAttempt.isCorrect ? "Correct" : "Incorrect";
             const statusIcon = lastAttempt.isCorrect ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <XCircle className="h-3.5 w-3.5 text-red-500" />;
             return <Badge variant="secondary" className={`text-xs font-normal h-6 ${lastAttempt.isCorrect ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}><History className="h-3 w-3 mr-1" />Last: {statusText} ({attemptDate})</Badge>;
         }
         return <Badge variant="outline" className="text-xs font-normal h-6"><HelpCircle className="h-3 w-3 mr-1"/>Not Attempted Yet</Badge>;
     };

   const handleOpenNotebookModal = () => {
       if (isLoadingNotebooks) {
            toast({ variant: "default", title: "Loading notebooks..." });
            return;
       }
       if (!currentQuestion) return;
       setIsNotebookModalOpen(true);
   }

   const handleCloseNotebookModal = () => {
        setIsNotebookModalOpen(false);
   }

    const handleSaveToNotebooks = async (selectedNotebookIds: string[], tags: string[]) => {
        if (!user?.id || !currentQuestion) return;
        const questionData = {
            questionId: currentQuestion.id,
            subject: currentQuestion.subject,
            lesson: currentQuestion.lesson,
            addedAt: Date.now(),
            tags: tags,
        };
        setIsSaving(true);
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
             setIsSaving(false);
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
        <div className="container mx-auto py-8 px-4 max-w-3xl space-y-6">
            <Skeleton className="h-6 w-1/4 mb-4" />
            <Skeleton className="h-10 w-3/4 mb-2" />
            <Skeleton className="h-6 w-1/2 mb-6" />
            <div className="flex gap-2 mb-4"> <Skeleton className="h-10 w-24" /> <Skeleton className="h-10 w-24" /> <Skeleton className="h-10 w-24" /> </div>
            <Card className="shadow-lg">
            <CardHeader className="p-6"><Skeleton className="h-7 w-1/3 mb-2" /><Skeleton className="h-4 w-2/3" /></CardHeader>
            <CardContent className="p-6"><Skeleton className="h-48 w-full mb-4" /><Skeleton className="h-12 w-full mb-3" /><Skeleton className="h-12 w-full" /></CardContent>
            <CardFooter className="p-6 flex justify-between items-center"><Skeleton className="h-10 w-32" /><Skeleton className="h-10 w-32" /></CardFooter>
            </Card>
        </div>
     );
   }
    if (!user) { router.push('/auth/login?redirect=/dpp'); return null; }
    if (error) { return (
         <div className="container mx-auto py-8 px-4 max-w-2xl text-center space-y-4">
           <AlertTriangle className="h-16 w-16 text-destructive mx-auto" />
           <h1 className="text-2xl font-bold text-destructive">Error Loading DPP</h1>
           <p className="text-muted-foreground">{error}</p>
           <Button asChild variant="outline"><Link href="/dpp">Back to DPP List</Link></Button>
         </div>
    ); }
    if (filteredQuestions.length === 0) { return (
         <div className="container mx-auto py-8 px-4 max-w-3xl space-y-6">
             <div className="mb-4"><Link href="/dpp" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> Back to DPP List</Link></div>
             <h1 className="text-3xl font-bold tracking-tight">DPP: {lesson}</h1>
             <p className="text-muted-foreground">Subject: {subject}</p>
              <div className="flex flex-wrap items-center gap-2 mb-6 border-b pb-4"> <Filter className="h-5 w-5 text-muted-foreground" /> <span className="font-medium mr-2 text-sm">Difficulty:</span> {(['All', 'Easy', 'Medium', 'Hard'] as DifficultyFilter[]).map(diff => (<Button key={diff} variant="ghost" size="sm" onClick={() => handleDifficultyFilter(diff)} className={cn("text-xs h-8 px-3", selectedDifficulty === diff ? difficultyButtonVariants[diff] : 'text-muted-foreground hover:bg-accent')}>{diff}</Button>))} </div>
             <Card className="shadow-md"><CardContent className="p-10 text-center text-muted-foreground">No questions found matching the '{selectedDifficulty}' filter for this lesson.</CardContent></Card>
          </div>
     ); }


   return (
     <>
       <Script id="mathjax-script-dpp" src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" strategy="lazyOnload" onLoad={() => { typesetMathJax(); }} />
       <div className="container mx-auto py-6 px-4 md:py-8 md:px-6 max-w-3xl space-y-8">
        <div className="flex justify-between items-center">
            <Button variant="outline" size="sm" asChild>
                <Link href="/dpp" className="inline-flex items-center gap-1.5">
                    <ArrowLeft className="h-4 w-4" /> Back to DPP List
                </Link>
            </Button>
            <span className="text-sm text-muted-foreground">Question {currentQuestionIndex + 1} of {filteredQuestions.length}</span>
        </div>

         <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">DPP: {lesson}</h1>
            <p className="text-muted-foreground text-sm md:text-base">Subject: {subject}</p>
         </div>

         <div className="flex flex-wrap items-center justify-center gap-2 mb-6 rounded-lg bg-muted/50 p-3">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium mr-2 text-sm">Difficulty:</span>
            {(['All', 'Easy', 'Medium', 'Hard'] as DifficultyFilter[]).map(diff => (
                <Button key={diff} variant="ghost" size="sm" onClick={() => handleDifficultyFilter(diff)} className={cn("text-xs h-8 px-3", selectedDifficulty === diff ? difficultyButtonVariants[diff] : 'text-muted-foreground hover:bg-accent')}>
                    {diff}
                </Button>
            ))}
         </div>

         {currentQuestion ? (
             <Card className="shadow-lg border-border overflow-hidden">
             <CardHeader className="p-4 md:p-6 bg-card">
                 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <div className="flex items-center gap-2">
                         <Badge variant="secondary" className="text-xs h-6">{currentQuestion.difficulty}</Badge>
                         {renderPyqInfo(currentQuestion)}
                    </div>
                    <div className="text-xs sm:text-sm">
                        {renderPreviousAttemptStatus()}
                    </div>
                 </div>
             </CardHeader>
             <CardContent className="p-4 md:p-6">
                {renderQuestionContent(currentQuestion)}
                {renderOptions(currentQuestion)}
                {showSolution && isCorrect !== null && (
                    <Alert variant={isCorrect ? "default" : "destructive"} className={cn("mt-6 text-sm", isCorrect ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700" : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700")}>
                        {isCorrect ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        <AlertTitle className={cn(isCorrect ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300")}>{isCorrect ? 'Correct!' : 'Incorrect!'}</AlertTitle>
                        {!isCorrect && <AlertDescription className={cn("text-xs", isCorrect ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>The correct answer was {currentQuestion.correct}.</AlertDescription>}
                    </Alert>
                )}
                {showSolution && renderExplanation(currentQuestion)}
             </CardContent>
             <CardFooter className="p-4 md:p-6 flex flex-col sm:flex-row justify-between items-center gap-3 bg-muted/30 border-t">
                 <Button variant="outline" size="sm" onClick={handleOpenNotebookModal} disabled={!user || isLoadingNotebooks || isSaving} className="w-full sm:w-auto">
                    <Bookmark className="mr-2 h-4 w-4" />{isSaving && notebooks.length === 0 ? "Saving..." : "Bookmark"}
                 </Button>
                 <div className="flex gap-2 w-full sm:w-auto">
                    {!showSolution ? (
                        <Button onClick={checkAnswer} disabled={userAnswers[currentQuestion.id] === null || userAnswers[currentQuestion.id] === undefined || isSaving} className="flex-1 sm:flex-initial bg-primary hover:bg-primary/90">
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Check Answer
                        </Button>
                    ) : (
                         <Button onClick={goToNextQuestion} disabled={isSaving} className="flex-1 sm:flex-initial bg-primary hover:bg-primary/90">
                            {currentQuestionIndex === filteredQuestions.length - 1 ? 'Finish DPP' : 'Next Question'} <ChevronRight className="ml-1 h-4 w-4"/>
                         </Button>
                    )}
                 </div>
             </CardFooter>
             </Card>
         ) : (
              <Card className="shadow-md"><CardContent className="p-10 text-center text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin"/>Loading question...</CardContent></Card>
         )}
       </div>
        {currentQuestion && user && (<AddToNotebookDialog isOpen={isNotebookModalOpen} onClose={handleCloseNotebookModal} notebooks={notebooks} onSave={handleSaveToNotebooks} isLoading={isSaving} userId={user.id} onNotebookCreated={handleCreateNotebookCallback} />)}
     </>
   );
 }
