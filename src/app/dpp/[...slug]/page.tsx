// src/app/dpp/[...slug]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Script from 'next/script'; // For MathJax
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getQuestionsForLesson } from '@/actions/question-bank-query-actions';
import { saveDppAttempt, getDppProgress } from '@/actions/dpp-progress-actions'; // Import DPP progress actions
import type { QuestionBankItem, DifficultyLevel, UserDppLessonProgress, DppAttempt } from '@/types';
import { AlertTriangle, Filter, ArrowUpNarrowWide, CheckCircle, XCircle, Loader2, History } from 'lucide-react'; // Added icons
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge'; // Import Badge
import { useAuth } from '@/context/auth-context'; // Import useAuth
import { useToast } from '@/hooks/use-toast'; // Import useToast

type DifficultyFilter = DifficultyLevel | 'All';

// Helper function to construct image paths relative to the public directory
const constructImagePath = (subject: string, lesson: string, filename: string | null | undefined): string | null => {
    if (!filename) return null;
    // Ensure the path starts correctly and encode components
    const basePath = '/question_bank_images'; // Base path within public
    return `${basePath}/${encodeURIComponent(subject)}/${encodeURIComponent(lesson)}/images/${encodeURIComponent(filename)}`;
};

export default function DppLessonPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth(); // Get user from auth context
  const { toast } = useToast(); // Initialize toast
  const { slug } = params;

  const [subject, setSubject] = useState<string | null>(null);
  const [lesson, setLesson] = useState<string | null>(null);
  const [allQuestions, setAllQuestions] = useState<QuestionBankItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyFilter>('All');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string | null>>({}); // Store answers by question ID for CURRENT session
  const [showSolution, setShowSolution] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false); // State for saving attempt

  const [dppProgress, setDppProgress] = useState<UserDppLessonProgress | null>(null); // State for user progress data
  const [isLoadingProgress, setIsLoadingProgress] = useState(false); // Separate loading state for progress

  // --- MathJax Integration ---
  const typesetMathJax = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).MathJax) {
      (window as any).MathJax.typesetPromise?.().catch((err: any) => console.error("MathJax typesetting error:", err));
    }
  }, []);

  useEffect(() => {
    typesetMathJax();
  }, [currentQuestionIndex, allQuestions, showSolution, typesetMathJax]); // Re-typeset when question changes or solution shown
  // --- End MathJax Integration ---

  // Fetch Questions
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
          setCurrentQuestionIndex(0); // Reset index when questions load
          setUserAnswers({}); // Reset answers
          setShowSolution(false); // Hide solution
          setIsCorrect(null); // Reset correctness
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

  // Fetch User Progress
  useEffect(() => {
    if (user?.id && subject && lesson) {
      setIsLoadingProgress(true);
      getDppProgress(user.id, subject, lesson)
        .then(progress => {
          setDppProgress(progress);
        })
        .catch(err => {
          console.error("Failed to load DPP progress:", err);
          // Don't block the UI, just log the error
        })
        .finally(() => {
          setIsLoadingProgress(false);
        });
    }
  }, [user, subject, lesson]); // Fetch when user/subject/lesson are available

  const filteredQuestions = useMemo(() => {
    if (selectedDifficulty === 'All') {
      return allQuestions;
    }
    return allQuestions.filter(q => q.difficulty === selectedDifficulty);
  }, [allQuestions, selectedDifficulty]);

  const currentQuestion = filteredQuestions[currentQuestionIndex];
  const previousAttempts = currentQuestion ? dppProgress?.questionAttempts[currentQuestion.id] : [];
  const lastAttempt = previousAttempts?.[0]; // Most recent attempt is first


  const handleDifficultyFilter = (difficulty: DifficultyFilter) => {
    setSelectedDifficulty(difficulty);
    setCurrentQuestionIndex(0); // Reset to first question of filtered list
    setUserAnswers({});
    setShowSolution(false);
    setIsCorrect(null);
  };

  const handleOptionSelect = (questionId: string, selectedOption: string) => {
      if (showSolution) return; // Don't allow changing answer after showing solution
      setUserAnswers(prev => ({ ...prev, [questionId]: selectedOption }));
      setIsCorrect(null); // Reset correctness check until submitted/checked
      setShowSolution(false); // Hide solution if user selects a new answer
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
       setShowSolution(true); // Show solution after checking

       // Save attempt
       setIsSaving(true);
       try {
           const result = await saveDppAttempt(user.id, subject, lesson, currentQuestion.id, selected, correct);
           if (!result.success) {
               throw new Error(result.message || "Failed to save attempt.");
           }
           // Optimistically update local progress state
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
           // Reset session answer for the new question if it wasn't already answered in this session
           const nextQuestionId = filteredQuestions[currentQuestionIndex + 1]?.id;
           if (nextQuestionId && userAnswers[nextQuestionId] === undefined) {
               setUserAnswers(prev => ({ ...prev, [nextQuestionId]: null }));
           }
       } else {
           toast({ title: "DPP Completed", description: "You've reached the end of this set."});
           router.push('/dpp'); // Example: Navigate back to list
       }
   };

   // Function to render question content (text or image)
   const renderQuestionContent = (q: QuestionBankItem) => {
       const imagePath = constructImagePath(q.subject, q.lesson, q.question.image);

       if (q.type === 'image' && imagePath) {
           return (
                <div className="relative w-full max-w-lg h-64 mx-auto my-4"> {/* Adjust size as needed */}
                    <Image
                       src={imagePath} // Use the correctly constructed path
                       alt={`Question Image: ${q.id}`}
                       layout="fill"
                       objectFit="contain"
                       className="rounded border"
                       data-ai-hint="question diagram"
                       priority={currentQuestionIndex < 2} // Prioritize first few images
                       onError={(e) => { console.error(`Error loading question image: ${imagePath}`, e); }} // Simplified error logging
                       unoptimized // Keep this if local images might cause issues
                    />
                    {/* Consider adding a fallback text display on error if needed */}
                </div>
           );
       } else if (q.type === 'text' && q.question.text) {
           return (
                <div
                   className="prose dark:prose-invert max-w-none mathjax-content mb-4" // Added margin-bottom
                   dangerouslySetInnerHTML={{ __html: q.question.text.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}
                />
           );
       }
       return <p className="text-muted-foreground">Question content not available.</p>;
   };

    // Function to render options
    const renderOptions = (q: QuestionBankItem) => {
        const questionId = q.id;
        const selectedOption = userAnswers[questionId];
        const isAnswerChecked = showSolution; // Use showSolution state
        const correctOption = q.correct;

        return (
            <RadioGroup
                value={selectedOption ?? undefined}
                onValueChange={(value) => handleOptionSelect(questionId, value)}
                className="space-y-3 mt-4" // Added margin-top
                disabled={showSolution || isSaving} // Disable while saving or showing solution
            >
                {Object.entries(q.options).map(([key, value]) => {
                    const isSelected = selectedOption === key;
                    const isCorrectOption = key === correctOption;
                    let optionStyle = "border-border hover:border-primary"; // Base style

                    if (isAnswerChecked) {
                        if (isSelected && isCorrectOption) {
                             optionStyle = "border-primary bg-green-100 dark:bg-green-900/30 ring-2 ring-green-500 dark:ring-green-400 text-green-700 dark:text-green-300";
                        } else if (isSelected && !isCorrectOption) {
                             optionStyle = "border-destructive bg-red-100 dark:bg-red-900/30 ring-2 ring-red-500 dark:ring-red-400 text-red-700 dark:text-red-300";
                        } else if (!isSelected && isCorrectOption) {
                             optionStyle = "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"; // Highlight correct if unselected
                        }
                    } else if (isSelected) {
                         optionStyle = "border-primary ring-2 ring-primary bg-primary/5"; // Highlight selected before check
                    }

                    return (
                         <Label
                            key={key}
                            htmlFor={`${questionId}-${key}`}
                            className={cn(
                                "flex items-start space-x-3 p-4 border rounded-lg transition-all",
                                optionStyle,
                                (showSolution || isSaving) ? "cursor-default opacity-70" : "cursor-pointer" // Adjust cursor and opacity
                            )}
                        >
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

    // Function to render explanation
    const renderExplanation = (q: QuestionBankItem) => {
        const hasText = q.explanation.text && q.explanation.text.trim().length > 0;
        const explanationImagePath = constructImagePath(q.subject, q.lesson, q.explanation.image);
        const hasImage = !!explanationImagePath;

        if (!hasText && !hasImage) return null; // No explanation to show

        return (
             <Card className="mt-6 bg-muted/40 dark:bg-muted/20 border-border">
                 <CardHeader>
                     <CardTitle className="text-lg">Explanation</CardTitle>
                 </CardHeader>
                 <CardContent>
                     {hasText && (
                         <div className="prose dark:prose-invert max-w-none mathjax-content" dangerouslySetInnerHTML={{ __html: q.explanation.text!.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}></div>
                     )}
                     {hasImage && (
                          <div className="relative w-full max-w-lg h-64 mx-auto mt-4">
                             <Image
                                 src={explanationImagePath!} // Assert non-null as hasImage is true
                                 alt={`Explanation Image`}
                                 layout="fill"
                                 objectFit="contain"
                                 className="rounded border"
                                 data-ai-hint="explanation image"
                                 onError={(e) => { console.error(`Error loading explanation image: ${explanationImagePath}`, e); }} // Simplified error logging
                                 unoptimized // Keep this if local images might cause issues
                             />
                             {/* Consider adding a fallback text display on error if needed */}
                          </div>
                     )}
                 </CardContent>
             </Card>
        );
    }

    // Helper to display PYQ info
     const renderPyqInfo = (q: QuestionBankItem) => {
        if (!q.isPyq || !q.pyqDetails) return null;
        const { exam, date, shift } = q.pyqDetails;
        return (
            <Badge variant="outline" className="text-xs text-muted-foreground">
                PYQ: {exam} ({new Date(date).getFullYear()} Shift {shift})
            </Badge>
        );
     }

     // Render previous attempt status
     const renderPreviousAttemptStatus = () => {
        if (isLoadingProgress) {
            return <Skeleton className="h-4 w-24" />;
        }
        if (lastAttempt) {
            const attemptDate = new Date(lastAttempt.timestamp).toLocaleDateString();
            const statusText = lastAttempt.isCorrect ? "Correct" : "Incorrect";
            const statusClass = lastAttempt.isCorrect ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
            return (
                <span className={`text-xs flex items-center gap-1 ${statusClass}`}>
                    <History className="h-3 w-3" /> Last Attempt ({attemptDate}): {statusText}
                </span>
            );
        }
        return <span className="text-xs text-muted-foreground">Not Attempted Before</span>;
    };


  if (isLoading || authLoading) { // Check authLoading as well
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
        <Skeleton className="h-8 w-1/2 mb-2" />
        <Skeleton className="h-6 w-3/4 mb-6" />
        <div className="flex gap-2 mb-4">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/4" />
             <Skeleton className="h-4 w-1/3" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-40 w-full mb-4" />
            <Skeleton className="h-10 w-full mb-2" />
            <Skeleton className="h-10 w-full mb-2" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
           <CardFooter className="flex justify-between">
                <Skeleton className="h-10 w-28" />
                <Skeleton className="h-10 w-28" />
           </CardFooter>
        </Card>
      </div>
    );
  }

  if (!user) { // Redirect if not logged in (after loading finishes)
     router.push('/auth/login?redirect=/dpp');
     return ( // Show loading while redirecting
        <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6 text-center">
             <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary"/>
             <p>Redirecting to login...</p>
        </div>
     );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
        <h1 className="text-2xl font-bold text-destructive">Error</h1>
        <p className="text-muted-foreground">{error}</p>
        <Button asChild variant="outline">
          <Link href="/dpp">Back to DPP List</Link>
        </Button>
      </div>
    );
  }

  if (!subject || !lesson) {
     return <div className="container mx-auto py-8 px-4 text-center">Loading lesson details...</div>;
  }

   if (filteredQuestions.length === 0) {
        return (
            <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
                <div className="mb-4">
                    <Link href="/dpp" className="text-sm text-muted-foreground hover:text-primary">
                    &larr; Back to DPP List
                    </Link>
                </div>
                 <h1 className="text-3xl font-bold tracking-tight">DPP: {lesson}</h1>
                 <p className="text-muted-foreground">Subject: {subject}</p>
                  {/* Filter buttons */}
                  <div className="flex flex-wrap items-center gap-2 mb-4 border-b pb-4">
                    <Filter className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium mr-2">Difficulty:</span>
                    {(['All', 'Easy', 'Medium', 'Hard'] as DifficultyFilter[]).map(diff => (
                        <Button
                        key={diff}
                        variant={selectedDifficulty === diff ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleDifficultyFilter(diff)}
                        >
                        {diff}
                        </Button>
                    ))}
                    {/* Add Sort button later */}
                    {/* <Button variant="outline" size="sm" className="ml-auto"><ArrowUpNarrowWide className="h-4 w-4 mr-1"/> Sort</Button> */}
                </div>
                 <Card>
                    <CardContent className="p-10 text-center text-muted-foreground">
                        No questions found matching the '{selectedDifficulty}' filter for this lesson.
                    </CardContent>
                 </Card>
             </div>
        );
    }

  return (
    <>
      {/* MathJax Script */}
       <Script
        id="mathjax-script-dpp" // Unique ID
        src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
        strategy="lazyOnload"
        onLoad={() => {
            console.log('MathJax loaded for DPP page.');
            typesetMathJax();
        }}
      />
      <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
        <div className="mb-4">
          <Link href="/dpp" className="text-sm text-muted-foreground hover:text-primary">
            &larr; Back to DPP List
          </Link>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">DPP: {lesson}</h1>
        <p className="text-muted-foreground">Subject: {subject}</p>

        {/* Filter buttons */}
        <div className="flex flex-wrap items-center gap-2 mb-4 border-b pb-4">
             <Filter className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium mr-2">Difficulty:</span>
            {(['All', 'Easy', 'Medium', 'Hard'] as DifficultyFilter[]).map(diff => (
                <Button
                key={diff}
                variant={selectedDifficulty === diff ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleDifficultyFilter(diff)}
                >
                {diff}
                </Button>
            ))}
            {/* <Button variant="outline" size="sm" className="ml-auto"><ArrowUpNarrowWide className="h-4 w-4 mr-1"/> Sort</Button> */}
        </div>

        {/* Question Display Card */}
        {currentQuestion ? (
            <Card className="shadow-md">
            <CardHeader>
                <div className="flex justify-between items-start flex-wrap gap-2">
                    <CardTitle>Question {currentQuestionIndex + 1} of {filteredQuestions.length}</CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                        {renderPyqInfo(currentQuestion)}
                        <Badge variant="secondary">{currentQuestion.difficulty}</Badge>
                         {/* Display previous attempt status */}
                         {renderPreviousAttemptStatus()}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {renderQuestionContent(currentQuestion)}
                {renderOptions(currentQuestion)}
                {showSolution && renderExplanation(currentQuestion)}
            </CardContent>
            <CardFooter className="flex justify-between items-center flex-wrap gap-2">
                <Button
                    variant="secondary"
                    onClick={checkAnswer}
                    disabled={showSolution || userAnswers[currentQuestion.id] === null || userAnswers[currentQuestion.id] === undefined || isSaving}
                >
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Check Answer
                </Button>
                {isCorrect !== null && (
                    <span className={`font-medium ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                        {isCorrect ? 'Correct!' : 'Incorrect'}
                    </span>
                )}
                <Button
                    onClick={goToNextQuestion}
                    disabled={!showSolution || isSaving} // Only enable Next after checking/showing solution and not saving
                >
                    {currentQuestionIndex === filteredQuestions.length - 1 ? 'Finish DPP' : 'Next Question'}
                </Button>
            </CardFooter>
            </Card>
        ) : (
             <Card>
                <CardContent className="p-10 text-center text-muted-foreground">
                    Loading question...
                </CardContent>
            </Card>
        )}
      </div>
    </>
  );
}

