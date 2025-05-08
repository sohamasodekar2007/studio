// src/app/chapterwise-test-review/[testCode]/page.tsx
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle, HelpCircle, Info, Loader2, XCircle } from 'lucide-react';
import Link from 'next/link';
import type { TestResultSummary, GeneratedTest, QuestionStatus, TestQuestion, QuestionType } from '@/types';
import { QuestionStatus as QuestionStatusEnum } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { getGeneratedTestByCode } from '@/actions/generated-test-actions';
import { getTestReport } from '@/actions/test-report-actions'; // Import action to get specific report
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Script from 'next/script'; // Ensure Script is imported

// Helper function to construct image paths relative to the public directory
const constructImagePath = (relativePath: string | null | undefined): string | null => {
    if (!relativePath) return null;
    // Assume relativePath is already correctly formatted like /question_bank_images/...
    return relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
};


const QUESTION_STATUS_BADGE_VARIANTS: Record<QuestionStatus, "default" | "secondary" | "destructive" | "outline"> = {
    [QuestionStatusEnum.Answered]: "default",
    [QuestionStatusEnum.Unanswered]: "destructive",
    [QuestionStatusEnum.MarkedForReview]: "secondary",
    [QuestionStatusEnum.AnsweredAndMarked]: "default",
    [QuestionStatusEnum.NotVisited]: "outline",
};

const OPTION_STYLES = {
  base: "border-border hover:border-primary dark:border-gray-700 dark:hover:border-primary",
  selectedCorrect: "border-green-500 bg-green-500/10 text-green-700 dark:border-green-400 dark:bg-green-700/20 dark:text-green-300 ring-2 ring-green-500 dark:ring-green-400",
  selectedIncorrect: "border-red-500 bg-red-500/10 text-red-700 dark:border-red-400 dark:bg-red-700/20 dark:text-red-300 ring-2 ring-red-500 dark:ring-red-400",
  correctUnselected: "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300", // Style for correct option when not selected
  // For image questions where there's no explicit "selected" state but we want to highlight the correct one
  correctImageOption: "border-green-500 bg-green-500/10 text-green-700 dark:border-green-400 dark:bg-green-700/20 dark:text-green-300",

};


