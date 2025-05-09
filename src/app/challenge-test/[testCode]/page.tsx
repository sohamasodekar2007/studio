// src/app/challenge-test/[testCode]/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getChallengeDetails, submitChallengeAttempt } from '@/actions/challenge-actions';
import type { Challenge, TestQuestion, UserAnswer, QuestionStatus } from '@/types';
import { QuestionStatus as QuestionStatusEnum } from '@/types';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertTriangle, ArrowLeft, ArrowRight, Flag, XSquare, Send, Clock, Users } from 'lucide-react';
import Image from 'next/image';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Script from 'next/script';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const QUESTION_STATUS_COLORS: Record<QuestionStatus, string> = {
  [QuestionStatusEnum.NotVisited]: 'bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200',
  [QuestionStatusEnum.Unanswered]: 'bg-red-400 hover:bg-red-500 text-white dark:bg-red-600 dark:hover:bg-red-500',
  [QuestionStatusEnum.Answered]: 'bg-green-500 hover:bg-green-600 text-white dark:bg-green-600 dark:hover:bg-green-500',
  [QuestionStatusEnum.MarkedForReview]: 'bg-purple-500 hover:bg-purple-600 text-white dark:bg-purple-600 dark:hover:bg-purple-500',
  [QuestionStatusEnum.AnsweredAndMarked]: 'bg-blue-500 hover:bg-blue-600 text-white dark:bg-blue-600 dark:hover:bg-blue-500',
};

