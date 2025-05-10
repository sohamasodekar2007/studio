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
import { Loader2, AlertTriangle, ArrowLeft, ArrowRight, Flag, XSquare, Send, CheckSquare, Maximize } from 'lucide-react';
import InstructionsDialog from '@/components/test-interface/instructions-dialog';
import TestHeaderBar from '@/components/test-interface/test-header-bar';
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

export default function TestLayoutClient({ initialTestData }: TestLayoutClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams(); // For userId
  const params = useParams(); // For testCode
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const testCode = params.testCode as string;
  const queryUserId = searchParams.get('userId');

  const [testData, setTestData] = useState<GeneratedTest>(initialTestData);
  const [isLoading, setIsLoading] = useState(false); // For actions, not initial load
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  
  const [currentSection, setCurrentSection] = useState<string>(initialTestData.test_subject[0] || 'Overall');
  const [currentQuestionIndexInSection, setCurrentQuestionIndexInSection] = useState(0);
  
  const [userAnswers, setUserAnswers] = useState<Record<string, string | null>>({}); // questionId -> selectedOption
  const [questionStatuses, setQuestionStatuses] = useState<Record<string, QuestionStatus>>({}); // questionId -> status
  
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(initialTestData.duration * 60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const allQuestionsInOrder = useMemo(() => {
    if (testData.testType === 'chapterwise') {
      return testData.questions || [];
    } else if (testData.testType === 'full_length') {
      const questions: TestQuestion[] = [];
      // Order matters for full-length tests typically
      if (testData.physics_questions) questions.push(...testData.physics_questions);
      if (testData.chemistry_questions) questions.push(...testData.chemistry_questions);
      if (testData.maths_questions) questions.push(...testData.maths_questions);
      if (testData.biology_questions) questions.push(...testData.biology_questions);
      return questions;
    }
    return [];
  }, [testData]);

  const questionsBySection = useMemo(() => {
    const sections: Record<string, TestQuestion[]> = {};
    if (testData.testType === 'chapterwise' && testData.questions) {
        sections[testData.test_subject[0] || 'Questions'] = testData.questions;
    } else if (testData.testType === 'full_length') {
        if (testData.physics_questions) sections['Physics'] = testData.physics_questions;
        if (testData.chemistry_questions) sections['Chemistry'] = testData.chemistry_questions;
        if (testData.maths_questions) sections['Mathematics'] = testData.maths_questions;
        if (testData.biology_questions) sections['Biology'] = testData.biology_questions;
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
    let globalIdx = 0;
    for (const sectionName in questionsBySection) {
      if (sectionName === currentSection) {
        globalIdx += currentQuestionIndexInSection;
        break;
      }
      globalIdx += questionsBySection[sectionName].length;
    }
    return globalIdx;
  }, [questionsBySection, currentSection, currentQuestionIndexInSection]);


  const typesetMathJax = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).MathJax?.typesetPromise) {
      (window as any).MathJax.typesetPromise()
        .catch((err: any) => console.error("MathJax typeset error:", err));
    }
  }, []);

  useEffect(() => {
    if (currentQuestion && !showInstructions) {
      typesetMathJax();
    }
  }, [currentQuestion, showInstructions, typesetMathJax]);


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

    if (allQuestionsInOrder.length > 0 && !showInstructions) {
        const initialStatuses: Record<string, QuestionStatus> = {};
        allQuestionsInOrder.forEach(q => {
            if (q.id) initialStatuses[q.id] = QuestionStatusEnum.NotVisited;
        });
        if (currentQuestion?.id) {
            initialStatuses[currentQuestion.id] = QuestionStatusEnum.Unanswered;
        }
        setQuestionStatuses(initialStatuses);
    }

  }, [testCode, queryUserId, authLoading, user, router, toast, allQuestionsInOrder, showInstructions, currentQuestion?.id]);


  const handleStartTest = useCallback(() => {
    setShowInstructions(false);
    setStartTime(Date.now());
    if (currentQuestion?.id) {
        setQuestionStatuses(prev => ({...prev, [currentQuestion.id!]: QuestionStatusEnum.Unanswered}));
    }
  }, [currentQuestion?.id]);

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
        toast({ title: "Test Submitted!", description: "Your responses have been saved." });
        router.push(`/chapterwise-test-results/${testCode}?userId=${queryUserId}&attemptTimestamp=${startTime}`);
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

    let cumulativeIndex = 0;
    for (const sectionName in questionsBySection) {
        const sectionQuestions = questionsBySection[sectionName];
        if (globalIdx < cumulativeIndex + sectionQuestions.length) {
            const indexInSection = globalIdx - cumulativeIndex;
            setCurrentSection(sectionName);
            setCurrentQuestionIndexInSection(indexInSection);
            if (questionStatuses[allQuestionsInOrder[globalIdx]?.id!] === QuestionStatusEnum.NotVisited) {
                setQuestionStatuses(prev => ({...prev, [allQuestionsInOrder[globalIdx]?.id!]: QuestionStatusEnum.Unanswered}));
            }
            return;
        }
        cumulativeIndex += sectionQuestions.length;
    }
  };

  const handleSaveAndNext = () => {
    // Logic to save current state if needed (auto-save is implied by state updates)
    if (currentQuestion?.id && questionStatuses[currentQuestion.id] === QuestionStatusEnum.NotVisited && !userAnswers[currentQuestion.id]){
         setQuestionStatuses(prev => ({...prev, [currentQuestion.id!]: QuestionStatusEnum.Unanswered}));
    }
    if (globalQuestionIndex < allQuestionsInOrder.length - 1) {
      navigateToQuestion(globalQuestionIndex + 1);
    } else {
      toast({title: "Last Question", description: "You are on the last question. Click Submit to finish."});
    }
  };

  const handleMarkForReview = () => {
    if (!currentQuestion?.id) return;
    const currentStatus = questionStatuses[currentQuestion.id];
    if (currentStatus === QuestionStatusEnum.Answered) {
      setQuestionStatuses(prev => ({ ...prev, [currentQuestion.id!]: QuestionStatusEnum.AnsweredAndMarked }));
    } else if (currentStatus === QuestionStatusEnum.AnsweredAndMarked) {
        setQuestionStatuses(prev => ({ ...prev, [currentQuestion.id!]: QuestionStatusEnum.Answered }));
    } else if (currentStatus === QuestionStatusEnum.MarkedForReview) {
         setQuestionStatuses(prev => ({ ...prev, [currentQuestion.id!]: QuestionStatusEnum.Unanswered }));
    } else { 
      setQuestionStatuses(prev => ({ ...prev, [currentQuestion.id!]: QuestionStatusEnum.MarkedForReview }));
    }
  };

  const handleClearResponse = () => {
    if (!currentQuestion?.id) return;
    setUserAnswers(prev => ({ ...prev, [currentQuestion.id!]: null }));
    const currentStatus = questionStatuses[currentQuestion.id];
    if (currentStatus === QuestionStatusEnum.AnsweredAndMarked) {
        setQuestionStatuses(prev => ({ ...prev, [currentQuestion.id!]: QuestionStatusEnum.MarkedForReview }));
    } else {
        setQuestionStatuses(prev => ({ ...prev, [currentQuestion.id!]: QuestionStatusEnum.Unanswered }));
    }
  };

  const toggleFullScreen = () => {
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
  };

  useEffect(() => {
    const handleFullScreenChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);


  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (showInstructions) {
    return <InstructionsDialog isOpen={showInstructions} testData={testData} onProceed={handleStartTest} />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-destructive font-semibold text-lg">Error Loading Test</p>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => router.push('/tests')}>Back to Test Series</Button>
      </div>
    );
  }

  if (!testData || !currentQuestion) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <p className="text-muted-foreground">Test data or current question is unavailable.</p>
         <Button onClick={() => router.push('/tests')}>Back to Test Series</Button>
      </div>
    );
  }

  const optionKeys = ["A", "B", "C", "D"];
  const renderQuestionContent = (question: TestQuestion) => {
     const imageUrl = question.question_image_url;
     if (imageUrl && (imageUrl.startsWith('/') || imageUrl.startsWith('http'))) {
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
        <TestHeaderBar
          testName={testData.name}
          timeLeft={timeLeft}
          user={user}
          onFullScreenToggle={toggleFullScreen}
          isFullScreen={isFullScreen}
        />
        
        {/* Section Tabs for Full Length Test */}
        {testData.testType === 'full_length' && Object.keys(questionsBySection).length > 1 && (
            <div className="bg-card border-b px-2 py-1.5 flex gap-1 overflow-x-auto no-scrollbar">
                {Object.keys(questionsBySection).map(sectionName => (
                    <Button 
                        key={sectionName}
                        variant={currentSection === sectionName ? "secondary" : "ghost"}
                        size="sm"
                        className={cn("text-xs h-7 px-3 rounded-md", currentSection === sectionName && "bg-primary/10 text-primary font-semibold")}
                        onClick={() => {setCurrentSection(sectionName); setCurrentQuestionIndexInSection(0);}}
                    >
                        {sectionName}
                    </Button>
                ))}
            </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 p-3 md:p-4 overflow-y-auto">
            <Card className="mb-4 shadow-sm">
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
                  {/* Submit button is now in the palette or via TestHeaderBar */}
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
