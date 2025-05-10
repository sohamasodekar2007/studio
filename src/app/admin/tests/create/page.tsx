// src/app/admin/tests/create/page.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { v4 as uuidv4 } from 'uuid';
import Script from 'next/script';

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Loader2, Filter, BookOpen, Check, ChevronsUpDown, AlertTriangle, Eye, FileText, ImageIcon, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuestionBankItem, PricingType, ExamOption, TestStream, GeneratedTest, TestQuestion, AcademicStatus } from '@/types';
import { pricingTypes, academicStatuses as audienceTypes, testStreams, exams } from '@/types';
import { getSubjects, getLessonsForSubject, getQuestionsForLesson } from '@/actions/question-bank-query-actions';
import { saveGeneratedTest } from '@/actions/generated-test-actions';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Image from 'next/image';
import JsonEditorDialog from '@/components/admin/json-editor-dialog'; // Assuming this component exists

// --- Zod Schemas ---
const commonTestFieldsSchema = z.object({
    name: z.string().min(3, "Test name must be at least 3 characters long."),
    duration: z.number().min(1, "Duration must be at least 1 minute.").positive("Duration must be a positive number."),
    type: z.enum(pricingTypes, { required_error: "Access type is required." }),
    audience: z.enum(audienceTypes, { required_error: "Target audience is required." }),
    // testType will be added by specific schemas
});

const ChapterwiseSchema = commonTestFieldsSchema.extend({
    testType: z.literal('chapterwise'),
    subject: z.string().min(1, "Subject is required."),
    lesson: z.string().min(1, "Lesson name is required."),
    examFilter: z.enum([...exams, 'all'] as [ExamOption, ...ExamOption[], 'all'], { invalid_type_error: "Please select an exam filter." }).default('all'),
    selectedQuestionIds: z.array(z.string()).min(1, "Select at least one question."),
    count: z.number().min(1, "Must select at least 1 question.").max(50, "Max 50 questions per chapterwise test."),
});

const FullLengthSchema = commonTestFieldsSchema.extend({
    testType: z.literal('full_length'),
    stream: z.enum(testStreams, { required_error: "Stream selection is required." }),
    examFilter: z.enum([...exams, 'all'] as [ExamOption, ...ExamOption[], 'all'], { invalid_type_error: "Please select an exam filter." }).default('all'),
    totalQuestions: z.number().min(10, "Must select at least 10 total questions.").positive("Total questions must be positive."),
    weightagePhysics: z.number().min(0).max(100).optional(),
    weightageChemistry: z.number().min(0).max(100).optional(),
    weightageMaths: z.number().min(0).max(100).optional(),
    weightageBiology: z.number().min(0).max(100).optional(),
})
.refine(data => {
    if (data.testType !== 'full_length') return true;
    let sum = 0;
    if (data.stream === 'PCM') {
        sum = (data.weightagePhysics ?? 0) + (data.weightageChemistry ?? 0) + (data.weightageMaths ?? 0);
    } else if (data.stream === 'PCB') {
        sum = (data.weightagePhysics ?? 0) + (data.weightageChemistry ?? 0) + (data.weightageBiology ?? 0);
    } else {
        return true; 
    }
    return sum === 100;
}, {
    message: "Weightages must add up to 100% for the selected stream (PCM/PCB).",
    path: ["weightagePhysics"], 
});

// Discriminated union schema
const TestCreationSchema = z.discriminatedUnion("testType", [
    ChapterwiseSchema,
    FullLengthSchema,
]);

type TestCreationFormValues = z.infer<typeof TestCreationSchema>;

const constructImagePath = (subject: string, lesson: string, filename: string | null | undefined): string | null => {
    if (!filename) return null;
    const basePath = '/question_bank_images';
    return `${basePath}/${encodeURIComponent(subject)}/${encodeURIComponent(lesson)}/images/${encodeURIComponent(filename)}`;
};

