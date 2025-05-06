// src/app/admin/tests/create/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, ListChecks, FileJson, FileCheck, Trash2, Eye, BookOpen, Clock, HelpCircle, Percent, Dna, FlaskConical, Calculator } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import type { QuestionBankItem, PricingType, ChapterwiseTestJson, FullLengthTestJson, ExamOption, ClassLevel, AudienceType, TestStream, GeneratedTest, TestQuestion } from '@/types';
import { pricingTypes, academicStatuses as audienceTypes, testStreams, examOptions } from '@/types'; // Import options, use academicStatuses for audienceTypes
import { getSubjects, getLessonsForSubject, getQuestionsForLesson } from '@/actions/question-bank-query-actions'; // Import query actions
import { saveGeneratedTest } from '@/actions/generated-test-actions';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { v4 as uuidv4 } from 'uuid';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';


// --- Schemas ---

const BaseTestSchema = z.object({
    name: z.string().min(3, "Test name must be at least 3 characters."),
    duration: z.coerce.number().min(1, "Duration must be at least 1 minute.").max(300, "Duration cannot exceed 300 minutes."),
    access: z.enum(pricingTypes, { required_error: "Access type is required." }),
    audience: z.enum(audienceTypes, { required_error: "Target audience is required." }),
    count: z.coerce.number().min(1, "Number of questions must be at least 1.").max(20, "Maximum 20 questions per test."),
    // Include the discriminator in the base, but make it specific in the extended schemas
    testType: z.enum(['chapterwise', 'full_length'], { required_error: "Test type is required." }),
});

const ChapterwiseSchema = BaseTestSchema.extend({
    testType: z.literal('chapterwise'), // Correctly define literal here
    subject: z.string().min(1, "Subject is required"),
    lesson: z.string().min(1, "Lesson is required"),
    chapterwiseExamFilter: z.enum(['all', ...examOptions], { required_error: "Exam filter is required" }),
    selectedQuestionIds: z.array(z.string()).min(1, "Please select at least one question."),
});

const FullLengthSchema = BaseTestSchema.extend({
    testType: z.literal('full_length'), // Correctly define literal here
    stream: z.enum(testStreams, { required_error: "Stream (PCM/PCB) is required." }),
    fullLengthExamFilter: z.enum(['all', ...examOptions], { required_error: "Exam filter is required" }),
    // Weightages - ensure they add up to 100
    physicsWeight: z.number().min(0).max(100),
    chemistryWeight: z.number().min(0).max(100),
    mathsWeight: z.number().min(0).max(100).optional(),
    biologyWeight: z.number().min(0).max(100).optional(),
}).refine(data => {
    // Weightage calculation only applies if it's not overridden by manual count logic later
    const totalWeight = data.physicsWeight + data.chemistryWeight + (data.stream === 'PCM' ? (data.mathsWeight || 0) : (data.biologyWeight || 0));
    return Math.abs(totalWeight - 100) < 0.1; // Allow for small floating point inaccuracies
}, {
    message: "Weightages must add up to 100%",
    path: ["physicsWeight"], // Apply error message near the first weightage field
});


// Discriminated union based on 'testType'
const TestCreationSchema = z.discriminatedUnion("testType", [
  ChapterwiseSchema,
  FullLengthSchema
]);

type TestCreationFormValues = z.infer<typeof TestCreationSchema>;


