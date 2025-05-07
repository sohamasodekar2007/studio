
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getGeneratedTestByCode } from '@/actions/generated-test-actions';
import type { GeneratedTest, TestQuestion, UserAnswer, QuestionStatus, TestSession } from '@/types';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertTriangle, ArrowLeft, ArrowRight, Flag, Sparkles, XSquare, Send } from 'lucide-react';
import InstructionsDialog from '@/components/test-interface/instructions-dialog';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Image from 'next/image';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import Link from 'next/link';
// Placeholder for server action to save test results
// import { saveChapterwiseTestAttempt } from '@/actions/test-submission-actions';

const QUESTION_STATUS_COLORS: Record<QuestionStatus, string> = {
  [QuestionStatus.NotVisited]: 'bg-gray-200 hover:bg-gray-300 text-gray-700',
  [QuestionStatus.Unanswered]: 'bg-red-400 hover:bg-red-500 text-white',
  [QuestionStatus.Answered]: 'bg-green-500 hover:bg-green-600 text-white',
  [QuestionStatus.MarkedForReview]: 'bg-purple-500 hover:bg-purple-600 text-white',
  [QuestionStatus.AnsweredAndMarked]: 'bg-blue-500 hover:bg-blue-600 text-white',
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
  const [userAnswers, setUserAnswers] = useState<Record<number, string | null>>({}); // { questionIndex: selectedOptionKey }
  const [questionStatuses, setQuestionStatuses] = useState<Record<number, QuestionStatus>>({});
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const [isSubmitting, setIsSubmitting] = useState(false);

  // MathJax typesetting
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).MathJax) {
      (window as any).MathJax.typesetPromise?.();
    }
  }, [currentQuestionIndex, testData]);


  const loadTest = useCallback(async () => {
    if (!testCode) {
      setError("Test code is missing.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await getGeneratedTestByCode(testCode);
      if (!data || data.testType !== 'chapterwise' || !data.questions || data.questions.length === 0) {
        setError("Test not found, invalid, or has no questions.");
        setTestData(null);
      } else {
        setTestData(data as GeneratedTest); // Type assertion
        setTimeLeft(data.duration * 60);
        const initialStatuses: Record<number, QuestionStatus> = {};
        data.questions.forEach((_, index) => {
          initialStatuses[index] = QuestionStatus.NotVisited;
        });
        setQuestionStatuses(initialStatuses);
        // Mark first question as unanswered (or not visited if preferred)
        if (data.questions.length > 0) {
             setQuestionStatuses(prev => ({...prev, 0: QuestionStatus.Unanswered}));
        }
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
      router.push(`/auth/login?redirect=/chapterwise-test/${testCode}${userId ? `?userId=${userId}` : ''}`);
      return;
    }
    if (!authLoading && user && userId && user.id.toString() !== userId) {
        toast({ variant: 'destructive', title: 'Access Denied', description: 'You are trying to access a test for another user.'});
        router.push('/');
        return;
    }
    if (!authLoading && user && !userId) {
        // If userId is not in query params, redirect to the same page with userId from auth context
        router.replace(`/chapterwise-test/${testCode}?userId=${user.id}`);
        return;
    }

    if (userId) { // Only load if userId is confirmed
        loadTest();
    }
  }, [testCode, userId, authLoading, user, router, toast, loadTest]);

  // Timer effect
  useEffect(() => {
    if (timeLeft <= 0 || showInstructions || !testData) return;
    const timerId = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(timerId);
          handleSubmitTest(); // Auto-submit when time is up
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
    return () => clearInterval(timerId);
  }, [timeLeft, showInstructions, testData]); // handleSubmitTest dependency will be added if it's memoized

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
      [currentQuestionIndex]: prev[currentQuestionIndex] === QuestionStatus.MarkedForReview || prev[currentQuestionIndex] === QuestionStatus.AnsweredAndMarked
        ? QuestionStatus.AnsweredAndMarked
        : QuestionStatus.Answered,
    }));
  };

  const navigateQuestion = (index: number) => {
    if (index >= 0 && testData && index < testData.questions.length) {
      // Update status of current question before navigating if it was 'NotVisited' or 'Unanswered' and no answer was made
      if (questionStatuses[currentQuestionIndex] === QuestionStatus.NotVisited && !userAnswers[currentQuestionIndex]) {
           setQuestionStatuses(prev => ({...prev, [currentQuestionIndex]: QuestionStatus.Unanswered}));
      }

      setCurrentQuestionIndex(index);
      // Update status of new question to 'Unanswered' if it's 'NotVisited'
       if (questionStatuses[index] === QuestionStatus.NotVisited) {
           setQuestionStatuses(prev => ({...prev, [index]: QuestionStatus.Unanswered}));
       }
    }
  };

  const handleMarkForReview = () => {
    const currentStatus = questionStatuses[currentQuestionIndex];
    if (currentStatus === QuestionStatus.Answered) {
      setQuestionStatuses(prev => ({ ...prev, [currentQuestionIndex]: QuestionStatus.AnsweredAndMarked }));
    } else if (currentStatus === QuestionStatus.AnsweredAndMarked) {
        // Toggle back to Answered if already AnsweredAndMarked
        setQuestionStatuses(prev => ({ ...prev, [currentQuestionIndex]: QuestionStatus.Answered }));
    } else if (currentStatus === QuestionStatus.MarkedForReview) {
        // Toggle back to Unanswered (or NotVisited if preferred)
        setQuestionStatuses(prev => ({ ...prev, [currentQuestionIndex]: userAnswers[currentQuestionIndex] ? QuestionStatus.Answered : QuestionStatus.Unanswered }));
    }
    else { // Unanswered or NotVisited
      setQuestionStatuses(prev => ({ ...prev, [currentQuestionIndex]: QuestionStatus.MarkedForReview }));
    }
  };

  const handleClearResponse = () => {
    setUserAnswers(prev => ({ ...prev, [currentQuestionIndex]: null }));
    // If it was answered/marked, revert to just marked or unanswered
    const currentStatus = questionStatuses[currentQuestionIndex];
    if (currentStatus === QuestionStatus.AnsweredAndMarked) {
        setQuestionStatuses(prev => ({ ...prev, [currentQuestionIndex]: QuestionStatus.MarkedForReview }));
    } else {
        setQuestionStatuses(prev => ({ ...prev, [currentQuestionIndex]: QuestionStatus.Unanswered }));
    }
  };

  const handleSubmitTest = async () => {
    if (!testData || !user || !userId) return;
    setIsSubmitting(true);

    const attemptId = `${testCode}-${userId}-${Date.now()}`;
    const submittedAnswers: UserAnswer[] = (testData.questions || []).map((q, index) => ({
      questionId: q.id || `q-${index}`, // Fallback if question ID from bank isn't in TestQuestion
      selectedOption: userAnswers[index] || null,
      status: questionStatuses[index] || QuestionStatus.NotVisited,
    }));

    const sessionData: TestSession = {
      testId: testCode,
      userId: userId,
      startTime: Date.now() - ((testData.duration * 60) - timeLeft) * 1000, // Approximate start time
      endTime: Date.now(),
      answers: submittedAnswers,
      // Score calculation would happen here or on the results page
    };

    console.log("Submitting test session:", sessionData);

    // Placeholder for saving to local JSON
    try {
      // Simulate saving (in a real app, this would be an API call/server action)
      // await saveChapterwiseTestAttempt(sessionData); // Example server action call
      localStorage.setItem(`testResult-${attemptId}`, JSON.stringify(sessionData));

      toast({ title: "Test Submitted!", description: "Your responses have been recorded." });
      // Redirect to a results page (to be created)
      router.push(`/chapterwise-test-results/${testCode}?userId=${userId}&attemptId=${attemptId}`);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Submission Failed', description: e.message || "Could not submit your test." });
      setIsSubmitting(false);
    }
  };


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

  if (!testData || !currentQuestion) {
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

  return (
    <div className="flex flex-col h-screen max-h-screen bg-muted overflow-hidden">
      {/* Test Header */}
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
        {/* Main Content Area (Question + Options) */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>Question {currentQuestionIndex + 1} of {testData.questions.length}</span>
                <Badge variant="outline">Marks: {currentQuestion.marks}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none prose-sm md:prose-base">
              {currentQuestion.type === 'image' && currentQuestion.image_url ? (
                <Image src={currentQuestion.image_url} alt={`Question ${currentQuestionIndex + 1}`} width={600} height={400} className="rounded-md border max-w-full h-auto mx-auto" data-ai-hint="question diagram physics" />
              ) : currentQuestion.question ? (
                <div dangerouslySetInnerHTML={{ __html: currentQuestion.question.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }} />
              ) : (
                <p>Question content not available.</p>
              )}
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
                    "flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-all hover:border-primary",
                    userAnswers[currentQuestionIndex] === optionKey ? "border-primary bg-primary/5 ring-2 ring-primary" : "border-border"
                  )}
                >
                  <RadioGroupItem value={optionKey} id={`option-${optionKey}`} className="border-primary text-primary focus:ring-primary"/>
                  <span className="font-medium">{optionKey}.</span>
                  {currentQuestion.type === 'text' && optionText ? (
                     <div className="prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: optionText.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }} />
                  ) : (
                    <span>{optionText}</span> // For image questions, options are just "A", "B", "C", "D" typically
                  )}
                </Label>
              );
            })}
          </RadioGroup>

          <div className="flex flex-wrap gap-2 justify-between items-center mt-6">
            <div className="flex gap-2">
                 <Button variant="outline" onClick={handleMarkForReview} className="text-purple-600 border-purple-600 hover:bg-purple-50">
                    <Flag className="mr-2 h-4 w-4" />
                    {questionStatuses[currentQuestionIndex] === QuestionStatus.MarkedForReview || questionStatuses[currentQuestionIndex] === QuestionStatus.AnsweredAndMarked ? 'Unmark' : 'Mark for Review'}
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
                            <AlertDialogAction onClick={handleSubmitTest} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
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

        {/* Question Navigation Panel */}
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
                  QUESTION_STATUS_COLORS[questionStatuses[index] || QuestionStatus.NotVisited],
                  currentQuestionIndex === index && "ring-2 ring-offset-2 ring-primary"
                )}
                onClick={() => navigateQuestion(index)}
              >
                {index + 1}
              </Button>
            ))}
          </div>
          <div className="mt-4 space-y-1 text-xs text-muted-foreground">
            <p><span className={cn("inline-block w-3 h-3 rounded-sm mr-1.5", QUESTION_STATUS_COLORS[QuestionStatus.Answered])}></span> Answered</p>
            <p><span className={cn("inline-block w-3 h-3 rounded-sm mr-1.5", QUESTION_STATUS_COLORS[QuestionStatus.Unanswered])}></span> Not Answered</p>
            <p><span className={cn("inline-block w-3 h-3 rounded-sm mr-1.5", QUESTION_STATUS_COLORS[QuestionStatus.NotVisited])}></span> Not Visited</p>
            <p><span className={cn("inline-block w-3 h-3 rounded-sm mr-1.5", QUESTION_STATUS_COLORS[QuestionStatus.MarkedForReview])}></span> Marked for Review</p>
            <p><span className={cn("inline-block w-3 h-3 rounded-sm mr-1.5", QUESTION_STATUS_COLORS[QuestionStatus.AnsweredAndMarked])}></span> Answered & Marked</p>
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
                        <AlertDialogAction onClick={handleSubmitTest} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
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
  );
}
