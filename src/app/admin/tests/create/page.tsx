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
import type { QuestionBankItem, PricingType, ChapterwiseTestJson, FullLengthTestJson, ExamOption, ClassLevel, AudienceType, TestStream, GeneratedTest } from '@/types';
import { pricingTypes, audienceTypes, testStreams, examOptions } from '@/types'; // Import options
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
    duration: z.coerce.number().min(1, "Duration must be at least 1 minute.").max(300, "Duration cannot exceed 300 minutes."),
    access: z.enum(pricingTypes, { required_error: "Access type is required." }),
    audience: z.enum(audienceTypes, { required_error: "Target audience is required." }),
    name: z.string().min(3, "Test name must be at least 3 characters."),
});

const ChapterwiseSchema = BaseTestSchema.extend({
    testType: z.literal('chapterwise'),
    subject: z.string().min(1, "Subject is required"),
    lesson: z.string().min(1, "Lesson is required"),
    chapterwiseExamFilter: z.enum(['all', ...examOptions], { required_error: "Exam filter is required" }),
    selectedQuestionIds: z.array(z.string()).min(1, "Please select at least one question."),
    questionCount: z.coerce.number().min(1, "Number of questions must be at least 1.").max(50, "Max 50 questions"),
});

const FullLengthSchema = BaseTestSchema.extend({
    testType: z.literal('full_length'),
    stream: z.enum(testStreams, { required_error: "Stream (PCM/PCB) is required." }),
    fullLengthExamFilter: z.enum(['all', ...examOptions], { required_error: "Exam filter is required" }),
    // Weightages - ensure they add up to 100
    physicsWeight: z.number().min(0).max(100),
    chemistryWeight: z.number().min(0).max(100),
    mathsWeight: z.number().min(0).max(100).optional(),
    biologyWeight: z.number().min(0).max(100).optional(),
    totalQuestions: z.coerce.number().min(10, "Minimum 10 questions").max(200, "Maximum 200 questions"),
}).refine(data => {
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
   const [allQuestionsForSubject, setAllQuestionsForSubject] = useState<QuestionBankItem[]>([]); // Store all questions for the subject


  const form = useForm<TestCreationFormValues>({
    resolver: zodResolver(TestCreationSchema),
    defaultValues: {
      testType: 'chapterwise', // Default to chapterwise
      name: '',
      duration: 60,
      access: 'FREE',
      audience: 'Dropper',
      // Chapterwise defaults
      subject: '',
      lesson: '',
      chapterwiseExamFilter: 'all',
      selectedQuestionIds: [],
      questionCount: 20,
      // Full Length defaults
      stream: 'PCM',
      fullLengthExamFilter: 'all',
      physicsWeight: 34,
      chemistryWeight: 33,
      mathsWeight: 33,
      biologyWeight: 0,
      totalQuestions: 100,
    },
  });

  const testType = form.watch('testType');
  const selectedSubject = form.watch('subject'); // For chapterwise
  const selectedLesson = form.watch('lesson'); // For chapterwise
  const selectedStream = form.watch('stream'); // For full length
  const selectedQuestionIds = form.watch('selectedQuestionIds', []);
  const chapterwiseQuestionCount = form.watch('questionCount'); // For chapterwise manual count

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
         try {
           const questions = await getQuestionsForLesson({
             subject: selectedSubject,
             lesson: selectedLesson,
             // Apply exam filter if needed
             examType: form.getValues('chapterwiseExamFilter') === 'all' ? undefined : form.getValues('chapterwiseExamFilter'),
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
     fetchQuestions();
   }, [testType, selectedSubject, selectedLesson, form, toast]); // Re-fetch when filters change

   // Fetch ALL questions for the selected stream subjects (for Full-Length auto-selection)
   useEffect(() => {
     const fetchAllStreamQuestions = async () => {
       if (testType === 'full_length' && selectedStream) {
         setAllQuestionsForSubject([]); // Clear previous
         const subjectsToFetch = ['Physics', 'Chemistry'];
         if (selectedStream === 'PCM') subjectsToFetch.push('Maths');
         if (selectedStream === 'PCB') subjectsToFetch.push('Biology');

         try {
           const questionPromises = subjectsToFetch.map(sub =>
             getQuestionsForLesson({ subject: sub, lesson: '' }) // Fetch all lessons for each subject
           );
           const results = await Promise.all(questionPromises);
           setAllQuestionsForSubject(results.flat()); // Combine questions from all subjects
         } catch (err) {
           console.error("Error fetching stream questions:", err);
           toast({ variant: "destructive", title: "Error loading questions for stream" });
         }
       } else {
           setAllQuestionsForSubject([]);
       }
     };
     fetchAllStreamQuestions();
   }, [testType, selectedStream, toast]);


  // --- Event Handlers ---

   const handleQuestionSelect = (id: string) => {
    const currentSelection = form.getValues('selectedQuestionIds') || [];
    const isSelected = currentSelection.includes(id);
    const newSelection = isSelected
      ? currentSelection.filter(qid => qid !== id)
      : [...currentSelection, id];
    form.setValue('selectedQuestionIds', newSelection, { shouldValidate: true });
  };

   const handleSelectRandomChapterwise = () => {
     const count = form.getValues('questionCount');
     const selectedCount = Math.min(count, availableQuestions.length);
     if (selectedCount < 1) return;
     const shuffled = [...availableQuestions].sort(() => 0.5 - Math.random());
     const randomSelection = shuffled.slice(0, selectedCount).map(q => q.id);
     form.setValue('selectedQuestionIds', randomSelection, { shouldValidate: true });
     toast({ title: `Selected ${randomSelection.length} random questions for this chapter.` });
   };

  const generateTestCode = (): string => {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
  }

  // --- Function to structure selected questions into the final format ---
   const structureQuestions = (
       selectedIds: string[],
       allQuestions: QuestionBankItem[]
   ): Pick<GeneratedTest, 'physics' | 'chemistry' | 'maths' | 'biology'> => {
       const structured: Pick<GeneratedTest, 'physics' | 'chemistry' | 'maths' | 'biology'> = {
           physics: [],
           chemistry: [],
           maths: [],
           biology: [],
       };

       selectedIds.forEach(id => {
           const question = allQuestions.find(q => q.id === id);
           if (question) {
               // Normalize subject key (e.g., "Physics" -> "physics")
               const subjectKey = question.subject.toLowerCase() as keyof typeof structured;

               // Check if the subject key exists in our structure
               if (structured.hasOwnProperty(subjectKey)) {
                    const formattedQuestion = {
                         question: question.type === 'text' ? question.question.text! : question.question.image!,
                         image_url: question.type === 'image' ? `/question_bank_images/${question.subject}/${question.lesson}/${question.question.image}` : null,
                         options: [`Option A: ${question.options.A}`, `Option B: ${question.options.B}`, `Option C: ${question.options.C}`, `Option D: ${question.options.D}`], // Format options
                         answer: `OPTION ${question.correct}`, // Format answer
                         marks: 1, // Default marks
                         explanation: question.explanation.text || (question.explanation.image ? `Image: /question_bank_images/${question.subject}/${question.lesson}/${question.explanation.image}` : null),
                    };
                    // Ensure the subject array exists before pushing
                    if (!structured[subjectKey]) {
                      structured[subjectKey] = [];
                    }
                   (structured[subjectKey] as any[]).push(formattedQuestion);
               } else {
                    console.warn(`Subject key "${subjectKey}" derived from question ${question.id} is not valid.`);
               }
           }
       });
       // Clean up empty subject arrays
       Object.keys(structured).forEach(key => {
            const subjectKey = key as keyof typeof structured;
            if (structured[subjectKey] && structured[subjectKey]?.length === 0) {
                delete structured[subjectKey];
            }
       });

       return structured;
   };

   // --- Auto-select questions based on weightage for Full-Length ---
   const autoSelectFullLengthQuestions = (stream: TestStream, weights: { physics: number; chemistry: number; maths?: number; biology?: number }, totalCount: number) => {
        const selectedIds: string[] = [];
        const questionsBySubject: Record<string, QuestionBankItem[]> = {
            physics: allQuestionsForSubject.filter(q => q.subject.toLowerCase() === 'physics'),
            chemistry: allQuestionsForSubject.filter(q => q.subject.toLowerCase() === 'chemistry'),
            maths: allQuestionsForSubject.filter(q => q.subject.toLowerCase() === 'maths'),
            biology: allQuestionsForSubject.filter(q => q.subject.toLowerCase() === 'biology'),
        };

        const subjectsInStream = ['physics', 'chemistry'];
        if (stream === 'PCM') subjectsInStream.push('maths');
        if (stream === 'PCB') subjectsInStream.push('biology');

        let remainingTotal = totalCount;

        subjectsInStream.forEach((subject, index) => {
            const subjectKey = subject as keyof typeof weights;
            const weight = weights[subjectKey] || 0;
            // Calculate count, ensuring the last subject takes the remainder
            let countForSubject = (index === subjectsInStream.length - 1)
                ? remainingTotal
                : Math.round((weight / 100) * totalCount);

             // Ensure count doesn't exceed available questions
            countForSubject = Math.min(countForSubject, questionsBySubject[subject]?.length || 0);
            countForSubject = Math.max(0, countForSubject); // Ensure non-negative

            if (questionsBySubject[subject] && countForSubject > 0) {
                const shuffled = [...questionsBySubject[subject]].sort(() => 0.5 - Math.random());
                selectedIds.push(...shuffled.slice(0, countForSubject).map(q => q.id));
                remainingTotal -= countForSubject; // Decrement remaining count
            }
        });

       // If due to rounding, remainingTotal is not zero, adjust the last subject's count slightly if possible
       if (remainingTotal !== 0 && subjectsInStream.length > 0) {
          const lastSubject = subjectsInStream[subjectsInStream.length - 1];
          const lastSubjectPool = questionsBySubject[lastSubject];
          const currentLastSubjectCount = selectedIds.filter(id => lastSubjectPool.some(q => q.id === id)).length;
          const potentialNewCount = currentLastSubjectCount + remainingTotal;

          if (potentialNewCount >= 0 && potentialNewCount <= lastSubjectPool.length) {
              // Adjust selection for the last subject
              const otherSubjectIds = selectedIds.filter(id => !lastSubjectPool.some(q => q.id === id));
              const shuffledLast = [...lastSubjectPool].sort(() => 0.5 - Math.random());
              const newLastSubjectIds = shuffledLast.slice(0, potentialNewCount).map(q => q.id);
              selectedIds.splice(0, selectedIds.length, ...otherSubjectIds, ...newLastSubjectIds); // Replace selection
          } else {
              console.warn("Could not perfectly match total question count due to rounding and availability.");
              // Keep the current selection, it might be slightly off totalCount
          }
       }


        return selectedIds;
   };

    // --- Main Submit Handler ---
    const onSubmit = async (data: TestCreationFormValues) => {
        setIsSaving(true);
        setGeneratedTestJson(null);

        try {
            const testCode = generateTestCode();
            let finalTestDefinition: GeneratedTest | ChapterwiseTestJson | FullLengthTestJson;
            let selectedIdsForStructure: string[] = [];
            let testSubjects: string[] = [];

            if (data.testType === 'chapterwise') {
                if (!data.selectedQuestionIds || data.selectedQuestionIds.length !== data.questionCount) {
                   toast({ variant: "destructive", title: "Validation Error", description: `Please select exactly ${data.questionCount} questions.` });
                   setIsSaving(false);
                   return;
                }
                 selectedIdsForStructure = data.selectedQuestionIds;
                 testSubjects = [data.subject]; // Chapterwise has one subject

                const structuredQuestions = structureQuestions(selectedIdsForStructure, availableQuestions);

                const chapterwiseJson: ChapterwiseTestJson = {
                    test_code: testCode,
                    name: data.name,
                    type: 'chapterwise',
                    subject: data.subject, // Single subject
                    lesson: data.lesson,
                    duration: data.duration,
                    access: data.access,
                    audience: data.audience,
                    examFilter: data.chapterwiseExamFilter,
                    total_questions: selectedIdsForStructure.length,
                    questions: structuredQuestions[data.subject.toLowerCase() as keyof typeof structuredQuestions] || [], // Get questions for the specific subject
                    createdAt: new Date().toISOString(),
                };
                 finalTestDefinition = chapterwiseJson;


            } else { // Full Length
                 const weights = {
                     physics: data.physicsWeight,
                     chemistry: data.chemistryWeight,
                     maths: data.stream === 'PCM' ? data.mathsWeight : undefined,
                     biology: data.stream === 'PCB' ? data.biologyWeight : undefined,
                 };
                selectedIdsForStructure = autoSelectFullLengthQuestions(data.stream, weights, data.totalQuestions);
                testSubjects = ['Physics', 'Chemistry']; // Base subjects
                if (data.stream === 'PCM') testSubjects.push('Maths');
                if (data.stream === 'PCB') testSubjects.push('Biology');

                const structuredQuestions = structureQuestions(selectedIdsForStructure, allQuestionsForSubject); // Use allQuestionsForSubject here

                const fullLengthJson: FullLengthTestJson = {
                    test_code: testCode,
                    name: data.name,
                    type: 'full_length',
                    stream: data.stream,
                    duration: data.duration,
                    access: data.access,
                    audience: data.audience,
                    examFilter: data.fullLengthExamFilter,
                    total_questions: selectedIdsForStructure.length,
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
        } finally {
             // Keep isSaving true until dialog confirmation or cancellation
             // setIsSaving(false); // Moved to handleConfirmSave and dialog close
        }
    };


  const handleConfirmSave = async () => {
    if (!generatedTestJson) return;
    setIsSaving(true); // Indicate final saving process
    try {
      const testDefinition = JSON.parse(generatedTestJson); // Parse the confirmed JSON
      const result = await saveGeneratedTest(testDefinition); // Save the generated test
      if (!result.success) throw new Error(result.message || "Failed to save test definition.");

      toast({ title: "Test Saved Successfully!", description: `Test ${testDefinition.name} (${testDefinition.test_code}) saved.` });
      form.reset(); // Reset form
      setAvailableQuestions([]);
      setAllQuestionsForSubject([]);
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
        return (physicsWeight || 0) + (chemistryWeight || 0) + (selectedStream === 'PCM' ? (mathsWeight || 0) : (biologyWeight || 0));
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
                            <SelectTrigger> <SelectValue placeholder="Select Type" /> </SelectTrigger>
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
                                    <SelectTrigger> <SelectValue placeholder={isLoadingSubjects ? "Loading..." : "Select Subject"} /> </SelectTrigger>
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
                                    <SelectTrigger> <SelectValue placeholder={isLoadingLessons ? "Loading..." : (!selectedSubject ? "Select Subject First" : "Select Lesson")} /> </SelectTrigger>
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
                                    <Select onValueChange={(value) => {field.onChange(value); setAvailableQuestions([])}} value={field.value} disabled={isSaving || !selectedSubject || !selectedLesson}>
                                    <SelectTrigger> <SelectValue placeholder="Filter by Exam (Optional)" /> </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Exams</SelectItem>
                                        {examOptions.map((ex) => <SelectItem key={ex} value={ex}>{ex}</SelectItem>)}
                                    </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                             />
                              <FormField
                                control={form.control}
                                name="questionCount"
                                render={({ field }) => ( <FormItem>
                                    <FormLabel>Number of Questions *</FormLabel>
                                    <Select onValueChange={(value) => field.onChange(parseInt(value, 10))} value={field.value?.toString()} disabled={isSaving}>
                                    <SelectTrigger> <SelectValue placeholder="Select Count" /> </SelectTrigger>
                                    <SelectContent> {Array.from({ length: 50 }, (_, i) => i + 1).map((num) => <SelectItem key={num} value={num.toString()}>{num}</SelectItem>)} </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem> )}
                             />
                         </div>
                           {/* Question Selection Table */}
                         <div className="md:col-span-2 space-y-3">
                            <h3 className="font-medium">Select Questions ({selectedQuestionIds?.length || 0} / {chapterwiseQuestionCount})</h3>
                            <div className="flex justify-between items-center">
                                <p className="text-sm text-muted-foreground">Available: {availableQuestions.length} questions</p>
                                <Button type="button" size="sm" variant="outline" onClick={handleSelectRandomChapterwise} disabled={isLoadingQuestions || availableQuestions.length < 1 || isSaving || !selectedSubject || !selectedLesson}>
                                Auto-Pick {chapterwiseQuestionCount}
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
                                        <TableCell padding="checkbox"><Checkbox checked={selectedQuestionIds?.includes(q.id)} onCheckedChange={() => handleQuestionSelect(q.id)} disabled={isSaving} /></TableCell>
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
                                       {(selectedQuestionIds?.length || 0) !== chapterwiseQuestionCount ? `Please select exactly ${chapterwiseQuestionCount} questions.` : fieldState.error?.message}
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
                        <CardDescription>Select stream, exam filter, total questions, and subject weightages.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-3">
                         <FormField
                            control={form.control}
                            name="stream"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Stream *</FormLabel>
                                <Select onValueChange={(value) => { field.onChange(value); form.setValue('biologyWeight', value === 'PCB' ? 33 : 0); form.setValue('mathsWeight', value === 'PCM' ? 33 : 0); }} value={field.value} disabled={isSaving}>
                                <SelectTrigger> <SelectValue placeholder="Select Stream" /> </SelectTrigger>
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
                                <SelectTrigger> <SelectValue placeholder="Filter by Exam (Optional)" /> </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Exams</SelectItem>
                                    {examOptions.map((ex) => <SelectItem key={ex} value={ex}>{ex}</SelectItem>)}
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                         />
                        <FormField control={form.control} name="totalQuestions" render={({ field }) => ( <FormItem> <FormLabel>Total Questions *</FormLabel> <FormControl> <Input type="number" {...field} min="10" max="200" disabled={isSaving} /> </FormControl> <FormMessage /> </FormItem> )} />
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
                                            <span className="text-sm font-normal text-muted-foreground">{field.value}%</span>
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
                                            <span className="text-sm font-normal text-muted-foreground">{field.value}%</span>
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