export default function CreateTestPage() {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [lessons, setLessons] = useState<string[]>([]);
  const [availableQuestions, setAvailableQuestions] = useState<QuestionBankItem[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedTestJson, setGeneratedTestJson] = useState<string | null>(null);
  const [showJsonDialog, setShowJsonDialog] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<QuestionBankItem | null>(null);
  // Store all questions keyed by lowercase subject for Full-Length
  const [allQuestionsForSubject, setAllQuestionsForSubject] = useState<Record<string, QuestionBankItem[]>>({});


  const form = useForm<TestCreationFormValues>({
    resolver: zodResolver(TestCreationSchema),
    defaultValues: {
      testType: 'chapterwise', // Default to chapterwise
      name: '',
      duration: 60,
      access: 'FREE',
      audience: 'Dropper',
      count: 20, // Default count
      // Chapterwise defaults
      subject: '',
      lesson: '',
      chapterwiseExamFilter: 'all',
      selectedQuestionIds: [],
      // Full Length defaults
      stream: 'PCM',
      fullLengthExamFilter: 'all',
      physicsWeight: 34,
      chemistryWeight: 33,
      mathsWeight: 33,
      biologyWeight: 0,
    },
  });

  const testType = form.watch('testType');
  const selectedSubject = form.watch('subject'); // For chapterwise
  const selectedLesson = form.watch('lesson'); // For chapterwise
  const selectedStream = form.watch('stream'); // For full length
  const selectedQuestionIds = form.watch('selectedQuestionIds', []);
  const questionCount = form.watch('count'); // Watch the common count field

  // For Full Length weightage sliders
  const physicsWeight = useWatch({ control: form.control, name: 'physicsWeight' });
  const chemistryWeight = useWatch({ control: form.control, name: 'chemistryWeight' });
  const mathsWeight = useWatch({ control: form.control, name: 'mathsWeight' });
  const biologyWeight = useWatch({ control: form.control, name: 'biologyWeight' });

  // --- Effects ---

  // Fetch Subjects
   useEffect(() => {
        setIsLoadingSubjects(true);
        getSubjects()
        .then(setSubjects)
        .catch(() => toast({ variant: "destructive", title: "Error loading subjects" }))
        .finally(() => setIsLoadingSubjects(false));
   }, [toast]);

   // Fetch Lessons when Subject Changes (for Chapterwise)
   useEffect(() => {
        if (testType === 'chapterwise' && selectedSubject) {
            setIsLoadingLessons(true);
            setLessons([]);
            form.setValue('lesson', ''); // Reset lesson selection
            getLessonsForSubject(selectedSubject)
                .then(setLessons)
                .catch(err => toast({ variant: "destructive", title: "Error", description: `Could not load lessons for ${selectedSubject}.` }))
                .finally(() => setIsLoadingLessons(false));
        } else {
            setLessons([]);
        }
   }, [testType, selectedSubject, form, toast]);


   // Load all questions for the selected SUBJECT and LESSON (for Chapterwise selection table)
   useEffect(() => {
     const fetchQuestions = async () => {
       if (testType === 'chapterwise' && selectedSubject && selectedLesson) {
         setIsLoadingQuestions(true);
         setAvailableQuestions([]);
         const examFilter = form.getValues('chapterwiseExamFilter');
         try {
           const questions = await getQuestionsForLesson({
             subject: selectedSubject,
             lesson: selectedLesson,
             examType: examFilter === 'all' ? undefined : examFilter,
           });
           setAvailableQuestions(questions);
           form.setValue('selectedQuestionIds', []); // Reset selection when questions reload
         } catch (err) {
           console.error("Error fetching questions:", err);
           toast({ variant: "destructive", title: "Error loading questions" });
         } finally {
           setIsLoadingQuestions(false);
         }
       } else {
         setAvailableQuestions([]);
       }
     };
     // Fetch immediately if chapterwise and filters are set
     if (testType === 'chapterwise' && selectedSubject && selectedLesson) {
         fetchQuestions();
     }
   }, [testType, selectedSubject, selectedLesson, form.watch('chapterwiseExamFilter'), form, toast]); // Watch filter change too


   // Fetch ALL questions for the selected stream subjects (for Full-Length auto-selection)
   useEffect(() => {
    const fetchAllStreamQuestions = async () => {
        if (testType === 'full_length') {
            setIsLoadingQuestions(true);
            setAllQuestionsForSubject({});

            const stream = form.getValues('stream');
            const subjectsToFetch: string[] = ['Physics', 'Chemistry'];
            if (stream === 'PCM') subjectsToFetch.push('Maths');
            if (stream === 'PCB') subjectsToFetch.push('Biology');

            const examFilterValue = form.getValues('fullLengthExamFilter');
            const examFilter = examFilterValue === 'all' ? undefined : examFilterValue;

            console.log(`Fetching all questions for stream: ${stream}, subjects: ${subjectsToFetch.join(', ')}, examFilter: ${examFilter || 'all'}`);

            try {
                const questionsBySub: Record<string, QuestionBankItem[]> = {};
                const subjectPromises = subjectsToFetch.map(async (sub) => {
                    // Fetch questions for each lesson within the subject
                    const lessons = await getLessonsForSubject(sub);
                    const lessonPromises = lessons.map(lesson =>
                        getQuestionsForLesson({ subject: sub, lesson: lesson, examType: examFilter })
                    );
                    const questionsPerLesson = await Promise.all(lessonPromises);
                    // Flatten questions from all lessons into a single array for the subject
                    const allQuestionsForSubject = questionsPerLesson.flat();
                     questionsBySub[sub.toLowerCase()] = allQuestionsForSubject;
                    console.log(`Fetched ${allQuestionsForSubject.length} questions for ${sub}`);
                });

                await Promise.all(subjectPromises);
                setAllQuestionsForSubject(questionsBySub); // Store questions keyed by lowercase subject
                console.log("Finished fetching stream questions:", questionsBySub);

            } catch (err) {
                console.error("Error fetching stream questions:", err);
                toast({ variant: "destructive", title: "Error loading questions for stream" });
            } finally {
                setIsLoadingQuestions(false);
            }
        } else {
            setAllQuestionsForSubject({}); // Clear if not full length
        }
    };
    fetchAllStreamQuestions();
   }, [testType, form.watch('stream'), form.watch('fullLengthExamFilter'), form, toast]);


  // --- Event Handlers ---

   const handleQuestionSelect = (id: string) => {
    const currentSelection = form.getValues('selectedQuestionIds') || [];
    const isSelected = currentSelection.includes(id);

    const currentCount = form.getValues('count');
    if (!isSelected && currentSelection.length >= currentCount) {
        toast({
            variant: "destructive",
            title: "Selection Limit Reached",
            description: `You can only select up to ${currentCount} questions for this test.`,
        });
        return;
    }

    const newSelection = isSelected
      ? currentSelection.filter(qid => qid !== id)
      : [...currentSelection, id];
    form.setValue('selectedQuestionIds', newSelection, { shouldValidate: true });
  };

   const handleSelectRandomChapterwise = () => {
     const count = form.getValues('count');
     const selectedCount = Math.min(count, availableQuestions.length);
     if (selectedCount < 1) {
        toast({ variant: "destructive", title: "No questions available to select." });
        return;
     }
     if (selectedCount < count) {
         toast({ variant: "destructive", title: `Only ${selectedCount} questions available`, description: `Selected all available questions.`});
     }

     const shuffled = [...availableQuestions].sort(() => 0.5 - Math.random());
     const randomSelection = shuffled.slice(0, selectedCount).map(q => q.id);
     form.setValue('selectedQuestionIds', randomSelection, { shouldValidate: true });
     toast({ title: `Selected ${randomSelection.length} random questions for this chapter.` });
   };

  const generateTestCode = (): string => {
    // Generate a unique 8-10 digit code (example implementation)
    return Math.random().toString().slice(2, 12); // Simple random string, consider UUID for production
  }

  // --- Function to structure selected questions into the final format ---
   const structureQuestions = (
       selectedIds: string[],
       allQuestionsMap: Record<string, QuestionBankItem[]> // Map of subject -> questions
   ): Pick<GeneratedTest, 'physics' | 'chemistry' | 'maths' | 'biology'> => {
        const structured: Pick<GeneratedTest, 'physics' | 'chemistry' | 'maths' | 'biology'> = {
            physics: [],
            chemistry: [],
            maths: [],
            biology: [],
        };

        const allQuestionsFlat: QuestionBankItem[] = Object.values(allQuestionsMap).flat();

        selectedIds.forEach(id => {
            const question = allQuestionsFlat.find(q => q.id === id);
            if (question) {
                const subjectKey = question.subject.toLowerCase() as keyof typeof structured;
                if (structured.hasOwnProperty(subjectKey)) {
                     const questionContent = question.type === 'image' && question.question.image ? question.question.image : (question.question.text || '[No Question Text]');
                     const imageUrl = question.type === 'image' && question.question.image ? `/question_bank_images/${question.subject}/${question.lesson}/${question.question.image}` : null;
                     const explanationContent = question.explanation.image ? question.explanation.image : (question.explanation.text || null);
                     const explanationImageUrl = question.explanation.image ? `/question_bank_images/${question.subject}/${question.lesson}/${question.explanation.image}` : null;

                    const formattedQuestion: TestQuestion = {
                        question: questionContent,
                        image_url: imageUrl,
                         // Keep options as strings like "Option A: ..." for the JSON
                        options: [
                             `Option A: ${question.options.A}`,
                             `Option B: ${question.options.B}`,
                             `Option C: ${question.options.C}`,
                             `Option D: ${question.options.D}`
                        ],
                         answer: `OPTION ${question.correct}`, // Format answer as "OPTION A", etc.
                         marks: 1, // Default marks, can be adjusted later
                         explanation: explanationContent, // Text or explanation image filename
                         explanation_image_url: explanationImageUrl, // Add explanation image URL
                    };
                     // Explicitly cast to any[] to allow push
                    (structured[subjectKey] as any[]).push(formattedQuestion);
                } else {
                    console.warn(`Subject key "${subjectKey}" derived from question ${question.id} is not valid for the structure.`);
                }
            }
        });

       // Clean up empty subject arrays
       (Object.keys(structured) as Array<keyof typeof structured>).forEach(key => {
            if (!structured[key] || structured[key]?.length === 0) {
                delete structured[key];
            }
       });

       return structured;
   };

   // --- Auto-select questions based on weightage for Full-Length ---
    const autoSelectFullLengthQuestions = (
        stream: TestStream,
        weights: { physics: number; chemistry: number; maths?: number; biology?: number },
        totalQuestionsToSelect: number, // Use the 'count' field
        questionsBySubject: Record<string, QuestionBankItem[]> // Pre-filtered questions keyed by lowercase subject
    ): string[] => {
        const selectedIds: string[] = [];
        const subjectsInStream = ['physics', 'chemistry'];
        if (stream === 'PCM') subjectsInStream.push('maths');
        if (stream === 'PCB') subjectsInStream.push('biology');

        let remainingTotal = totalQuestionsToSelect;
        const subjectCounts: Record<string, number> = {};
        const subjectPoolSizes: Record<string, number> = {};

        // Initialize pool sizes
        subjectsInStream.forEach(sub => {
            subjectPoolSizes[sub] = questionsBySubject[sub]?.length || 0;
        });

        console.log("Available questions per subject:", subjectPoolSizes);

        // Calculate initial counts based on weightage
        subjectsInStream.forEach((subject, index) => {
            const subjectKey = subject as keyof typeof weights;
            const weight = weights[subjectKey] || 0;
            // Calculate theoretical count, but don't exceed available pool size
            const theoreticalCount = Math.round((weight / 100) * totalQuestionsToSelect);
            const countForSubject = Math.min(theoreticalCount, subjectPoolSizes[subject] || 0);

            subjectCounts[subject] = countForSubject;
            // Decrement remainingTotal based on the count *actually* assigned
            // This needs refinement - calculate all theoretical counts first, then adjust
        });

        let currentTotalAssigned = Object.values(subjectCounts).reduce((a, b) => a + b, 0);
        remainingTotal = totalQuestionsToSelect - currentTotalAssigned;

        console.log("Initial counts based on weight:", subjectCounts, "Remaining:", remainingTotal);


       // Adjust counts if needed due to rounding or pool limits
        while (remainingTotal !== 0 && currentTotalAssigned < totalQuestionsToSelect) {
            // Prioritize subjects that have available questions and are below their theoretical count?
            // Or simply add to the largest available pool? Let's try largest pool first.
            let bestSubjectToAdd = '';
            let maxAvailableCanAdd = -1;

            subjectsInStream.forEach(sub => {
                const currentCount = subjectCounts[sub];
                const poolSize = subjectPoolSizes[sub];
                if (currentCount < poolSize) { // Can add more from this subject
                    if (poolSize - currentCount > maxAvailableCanAdd) {
                        maxAvailableCanAdd = poolSize - currentCount;
                        bestSubjectToAdd = sub;
                    }
                }
            });

            if (bestSubjectToAdd) {
                subjectCounts[bestSubjectToAdd]++;
                currentTotalAssigned++;
                remainingTotal--;
                 console.log(`Adjusted: Added 1 to ${bestSubjectToAdd}. New counts:`, subjectCounts, "Remaining:", remainingTotal);
            } else {
                // No subject can accept more questions
                console.warn("Could not assign remaining questions due to pool limits.");
                break;
            }
        }


        // Select questions based on final calculated counts
        subjectsInStream.forEach(subject => {
            const count = subjectCounts[subject];
            if (questionsBySubject[subject] && count > 0) {
                const shuffled = [...questionsBySubject[subject]].sort(() => 0.5 - Math.random());
                selectedIds.push(...shuffled.slice(0, count).map(q => q.id));
            }
        });

        console.log(`Final selected question IDs (${selectedIds.length}):`, selectedIds);
        return selectedIds;
    };

    // --- Main Submit Handler ---
    const onSubmit = async (data: TestCreationFormValues) => {
        setIsSaving(true);
        setGeneratedTestJson(null);

        try {
            const testCode = generateTestCode();
            let finalTestDefinition: GeneratedTest;
            let selectedIdsForStructure: string[] = [];
            let subjectsCovered: string[] = [];
            let actualTotalQuestions = 0;

            if (data.testType === 'chapterwise') {
                if (!data.selectedQuestionIds || data.selectedQuestionIds.length === 0 || data.selectedQuestionIds.length !== data.count) {
                   toast({ variant: "destructive", title: "Validation Error", description: `Please select exactly ${data.count} questions.` });
                   setIsSaving(false);
                   return;
                }
                 // Use the exact selected questions
                 selectedIdsForStructure = data.selectedQuestionIds;
                 subjectsCovered = [data.subject];
                 actualTotalQuestions = selectedIdsForStructure.length;

                 // Structure only the selected questions
                 const questionsForChapter = availableQuestions.filter(q => selectedIdsForStructure.includes(q.id));
                 const structuredData = structureQuestions(selectedIdsForStructure, {[data.subject.toLowerCase()]: questionsForChapter});


                const chapterwiseJson: ChapterwiseTestJson = {
                    test_code: testCode,
                    name: data.name,
                    type: data.access, // Use 'access' field for pricing type
                    test_subject: subjectsCovered as [string], // Ensure it's a tuple of one string
                    lesson: data.lesson,
                    duration: data.duration,
                    count: actualTotalQuestions, // Override count with actual selected count for chapterwise
                    total_questions: actualTotalQuestions,
                    audience: data.audience,
                    examFilter: data.chapterwiseExamFilter,
                    questions: structuredData[data.subject.toLowerCase() as keyof typeof structuredData] || [],
                    createdAt: new Date().toISOString(),
                };
                 finalTestDefinition = chapterwiseJson;


            } else { // Full Length
                 const weights = {
                     physics: data.physicsWeight,
                     chemistry: data.chemistryWeight,
                     maths: data.stream === 'PCM' ? (data.mathsWeight ?? 0) : undefined,
                     biology: data.stream === 'PCB' ? (data.biologyWeight ?? 0) : undefined,
                 };
                 // Auto-select based on weightage and the requested count
                 selectedIdsForStructure = autoSelectFullLengthQuestions(data.stream, weights, data.count, allQuestionsForSubject);
                 actualTotalQuestions = selectedIdsForStructure.length;

                  if (actualTotalQuestions < data.count) {
                    toast({
                        variant: "destructive",
                        title: "Insufficient Questions",
                        description: `Only found ${actualTotalQuestions} questions matching criteria, but ${data.count} were requested. Adjust filters or add more questions.`,
                    });
                     // Optionally proceed with fewer questions or stop
                     // setIsSaving(false); return;
                 }


                 subjectsCovered = ['Physics', 'Chemistry']; // Base subjects
                 if (data.stream === 'PCM') subjectsCovered.push('Maths');
                 if (data.stream === 'PCB') subjectsCovered.push('Biology');

                const structuredQuestions = structureQuestions(selectedIdsForStructure, allQuestionsForSubject);

                const fullLengthJson: FullLengthTestJson = {
                    test_code: testCode,
                    name: data.name,
                    type: data.access, // Use 'access' field for pricing type
                    stream: data.stream,
                    test_subject: subjectsCovered,
                    duration: data.duration,
                     count: data.count, // Number requested by user
                    total_questions: actualTotalQuestions, // Actual number included
                    audience: data.audience,
                    examFilter: data.fullLengthExamFilter,
                    weightage: weights,
                    physics: structuredQuestions.physics || [],
                    chemistry: structuredQuestions.chemistry || [],
                    maths: data.stream === 'PCM' ? (structuredQuestions.maths || []) : undefined,
                    biology: data.stream === 'PCB' ? (structuredQuestions.biology || []) : undefined,
                    createdAt: new Date().toISOString(),
                };
                finalTestDefinition = fullLengthJson;
            }

            setGeneratedTestJson(JSON.stringify(finalTestDefinition, null, 2));
            setShowJsonDialog(true);

        } catch (error: any) {
            console.error("Test generation failed:", error);
            toast({ variant: "destructive", title: "Generation Failed", description: error.message });
             setIsSaving(false); // Ensure saving is false on error
        } finally {
             // Keep isSaving true until dialog confirmation or cancellation
             // setIsSaving(false); // Moved to handleConfirmSave and dialog close
        }
    };


  const handleConfirmSave = async () => {
    if (!generatedTestJson) return;
    setIsSaving(true); // Indicate final saving process
    try {
      const testDefinition = JSON.parse(generatedTestJson) as GeneratedTest; // Parse the confirmed JSON
      const result = await saveGeneratedTest(testDefinition); // Save the generated test
      if (!result.success) throw new Error(result.message || "Failed to save test definition.");

      toast({ title: "Test Saved Successfully!", description: `Test ${testDefinition.name} (${testDefinition.test_code}) saved.` });
      form.reset(); // Reset form
      setAvailableQuestions([]);
      setAllQuestionsForSubject({});
      setGeneratedTestJson(null);
      setShowJsonDialog(false);

    } catch (error: any) {
      toast({ variant: "destructive", title: "Save Failed", description: error.message });
    } finally {
      setIsSaving(false); // Finish saving indicator
    }
  }


  // Helper to render question preview
  const renderQuestionPreview = (q: QuestionBankItem) => {
    if (q.type === 'image' && q.question.image) {
      return <span className="text-blue-600 line-clamp-1">[Image: {q.question.image}]</span>;
    }
    return <span className="line-clamp-1">{q.question.text || '[No Text]'}</span>;
  }

   // Calculate total weightage for validation message
    const totalWeightage = useMemo(() => {
        if (testType !== 'full_length') return 100; // Not applicable
        return (physicsWeight ?? 0) + (chemistryWeight ?? 0) + (selectedStream === 'PCM' ? (mathsWeight ?? 0) : (biologyWeight ?? 0));
    }, [testType, selectedStream, physicsWeight, chemistryWeight, mathsWeight, biologyWeight]);


  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <PlusCircle className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create New Test</h1>
          <p className="text-muted-foreground">Define test parameters and select questions.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

          {/* --- Test Type and Metadata Card --- */}
          <Card>
            <CardHeader>
              <CardTitle>1. Test Configuration</CardTitle>
              <CardDescription>Select the type of test and set basic details.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
               <FormField
                    control={form.control}
                    name="testType"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Test Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isSaving}>
                            <FormControl>
                                <SelectTrigger> <SelectValue placeholder="Select Type" /> </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="chapterwise">Chapterwise Test</SelectItem>
                                <SelectItem value="full_length">Full-Length Test</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel>Test Name *</FormLabel> <FormControl> <Input placeholder="e.g., Physics Chapter 1 Test" {...field} disabled={isSaving} /> </FormControl> <FormMessage /> </FormItem> )} />
                <FormField control={form.control} name="duration" render={({ field }) => ( <FormItem> <FormLabel>Duration (Minutes) *</FormLabel> <FormControl> <Input type="number" {...field} min="1" max="300" disabled={isSaving} /> </FormControl> <FormMessage /> </FormItem> )} />
                <FormField control={form.control} name="access" render={({ field }) => ( <FormItem> <FormLabel>Access Type *</FormLabel> <Select onValueChange={field.onChange} value={field.value} disabled={isSaving}> <FormControl> <SelectTrigger> <SelectValue placeholder="Select Access" /> </SelectTrigger> </FormControl> <SelectContent> {pricingTypes.map((pt) => <SelectItem key={pt} value={pt} className="capitalize">{pt.replace('_', ' ')}</SelectItem>)} </SelectContent> </Select> <FormMessage /> </FormItem> )} />
                <FormField control={form.control} name="audience" render={({ field }) => ( <FormItem> <FormLabel>Target Audience *</FormLabel> <Select onValueChange={field.onChange} value={field.value} disabled={isSaving}> <FormControl> <SelectTrigger> <SelectValue placeholder="Select Audience" /> </SelectTrigger> </FormControl> <SelectContent> {audienceTypes.map((aud) => <SelectItem key={aud} value={aud}>{aud}</SelectItem>)} </SelectContent> </Select> <FormMessage /> </FormItem> )} />
                 {/* Common Question Count Dropdown */}
                 <FormField
                    control={form.control}
                    name="count"
                    render={({ field }) => ( <FormItem>
                        <FormLabel>Number of Questions *</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value, 10))} value={field.value?.toString()} disabled={isSaving}>
                        <FormControl>
                            <SelectTrigger> <SelectValue placeholder="Select Count" /> </SelectTrigger>
                        </FormControl>
                         <SelectContent> {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => <SelectItem key={num} value={num.toString()}>{num}</SelectItem>)} </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem> )}
                 />
            </CardContent>
          </Card>

          {/* --- Chapterwise Specific Fields --- */}
            {testType === 'chapterwise' && (
                 <Card>
                     <CardHeader>
                       <CardTitle>2. Chapterwise Details & Questions</CardTitle>
                       <CardDescription>Select subject, lesson, exam filter, and questions.</CardDescription>
                     </CardHeader>
                     <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-3">
                          {/* Subject & Lesson Selection */}
                         <div className="md:col-span-1 space-y-4">
                             <FormField
                                control={form.control}
                                name="subject"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Subject *</FormLabel>
                                     <Select onValueChange={(value) => { field.onChange(value); setLessons([]); form.setValue('lesson', ''); setAvailableQuestions([]) }} value={field.value} disabled={isLoadingSubjects || isSaving}>
                                       <FormControl>
                                         <SelectTrigger> <SelectValue placeholder={isLoadingSubjects ? "Loading..." : "Select Subject"} /> </SelectTrigger>
                                       </FormControl>
                                       <SelectContent>
                                        {subjects.map((sub) => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}
                                       </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                             />
                             <FormField
                                control={form.control}
                                name="lesson"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Lesson *</FormLabel>
                                    <Select onValueChange={(value) => {field.onChange(value); setAvailableQuestions([])}} value={field.value} disabled={isLoadingLessons || !selectedSubject || isSaving}>
                                    <FormControl>
                                        <SelectTrigger> <SelectValue placeholder={isLoadingLessons ? "Loading..." : (!selectedSubject ? "Select Subject First" : "Select Lesson")} /> </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {lessons.map((lesson) => <SelectItem key={lesson} value={lesson}>{lesson}</SelectItem>)}
                                        {!isLoadingLessons && lessons.length === 0 && selectedSubject && <SelectItem value="no-lessons" disabled>No lessons found</SelectItem>}
                                    </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                             />
                             <FormField
                                control={form.control}
                                name="chapterwiseExamFilter"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Exam Filter</FormLabel>
                                    <Select onValueChange={(value) => {field.onChange(value as ExamOption | 'all'); setAvailableQuestions([])}} value={field.value} disabled={isSaving || !selectedSubject || !selectedLesson}>
                                     <FormControl>
                                        <SelectTrigger> <SelectValue placeholder="Filter by Exam (Optional)" /> </SelectTrigger>
                                     </FormControl>
                                    <SelectContent>
                                        <SelectItem value="all">All Exams</SelectItem>
                                        {examOptions.map((ex) => <SelectItem key={ex} value={ex}>{ex}</SelectItem>)}
                                    </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                             />
                         </div>
                           {/* Question Selection Table */}
                         <div className="md:col-span-2 space-y-3">
                            <h3 className="font-medium">Select Questions ({selectedQuestionIds?.length || 0} / {questionCount})</h3>
                            <div className="flex justify-between items-center">
                                <p className="text-sm text-muted-foreground">Available: {availableQuestions.length} questions</p>
                                <Button type="button" size="sm" variant="outline" onClick={handleSelectRandomChapterwise} disabled={isLoadingQuestions || availableQuestions.length < 1 || isSaving || !selectedSubject || !selectedLesson}>
                                Auto-Pick {questionCount}
                                </Button>
                            </div>
                             <ScrollArea className="h-72 w-full rounded-md border">
                             <Table>
                                <TableHeader><TableRow>
                                    <TableHead className="w-[40px]"></TableHead>
                                    <TableHead>Preview</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Exam</TableHead>
                                    <TableHead className="text-right">View</TableHead>
                                </TableRow></TableHeader>
                                <TableBody>
                                {isLoadingQuestions ? (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></TableCell></TableRow>
                                ) : availableQuestions.length > 0 ? (
                                    availableQuestions.map((q) => (
                                    <TableRow key={q.id} className={selectedQuestionIds?.includes(q.id) ? 'bg-muted/50' : ''}>
                                        <TableCell padding="checkbox"><Checkbox checked={selectedQuestionIds?.includes(q.id)} onCheckedChange={() => handleQuestionSelect(q.id)} disabled={isSaving || (selectedQuestionIds && selectedQuestionIds.length >= questionCount && !selectedQuestionIds.includes(q.id))} /></TableCell>
                                        <TableCell>{renderQuestionPreview(q)}</TableCell>
                                        <TableCell><Badge variant={q.type === 'text' ? 'secondary' : 'outline'} className="capitalize text-xs">{q.type}</Badge></TableCell>
                                        <TableCell><Badge variant="outline" className="text-xs">{q.examType}</Badge></TableCell>
                                        <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => setPreviewQuestion(q)}><Eye className="h-4 w-4"/></Button></TableCell>
                                    </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center">
                                        {(!selectedSubject || !selectedLesson) ? "Select Subject and Lesson." : "No questions found."}
                                    </TableCell></TableRow>
                                )}
                                </TableBody>
                            </Table>
                            </ScrollArea>
                            <FormField
                                control={form.control}
                                name="selectedQuestionIds"
                                render={({ fieldState }) => (
                                     <FormMessage className="mt-2 text-destructive">
                                       {(selectedQuestionIds?.length || 0) !== questionCount && availableQuestions.length > 0 ? `Please select exactly ${questionCount} questions.` : fieldState.error?.message}
                                     </FormMessage>
                                )}
                             />
                         </div>
                     </CardContent>
                 </Card>
            )}

           {/* --- Full Length Specific Fields --- */}
            {testType === 'full_length' && (
                <Card>
                    <CardHeader>
                        <CardTitle>2. Full-Length Details</CardTitle>
                        <CardDescription>Select stream, exam filter, and subject weightages (Total questions: {questionCount}).</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
                         <FormField
                            control={form.control}
                            name="stream"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Stream *</FormLabel>
                                <Select onValueChange={(value) => {
                                    field.onChange(value as TestStream);
                                    const isPCM = value === 'PCM';
                                    const defaultMathsBioWeight = Math.round(100 / 3); // Default to ~33%
                                    const currentPhysicsWeight = form.getValues('physicsWeight') ?? defaultMathsBioWeight;
                                    const currentChemistryWeight = form.getValues('chemistryWeight') ?? defaultMathsBioWeight;
                                    const remainingWeight = 100 - currentPhysicsWeight - currentChemistryWeight;

                                    form.setValue('mathsWeight', isPCM ? Math.max(0, remainingWeight) : 0);
                                    form.setValue('biologyWeight', !isPCM ? Math.max(0, remainingWeight) : 0);
                                    // Trigger validation after updating weights
                                     form.trigger(['physicsWeight', 'chemistryWeight', 'mathsWeight', 'biologyWeight']);
                                }} value={field.value} disabled={isSaving}>
                                <FormControl>
                                    <SelectTrigger> <SelectValue placeholder="Select Stream" /> </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {testStreams.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                         />
                         <FormField
                            control={form.control}
                            name="fullLengthExamFilter"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Exam Filter</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} disabled={isSaving}>
                                 <FormControl>
                                    <SelectTrigger> <SelectValue placeholder="Filter by Exam (Optional)" /> </SelectTrigger>
                                 </FormControl>
                                <SelectContent>
                                    <SelectItem value="all">All Exams</SelectItem>
                                    {examOptions.map((ex) => <SelectItem key={ex} value={ex}>{ex}</SelectItem>)}
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                         />
                     </CardContent>
                     {/* Weightage Sliders */}
                     <CardContent className="space-y-6 pt-0">
                         <h4 className="font-medium border-t pt-4">Subject Weightage (%)</h4>
                          <div className="grid gap-4 md:grid-cols-3">
                              {/* Physics */}
                              <FormField control={form.control} name="physicsWeight" render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel className="flex items-center justify-between">
                                        <span className="flex items-center gap-1.5"><FlaskConical className="h-4 w-4 text-blue-500"/>Physics</span>
                                        <span className="text-sm font-normal text-muted-foreground">{field.value}%</span>
                                    </FormLabel>
                                     <FormControl><Slider defaultValue={[field.value]} value={[field.value]} max={100} step={1} onValueChange={(value) => field.onChange(value[0])} disabled={isSaving} /></FormControl>
                                </FormItem>
                                )} />
                                {/* Chemistry */}
                              <FormField control={form.control} name="chemistryWeight" render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel className="flex items-center justify-between">
                                        <span className="flex items-center gap-1.5"><FlaskConical className="h-4 w-4 text-green-500"/>Chemistry</span>
                                        <span className="text-sm font-normal text-muted-foreground">{field.value}%</span>
                                    </FormLabel>
                                    <FormControl><Slider defaultValue={[field.value]} value={[field.value]} max={100} step={1} onValueChange={(value) => field.onChange(value[0])} disabled={isSaving} /></FormControl>
                                </FormItem>
                                )} />
                                {/* Maths (Conditional) */}
                               {selectedStream === 'PCM' && (
                                  <FormField control={form.control} name="mathsWeight" render={({ field }) => (
                                    <FormItem className="space-y-3">
                                         <FormLabel className="flex items-center justify-between">
                                           <span className="flex items-center gap-1.5"><Calculator className="h-4 w-4 text-red-500"/>Maths</span>
                                            <span className="text-sm font-normal text-muted-foreground">{field.value ?? 0}%</span>
                                        </FormLabel>
                                        <FormControl><Slider defaultValue={[field.value ?? 0]} value={[field.value ?? 0]} max={100} step={1} onValueChange={(value) => field.onChange(value[0])} disabled={isSaving} /></FormControl>
                                    </FormItem>
                                    )} />
                                )}
                                 {/* Biology (Conditional) */}
                                {selectedStream === 'PCB' && (
                                  <FormField control={form.control} name="biologyWeight" render={({ field }) => (
                                    <FormItem className="space-y-3">
                                         <FormLabel className="flex items-center justify-between">
                                            <span className="flex items-center gap-1.5"><Dna className="h-4 w-4 text-purple-500"/>Biology</span>
                                            <span className="text-sm font-normal text-muted-foreground">{field.value ?? 0}%</span>
                                        </FormLabel>
                                        <FormControl><Slider defaultValue={[field.value ?? 0]} value={[field.value ?? 0]} max={100} step={1} onValueChange={(value) => field.onChange(value[0])} disabled={isSaving} /></FormControl>
                                    </FormItem>
                                    )} />
                                )}
                          </div>
                           {/* Display Total Weightage and Validation Message */}
                            <div className="flex justify-end items-center gap-2 text-sm">
                                <span className="text-muted-foreground">Total:</span>
                                <span className={`font-medium ${Math.abs(totalWeightage - 100) > 0.1 ? 'text-destructive' : 'text-foreground'}`}>{totalWeightage.toFixed(0)}%</span>
                            </div>
                            {Math.abs(totalWeightage - 100) > 0.1 && (
                                <p className="text-xs text-destructive text-right">Total weightage must be 100%.</p>
                            )}
                             {/* Validation message specifically for the weightage refinement */}
                             <FormField
                                control={form.control}
                                name="physicsWeight" // Attach error to one of the fields involved
                                render={({ fieldState }) => <FormMessage>{fieldState.error?.message}</FormMessage>}
                             />
                     </CardContent>
                </Card>
            )}

          {/* --- Submit Footer --- */}
          <Card>
            <CardFooter className="pt-6">
                 <Button type="submit" disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Generate Test Definition
                </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>


      {/* Question Preview Dialog */}
       <Dialog open={!!previewQuestion} onOpenChange={(open) => !open && setPreviewQuestion(null)}>
         <DialogContent className="max-w-2xl">
           <DialogHeader>
             <DialogTitle>Question Preview: {previewQuestion?.id}</DialogTitle>
           </DialogHeader>
           {previewQuestion && (
             <div className="space-y-4 max-h-[70vh] overflow-y-auto p-4">
               <div className="flex flex-wrap gap-2 text-xs">
                   <Badge variant="secondary">{previewQuestion.subject}</Badge>
                   <Badge variant="secondary">{previewQuestion.lesson}</Badge>
                   <Badge variant="outline">{previewQuestion.class}</Badge>
                   <Badge variant="outline">{previewQuestion.examType}</Badge>
                    <Badge variant="outline">{previewQuestion.difficulty}</Badge>
               </div>
                {previewQuestion.type === 'text' && previewQuestion.question.text && (
                    <div className="prose prose-sm dark:prose-invert max-w-none border p-3 rounded-md">
                        <p className="font-medium mb-1">Question:</p>
                        <p>{previewQuestion.question.text}</p>
                    </div>
                )}
                 {previewQuestion.type === 'image' && previewQuestion.question.image && (
                     <div>
                        <p className="font-medium mb-1">Question Image:</p>
                        <Image src={`/question_bank_images/${previewQuestion.subject}/${previewQuestion.lesson}/${previewQuestion.question.image}`} alt="Question Image" width={500} height={300} className="rounded border"/>
                     </div>
                 )}
                  <div>
                     <p className="font-medium mb-1">Options:</p>
                     <ul className="list-none space-y-1 text-sm">
                        <li><strong>A:</strong> {previewQuestion.options.A}</li>
                        <li><strong>B:</strong> {previewQuestion.options.B}</li>
                        <li><strong>C:</strong> {previewQuestion.options.C}</li>
                        <li><strong>D:</strong> {previewQuestion.options.D}</li>
                     </ul>
                 </div>
                 <p className="text-sm"><strong>Correct Answer:</strong> {previewQuestion.correct}</p>
                  {previewQuestion.explanation.text && (
                     <div className="prose prose-sm dark:prose-invert max-w-none border p-3 rounded-md bg-muted/50">
                         <p className="font-medium mb-1">Explanation:</p>
                        <p>{previewQuestion.explanation.text}</p>
                     </div>
                  )}
                  {previewQuestion.explanation.image && (
                     <div>
                        <p className="font-medium mb-1">Explanation Image:</p>
                         <Image src={`/question_bank_images/${previewQuestion.subject}/${previewQuestion.lesson}/${previewQuestion.explanation.image}`} alt="Explanation Image" width={400} height={200} className="rounded border"/>
                     </div>
                  )}

             </div>
           )}
           <DialogFooter>
             <DialogClose asChild>
               <Button type="button" variant="outline">Close</Button>
             </DialogClose>
           </DialogFooter>
         </DialogContent>
       </Dialog>


       {/* JSON Confirmation Dialog */}
       <Dialog open={showJsonDialog} onOpenChange={(open) => { if (!open) { setGeneratedTestJson(null); setIsSaving(false); } setShowJsonDialog(open); }}>
         <DialogContent className="max-w-3xl">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2"><FileJson className="h-5 w-5"/> Test Definition Generated</DialogTitle>
             <DialogDescription>
               Review the generated test JSON below. Click "Confirm & Save" to store it.
             </DialogDescription>
           </DialogHeader>
           <ScrollArea className="max-h-[60vh] rounded-md border bg-muted/50 p-4">
             <pre className="text-xs whitespace-pre-wrap break-all">
               {generatedTestJson || "Generating..."}
             </pre>
           </ScrollArea>
           <DialogFooter>
             <Button type="button" variant="outline" onClick={() => { setShowJsonDialog(false); setGeneratedTestJson(null); setIsSaving(false); }} disabled={isSaving}>
               Cancel
             </Button>
             <Button type="button" onClick={handleConfirmSave} disabled={!generatedTestJson || isSaving}>
               {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <FileCheck className="mr-2 h-4 w-4"/> Confirm & Save Test
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
    </div>
  );
}