export default function CreateTestPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [lessons, setLessons] = useState<string[]>([]);
  const [availableQuestions, setAvailableQuestions] = useState<QuestionBankItem[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [lessonPopoverOpen, setLessonPopoverOpen] = useState(false);
  const [selectedQuestionObjects, setSelectedQuestionObjects] = useState<QuestionBankItem[]>([]);
  const [isJsonEditorOpen, setIsJsonEditorOpen] = useState(false);
  const [sampleJsonContent, setSampleJsonContent] = useState('');
  const [isLoadingSampleJson, setIsLoadingSampleJson] = useState(false);

  const form = useForm<TestCreationFormValues>({
    resolver: zodResolver(TestCreationSchema),
    defaultValues: {
        testType: 'chapterwise', // Default to chapterwise
        name: '',
        duration: 60,
        type: 'FREE',
        audience: 'Dropper',
        // Chapterwise specific defaults
        subject: '',
        lesson: '',
        examFilter: 'all',
        selectedQuestionIds: [],
        count: 20,
        // Full length specific defaults (will be overridden if testType changes)
        stream: 'PCM',
        totalQuestions: 50,
        weightagePhysics: 34,
        weightageChemistry: 33,
        weightageMaths: 33,
    },
  });

  const selectedTestType = form.watch('testType');
  const selectedSubjectWatch = form.watch('subject' as any); // Use 'any' if field doesn't always exist
  const selectedLessonWatch = form.watch('lesson' as any);
  const selectedQuestionIdsWatch = form.watch('selectedQuestionIds' as any);
  const chapterwiseCountWatch = form.watch('count' as any);
  const fullLengthStreamWatch = form.watch('stream' as any);


  const typesetMathJax = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).MathJax && typeof (window as any).MathJax.typesetPromise === 'function') {
        const elements = document.querySelectorAll('.mathjax-content-preview');
        if (elements.length > 0) {
            (window as any).MathJax.typesetPromise(Array.from(elements))
                .catch((err: any) => console.error("MathJax typeset error (preview):", err));
        }
    }
  }, []);

  useEffect(() => {
    if (availableQuestions.length > 0 && !isLoadingQuestions) {
        const timerId = setTimeout(() => {
            typesetMathJax();
        }, 50);
        return () => clearTimeout(timerId);
    }
  }, [availableQuestions, isLoadingQuestions, typesetMathJax]);


  useEffect(() => {
    const currentValues = form.getValues();
    const commonValuesToPreserve = {
      name: currentValues.name,
      duration: currentValues.duration,
      type: currentValues.type,
      audience: currentValues.audience,
      examFilter: (currentValues as any).examFilter || 'all', // Cast to any for common access
    };

    if (selectedTestType === 'full_length') {
      form.reset({
        ...commonValuesToPreserve,
        testType: 'full_length',
        stream: 'PCM',
        totalQuestions: 50,
        weightagePhysics: 34, 
        weightageChemistry: 33,
        weightageMaths: 33,
        weightageBiology: undefined, // Explicitly undefined
        // Chapterwise specific fields to undefined
        subject: undefined,
        lesson: undefined,
        selectedQuestionIds: undefined,
        count: undefined,
      });
    } else if (selectedTestType === 'chapterwise') {
      form.reset({
        ...commonValuesToPreserve,
        testType: 'chapterwise',
        subject: '',
        lesson: '',
        selectedQuestionIds: [],
        count: 20,
        // Full length specific fields to undefined
        stream: undefined,
        totalQuestions: undefined,
        weightagePhysics: undefined,
        weightageChemistry: undefined,
        weightageMaths: undefined,
        weightageBiology: undefined,
      });
    }
  }, [selectedTestType, form]); 

    useEffect(() => {
        setIsLoadingSubjects(true);
        getSubjects()
            .then(setSubjects)
            .catch(err => toast({ variant: "destructive", title: "Error", description: "Could not load subjects." }))
            .finally(() => setIsLoadingSubjects(false));
    }, [toast]);

    useEffect(() => {
        const currentValues = form.getValues();
        if (currentValues.testType === 'chapterwise' && currentValues.subject) {
            setIsLoadingLessons(true);
            setLessons([]);
            form.setValue('lesson', ''); // Type assertion
            form.setValue('selectedQuestionIds', []); // Type assertion
            setAvailableQuestions([]);
            getLessonsForSubject(currentValues.subject)
                .then(setLessons)
                .catch(err => toast({ variant: "destructive", title: "Error", description: `Could not load lessons for ${currentValues.subject}.` }))
                .finally(() => setIsLoadingLessons(false));
        } else {
            setLessons([]);
        }
    }, [selectedTestType, selectedSubjectWatch, form, toast]);

    useEffect(() => {
        const currentValues = form.getValues();
        if (currentValues.testType === 'chapterwise' && currentValues.subject && currentValues.lesson) {
            setIsLoadingQuestions(true);
            setAvailableQuestions([]);
            form.setValue('selectedQuestionIds', []); // Type assertion
            const examFilterValue = currentValues.examFilter as ExamOption | 'all';

            const filters = {
                subject: currentValues.subject,
                lesson: currentValues.lesson,
                examType: examFilterValue !== 'all' ? examFilterValue : undefined,
            };
            getQuestionsForLesson(filters)
                .then(setAvailableQuestions)
                .catch(err => toast({ variant: "destructive", title: "Error", description: "Could not load questions." }))
                .finally(() => setIsLoadingQuestions(false));
        } else {
            setAvailableQuestions([]);
             setIsLoadingQuestions(false); 
        }
    }, [selectedTestType, selectedSubjectWatch, selectedLessonWatch, form, toast, form.watch('examFilter' as any)]);


     useEffect(() => {
         if (selectedTestType === 'chapterwise') {
             const currentValues = form.getValues();
             const selectedIds = currentValues.selectedQuestionIds || [];
             const selectedObjects = availableQuestions.filter(q => selectedIds.includes(q.id));
             setSelectedQuestionObjects(selectedObjects);
         } else {
             setSelectedQuestionObjects([]);
         }
     }, [selectedQuestionIdsWatch, availableQuestions, selectedTestType, form]);

     const shuffleArray = (array: any[]) => {
        let currentIndex = array.length, randomIndex;
        while (currentIndex !== 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [
                array[randomIndex], array[currentIndex]];
        }
        return array;
    };

    const handleAutoSelect = useCallback(() => {
        const currentValues = form.getValues();
        if (currentValues.testType !== 'chapterwise') return;

        const countNum = typeof currentValues.count === 'number' ? currentValues.count : 0;
        if (availableQuestions.length > 0 && countNum > 0) {
            const countToSelect = Math.min(countNum, availableQuestions.length);
            const shuffledQuestions = shuffleArray([...availableQuestions]);
            const selectedIds = shuffledQuestions.slice(0, countToSelect).map(q => q.id);
            form.setValue('selectedQuestionIds', selectedIds); // Type assertion
             toast({ title: "Questions Selected", description: `${selectedIds.length} questions randomly selected.` });
        } else {
            toast({ variant: "destructive", title: "Selection Failed", description: "Not enough questions available or count is zero." });
        }
    }, [availableQuestions, form, toast]);


    const onSubmit = async (data: TestCreationFormValues) => {
        setIsLoading(true);
        let testDefinition: GeneratedTest | null = null;
        const testCode = uuidv4().substring(0, 8).toUpperCase();

        const baseData = {
            test_code: testCode,
            name: data.name,
            duration: data.duration,
            type: data.type,
            audience: data.audience,
            createdAt: new Date().toISOString(),
        };

        let finalQuestions: TestQuestion[] = [];
        let actualTotalQuestions = 0;
        let subjectsInTest: string[] = [];


        try {
            if (data.testType === 'chapterwise') {
                const chapterwiseData = data;
                if (!chapterwiseData.subject || !chapterwiseData.lesson || !chapterwiseData.selectedQuestionIds || !chapterwiseData.count) {
                    throw new Error("Missing required chapterwise fields.");
                }
                const selectedQsData = availableQuestions.filter(q => chapterwiseData.selectedQuestionIds!.includes(q.id));
                if (selectedQsData.length === 0) throw new Error("No questions selected for chapterwise test.");

                finalQuestions = selectedQsData.map(q => ({
                    id: q.id,
                    type: q.type,
                    question_text: q.question.text || null,
                    question_image_url: q.question.image ? constructImagePath(q.subject, q.lesson, q.question.image) : null,
                    options: [q.options.A, q.options.B, q.options.C, q.options.D],
                    answer: q.correct,
                    marks: q.marks || 1,
                    explanation_text: q.explanation.text || null,
                    explanation_image_url: q.explanation.image ? constructImagePath(q.subject, q.lesson, q.explanation.image) : null,
                }));
                actualTotalQuestions = finalQuestions.length;
                subjectsInTest = [chapterwiseData.subject];

                testDefinition = {
                    ...baseData,
                    testType: 'chapterwise',
                    count: actualTotalQuestions, 
                    total_questions: actualTotalQuestions,
                    test_subject: subjectsInTest,
                    lesson: chapterwiseData.lesson,
                    examFilter: chapterwiseData.examFilter,
                    questions: finalQuestions,
                };

            } else if (data.testType === 'full_length') {
                 const fullLengthData = data;
                 if (!fullLengthData.stream || !fullLengthData.examFilter || !fullLengthData.totalQuestions) {
                    throw new Error("Missing required full_length fields.");
                 }
                subjectsInTest = fullLengthData.stream === 'PCM' ? ['Physics', 'Chemistry', 'Maths'] : ['Physics', 'Chemistry', 'Biology'];
                const examTypeFilter = fullLengthData.examFilter !== 'all' ? fullLengthData.examFilter : undefined;
                const allSubjectQuestions: { [key: string]: QuestionBankItem[] } = {};
                let totalAvailableBankQuestions = 0;

                setIsLoadingQuestions(true); 
                try {
                    await Promise.all(subjectsInTest.map(async (subject) => {
                        const lessonsInSubject = await getLessonsForSubject(subject);
                        let subjectQuestions: QuestionBankItem[] = [];
                        await Promise.all(lessonsInSubject.map(async (lesson) => {
                            const lessonQuestions = await getQuestionsForLesson({ subject, lesson, examType: examTypeFilter });
                            subjectQuestions = subjectQuestions.concat(lessonQuestions);
                        }));
                        allSubjectQuestions[subject] = subjectQuestions;
                        totalAvailableBankQuestions += subjectQuestions.length;
                    }));
                } finally {
                    setIsLoadingQuestions(false); 
                }


                if (totalAvailableBankQuestions < fullLengthData.totalQuestions) {
                    throw new Error(`Not enough questions in bank (${totalAvailableBankQuestions}) for requested total (${fullLengthData.totalQuestions}). Try broader filters.`);
                }

                const totalQuestionsNeeded = fullLengthData.totalQuestions;
                 const weightages: Record<string, number> = {
                    Physics: fullLengthData.weightagePhysics ?? (fullLengthData.stream === 'PCM' ? 34 : 33), 
                    Chemistry: fullLengthData.weightageChemistry ?? 33,
                    Maths: fullLengthData.stream === 'PCM' ? (fullLengthData.weightageMaths ?? 33) : 0,
                    Biology: fullLengthData.stream === 'PCB' ? (fullLengthData.weightageBiology ?? 34) : 0,
                 };

                const targetCounts: { [key: string]: number } = {};
                let calculatedSum = 0;
                subjectsInTest.forEach(subject => {
                    targetCounts[subject] = Math.round((weightages[subject] / 100) * totalQuestionsNeeded);
                    calculatedSum += targetCounts[subject];
                });

                 let diff = totalQuestionsNeeded - calculatedSum;
                 while (diff !== 0) {
                    const adjustableSubjects = subjectsInTest.filter(s => (diff > 0) || (targetCounts[s] > 0));
                    if (adjustableSubjects.length === 0) break; 
                    const adjustSubject = adjustableSubjects[Math.floor(Math.random() * adjustableSubjects.length)];
                    if (diff > 0) { targetCounts[adjustSubject]++; diff--; }
                    else if (targetCounts[adjustSubject] > 0) { targetCounts[adjustSubject]--; diff++; }
                 }


                const physicsQs: TestQuestion[] = [];
                const chemistryQs: TestQuestion[] = [];
                const mathsQs: TestQuestion[] = [];
                const biologyQs: TestQuestion[] = [];

                for (const subject of subjectsInTest) {
                    const countForSubject = targetCounts[subject];
                    const availableQs = shuffleArray([...allSubjectQuestions[subject] || []]);
                    const selectedForSubject = availableQs.slice(0, Math.min(countForSubject, availableQs.length));

                    selectedForSubject.forEach(q => {
                        const questionObj: TestQuestion = {
                            id: q.id, type: q.type,
                            question_text: q.question.text || null,
                            question_image_url: q.question.image ? constructImagePath(q.subject, q.lesson, q.question.image) : null,
                            options: [q.options.A, q.options.B, q.options.C, q.options.D],
                            answer: q.correct, marks: q.marks || 1,
                            explanation_text: q.explanation.text || null,
                            explanation_image_url: q.explanation.image ? constructImagePath(q.subject, q.lesson, q.explanation.image) : null,
                        };
                        if (subject === 'Physics') physicsQs.push(questionObj);
                        else if (subject === 'Chemistry') chemistryQs.push(questionObj);
                        else if (subject === 'Maths') mathsQs.push(questionObj);
                        else if (subject === 'Biology') biologyQs.push(questionObj);
                    });
                }
                actualTotalQuestions = physicsQs.length + chemistryQs.length + mathsQs.length + biologyQs.length;

                testDefinition = {
                    ...baseData,
                    testType: 'full_length',
                    stream: fullLengthData.stream,
                    test_subject: subjectsInTest,
                    examFilter: fullLengthData.examFilter,
                    weightage: {
                        physics: weightages.Physics,
                        chemistry: weightages.Chemistry,
                        maths: fullLengthData.stream === 'PCM' ? weightages.Maths : undefined,
                        biology: fullLengthData.stream === 'PCB' ? weightages.Biology : undefined,
                    },
                    count: totalQuestionsNeeded,
                    total_questions: actualTotalQuestions, 
                    physics: physicsQs.length > 0 ? physicsQs : undefined,
                    chemistry: chemistryQs.length > 0 ? chemistryQs : undefined,
                    maths: mathsQs.length > 0 ? mathsQs : undefined,
                    biology: biologyQs.length > 0 ? biologyQs : undefined,
                };
            }

            if (testDefinition) {
                const result = await saveGeneratedTest(testDefinition);
                if (!result.success) throw new Error(result.message || "Failed to save test.");
                toast({ title: "Test Created!", description: `Test "${data.name}" (${testCode}) saved successfully.` });
                form.reset( { 
                    testType: 'chapterwise', name: '', duration: 60, type: 'FREE', audience: 'Dropper',
                    subject: '', lesson: '', examFilter: 'all', selectedQuestionIds: [], count: 20,
                     // Reset full length specific fields as well
                    stream: 'PCM', totalQuestions: 50, weightagePhysics: 34, weightageChemistry: 33, weightageMaths: 33, weightageBiology: undefined,
                });
                setAvailableQuestions([]); 
                setSelectedQuestionObjects([]); 
            } else {
                 throw new Error("Invalid test type or configuration error.");
            }

        } catch (error: any) {
            console.error("Error in onSubmit:", error);
            toast({ variant: "destructive", title: "Creation Failed", description: error.message });
        } finally {
            setIsLoading(false);
        }
  };

  const handleMathJaxLoad = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).MathJax) {
      typesetMathJax();
    }
  }, [typesetMathJax]);
    
  return <>
      <Script
        id="mathjax-script-create-test"
        src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
        strategy="lazyOnload"
        onLoad={handleMathJaxLoad}
      />
      <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Create New Test</h1>
            <p className="text-muted-foreground">Generate chapterwise or full-length tests from the question bank.</p>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                     <Card>
                         <CardHeader><CardTitle>1. Select Test Type</CardTitle></CardHeader>
                         <CardContent>
                            <FormField control={form.control} name="testType" render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormControl>
                                        <RadioGroup
                                            onValueChange={(value) => {
                                                const newType = value as 'chapterwise' | 'full_length';
                                                field.onChange(newType);
                                            }}
                                            value={field.value}
                                            className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-4"
                                            disabled={isLoading}
                                        >
                                            <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="chapterwise" id="r1" /></FormControl><Label htmlFor="r1" className="font-normal">Chapterwise</Label></FormItem>
                                            <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="full_length" id="r2" /></FormControl><Label htmlFor="r2" className="font-normal">Full Length</Label></FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                         </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>2. Test Details</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Test Name *</FormLabel><FormControl><Input placeholder="e.g., Physics Mock Test 1" {...field} disabled={isLoading} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="duration" render={({ field }) => (<FormItem><FormLabel>Duration (Minutes) *</FormLabel><FormControl><Input type="number" placeholder="e.g., 60" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} disabled={isLoading} min="1" /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="type" render={({ field }) => ( <FormItem><FormLabel>Access Type *</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Select Access" /></SelectTrigger></FormControl><SelectContent>{pricingTypes.map(pt => <SelectItem key={pt} value={pt} className="capitalize">{pt.replace('_', ' ')}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="audience" render={({ field }) => ( <FormItem><FormLabel>Target Audience *</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Select Audience" /></SelectTrigger></FormControl><SelectContent>{audienceTypes.map(aud => <SelectItem key={aud} value={aud}>{aud}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        </CardContent>
                    </Card>

                    {selectedTestType === 'chapterwise' && (
                        <Card>
                            <CardHeader><CardTitle>3. Chapterwise Details &amp; Questions</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <FormField control={form.control} name="subject" render={({ field }) => (<FormItem><FormLabel>Subject *</FormLabel><Select onValueChange={field.onChange} value={field.value ?? ''} disabled={isLoading || isLoadingSubjects}><FormControl><SelectTrigger><SelectValue placeholder={isLoadingSubjects ? "Loading..." : "Select Subject"} /></SelectTrigger></FormControl><SelectContent>{subjects.map((sub) => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="lesson" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Lesson *</FormLabel>
                                        <Popover open={lessonPopoverOpen} onOpenChange={setLessonPopoverOpen}><PopoverTrigger asChild><FormControl><Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")} disabled={isLoading || isLoadingLessons || !selectedSubjectWatch}><BookOpen className="mr-2 h-4 w-4 opacity-50" />{field.value ? field.value : (isLoadingLessons ? "Loading..." : "Select Lesson")}<ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" /></Button></FormControl></PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Search lesson..." /><CommandList>{isLoadingLessons ? (<CommandItem disabled>Loading...</CommandItem>) : lessons.length === 0 && selectedSubjectWatch ? (<CommandEmpty>No lessons found.</CommandEmpty>) : !selectedSubjectWatch ? (<CommandEmpty>Select Subject first.</CommandEmpty>) : null }<CommandGroup>{lessons.map((lessonItem) => (<CommandItem value={lessonItem} key={lessonItem} onSelect={() => { form.setValue("lesson", lessonItem as any); setLessonPopoverOpen(false); }}><Check className={cn("mr-2 h-4 w-4", lessonItem === field.value ? "opacity-100" : "opacity-0")} />{lessonItem}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent></Popover><FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="examFilter" render={({ field }) => (<FormItem><FormLabel>Exam Filter</FormLabel><Select onValueChange={field.onChange} value={field.value ?? 'all'} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="All Exams" /></SelectTrigger></FormControl><SelectContent><SelectItem value="all">All Exams</SelectItem>{exams.map(ex => <SelectItem key={ex} value={ex}>{ex}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="count" render={({ field }) => (<FormItem><FormLabel>Number of Questions *</FormLabel><Select onValueChange={(value) => field.onChange(parseInt(value, 10))} value={field.value?.toString()} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Select count (1-50)" /></SelectTrigger></FormControl><SelectContent>{Array.from({ length: 50 }, (_, i) => i + 1).map(num => (<SelectItem key={num} value={num.toString()}>{num}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="selectedQuestionIds" render={({ field }) => (
                                    <FormItem>
                                        <div className="mb-2 flex justify-between items-center"><FormLabel>Select Questions * ({form.watch('selectedQuestionIds' as any, []).length} / {availableQuestions.length})</FormLabel>
                                        {availableQuestions.length > 0 && (<div className="space-x-2"><Button type="button" size="sm" variant="outline" onClick={handleAutoSelect} disabled={isLoading || isLoadingQuestions || !chapterwiseCountWatch || chapterwiseCountWatch === 0}>Auto-Pick {chapterwiseCountWatch}</Button><Button type="button" size="sm" variant="outline" onClick={() => field.onChange(availableQuestions.map(q => q.id))} disabled={isLoading || isLoadingQuestions}>Select All</Button><Button type="button" size="sm" variant="outline" onClick={() => field.onChange([])} disabled={isLoading || isLoadingQuestions}>Deselect All</Button></div>)}</div>
                                        <FormControl><ScrollArea className="h-72 w-full rounded-md border p-4 bg-muted/20">{isLoadingQuestions ? (<p>Loading...</p>) : availableQuestions.length === 0 ? (<p>No questions found. Adjust filters or add questions to the bank.</p>) : (<div className="space-y-2">{availableQuestions.map((item) => (<FormField key={item.id} control={form.control} name="selectedQuestionIds" render={({ field: checkboxField }) => (<FormItem key={item.id} className="flex flex-row items-start space-x-3 space-y-0 p-3 border rounded bg-background"><FormControl><Checkbox checked={checkboxField.value?.includes(item.id)} onCheckedChange={(checked) => checked ? checkboxField.onChange([...(checkboxField.value || []), item.id]) : checkboxField.onChange(checkboxField.value?.filter(id => id !== item.id))} /></FormControl>
                                        <FormLabel className="text-sm font-normal flex-1 cursor-pointer">
                                            {item.type === 'text' && item.question.text && (
                                                <span className="font-medium block mathjax-content-preview" dangerouslySetInnerHTML={{__html: (item.question.text.substring(0,100)+'...')}}></span>
                                            )}
                                            {item.type === 'image' && item.question.image && (
                                                <div className="flex items-center gap-2">
                                                   <ImageIcon className="h-4 w-4 text-muted-foreground"/>
                                                   <span className="text-xs font-mono">{item.question.image}</span>
                                                </div>
                                            )}
                                            <span className="text-xs text-muted-foreground block">ID: {item.id} | Marks: {item.marks}</span>
                                        </FormLabel>
                                        </FormItem>))} />))}</ScrollArea></FormControl><FormMessage />
                                    </FormItem>
                                )}/>
                            </CardContent>
                        </Card>
                    )}

                    {selectedTestType === 'full_length' && (
                        <Card>
                            <CardHeader><CardTitle>3. Full Length Details</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <FormField control={form.control} name="stream" render={({ field }) => (<FormItem><FormLabel>Stream *</FormLabel><Select onValueChange={field.onChange} value={field.value ?? 'PCM'} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Select Stream" /></SelectTrigger></FormControl><SelectContent>{testStreams.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="examFilter" render={({ field }) => (<FormItem><FormLabel>Source Question Exams *</FormLabel><Select onValueChange={field.onChange} value={field.value ?? 'all'} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Select Exam Pool" /></SelectTrigger></FormControl><SelectContent><SelectItem value="all">All Exams (Combined)</SelectItem>{exams.map(ex => <SelectItem key={ex} value={ex}>Only {ex} Questions</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="totalQuestions" render={({ field }) => (<FormItem><FormLabel>Total Questions *</FormLabel><FormControl><Input type="number" placeholder="e.g., 50" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} disabled={isLoading} min="10" /></FormControl><FormMessage /></FormItem>)} />
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t"><h4 className="md:col-span-3 font-medium text-sm">Weightage (%)</h4>
                                    <FormField control={form.control} name="weightagePhysics" render={({ field }) => (<FormItem><FormLabel>Physics</FormLabel><FormControl><Input type="number" min="0" max="100" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} disabled={isLoading} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="weightageChemistry" render={({ field }) => (<FormItem><FormLabel>Chemistry</FormLabel><FormControl><Input type="number" min="0" max="100" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} disabled={isLoading} /></FormControl><FormMessage /></FormItem>)} />
                                    {fullLengthStreamWatch === 'PCM' && (<FormField control={form.control} name="weightageMaths" render={({ field }) => (<FormItem><FormLabel>Maths</FormLabel><FormControl><Input type="number" min="0" max="100" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} disabled={isLoading} /></FormControl><FormMessage /></FormItem>)} />)}
                                    {fullLengthStreamWatch === 'PCB' && (<FormField control={form.control} name="weightageBiology" render={({ field }) => (<FormItem><FormLabel>Biology</FormLabel><FormControl><Input type="number" min="0" max="100" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} disabled={isLoading} /></FormControl><FormMessage /></FormItem>)} />)}
                                </div>
                                <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-700/50 dark:text-blue-300"><AlertTriangle className="h-4 w-4 !text-blue-600 dark:!text-blue-400" /><AlertTitle>Question Selection</AlertTitle><AlertDescription>Questions are auto-selected based on criteria. Ensure enough questions exist in the bank for the chosen filters and weightages.</AlertDescription></Alert>
                            </CardContent>
                        </Card>
                    )}

                    <div className="flex justify-end">
                        <Button type="submit" disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}Create Test</Button>
                    </div>
                </form>
            </Form>
        </div>
    </>;
}
