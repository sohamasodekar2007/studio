// src/components/test-interface/test-layout-client.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import type { GeneratedTest, TestQuestion, UserAnswer, QuestionStatus, TestSession, ChapterwiseTestJson, FullLengthTestJson } from '@/types';
import { QuestionStatus as QuestionStatusEnum } from '@/types';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, AlertTriangle, ArrowLeft, ArrowRight, Flag, XSquare, Send, CheckSquare } from 'lucide-react';
import InstructionsDialog from '@/components/test-interface/instructions-dialog';
import TestHeaderBar from '@/components/test-interface/test-header-bar';
import QuestionPalette from '@/components/test-interface/question-palette';
import Image from 'next/image';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Script from 'next/script';
import { saveTestReport } from '@/actions/test-report-actions';
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

interface TestLayoutClientProps {
  initialTestData: GeneratedTest;
}

interface InProgressTestState {
  testCode: string;
  userId: string;
  startTime: number;
  timeLeft: number;
  currentGlobalIndex: number;
  currentSection: string;
  currentQuestionIndexInSection: number;
  userAnswers: Record<string, string | null>; // question.id -> selectedOption
  questionStatuses: Record<string, QuestionStatus>; // question.id -> status
}

export default function TestLayoutClient({ initialTestData }: TestLayoutClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams(); 
  const params = useParams(); 
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const testCode = params.testCode as string;
  const queryUserId = searchParams.get('userId');

  const [testData, setTestData] = useState<GeneratedTest>(initialTestData);
  const [isLoading, setIsLoading] = useState(false); 
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  
  const initialSection = useMemo(() => {
    if (initialTestData.testType === 'full_length') {
        if (initialTestData.physics_questions && initialTestData.physics_questions.length > 0) return 'Physics';
        if (initialTestData.chemistry_questions && initialTestData.chemistry_questions.length > 0) return 'Chemistry';
        if (initialTestData.maths_questions && initialTestData.maths_questions.length > 0) return 'Mathematics';
        if (initialTestData.biology_questions && initialTestData.biology_questions.length > 0) return 'Biology';
    }
    return initialTestData.test_subject[0] || 'Overall'; 
  }, [initialTestData]);

  const [currentSection, setCurrentSection] = useState<string>(initialSection);
  const [currentQuestionIndexInSection, setCurrentQuestionIndexInSection] = useState(0);
  
  const [userAnswers, setUserAnswers] = useState<Record<string, string | null>>({}); 
  const [questionStatuses, setQuestionStatuses] = useState<Record<string, QuestionStatus>>({}); 
  
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(initialTestData.duration * 60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isResuming, setIsResuming] = useState(true); 

  const allQuestionsInOrder = useMemo(() => {
    if (!testData) return [];
    if (testData.testType === 'chapterwise') {
      return testData.questions || [];
    } else if (testData.testType === 'full_length') {
      const questions: TestQuestion[] = [];
      if (testData.physics_questions) questions.push(...testData.physics_questions);
      if (testData.chemistry_questions) questions.push(...testData.chemistry_questions);
      if (testData.maths_questions) questions.push(...testData.maths_questions);
      if (testData.biology_questions) questions.push(...testData.biology_questions);
      return questions;
    }
    return [];
  }, [testData]);

  const questionsBySection = useMemo(() => {
    if (!testData) return {};
    const sections: Record<string, TestQuestion[]> = {};
    if (testData.testType === 'chapterwise' && testData.questions) {
        const sectionName = testData.test_subject[0] || 'Questions';
        sections[sectionName] = testData.questions;
    } else if (testData.testType === 'full_length') {
        if (testData.physics_questions && testData.physics_questions.length > 0) sections['Physics'] = testData.physics_questions;
        if (testData.chemistry_questions && testData.chemistry_questions.length > 0) sections['Chemistry'] = testData.chemistry_questions;
        if (testData.maths_questions && testData.maths_questions.length > 0) sections['Mathematics'] = testData.maths_questions;
        if (testData.biology_questions && testData.biology_questions.length > 0) sections['Biology'] = testData.biology_questions;
    }
    return sections;
  }, [testData]);

  const currentSectionQuestions = useMemo(() => {
    return questionsBySection[currentSection] || [];
  }, [questionsBySection, currentSection]);

  const currentQuestion = useMemo(() => {
    return currentSectionQuestions[currentQuestionIndexInSection];
  }, [currentSectionQuestions, currentQuestionIndexInSection]);

  const globalQuestionIndex = useMemo(() => {
    if (!currentQuestion) return -1;
    return allQuestionsInOrder.findIndex(q => q.id === currentQuestion.id);
  }, [allQuestionsInOrder, currentQuestion]);


  const typesetMathJax = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).MathJax?.typesetPromise) {
      (window as any).MathJax.typesetPromise()
        .catch((err: any) => console.error("MathJax typeset error:", err));
    }
  }, []);

  useEffect(() => {
    if (currentQuestion && !showInstructions && !isLoading) { 
      typesetMathJax();
    }
  }, [currentQuestion, showInstructions, typesetMathJax, isLoading]);

  // Load from local storage on mount
  useEffect(() => {
    if (!user?.id || !testCode || authLoading || !isResuming) return;

    const savedSessionKey = `test-session-${user.id}-${testCode}`;
    const savedSessionJson = localStorage.getItem(savedSessionKey);

    let initialStatuses: Record<string, QuestionStatus> = {};
    allQuestionsInOrder.forEach((q, index) => {
        if (q.id) { // Ensure question ID exists
            initialStatuses[q.id] = index === 0 ? QuestionStatusEnum.Unanswered : QuestionStatusEnum.NotVisited;
        }
    });

    if (savedSessionJson) {
        try {
            const savedState: InProgressTestState = JSON.parse(savedSessionJson);
            if (savedState.testCode === testCode && savedState.userId === user.id) {
                setStartTime(savedState.startTime);
                setTimeLeft(savedState.timeLeft);
                setCurrentSection(savedState.currentSection || initialSection);
                setCurrentQuestionIndexInSection(savedState.currentQuestionIndexInSection || 0);
                setUserAnswers(savedState.userAnswers || {});
                // Merge saved statuses with initial ones to ensure all questions have a status
                setQuestionStatuses({...initialStatuses, ...(savedState.questionStatuses || {})});
                setShowInstructions(false); 
                toast({ title: "Test Resumed", description: "Your previous progress has been loaded." });
            } else {
                 localStorage.removeItem(savedSessionKey); // Invalid saved state for this test/user
                 setQuestionStatuses(initialStatuses);
            }
        } catch (e) {
            console.error("Failed to parse saved session, starting fresh:", e);
            localStorage.removeItem(savedSessionKey); 
            setQuestionStatuses(initialStatuses);
        }
    } else {
        setQuestionStatuses(initialStatuses);
    }
    setIsResuming(false); 
  }, [user?.id, testCode, authLoading, isResuming, allQuestionsInOrder, initialSection, toast]);

  // Save to local storage on state change
  useEffect(() => {
    if (!user?.id || !testCode || showInstructions || startTime === null || authLoading || isResuming) return;

    const currentGlobalIdx = globalQuestionIndex; // Recalculate based on current section and index
    
    const sessionState: InProgressTestState = {
      testCode,
      userId: user.id,
      startTime,
      timeLeft,
      currentGlobalIndex: currentGlobalIdx, 
      currentSection,
      currentQuestionIndexInSection,
      userAnswers,
      questionStatuses,
    };
    localStorage.setItem(`test-session-${user.id}-${testCode}`, JSON.stringify(sessionState));
  }, [user?.id, testCode, startTime, timeLeft, globalQuestionIndex, currentSection, currentQuestionIndexInSection, userAnswers, questionStatuses, showInstructions, authLoading, isResuming]);


  useEffect(() => {
    if (!authLoading && !user) {
      toast({ variant: 'destructive', title: 'Unauthorized', description: 'Please log in to take the test.' });
      router.push(`/auth/login?redirect=/test-interface/${testCode}${queryUserId ? `?userId=${queryUserId}` : ''}`);
      return;
    }
    if (!authLoading && user && queryUserId && user.id !== queryUserId) {
        toast({ variant: 'destructive', title: 'Forbidden', description: 'You cannot take a test for another user.' });
        router.push('/');
        return;
    }
    if (!authLoading && user && !queryUserId) { 
         router.replace(`/test-interface/${testCode}?userId=${user.id}`);
         return;
     }
  }, [testCode, queryUserId, authLoading, user, router, toast]);


  const handleStartTest = useCallback(() => {
    setShowInstructions(false);
    setStartTime(Date.now());
    const firstQuestionId = allQuestionsInOrder[0]?.id;
    if (firstQuestionId && (!questionStatuses[firstQuestionId] || questionStatuses[firstQuestionId] === QuestionStatusEnum.NotVisited)) {
        setQuestionStatuses(prev => ({...prev, [firstQuestionId]: QuestionStatusEnum.Unanswered}));
    }
  }, [allQuestionsInOrder, questionStatuses]);

  const handleSubmitTest = useCallback(async (autoSubmit = false) => {
    if (!user || !queryUserId || isSubmitting || !startTime) return;
    setIsSubmitting(true);
    const endTime = Date.now();

    const submittedAnswers: UserAnswer[] = allQuestionsInOrder.map((q, globalIdx) => ({
      questionId: q.id || `q-${globalIdx}`, 
      selectedOption: userAnswers[q.id!] || null,
      status: questionStatuses[q.id!] || QuestionStatusEnum.NotVisited,
    }));

    const sessionData: TestSession = {
      testId: testCode,
      userId: queryUserId,
      startTime: startTime,
      endTime: endTime,
      answers: submittedAnswers,
    };

    try {
      const result = await saveTestReport(sessionData, testData);
      if (result.success && result.results) {
        localStorage.removeItem(`test-session-${user.id}-${testCode}`); 
        toast({ title: "Test Submitted!", description: "Your responses have been saved." });
        const resultPath = `/chapterwise-test-results/${testCode}?userId=${queryUserId}&attemptTimestamp=${startTime}`;
        router.push(resultPath);
      } else {
        throw new Error(result.message || "Failed to save test report.");
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Submission Failed', description: e.message });
      setIsSubmitting(false); 
    }
  }, [testData, user, queryUserId, isSubmitting, startTime, testCode, userAnswers, questionStatuses, toast, router, allQuestionsInOrder]);

  useEffect(() => {
    if (timeLeft <= 0 || showInstructions || !startTime || isSubmitting) return;
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
  }, [timeLeft, showInstructions, startTime, isSubmitting, handleSubmitTest]);


  const handleOptionChange = (questionId: string, optionKey: string) => {
    if (!questionId) return;
    setUserAnswers(prev => ({ ...prev, [questionId]: optionKey }));
    setQuestionStatuses(prev => ({
      ...prev,
      [questionId]: prev[questionId] === QuestionStatusEnum.MarkedForReview || prev[questionId] === QuestionStatusEnum.AnsweredAndMarked
        ? QuestionStatusEnum.AnsweredAndMarked
        : QuestionStatusEnum.Answered,
    }));
  };

  const navigateToQuestion = (globalIdx: number) => {
    if (globalIdx < 0 || globalIdx >= allQuestionsInOrder.length) return;

    const currentQId = allQuestionsInOrder[globalQuestionIndex]?.id;
    if (currentQId && questionStatuses[currentQId] === QuestionStatusEnum.NotVisited && !userAnswers[currentQId]){
         setQuestionStatuses(prev => ({...prev, [currentQId]: QuestionStatusEnum.Unanswered}));
    }

    let cumulativeIndex = 0;
    for (const sectionName in questionsBySection) {
        const sectionQuestionsList = questionsBySection[sectionName];
        if (globalIdx < cumulativeIndex + sectionQuestionsList.length) {
            const indexInSection = globalIdx - cumulativeIndex;
            setCurrentSection(sectionName);
            setCurrentQuestionIndexInSection(indexInSection);
            const newQId = sectionQuestionsList[indexInSection]?.id;
            if (newQId && (questionStatuses[newQId] === QuestionStatusEnum.NotVisited || !questionStatuses[newQId])) {
                setQuestionStatuses(prev => ({...prev, [newQId]: QuestionStatusEnum.Unanswered}));
            }
            return;
        }
        cumulativeIndex += sectionQuestionsList.length;
    }
  };

  const handleSaveAndNext = () => {
    const currentQId = currentQuestion?.id;
    if (currentQId && (questionStatuses[currentQId] === QuestionStatusEnum.NotVisited || !questionStatuses[currentQId]) && !userAnswers[currentQId]){
         setQuestionStatuses(prev => ({...prev, [currentQId]: QuestionStatusEnum.Unanswered}));
    }
    if (globalQuestionIndex < allQuestionsInOrder.length - 1) {
      navigateToQuestion(globalQuestionIndex + 1);
    } else {
      toast({title: "Last Question", description: "You are on the last question. Click Submit to finish."});
    }
  };

  const handleMarkForReview = () => {
    if (!currentQuestion?.id) return;
    const currentQId = currentQuestion.id;
    const currentStatus = questionStatuses[currentQId];
    
    if (currentStatus === QuestionStatusEnum.Answered) {
      setQuestionStatuses(prev => ({ ...prev, [currentQId]: QuestionStatusEnum.AnsweredAndMarked }));
    } else if (currentStatus === QuestionStatusEnum.AnsweredAndMarked) {
        setQuestionStatuses(prev => ({ ...prev, [currentQId]: QuestionStatusEnum.Answered }));
    } else if (currentStatus === QuestionStatusEnum.MarkedForReview) {
         setQuestionStatuses(prev => ({ ...prev, [currentQId]: userAnswers[currentQId] ? QuestionStatusEnum.Answered : QuestionStatusEnum.Unanswered }));
    } else { // Unanswered or NotVisited
      setQuestionStatuses(prev => ({ ...prev, [currentQId]: QuestionStatusEnum.MarkedForReview }));
    }
  };

  const handleClearResponse = () => {
    if (!currentQuestion?.id) return;
    const currentQId = currentQuestion.id;
    setUserAnswers(prev => ({ ...prev, [currentQId]: null }));
    const currentStatus = questionStatuses[currentQId];

    if (currentStatus === QuestionStatusEnum.AnsweredAndMarked) {
        setQuestionStatuses(prev => ({ ...prev, [currentQId]: QuestionStatusEnum.MarkedForReview }));
    } else { // Answered, MarkedForReview, NotVisited, Unanswered
        setQuestionStatuses(prev => ({ ...prev, [currentQId]: QuestionStatusEnum.Unanswered }));
    }
  };

  const toggleFullScreen = () => {
    if (typeof window !== 'undefined' && document.documentElement) {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                toast({variant: 'destructive', title: 'Fullscreen Error', description: `Could not enter fullscreen: ${err.message}`});
            });
            setIsFullScreen(true);
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                setIsFullScreen(false);
            }
        }
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const handleFullScreenChange = () => setIsFullScreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullScreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
    }
  }, []);


  if (authLoading || isResuming) { 
    return <div className="flex items-center justify-center min-h-screen bg-background"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (showInstructions) {
    return <InstructionsDialog isOpen={showInstructions} testData={testData} onProceed={handleStartTest} />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-destructive/5">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-destructive font-semibold text-lg">Error Loading Test</p>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => router.push('/tests')}>Back to Test Series</Button>
      </div>
    );
  }

  if (!testData || !currentQuestion) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-background">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <p className="text-muted-foreground">Test data or current question is unavailable. This might happen if the test has no questions.</p>
         <Button onClick={() => router.push('/tests')}>Back to Test Series</Button>
      </div>
    );
  }

  const optionKeys = ["A", "B", "C", "D"];
  const renderQuestionContent = (question: TestQuestion) => {
     const imageUrl = question.question_image_url;
     if (question.type === 'image' && imageUrl && (imageUrl.startsWith('/') || imageUrl.startsWith('http'))) {
       return <Image src={imageUrl} alt={`Question ${globalQuestionIndex + 1}`} width={600} height={400} className="rounded-md border max-w-full h-auto mx-auto my-4 object-contain" data-ai-hint="question diagram" priority={globalQuestionIndex < 3} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} unoptimized />;
     } else if (question.question_text) {
       return <div className="prose dark:prose-invert max-w-none mathjax-content" dangerouslySetInnerHTML={{ __html: question.question_text.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }} />;
     }
     return <p className="text-muted-foreground">Question content not available.</p>;
   };

   const renderOptionContent = (optionText: string | null | undefined) => {
        if (!optionText) return null;
        const containsMathJax = (typeof optionText === 'string' && (optionText.includes('$') || optionText.includes('\\(') || optionText.includes('\\[')));
        if (containsMathJax) {
            return <div className="prose-sm dark:prose-invert max-w-none flex-1 mathjax-content" dangerouslySetInnerHTML={{ __html: optionText.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }} />;
        } else { return <span className="flex-1">{optionText}</span>; }
    };

  return (
    <>
      <Script id="mathjax-script-test-interface" src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" strategy="lazyOnload" onLoad={typesetMathJax} />
      <div className="flex flex-col h-screen max-h-screen bg-muted/20 dark:bg-background overflow-hidden">
        {user && <TestHeaderBar
          testName={testData.name}
          timeLeft={timeLeft}
          user={user}
        />}
        
        {testData.testType === 'full_length' && Object.keys(questionsBySection).length > 1 && (
            <div className="bg-card border-b px-2 py-1.5 flex gap-1 overflow-x-auto no-scrollbar shadow-sm">
                {Object.keys(questionsBySection).map(sectionName => (
                    <Button 
                        key={sectionName}
                        variant={currentSection === sectionName ? "secondary" : "ghost"}
                        size="sm"
                        className={cn("text-xs h-7 px-3 rounded-md flex-shrink-0", currentSection === sectionName && "bg-primary/10 text-primary font-semibold shadow-sm")}
                        onClick={() => {setCurrentSection(sectionName); setCurrentQuestionIndexInSection(0);}}
                    >
                        {sectionName}
                    </Button>
                ))}
            </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 p-3 md:p-4 overflow-y-auto">
            <Card className="mb-4 shadow-sm border-border">
              <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="flex justify-between items-center text-base md:text-lg">
                  <span>Question {currentQuestionIndexInSection + 1} <span className="text-muted-foreground text-sm">of {currentSectionQuestions.length} ({currentSection})</span></span>
                  <Badge variant="outline" className="text-xs">Marks: {currentQuestion.marks}</Badge>
                </CardTitle>
                 <CardDescription className="text-xs text-muted-foreground">Question ID: {currentQuestion.id || `q-${globalQuestionIndex}`}</CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {renderQuestionContent(currentQuestion)}
              </CardContent>
            </Card>

            <RadioGroup
              value={userAnswers[currentQuestion.id!] || undefined}
              onValueChange={(val) => handleOptionChange(currentQuestion.id!, val)}
              className="space-y-2.5 mb-4"
              disabled={isSubmitting}
            >
              {currentQuestion.options.map((optionText, idx) => {
                const optionKey = optionKeys[idx];
                return (
                  <Label
                    key={optionKey}
                    htmlFor={`${currentQuestion.id}-${optionKey}`}
                    className={cn(
                      "flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-all hover:border-primary/70 text-sm",
                      userAnswers[currentQuestion.id!] === optionKey ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card",
                      isSubmitting && "opacity-70 cursor-not-allowed"
                    )}
                  >
                    <RadioGroupItem value={optionKey} id={`${currentQuestion.id}-${optionKey}`} className="border-primary text-primary focus:ring-primary mt-0.5"/>
                    <span className="font-medium text-foreground/90">{optionKey}.</span>
                    {renderOptionContent(optionText)}
                  </Label>
                );
              })}
            </RadioGroup>

            <div className="flex flex-wrap gap-2 justify-between items-center mt-4 sticky bottom-0 bg-muted/20 dark:bg-background py-3 px-1 rounded-t-lg border-t">
              <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleMarkForReview} disabled={isSubmitting} className="border-purple-500 text-purple-600 dark:text-purple-400 dark:border-purple-600 hover:bg-purple-500/10">
                      <Flag className="mr-1.5 h-4 w-4" />
                      {questionStatuses[currentQuestion.id!] === QuestionStatusEnum.MarkedForReview || questionStatuses[currentQuestion.id!] === QuestionStatusEnum.AnsweredAndMarked ? 'Unmark' : 'Mark'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleClearResponse} disabled={!userAnswers[currentQuestion.id!] || isSubmitting}>
                      <XSquare className="mr-1.5 h-4 w-4" /> Clear
                  </Button>
              </div>
              <div className="flex gap-2">
                   <Button variant="secondary" size="sm" onClick={handleSaveAndNext} disabled={isSubmitting}>
                      Save & Next <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
              </div>
            </div>
          </main>

          <QuestionPalette
            questions={allQuestionsInOrder}
            questionStatuses={questionStatuses}
            currentGlobalIndex={globalQuestionIndex}
            onQuestionSelect={navigateToQuestion}
            onSubmitTest={() => handleSubmitTest(false)}
            isSubmitting={isSubmitting}
            questionsBySection={questionsBySection}
            currentSection={currentSection}
          />
        </div>
      </div>
    </>
  );
}
