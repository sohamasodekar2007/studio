// src/app/chapterwise-test/[testCode]/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getGeneratedTestByCode } from '@/actions/generated-test-actions';
import type { GeneratedTest, TestQuestion, UserAnswer, QuestionStatus, TestSession } from '@/types';
import { QuestionStatus as QuestionStatusEnum } from '@/types'; // Make sure enum is imported
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertTriangle, ArrowLeft, ArrowRight, Flag, XSquare, Send, Clock } from 'lucide-react';
import InstructionsDialog from '@/components/test-interface/instructions-dialog';
// import { Progress } from '@/components/ui/progress'; // Not used currently
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Image from 'next/image';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
// import Link from 'next/link'; // Not used currently
import Script from 'next/script'; // For MathJax

const QUESTION_STATUS_COLORS: Record<QuestionStatus, string> = {
  [QuestionStatusEnum.NotVisited]: 'bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200',
  [QuestionStatusEnum.Unanswered]: 'bg-red-400 hover:bg-red-500 text-white dark:bg-red-600 dark:hover:bg-red-500',
  [QuestionStatusEnum.Answered]: 'bg-green-500 hover:bg-green-600 text-white dark:bg-green-600 dark:hover:bg-green-500',
  [QuestionStatusEnum.MarkedForReview]: 'bg-purple-500 hover:bg-purple-600 text-white dark:bg-purple-600 dark:hover:bg-purple-500',
  [QuestionStatusEnum.AnsweredAndMarked]: 'bg-blue-500 hover:bg-blue-600 text-white dark:bg-blue-600 dark:hover:bg-blue-500',
};