export default function ChallengeTestInterfacePage() { // Renamed component for clarity
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const testCode = params.testCode as string; 
  const userId = searchParams.get('userId'); 

  const [challengeData, setChallengeData] = useState<Challenge | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string | null>>({});
  const [questionStatuses, setQuestionStatuses] = useState<Record<number, QuestionStatus>>({});
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const currentQuestion: TestQuestion | undefined = challengeData?.questions?.[currentQuestionIndex];
  useEffect(() => {
    if (!isLoading && challengeData && currentQuestion) {
        const timerId = setTimeout(() => {
            typesetMathJax();
        }, 50);
        return () => clearTimeout(timerId);
    }
  }, [isLoading, challengeData, currentQuestionIndex, typesetMathJax, currentQuestion]);


  const loadChallenge = useCallback(async () => {
    if (!testCode) { 
      setError("Challenge code is missing.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await getChallengeDetails(testCode); 
      if (!data) {
        setError("Challenge not found or has expired.");
        setChallengeData(null);
      } else if (data.testStatus !== 'started') {
        setError(`Challenge is not active. Status: ${data.testStatus}. Redirecting to lobby...`);
        setChallengeData(data); 
        setTimeout(() => router.push(`/challenge/lobby/${testCode}`), 3000); 
      }
      else {
        setChallengeData(data);
        // Calculate duration based on number of questions, e.g., 1.5 mins per question
        const challengeDurationMinutes = data.testConfig.numQuestions * 1.5; 
        setTimeLeft(challengeDurationMinutes * 60);
        const initialStatuses: Record<number, QuestionStatus> = {};
        data.questions.forEach((_, index) => {
          initialStatuses[index] = QuestionStatusEnum.NotVisited;
        });
        if (data.questions.length > 0) {
             initialStatuses[0] = QuestionStatusEnum.Unanswered;
        }
        setQuestionStatuses(initialStatuses);
        setStartTime(Date.now());
      }
    } catch (err: any) {
      setError(err.message || "Failed to load challenge data.");
    } finally {
      setIsLoading(false);
    }
  }, [testCode, router]); 

  useEffect(() => {
    if (!authLoading) {
        if (!user) {
          router.push(`/auth/login?redirect=/challenge-test/${testCode}?userId=${userId}`); 
          return;
        }
        if (user.id !== userId) {
            toast({ variant: 'destructive', title: 'Forbidden', description: 'Invalid user for this challenge test.' });
            router.push(`/challenges/invites`);
            return;
        }
        loadChallenge();
    }
  }, [testCode, userId, authLoading, user, router, toast, loadChallenge]); 

  const handleSubmitTest = useCallback(async (autoSubmit = false) => {
    if (!challengeData || !user || !userId || isSubmitting || !startTime) return;
    setIsSubmitting(true);

    const timeTakenSeconds = (challengeData.testConfig.numQuestions * 1.5 * 60) - timeLeft; // Use initial total time - time left

    const submittedAnswers: UserAnswer[] = (challengeData.questions || []).map((q, index) => ({
      questionId: q.id || `q-${index}`,
      selectedOption: userAnswers[index] || null,
      status: questionStatuses[index] || QuestionStatusEnum.NotVisited,
    }));

    try {
        const result = await submitChallengeAttempt(testCode, userId, submittedAnswers, timeTakenSeconds); 
        if (result.success) {
             toast({ title: "Challenge Submitted!", description: "Your responses have been saved." });
             router.push(`/challenge-test-result/${testCode}`); 
        } else {
             throw new Error(result.message || "Failed to submit challenge attempt.");
        }
    } catch (e: any) {
       toast({ variant: 'destructive', title: 'Submission Failed', description: e.message });
       setIsSubmitting(false);
    }
  }, [challengeData, user, userId, isSubmitting, startTime, testCode, userAnswers, questionStatuses, toast, router, timeLeft]); 

  useEffect(() => {
    if (timeLeft <= 0 || !challengeData || isSubmitting || !startTime || challengeData.testStatus !== 'started') return;
    const timerId = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(timerId);
          if (!isSubmitting) handleSubmitTest(true);
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
    return () => clearInterval(timerId);
  }, [timeLeft, challengeData, isSubmitting, startTime, handleSubmitTest]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };


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
    if (index >= 0 && challengeData && challengeData.questions && index < challengeData.questions.length) {
       const currentStatus = questionStatuses[currentQuestionIndex];
       if (currentStatus === QuestionStatusEnum.NotVisited && !userAnswers[currentQuestionIndex]) {
         setQuestionStatuses(prev => ({...prev, [currentQuestionIndex]: QuestionStatusEnum.Unanswered}));
       }
      setCurrentQuestionIndex(index);
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
         setQuestionStatuses(prev => ({ ...prev, [currentQuestionIndex]: QuestionStatusEnum.Unanswered }));
    }
    else { 
      setQuestionStatuses(prev => ({ ...prev, [currentQuestionIndex]: QuestionStatusEnum.MarkedForReview }));
    }
  };
  const handleClearResponse = () => { 
     setUserAnswers(prev => ({ ...prev, [currentQuestionIndex]: null }));
    const currentStatus = questionStatuses[currentQuestionIndex];
    if (currentStatus === QuestionStatusEnum.AnsweredAndMarked) {
        setQuestionStatuses(prev => ({ ...prev, [currentQuestionIndex]: QuestionStatusEnum.MarkedForReview }));
    } else {
        setQuestionStatuses(prev => ({ ...prev, [currentQuestionIndex]: QuestionStatusEnum.Unanswered }));
    }
  };

  if (isLoading || authLoading) { 
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted/30">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading Challenge Test...</p>
      </div>
    );
  }
  if (error) { 
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-destructive/10">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-destructive-foreground font-semibold text-lg">Error Loading Challenge</p>
        <p className="text-destructive-foreground/80 text-center mb-4">{error}</p>
        <Button onClick={() => router.push('/challenges/invites')}>Back to Invites</Button>
      </div>
    );
  }
  if (!challengeData || !challengeData.questions || challengeData.questions.length === 0 || !currentQuestion) { 
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted/30">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <p className="text-muted-foreground">Challenge data is unavailable or has no questions.</p>
         <Button onClick={() => router.push('/challenges/invites')}>Back to Invites</Button>
      </div>
    );
  }
   const optionKeys = ["A", "B", "C", "D"];
   const getInitials = (name?: string | null) => name ? name.charAt(0).toUpperCase() : '?';

   const renderQuestionContent = (question: TestQuestion) => {
     const imageUrl = question.question_image_url;
     if (imageUrl && (imageUrl.startsWith('/') || imageUrl.startsWith('http'))) {
       return <Image src={imageUrl} alt={`Question ${currentQuestionIndex + 1}`} width={600} height={400} className="rounded-md border max-w-full h-auto mx-auto my-4" data-ai-hint="question diagram" priority={currentQuestionIndex < 3} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} unoptimized />;
     } else if (question.question_text || question.question) {
       const textContent = question.question_text || question.question || '';
       return <div className="prose dark:prose-invert max-w-none prose-sm md:prose-base mathjax-content" dangerouslySetInnerHTML={{ __html: textContent.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }} />;
     }
     return <p className="text-muted-foreground">Question content not available.</p>;
   };

   const renderOptionContent = (optionText: string | null | undefined) => {
        if (!optionText) return null;
        const containsMathJax = (typeof optionText === 'string' && (optionText.includes('$') || optionText.includes('\\(') || optionText.includes('\\[')));
        if (containsMathJax) {
            return <div className="prose-sm dark:prose-invert max-w-none flex-1 mathjax-content" dangerouslySetInnerHTML={{ __html: optionText.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }} />;
        } else {
            return <span className="flex-1">{optionText}</span>;
        }
    };


  return (
    <>
    <Script id="mathjax-script-challenge-test" src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" strategy="lazyOnload" onLoad={() => typesetMathJax()} />
    <div className="flex flex-col h-screen max-h-screen bg-muted overflow-hidden">
      <header className="flex items-center justify-between p-3 border-b bg-card shadow-sm">
        <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <div className="flex -space-x-2 overflow-hidden">
                {Object.values(challengeData.participants).slice(0,3).map(p => (
                     <Avatar key={p.userId} className="inline-block h-6 w-6 rounded-full ring-2 ring-background">
                        <AvatarImage src={p.avatarUrl ? `/avatars/${p.avatarUrl}` : `https://avatar.vercel.sh/${p.userId}.png`} />
                        <AvatarFallback>{getInitials(p.name)}</AvatarFallback>
                    </Avatar>
                ))}
                {Object.keys(challengeData.participants).length > 3 && <span className="text-xs pl-3 pt-1 text-muted-foreground">+{Object.keys(challengeData.participants).length-3}</span>}
            </div>
        </div>
        <h1 className="text-sm md:text-base font-semibold truncate flex-1 text-center">{challengeData.testConfig.subject} - {challengeData.testConfig.lesson}</h1>
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-primary font-medium bg-primary/10 px-2 py-1 rounded-md text-sm">
                <Clock className="h-4 w-4" />
                <span>{formatTime(timeLeft)}</span>
            </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex justify-between items-center text-base md:text-lg">
                <span>Question {currentQuestionIndex + 1} of {challengeData.questions.length}</span>
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
            disabled={isSubmitting}
          >
            {currentQuestion.options.map((optionText, idx) => {
              const optionKey = optionKeys[idx];
              return (
                <Label
                  key={optionKey}
                  htmlFor={`option-${optionKey}`}
                  className={cn(
                    "flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-all hover:border-primary text-sm md:text-base",
                    userAnswers[currentQuestionIndex] === optionKey ? "border-primary bg-primary/5 ring-2 ring-primary" : "border-border",
                    isSubmitting && "opacity-70 cursor-not-allowed"
                  )}
                >
                  <RadioGroupItem value={optionKey} id={`option-${optionKey}`} className="border-primary text-primary focus:ring-primary mt-1"/>
                  <span className="font-medium">{optionKey}.</span>
                   {renderOptionContent(optionText)}
                </Label>
              );
            })}
          </RadioGroup>

          <div className="flex flex-wrap gap-2 justify-between items-center mt-6">
            <div className="flex gap-2">
                 <Button variant="outline" onClick={handleMarkForReview} disabled={isSubmitting} className="text-purple-600 border-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-400 dark:hover:bg-purple-900/30">
                    <Flag className="mr-2 h-4 w-4" />
                    {questionStatuses[currentQuestionIndex] === QuestionStatusEnum.MarkedForReview || questionStatuses[currentQuestionIndex] === QuestionStatusEnum.AnsweredAndMarked ? 'Unmark' : 'Mark'}
                </Button>
                <Button variant="outline" onClick={handleClearResponse} disabled={!userAnswers[currentQuestionIndex] || isSubmitting}>
                    <XSquare className="mr-2 h-4 w-4" /> Clear
                </Button>
            </div>
             <div className="flex gap-2">
                 <Button onClick={() => navigateQuestion(currentQuestionIndex - 1)} disabled={currentQuestionIndex === 0 || isSubmitting}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Prev
                </Button>
                {currentQuestionIndex < challengeData.questions.length - 1 ? (
                    <Button onClick={() => navigateQuestion(currentQuestionIndex + 1)} disabled={isSubmitting}>
                        Next <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                ) : (
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                                Submit
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Confirm Submission</AlertDialogTitle><AlertDialogDescription>Are you sure you want to submit the challenge?</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleSubmitTest(false)} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Submit</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>
          </div>
        </main>

        <aside className="w-64 md:w-72 border-l bg-card p-4 overflow-y-auto hidden lg:block">
          <h3 className="font-semibold mb-3 text-center text-sm">Question Palette</h3>
          <div className="grid grid-cols-4 md:grid-cols-5 gap-1.5">
            {(challengeData.questions || []).map((_, index) => (
              <Button key={index} variant="outline" size="icon"
                className={cn("h-8 w-8 text-xs font-medium", QUESTION_STATUS_COLORS[questionStatuses[index] || QuestionStatusEnum.NotVisited], currentQuestionIndex === index && "ring-2 ring-offset-2 ring-primary")}
                onClick={() => navigateQuestion(index)} disabled={isSubmitting}>
                {index + 1}
              </Button>
            ))}
          </div>
           <div className="mt-6 text-center">
                 <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="destructive" className="w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Submit Test</Button></AlertDialogTrigger>
                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirm Submission</AlertDialogTitle><AlertDialogDescription>Are you sure you want to submit the challenge?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleSubmitTest(false)} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Yes, Submit</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                </AlertDialog>
           </div>
        </aside>
      </div>
    </div>
    </>
  );
}