export default function TestReviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const testCode = params.testCode as string;
  const userId = searchParams.get('userId');
  const attemptTimestampStr = searchParams.get('attemptTimestamp'); // Get timestamp as string

  const [testReport, setTestReport] = useState<TestResultSummary | null>(null); // Store the full report
  const [testDefinition, setTestDefinition] = useState<GeneratedTest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionReviewIndex, setCurrentQuestionReviewIndex] = useState(0);

   const typesetMathJax = useCallback(() => {
       if (typeof window !== 'undefined' && (window as any).MathJax) {
           console.log("Attempting MathJax typesetting on review page...");
           (window as any).MathJax.typesetPromise?.().catch((err: any) => console.error("MathJax typeset error in review page:", err));
       }
   }, []);

   // Typeset whenever the current question index changes, or when data loads initially
   useEffect(() => {
       if (testDefinition && testReport) {
           typesetMathJax();
       }
   }, [currentQuestionReviewIndex, testDefinition, testReport, typesetMathJax]);

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
        // Fetch both concurrently
        const [reportData, testDefData] = await Promise.all([
            getTestReport(userId, testCode, attemptTimestamp),
            getGeneratedTestByCode(testCode).catch(err => {
                console.error("Failed to fetch test definition for review:", err);
                return null; // Allow review even if definition fetch fails (use report data)
            })
        ]);

        if (!reportData) {
            throw new Error(`Test attempt data not found for this attempt.`);
        }

        setTestDefinition(testDefData); // Can be null if fetch failed
        setTestReport(reportData);

    } catch (err: any) {
      console.error("Error fetching review data:", err);
      setError(err.message || "Failed to load test review.");
    } finally {
      setIsLoading(false);
    }
  }, [testCode, userId, attemptTimestampStr]);

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
  }, [testCode, userId, attemptTimestampStr, authLoading, user, router, fetchReviewData]);


    const allQuestionsFromReport = useMemo(() => testReport?.detailedAnswers || [], [testReport]);

  const currentReviewAnswer = allQuestionsFromReport?.[currentQuestionReviewIndex];

  if (isLoading || authLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <Skeleton className="h-10 w-3/4 mb-4" />
        <Skeleton className="h-8 w-1/2 mb-8" />
        <Card>
          <CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-10 w-1/4 mt-4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-destructive mb-2">Error Loading Review</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button asChild>
          <Link href="/tests">Go to Test Series</Link>
        </Button>
      </div>
    );
  }

  // Check if report and the specific answer detail exist
  if (!testReport || !currentReviewAnswer) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl text-center">
        <HelpCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Review Data Not Available</h1>
        <p className="text-muted-foreground mb-6">We could not load the necessary data for this test review.</p>
         <Button asChild>
          <Link href={`/chapterwise-test-results/${testCode}?userId=${userId}&attemptTimestamp=${attemptTimestampStr}`}>Back to Results</Link>
        </Button>
      </div>
    );
  }

  const totalQuestions = allQuestionsFromReport.length || 0;
  const optionKeys = ["A", "B", "C", "D"];
  // Handle cases where answer might not start with "Option "
  const correctOptionKey = currentReviewAnswer.correctAnswer?.replace('Option ', '').trim() || currentReviewAnswer.correctAnswer; // Assume it's just the key if format differs
  const userSelectedOptionKey = currentReviewAnswer?.userAnswer;
  const isUserCorrect = userSelectedOptionKey === correctOptionKey;
  const questionStatus = currentReviewAnswer?.status || QuestionStatusEnum.NotVisited;

  // Get options from the test definition if available, otherwise use placeholder
  // Assuming the report's detailedAnswers has the options used during the test
  // Modified to access options directly from detailedAnswers if definition is missing
   const currentQuestionDefinition = testDefinition ? (testDefinition.questions || [])[currentQuestionReviewIndex] : null;
   // Use options from definition first, fallback to detailedAnswers (though this might be less ideal)
   const optionsToDisplay = currentQuestionDefinition?.options || (allQuestionsFromReport[currentQuestionReviewIndex]?.options as string[] | undefined) || ["A", "B", "C", "D"];


   // Function to render content, handling both text and image, and applying MathJax transformation
   const renderContentWithMathJax = (
       textContent: string | undefined | null,
       imageUrl: string | undefined | null, // This is the RELATIVE public URL from report/definition
       context: 'question' | 'explanation'
   ) => {
       let contentToRender: React.ReactNode = null;
       const finalImagePath = constructImagePath(imageUrl); // Use helper

       if (finalImagePath) {
           contentToRender = (
                <div className="relative w-full max-w-lg h-64 mx-auto md:h-80 lg:h-96 my-4">
                   <Image
                       src={finalImagePath} // Use the correctly constructed path
                       alt={context === 'question' ? "Question Image" : "Explanation Image"}
                       layout="fill"
                       objectFit="contain"
                       className="rounded-md border"
                       data-ai-hint={context === 'question' ? "question diagram" : "explanation image"}
                       onError={(e) => { console.error(`Error loading image: ${finalImagePath}`, e); (e.target as HTMLImageElement).style.display = 'none'; }} // Simplified onError
                       unoptimized // Keep if local images might cause issues
                   />
                   <noscript>
                        <p className="text-center text-muted-foreground text-sm mt-2">[Image: {imageUrl}]</p>
                   </noscript>
                </div>
            );
       } else if (textContent) {
           // Render using dangerouslySetInnerHTML for MathJax to process
           contentToRender = (
               <div
                   className="prose prose-sm dark:prose-invert max-w-none text-foreground mathjax-content" // Added class for targeting
                   dangerouslySetInnerHTML={{ __html: textContent.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }} // Replace delimiters
                />
           );
       } else {
           contentToRender = <p className="text-sm text-muted-foreground">{`[${context === 'question' ? 'Question' : 'Explanation'} content not available]`}</p>;
       }

       return contentToRender;
   };


  return (
    <>
     {/* MathJax Script */}
     <Script
        id="mathjax-script-review" // Unique ID
        src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
        strategy="lazyOnload"
        onLoad={() => {
            console.log('MathJax loaded for review page.');
            // Initial typeset after script loads and component mounts
            typesetMathJax();
        }}
      />
    <div className="container mx-auto py-8 px-4 max-w-3xl space-y-6">
      <div className="flex justify-between items-center">
        <Button variant="outline" asChild>
            <Link href={`/chapterwise-test-results/${testCode}?userId=${userId}&attemptTimestamp=${attemptTimestampStr}`}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Results
            </Link>
        </Button>
         <h1 className="text-2xl font-bold text-center truncate flex-1 mx-4">{testReport.testName || 'Test Review'}</h1>
         {/* Placeholder for potential navigation buttons or info */}
         <div className="w-24"></div>
      </div>

      <Card className="shadow-md bg-card text-card-foreground">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Question {currentQuestionReviewIndex + 1} of {totalQuestions}</CardTitle>
             {/* Use total marks from report if available */}
             <Badge variant="outline">Marks: {currentQuestionDefinition?.marks ?? (testReport?.totalMarks ? (testReport.totalMarks / totalQuestions) : 1)}</Badge>
          </div>
           {currentReviewAnswer?.status && (
                <Badge
                    variant={QUESTION_STATUS_BADGE_VARIANTS[questionStatus]}
                    className={cn("text-xs w-fit mt-2", {
                        "bg-green-100 text-green-700 dark:bg-green-700/20 dark:text-green-300 border-green-500": questionStatus === QuestionStatusEnum.Answered && isUserCorrect,
                        "bg-red-100 text-red-700 dark:bg-red-700/20 dark:text-red-300 border-red-500": (questionStatus === QuestionStatusEnum.Answered && !isUserCorrect) || questionStatus === QuestionStatusEnum.Unanswered,
                        "bg-purple-100 text-purple-700 dark:bg-purple-700/20 dark:text-purple-300 border-purple-500": questionStatus === QuestionStatusEnum.MarkedForReview,
                        "bg-blue-100 text-blue-700 dark:bg-blue-700/20 dark:text-blue-300 border-blue-500": questionStatus === QuestionStatusEnum.AnsweredAndMarked,
                        "border-gray-400 text-gray-600 dark:border-gray-600 dark:text-gray-400": questionStatus === QuestionStatusEnum.NotVisited,
                    })}
                 >
                   Status: {questionStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Badge>
            )}
        </CardHeader>
        <CardContent className="space-y-4">
            {/* Render Question */}
            <div className="mb-4 pb-4 border-b border-border">
                 {renderContentWithMathJax(currentReviewAnswer?.questionText, currentReviewAnswer?.questionImageUrl, 'question')}
            </div>

          {/* Render Options */}
          <div className="space-y-2 pt-4">
            <p className="font-semibold text-card-foreground">Options:</p>
            {optionsToDisplay.map((optionText, idx) => {
              const optionKey = optionKeys[idx];
              const isSelected = userSelectedOptionKey === optionKey;
              const isCorrect = correctOptionKey === optionKey;

              let optionStyleClass = OPTION_STYLES.base;
              if (isSelected && isCorrect) optionStyleClass = cn(OPTION_STYLES.base, OPTION_STYLES.selectedCorrect);
              else if (isSelected && !isCorrect) optionStyleClass = cn(OPTION_STYLES.base, OPTION_STYLES.selectedIncorrect);
              else if (isCorrect) optionStyleClass = cn(OPTION_STYLES.base, OPTION_STYLES.correctUnselected);

              return (
                <div key={optionKey} className={cn("flex items-start space-x-3 p-3 border rounded-md", optionStyleClass)}>
                  <span className="font-medium mt-0.5">{optionKey}.</span>
                   <div className="flex-1 mathjax-content" dangerouslySetInnerHTML={{ __html: (optionText || '').replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}>
                   </div>
                  {isSelected && isCorrect && <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 ml-auto flex-shrink-0" />}
                  {isSelected && !isCorrect && <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 ml-auto flex-shrink-0" />}
                  {!isSelected && isCorrect && <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 ml-auto flex-shrink-0 opacity-70" />}
                </div>
              );
            })}
          </div>

          {/* Render Explanation */}
           {(currentReviewAnswer.explanationText || currentReviewAnswer.explanationImageUrl) && (
            <div className="mt-6 pt-4 border-t border-border">
              <h4 className="font-semibold text-lg mb-2 flex items-center text-card-foreground">
                 <Info className="h-5 w-5 mr-2 text-primary"/> Explanation
              </h4>
              <div className="bg-muted/50 dark:bg-muted/20 p-3 rounded-md">
                 {renderContentWithMathJax(currentReviewAnswer.explanationText, currentReviewAnswer.explanationImageUrl, 'explanation')}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between mt-4 p-6 border-t border-border">
          <Button onClick={() => setCurrentQuestionReviewIndex(prev => Math.max(0, prev - 1))} disabled={currentQuestionReviewIndex === 0}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Previous
          </Button>
          <Button onClick={() => setCurrentQuestionReviewIndex(prev => Math.min(totalQuestions - 1, prev + 1))} disabled={currentQuestionReviewIndex >= totalQuestions - 1}>
            Next <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </div>
    </>
  );
}

```
- src/components/admin/edit-question-dialog.tsx</file>
    <description>Refactor image path construction into a helper function and apply it consistently for both question and explanation images. Use the helper function for path generation.</description>
    <content><![CDATA[// src/components/admin/edit-question-dialog.tsx
'use client';

import { useState, useRef, useCallback, useEffect, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
// import { Checkbox } from "@/components/ui/checkbox"; // Not used directly in this form
import { Loader2, Upload, ClipboardPaste, X } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import type { QuestionBankItem } from '@/types';
import { updateQuestionDetails } from '@/actions/question-bank-actions';
import Script from 'next/script'; // For MathJax

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

// Helper function to construct image paths relative to the public directory
const constructImagePath = (subject: string, lesson: string, filename: string | null | undefined): string | null => {
    if (!filename) return null;
    const basePath = '/question_bank_images'; // Base path within public
    return `${basePath}/${encodeURIComponent(subject)}/${encodeURIComponent(lesson)}/images/${encodeURIComponent(filename)}`;
};

const editQuestionSchema = z.object({
  correctAnswer: z.enum(["A", "B", "C", "D"], { required_error: "Correct answer is required" }),
  explanationText: z.string().optional(),
  explanationImage: z.any().optional(),
  removeExplanationImage: z.boolean().optional(),
}).refine(data => {
    // Validate explanationImage file if present
    if (data.explanationImage && data.explanationImage instanceof File) {
        if (data.explanationImage.size > MAX_FILE_SIZE) return false;
        if (!ACCEPTED_IMAGE_TYPES.includes(data.explanationImage.type)) return false;
    }
    return true;
}, {
    message: `Explanation image must be a valid image file (JPG, PNG, WEBP) and less than ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
    path: ["explanationImage"],
});


type EditQuestionFormValues = z.infer<typeof editQuestionSchema>;

interface EditQuestionDialogProps {
  question: QuestionBankItem;
  isOpen: boolean;
  onClose: () => void;
  onQuestionUpdate: (updatedQuestion: QuestionBankItem) => void;
}

export default function EditQuestionDialog({ question, isOpen, onClose, onQuestionUpdate }: EditQuestionDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [explanationImagePreview, setExplanationImagePreview] = useState<string | null>(null);
  const explanationFileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<EditQuestionFormValues>({
    resolver: zodResolver(editQuestionSchema),
    defaultValues: {
      correctAnswer: question.correct,
      explanationText: question.explanation.text || '',
      explanationImage: question.explanation.image || null,
      removeExplanationImage: false,
    },
  });

  // MathJax typesetting
  const typesetMathJax = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).MathJax) {
        (window as any).MathJax.typesetPromise?.().catch((err: any) => console.error("MathJax typeset error in dialog:", err));
    }
  }, []);

  useEffect(() => {
    if (isOpen) { // Only typeset when dialog is open and content is visible
        typesetMathJax();
    }
  }, [question, isOpen, typesetMathJax]);

   useEffect(() => {
       const initialExplanationImagePath = constructImagePath(question.subject, question.lesson, question.explanation.image);
       setExplanationImagePreview(initialExplanationImagePath);

        form.reset({
            correctAnswer: question.correct,
            explanationText: question.explanation.text || '',
            explanationImage: question.explanation.image || null, // Keep original filename/null if no new file
            removeExplanationImage: false,
        });
   }, [question, form, isOpen]); // Rerun when question or isOpen changes


   const processImageFile = useCallback((
    file: File | null,
    setPreview: (url: string | null) => void
  ) => {
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        form.setError('explanationImage', { type: 'manual', message: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit.` });
        setPreview(null);
        return;
      }
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        form.setError('explanationImage', { type: 'manual', message: 'Invalid file type. Use JPG, PNG, or WEBP.' });
        setPreview(null);
        return;
      }
      form.clearErrors('explanationImage');
      form.setValue('explanationImage', file); // Set the File object
      form.setValue('removeExplanationImage', false); // Ensure remove flag is false when a new image is selected
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string); // Show preview of the new file
      reader.readAsDataURL(file);
    } else {
      // If file is null (e.g., canceled selection), revert preview to original or null
      const originalImagePath = constructImagePath(question.subject, question.lesson, question.explanation.image);
      setPreview(originalImagePath);
      form.setValue('explanationImage', question.explanation.image || null); // Reset form value to original or null
    }
  }, [form, question.subject, question.lesson, question.explanation.image]);

   const handleFileChange = useCallback((
    event: ChangeEvent<HTMLInputElement>,
    setPreview: (url: string | null) => void
  ) => {
    const file = event.target.files?.[0] || null;
    processImageFile(file, setPreview);
    if (event.target) event.target.value = "";
  }, [processImageFile]);

   const removeImage = useCallback(() => {
        setExplanationImagePreview(null); // Clear the preview
        if (explanationFileInputRef.current) explanationFileInputRef.current.value = ""; // Clear file input
        form.setValue('explanationImage', null); // Set form value to null (or a special marker if needed)
        form.setValue('removeExplanationImage', true); // Explicitly mark for removal
        form.clearErrors('explanationImage');
   }, [form]);


   const handlePasteImage = useCallback(async (
     setPreview: (url: string | null) => void
   ) => {
     if (!navigator.clipboard?.read) {
       toast({ variant: "destructive", title: "Clipboard API Not Supported" });
       return;
     }
     try {
       const items = await navigator.clipboard.read();
       let imageBlob: Blob | null = null;
       for (const item of items) {
         const imageType = item.types.find(type => type.startsWith('image/'));
         if (imageType) {
           imageBlob = await item.getType(imageType);
           break;
         }
       }
       if (imageBlob) {
         const timestamp = Date.now();
         const fileExtension = imageBlob.type.split('/')[1] || 'png';
         const fileName = `pasted_expl_${timestamp}.${fileExtension}`;
         const imageFile = new File([imageBlob], fileName, { type: imageBlob.type });
         processImageFile(imageFile, setPreview);
         toast({ title: "Image Pasted Successfully!" });
       } else {
         toast({ variant: "destructive", title: "No Image Found on Clipboard" });
       }
     } catch (error: any) {
       console.error("Failed to paste image:", error);
        if (error.name === 'NotAllowedError') {
            toast({ variant: "destructive", title: "Clipboard Permission Denied" });
        } else {
            toast({ variant: "destructive", title: "Paste Failed" });
        }
     }
   }, [processImageFile, toast]);

  const onSubmit = async (data: EditQuestionFormValues) => {
    setIsLoading(true);
    try {
        const formData = new FormData();
        formData.append('questionId', question.id);
        formData.append('subject', question.subject);
        formData.append('lesson', question.lesson);
        formData.append('correctAnswer', data.correctAnswer);
        if (data.explanationText) {
            formData.append('explanationText', data.explanationText);
        }
        // Only append the image if it's a new File object
        if (data.explanationImage instanceof File) {
            formData.append('explanationImage', data.explanationImage, data.explanationImage.name);
        }
         if (data.removeExplanationImage) {
            formData.append('removeExplanationImage', 'true');
        }

        const result = await updateQuestionDetails(formData);

        if (!result.success || !result.question) {
            throw new Error(result.error || 'Failed to update question.');
        }

        toast({
            title: 'Question Updated',
            description: `Details for ${question.id} have been saved.`,
        });
        onQuestionUpdate(result.question);
        onClose();

    } catch (error: any) {
      console.error('Failed to update question:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Could not save changes.',
      });
    } finally {
      setIsLoading(false);
    }
  };

   const renderQuestionPreview = (q: QuestionBankItem) => {
        const imagePath = constructImagePath(q.subject, q.lesson, q.question.image);

        if (q.type === 'image' && imagePath) {
             return (
                <div className="space-y-2">
                    <p className="text-sm font-medium">Question Image:</p>
                    <Image src={imagePath} alt="Question Image Preview" width={300} height={200} className="rounded border max-w-full h-auto object-contain" data-ai-hint="question diagram" unoptimized/>
                     <p className="text-xs text-muted-foreground">Options A, B, C, D are assumed to be in the image.</p>
                </div>
            );
        }
        if (q.type === 'text' && q.question.text) {
            return (
                 <div className="space-y-2 mathjax-content">
                    <p className="text-sm font-medium">Question Text:</p>
                    <div className="prose prose-sm dark:prose-invert max-w-none border p-3 rounded-md text-foreground bg-background">
                        <p dangerouslySetInnerHTML={{ __html: q.question.text.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}></p>
                    </div>
                    <p className="text-sm font-medium mt-2">Options:</p>
                     <ul className="list-disc list-inside pl-4 text-sm">
                        <li>A: <span dangerouslySetInnerHTML={{ __html: (q.options.A || "").replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}></span></li>
                        <li>B: <span dangerouslySetInnerHTML={{ __html: (q.options.B || "").replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}></span></li>
                        <li>C: <span dangerouslySetInnerHTML={{ __html: (q.options.C || "").replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}></span></li>
                        <li>D: <span dangerouslySetInnerHTML={{ __html: (q.options.D || "").replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}></span></li>
                     </ul>
                 </div>
            );
        }
        return <p className="text-sm text-muted-foreground">[Question content not available]</p>;
    }


  return (
    <>
    {/* MathJax Script */}
    <Script
        id="mathjax-script-edit-dialog" // Unique ID
        src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
        strategy="lazyOnload" // Load when dialog might become visible or after main content
        onLoad={() => {
            console.log('MathJax loaded for edit dialog.');
            if (isOpen) typesetMathJax(); // Typeset if dialog is already open when script loads
        }}
      />
    <Dialog open={isOpen} onOpenChange={(open) => {if (!open) onClose(); else typesetMathJax();}}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Question: {question.id}</DialogTitle>
          <DialogDescription>
            Update the correct answer and explanation. Question content cannot be changed here.
          </DialogDescription>
        </DialogHeader>

         <div className="my-4 p-4 border rounded-md bg-muted/30 max-h-60 overflow-y-auto">
             <h4 className="text-base font-semibold mb-2">Question Preview</h4>
            {renderQuestionPreview(question)}
         </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
             <FormField
                control={form.control}
                name="correctAnswer"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Correct Answer *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                    <FormControl>
                        <SelectTrigger className="w-full md:w-[180px]">
                        <SelectValue placeholder="Select Correct Option" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {["A", "B", "C", "D"].map((opt) => <SelectItem key={opt} value={opt}>Option {opt}</SelectItem>)}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />

             <FormField
                control={form.control}
                name="explanationText"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Explanation Text</FormLabel>
                    <FormControl>
                    <Textarea placeholder="Provide a detailed explanation. Use $...$ or $$...$$ for MathJax." {...field} value={field.value ?? ''} rows={4} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="explanationImage"
                render={({ field }) => ( // field here represents the form state for explanationImage (File or string/null)
                <FormItem>
                    <FormLabel>Explanation Image (Optional)</FormLabel>
                    <FormControl>
                        <div className="flex flex-wrap items-center gap-4">
                            <Input
                                id="explanation-image-edit-upload"
                                type="file"
                                accept={ACCEPTED_IMAGE_TYPES.join(',')}
                                ref={explanationFileInputRef}
                                onChange={(e) => handleFileChange(e, setExplanationImagePreview)}
                                className="hidden"
                                disabled={isLoading}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => explanationFileInputRef.current?.click()}
                                disabled={isLoading}
                            >
                                <Upload className="mr-2 h-4 w-4" /> Upload New Image
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handlePasteImage(setExplanationImagePreview)}
                                disabled={isLoading}
                            >
                                <ClipboardPaste className="mr-2 h-4 w-4" /> Paste Image
                            </Button>
                             {explanationImagePreview && (
                                <div className="relative h-24 w-auto border rounded-md overflow-hidden group">
                                    <Image src={explanationImagePreview} alt="Explanation Preview" height={96} width={150} style={{ objectFit: 'contain' }} data-ai-hint="explanation image" unoptimized/>
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-70 hover:!opacity-100 z-10"
                                        onClick={removeImage}
                                        disabled={isLoading}
                                        title="Remove Image"
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            )}
                             {/* Display indication if no new image is selected but an existing one might be present */}
                             {!explanationImagePreview && form.getValues('explanationImage') && typeof form.getValues('explanationImage') === 'string' && (
                                 <p className="text-xs text-muted-foreground italic">(Keeping existing image: {form.getValues('explanationImage')})</p>
                             )}
                        </div>
                    </FormControl>
                    <FormMessage />
                     <p className="text-xs text-muted-foreground">Uploading or pasting will replace the existing image. Click remove to delete it.</p>
                </FormItem>
                )}
            />
             <FormField
                control={form.control}
                name="removeExplanationImage" // This field is hidden but controlled by the removeImage function
                render={({ field }) => <input type="hidden" {...field} value={field.value?.toString() || 'false'} />}
             />
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
                <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    </>
  );
}