export default function ChapterwiseTestPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const testCode = params.testCode as string;
  const userId = searchParams.get('userId');

  const [testData, setTestData] = useState<GeneratedTest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string | null>>({});
  const [questionStatuses, setQuestionStatuses] = useState<Record<number, QuestionStatus>>({});
  const [startTime, setStartTime] = useState<number | null>(null); // Track start time
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const typesetMathJax = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).MathJax) {
        (window as any).MathJax.typesetPromise?.().catch((err: any) => console.error("MathJax typesetting error:", err));
    }
  }, []);

  useEffect(() => {
      typesetMathJax();
  }, [currentQuestionIndex, testData, typesetMathJax]);


  const loadTest = useCallback(async () => {
    if (!testCode) {
      setError("Test code is missing.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await getGeneratedTestByCode(testCode);
       // Ensure it's chapterwise and has questions
       if (!data || data.testType !== 'chapterwise' || !data.questions || data.questions.length === 0) {
        setError("Chapterwise test not found, invalid, or has no questions.");
        setTestData(null);
      } else {
        setTestData(data);
        setTimeLeft(data.duration * 60);
        const initialStatuses: Record<number, QuestionStatus> = {};
        data.questions.forEach((_, index) => {
          initialStatuses[index] = QuestionStatusEnum.NotVisited;
        });
        if (data.questions.length > 0) {
             initialStatuses[0] = QuestionStatusEnum.Unanswered; // Mark first question as unanswered
        }
        setQuestionStatuses(initialStatuses);
        setStartTime(Date.now()); // Set start time when test data is loaded
        console.log("Test loaded, start time set:", Date.now());
      }
    } catch (err: any) {
      setError(err.message || "Failed to load test data.");
      setTestData(null);
    } finally {
      setIsLoading(false);
    }
  }, [testCode]);

  useEffect(() => {
    if (!authLoading && !user) {
      toast({ variant: 'destructive', title: 'Unauthorized', description: 'Please log in to take the test.' });
      router.push(`/auth/login?redirect=/take-test/${testCode}`); // Use take-test for redirect consistency
      return;
    }
    // Add check for userId mismatch if needed, though take-test might handle this better
    // if (!authLoading && user && userId && user.id !== userId) { ... }

    // If userId is missing but user is logged in, add it
     if (!authLoading && user && !userId) {
         router.replace(`/chapterwise-test/${testCode}?userId=${user.id}`);
         return;
     }

    if (userId) {
        loadTest();
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testCode, userId, authLoading, user, router, toast]); // Removed loadTest from dependency array to prevent re-triggering

  useEffect(() => {
    if (timeLeft <= 0 || showInstructions || !testData || isSubmitting || !startTime) return; // Added startTime check
    const timerId = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(timerId);
           console.log("Time up, auto-submitting...");
           if (!isSubmitting) handleSubmitTest(true); // Indicate auto-submit
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
    return () => clearInterval(timerId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, showInstructions, testData, isSubmitting, startTime]); // Add startTime to dependencies

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQuestion: TestQuestion | undefined = testData?.questions?.[currentQuestionIndex];

  const handleOptionChange = (optionKey: string) => {
    setUserAnswers(prev => ({ ...prev, [currentQuestionIndex]: optionKey }));
    setQuestionStatuses(prev => ({
      ...prev,
      [currentQuestionIndex]: prev[currentQuestionIndex] === QuestionStatusEnum.MarkedForReview || prev[currentQuestionIndex] === QuestionStatusEnum.AnsweredAndMarked
        ? QuestionStatusEnum.AnsweredAndMarked
        : QuestionStatusEnum.Answered,
    }));
  };

  const navigateQuestion = (index: number) => {
    if (index >= 0 && testData && testData.questions && index < testData.questions.length) {
       // Update status of the question being left *before* changing index
       const currentStatus = questionStatuses[currentQuestionIndex];
       if (currentStatus === QuestionStatusEnum.NotVisited && !userAnswers[currentQuestionIndex]) {
         setQuestionStatuses(prev => ({...prev, [currentQuestionIndex]: QuestionStatusEnum.Unanswered}));
       }

      setCurrentQuestionIndex(index);
      // Update status of the new question being visited
       if (questionStatuses[index] === QuestionStatusEnum.NotVisited) {
           setQuestionStatuses(prev => ({...prev, [index]: QuestionStatusEnum.Unanswered}));
       }
    }
  };

  const handleMarkForReview = () => {
    const currentStatus = questionStatuses[currentQuestionIndex];
    if (currentStatus === QuestionStatusEnum.Answered) {
      setQuestionStatuses(prev => ({ ...prev, [currentQuestionIndex]: QuestionStatusEnum.AnsweredAndMarked }));
    } else if (currentStatus === QuestionStatusEnum.AnsweredAndMarked) {
        setQuestionStatuses(prev => ({ ...prev, [currentQuestionIndex]: QuestionStatusEnum.Answered }));
    } else if (currentStatus === QuestionStatusEnum.MarkedForReview) {
        // If unmarking a marked question, revert to Unanswered or Answered based on whether an answer exists
         setQuestionStatuses(prev => ({ ...prev, [currentQuestionIndex]: userAnswers[currentQuestionIndex] ? QuestionStatusEnum.Answered : QuestionStatusEnum.Unanswered }));
    }
    else { // Unanswered or NotVisited
      setQuestionStatuses(prev => ({ ...prev, [currentQuestionIndex]: QuestionStatusEnum.MarkedForReview }));
    }
  };

  const handleClearResponse = () => {
    setUserAnswers(prev => ({ ...prev, [currentQuestionIndex]: null }));
    const currentStatus = questionStatuses[currentQuestionIndex];
    // If it was Answered & Marked, it becomes just Marked. Otherwise, it becomes Unanswered.
    if (currentStatus === QuestionStatusEnum.AnsweredAndMarked) {
        setQuestionStatuses(prev => ({ ...prev, [currentQuestionIndex]: QuestionStatusEnum.MarkedForReview }));
    } else {
        setQuestionStatuses(prev => ({ ...prev, [currentQuestionIndex]: QuestionStatusEnum.Unanswered }));
    }
  };

   const handleSubmitTest = useCallback(async (autoSubmit = false) => {
    if (!testData || !user || !userId || isSubmitting || !startTime) return;
     console.log(`Submitting test (Auto: ${autoSubmit})...`);
    setIsSubmitting(true);

    const endTime = Date.now();
    const attemptTimestamp = startTime; // Use the initial start time for the attempt ID
    const attemptId = `${testCode}-${userId}-${attemptTimestamp}`;

    const submittedAnswers: UserAnswer[] = (testData.questions || []).map((q, index) => ({
      // Use index as a simple identifier within this attempt if question IDs aren't stable/available
      // Ideally, `TestQuestion` should have a unique `id` from the question bank.
      questionId: `q-${index}`, // Example: use index if no stable ID
      selectedOption: userAnswers[index] || null,
      status: questionStatuses[index] || QuestionStatusEnum.NotVisited,
    }));

    const sessionData: TestSession = {
      testId: testCode,
      userId: userId,
      startTime: startTime, // Use the stored start time
      endTime: endTime,
      answers: submittedAnswers,
    };

    try {
      // Store result in local storage
      localStorage.setItem(`testResult-${attemptId}`, JSON.stringify(sessionData));
      console.log(`Test result saved to local storage with key: testResult-${attemptId}`);
      toast({ title: "Test Submitted!", description: "Your responses have been recorded." });

      // Redirect to results page, passing the unique attemptId
      router.push(`/chapterwise-test-results/${testCode}?userId=${userId}&attemptId=${attemptId}`);
    } catch (e: any) {
       console.error("Submission failed:", e);
       toast({ variant: 'destructive', title: 'Submission Failed', description: e.message || "Could not save your test results locally." });
       setIsSubmitting(false); // Allow retry if submission fails locally
    }
    // Note: No finally block needed here as navigation happens on success
  }, [testData, user, userId, isSubmitting, startTime, testCode, userAnswers, questionStatuses, toast, router]);


  if (isLoading || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted/30">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading test...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-destructive/10">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-destructive-foreground font-semibold text-lg">Error Loading Test</p>
        <p className="text-destructive-foreground/80 text-center mb-4">{error}</p>
        <Button onClick={() => router.push('/tests')}>Back to Test Series</Button>
      </div>
    );
  }

  if (!testData || !testData.questions || testData.questions.length === 0 || !currentQuestion) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted/30">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <p className="text-muted-foreground">Test data is unavailable or current question is missing.</p>
        <Button onClick={() => router.push('/tests')}>Back to Test Series</Button>
      </div>
    );
  }

  if (showInstructions) {
    return <InstructionsDialog isOpen={showInstructions} testData={testData} onProceed={() => setShowInstructions(false)} />;
  }

  const optionKeys = ["A", "B", "C", "D"];

   // Function to render question content (text or image)
   const renderQuestionContent = (question: TestQuestion) => {
     // Check if image_url exists and prioritize it
     if (question.image_url) {
       return (
         <Image
           src={question.image_url} // Use the direct URL
           alt={`Question ${currentQuestionIndex + 1}`}
           width={600} // Adjust as needed
           height={400} // Adjust as needed
           className="rounded-md border max-w-full h-auto mx-auto my-4" // Added margin
           data-ai-hint="question diagram" // Keep hint if useful
         />
       );
     }
     // Fallback to question text if image_url is not present
     else if (question.question_text) {
       return (
         <div
           className="prose dark:prose-invert max-w-none prose-sm md:prose-base"
           dangerouslySetInnerHTML={{
             __html: question.question_text
                       .replace(/\$(.*?)\$/g, '\\($1\\)')
                       .replace(/\$\$(.*?)\$\$/g, '\\[$1\\]')
           }}
         />
       );
     }
     // Fallback if neither image nor text is available
     return <p className="text-muted-foreground">Question content not available.</p>;
   };


  return (
    <>
    <Script
        src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
        strategy="lazyOnload"
        onLoad={() => {
          console.log('MathJax loaded for test page');
          typesetMathJax();
        }}
      />
    <div className="flex flex-col h-screen max-h-screen bg-muted overflow-hidden">
      <header className="flex items-center justify-between p-3 border-b bg-card shadow-sm">
        <h1 className="text-lg font-semibold truncate flex-1 mr-4">{testData.name}</h1>
        <div className="flex items-center gap-4">
            {user && (
                <div className="text-xs text-muted-foreground hidden sm:block">
                    {user.displayName} ({user.model})
                </div>
            )}
            <div className="flex items-center gap-1 text-primary font-medium bg-primary/10 px-3 py-1.5 rounded-md">
                <Clock className="h-4 w-4" />
                <span>{formatTime(timeLeft)}</span>
            </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>Question {currentQuestionIndex + 1} of {testData.questions.length}</span>
                <Badge variant="outline">Marks: {currentQuestion.marks}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
                {renderQuestionContent(currentQuestion)}
            </CardContent>
          </Card>

          <RadioGroup
            value={userAnswers[currentQuestionIndex] || undefined}
            onValueChange={handleOptionChange}
            className="space-y-3 mb-6"
          >
            {currentQuestion.options.map((optionText, idx) => {
              const optionKey = optionKeys[idx];
              return (
                <Label
                  key={optionKey}
                  htmlFor={`option-${optionKey}`}
                  className={cn(
                    "flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-all hover:border-primary",
                    userAnswers[currentQuestionIndex] === optionKey ? "border-primary bg-primary/5 ring-2 ring-primary" : "border-border"
                  )}
                >
                  <RadioGroupItem value={optionKey} id={`option-${optionKey}`} className="border-primary text-primary focus:ring-primary mt-1"/>
                  <span className="font-medium">{optionKey}.</span>
                   {/* Check if optionText might contain MathJax */}
                   {(optionText && (typeof optionText === 'string' && (optionText.includes('$') || optionText.includes('\\(') || optionText.includes('\\[')))) ? (
                     <div className="prose-sm dark:prose-invert max-w-none flex-1" dangerouslySetInnerHTML={{ __html: optionText.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }} />
                  ) : (
                    <span className="flex-1">{optionText || `Option ${optionKey}`}</span> // Display Option Key if text is empty
                  )}
                </Label>
              );
            })}
          </RadioGroup>

          <div className="flex flex-wrap gap-2 justify-between items-center mt-6">
            <div className="flex gap-2">
                 <Button variant="outline" onClick={handleMarkForReview} className="text-purple-600 border-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-400 dark:hover:bg-purple-900/30">
                    <Flag className="mr-2 h-4 w-4" />
                    {questionStatuses[currentQuestionIndex] === QuestionStatusEnum.MarkedForReview || questionStatuses[currentQuestionIndex] === QuestionStatusEnum.AnsweredAndMarked ? 'Unmark' : 'Mark for Review'}
                </Button>
                <Button variant="outline" onClick={handleClearResponse} disabled={!userAnswers[currentQuestionIndex]}>
                    <XSquare className="mr-2 h-4 w-4" /> Clear Response
                </Button>
            </div>
             <div className="flex gap-2">
                 <Button onClick={() => navigateQuestion(currentQuestionIndex - 1)} disabled={currentQuestionIndex === 0}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Previous
                </Button>
                {currentQuestionIndex < testData.questions.length - 1 ? (
                    <Button onClick={() => navigateQuestion(currentQuestionIndex + 1)}>
                        Next <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                ) : (
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                                Submit Test
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Confirm Submission</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to submit the test? You cannot change your answers after submission.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleSubmitTest(false)} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                Yes, Submit
                            </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>
          </div>
        </main>

        <aside className="w-64 md:w-72 border-l bg-card p-4 overflow-y-auto hidden lg:block">
          <h3 className="font-semibold mb-3 text-center">Question Palette</h3>
          <div className="grid grid-cols-4 md:grid-cols-5 gap-2">
            {(testData.questions || []).map((_, index) => (
              <Button
                key={index}
                variant="outline"
                size="icon"
                className={cn(
                  "h-9 w-9 text-xs font-medium",
                  QUESTION_STATUS_COLORS[questionStatuses[index] || QuestionStatusEnum.NotVisited],
                  currentQuestionIndex === index && "ring-2 ring-offset-2 ring-primary"
                )}
                onClick={() => navigateQuestion(index)}
              >
                {index + 1}
              </Button>
            ))}
          </div>
          <div className="mt-4 space-y-1 text-xs text-muted-foreground">
            <p><span className={cn("inline-block w-3 h-3 rounded-sm mr-1.5 align-middle", QUESTION_STATUS_COLORS[QuestionStatusEnum.Answered])}></span> Answered</p>
            <p><span className={cn("inline-block w-3 h-3 rounded-sm mr-1.5 align-middle", QUESTION_STATUS_COLORS[QuestionStatusEnum.Unanswered])}></span> Not Answered</p>
            <p><span className={cn("inline-block w-3 h-3 rounded-sm mr-1.5 align-middle", QUESTION_STATUS_COLORS[QuestionStatusEnum.NotVisited])}></span> Not Visited</p>
            <p><span className={cn("inline-block w-3 h-3 rounded-sm mr-1.5 align-middle", QUESTION_STATUS_COLORS[QuestionStatusEnum.MarkedForReview])}></span> Marked for Review</p>
            <p><span className={cn("inline-block w-3 h-3 rounded-sm mr-1.5 align-middle", QUESTION_STATUS_COLORS[QuestionStatusEnum.AnsweredAndMarked])}></span> Answered & Marked</p>
          </div>
           <div className="mt-6 text-center">
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                            Submit Test
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Submission</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to submit the test? You cannot change your answers after submission.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleSubmitTest(false)} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
                             {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Yes, Submit
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
           </div>
        </aside>
      </div>
    </div>
    </>
  );
}
