// src/app/admin/tests/create/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { v4 as uuidv4 } from 'uuid';

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
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Loader2, Filter, BookOpen, Check, ChevronsUpDown, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuestionBankItem, PricingType, ChapterwiseTestJson, FullLengthTestJson, ExamOption, ClassLevel, AudienceType, TestStream, GeneratedTest, TestQuestion, AcademicStatus } from '@/types';
import { pricingTypes, academicStatuses as audienceTypes, testStreams, exams } from '@/types';
import { getSubjects, getLessonsForSubject, getQuestionsForLesson } from '@/actions/question-bank-query-actions';
import { saveGeneratedTest } from '@/actions/generated-test-actions';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Image from 'next/image';

// --- Zod Schemas ---

// Common fields for all test types
const commonTestFields = z.object({
    name: z.string().min(3, "Test name must be at least 3 characters long."),
    duration: z.number().min(1, "Duration must be at least 1 minute.").positive(),
    type: z.enum(pricingTypes, { required_error: "Access type is required." }),
    audience: z.enum(audienceTypes, { required_error: "Target audience is required." }),
});

// Schema for Chapterwise Test
const ChapterwiseSchema = z.object({
    testType: z.literal('chapterwise'),
}).merge(commonTestFields).extend({
    subject: z.string().min(1, "Subject is required."),
    lesson: z.string().min(1, "Lesson name is required."),
    examFilter: z.enum([...exams, 'all'], { required_error: "Exam filter is required." }),
    selectedQuestionIds: z.array(z.string()).min(1, "Select at least one question."),
    count: z.number().min(1, "Must select at least 1 question.").max(50, "Max 50 questions per chapterwise test."),
});

// Schema for Full Length Test
const FullLengthSchema = z.object({
    testType: z.literal('full_length'),
}).merge(commonTestFields).extend({
    stream: z.enum(testStreams, { required_error: "Stream selection is required." }),
    examFilter: z.enum([...exams, 'all'], { required_error: "Exam filter is required." }),
    totalQuestions: z.number().min(10, "Must select at least 10 total questions.").positive(),
    weightagePhysics: z.number().min(0).max(100).optional(),
    weightageChemistry: z.number().min(0).max(100).optional(),
    weightageMaths: z.number().min(0).max(100).optional(),
    weightageBiology: z.number().min(0).max(100).optional(),
}).refine(data => {
    if (data.stream === 'PCM') {
        const sum = (data.weightagePhysics ?? 0) + (data.weightageChemistry ?? 0) + (data.weightageMaths ?? 0);
        return sum === 100;
    }
    if (data.stream === 'PCB') {
        const sum = (data.weightagePhysics ?? 0) + (data.weightageChemistry ?? 0) + (data.weightageBiology ?? 0);
        return sum === 100;
    }
    return true;
}, {
    message: "Weightages must add up to 100% for the selected stream.",
    path: ["weightagePhysics"],
});

// Discriminated union schema
const TestCreationSchema = z.discriminatedUnion("testType", [
    ChapterwiseSchema,
    FullLengthSchema,
]);

type TestCreationFormValues = z.infer<typeof TestCreationSchema>;


// --- Component ---
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

    const form = useForm<TestCreationFormValues>({
        resolver: zodResolver(TestCreationSchema),
        defaultValues: {
            testType: 'chapterwise',
            name: '',
            duration: 60,
            type: 'FREE',
            audience: 'Dropper',
            subject: '',
            lesson: '',
            examFilter: 'all',
            selectedQuestionIds: [],
            count: 20,
            stream: 'PCM',
            totalQuestions: 50,
            weightagePhysics: 34,
            weightageChemistry: 33,
            weightageMaths: 33,
            weightageBiology: undefined, 
        },
    });

    const selectedTestType = form.watch('testType');
    const selectedSubject = form.watch('subject');
    const selectedLesson = form.watch('lesson');
    const selectedQuestionIds = form.watch('selectedQuestionIds');
    const chapterwiseCount = form.watch('count');
    const fullLengthStream = form.watch('stream');


    useEffect(() => {
        setIsLoadingSubjects(true);
        getSubjects()
            .then(setSubjects)
            .catch(err => toast({ variant: "destructive", title: "Error", description: "Could not load subjects." }))
            .finally(() => setIsLoadingSubjects(false));
    }, [toast]);

    useEffect(() => {
        if (selectedTestType === 'chapterwise' && selectedSubject) {
            setIsLoadingLessons(true);
            setLessons([]);
            form.setValue('lesson', '');
            form.setValue('selectedQuestionIds', []);
            setAvailableQuestions([]);
            getLessonsForSubject(selectedSubject)
                .then(setLessons)
                .catch(err => toast({ variant: "destructive", title: "Error", description: `Could not load lessons for ${selectedSubject}.` }))
                .finally(() => setIsLoadingLessons(false));
        } else {
            setLessons([]);
        }
    }, [selectedTestType, selectedSubject, toast, form]);

    useEffect(() => {
        if (selectedTestType === 'chapterwise' && selectedSubject && selectedLesson) {
            setIsLoadingQuestions(true);
            setAvailableQuestions([]);
            form.setValue('selectedQuestionIds', []);
            const currentExamFilter = form.getValues('examFilter') as ExamOption | 'all';
            const filters = {
                subject: selectedSubject,
                lesson: selectedLesson,
                examType: currentExamFilter !== 'all' ? currentExamFilter : undefined,
            };
            getQuestionsForLesson(filters)
                .then(setAvailableQuestions)
                .catch(err => toast({ variant: "destructive", title: "Error", description: "Could not load questions." }))
                .finally(() => setIsLoadingQuestions(false));
        } else {
            setAvailableQuestions([]);
        }
    }, [selectedTestType, selectedSubject, selectedLesson, form, toast]);


     useEffect(() => {
         if (selectedTestType === 'chapterwise') {
             const selectedObjects = availableQuestions.filter(q => selectedQuestionIds?.includes(q.id));
             setSelectedQuestionObjects(selectedObjects);
         } else {
             setSelectedQuestionObjects([]);
         }
     }, [selectedQuestionIds, availableQuestions, selectedTestType]);

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
        const countNum = typeof chapterwiseCount === 'number' ? chapterwiseCount : 0;
        if (selectedTestType === 'chapterwise' && availableQuestions.length > 0 && countNum > 0) {
            const countToSelect = Math.min(countNum, availableQuestions.length);
            const shuffledQuestions = shuffleArray([...availableQuestions]);
            const selectedIds = shuffledQuestions.slice(0, countToSelect).map(q => q.id);
            form.setValue('selectedQuestionIds', selectedIds);
             toast({ title: "Questions Selected", description: `${selectedIds.length} questions randomly selected.` });
        } else {
            toast({ variant: "destructive", title: "Selection Failed", description: "Not enough questions available or count is zero." });
        }
    }, [availableQuestions, chapterwiseCount, form, selectedTestType, toast]);


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
            test_subject: [],
            total_questions: 0,
            count: 0, 
        };

        let finalQuestions: TestQuestion[] = [];
        let actualTotalQuestions = 0;

        try {
            if (data.testType === 'chapterwise') {
                if (!data.subject || !data.lesson || !data.selectedQuestionIds || !data.count) {
                    throw new Error("Missing required chapterwise fields.");
                }
                const selectedQsData = availableQuestions.filter(q => data.selectedQuestionIds.includes(q.id));
                if (selectedQsData.length === 0) throw new Error("No questions selected for chapterwise test.");

                finalQuestions = selectedQsData.map(q => ({
                    id: q.id,
                    type: q.type,
                    question_text: q.question.text || null,
                    question_image_url: q.question.image ? `/question_bank_images/${encodeURIComponent(q.subject)}/${encodeURIComponent(q.lesson)}/images/${encodeURIComponent(q.question.image)}` : null,
                    options: [q.options.A, q.options.B, q.options.C, q.options.D],
                    answer: q.correct,
                    marks: q.marks || 1,
                    explanation_text: q.explanation.text || null,
                    explanation_image_url: q.explanation.image ? `/question_bank_images/${encodeURIComponent(q.subject)}/${encodeURIComponent(q.lesson)}/images/${encodeURIComponent(q.explanation.image)}` : null,
                }));
                actualTotalQuestions = finalQuestions.length;

                testDefinition = {
                    ...baseData,
                    testType: 'chapterwise',
                    count: actualTotalQuestions, // Use actual selected count
                    total_questions: actualTotalQuestions,
                    test_subject: [data.subject],
                    lesson: data.lesson,
                    examFilter: data.examFilter,
                    questions: finalQuestions,
                };

            } else if (data.testType === 'full_length') {
                 if (!data.stream || !data.examFilter || !data.totalQuestions) {
                    throw new Error("Missing required full_length fields.");
                 }
                const subjectsToFetch = data.stream === 'PCM' ? ['Physics', 'Chemistry', 'Maths'] : ['Physics', 'Chemistry', 'Biology'];
                const examTypeFilter = data.examFilter !== 'all' ? data.examFilter : undefined;
                const allSubjectQuestions: { [key: string]: QuestionBankItem[] } = {};
                let totalAvailableBankQuestions = 0;

                setIsLoadingQuestions(true);
                try {
                    await Promise.all(subjectsToFetch.map(async (subject) => {
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

                if (totalAvailableBankQuestions < data.totalQuestions) {
                    throw new Error(`Not enough questions in bank (${totalAvailableBankQuestions}) for requested total (${data.totalQuestions}).`);
                }

                const totalQuestionsNeeded = data.totalQuestions;
                 const weightages: Record<string, number> = {
                    Physics: data.weightagePhysics ?? (data.stream === 'PCM' ? 34 : 33),
                    Chemistry: data.weightageChemistry ?? 33,
                    Maths: data.stream === 'PCM' ? (data.weightageMaths ?? 33) : 0,
                    Biology: data.stream === 'PCB' ? (data.weightageBiology ?? 34) : 0,
                 };

                const targetCounts: { [key: string]: number } = {};
                let calculatedSum = 0;
                subjectsToFetch.forEach(subject => {
                    targetCounts[subject] = Math.round((weightages[subject] / 100) * totalQuestionsNeeded);
                    calculatedSum += targetCounts[subject];
                });

                 let diff = totalQuestionsNeeded - calculatedSum;
                 while (diff !== 0) {
                    const adjustableSubjects = subjectsToFetch.filter(s => (diff > 0) || (targetCounts[s] > 0));
                    if (adjustableSubjects.length === 0) break; 
                    const adjustSubject = adjustableSubjects[Math.floor(Math.random() * adjustableSubjects.length)];
                    if (diff > 0) { targetCounts[adjustSubject]++; diff--; }
                    else if (targetCounts[adjustSubject] > 0) { targetCounts[adjustSubject]--; diff++; }
                 }

                let physicsQuestions: TestQuestion[] = [];
                let chemistryQuestions: TestQuestion[] = [];
                let mathsQuestions: TestQuestion[] | undefined = data.stream === 'PCM' ? [] : undefined;
                let biologyQuestions: TestQuestion[] | undefined = data.stream === 'PCB' ? [] : undefined;

                for (const subject of subjectsToFetch) {
                    const countForSubject = targetCounts[subject];
                    const availableQs = shuffleArray([...allSubjectQuestions[subject] || []]);
                    const selectedForSubject = availableQs.slice(0, Math.min(countForSubject, availableQs.length));
                    selectedForSubject.forEach(q => {
                        const questionObj: TestQuestion = {
                            id: q.id, type: q.type,
                            question_text: q.question.text || null,
                            question_image_url: q.question.image ? `/question_bank_images/${encodeURIComponent(q.subject)}/${encodeURIComponent(q.lesson)}/images/${encodeURIComponent(q.question.image)}` : null,
                            options: [q.options.A, q.options.B, q.options.C, q.options.D],
                            answer: q.correct, marks: q.marks || 1,
                            explanation_text: q.explanation.text || null,
                            explanation_image_url: q.explanation.image ? `/question_bank_images/${encodeURIComponent(q.subject)}/${encodeURIComponent(q.lesson)}/images/${encodeURIComponent(q.explanation.image)}` : null,
                        };
                        if (subject === 'Physics') physicsQuestions.push(questionObj);
                        else if (subject === 'Chemistry') chemistryQuestions.push(questionObj);
                        else if (subject === 'Maths' && mathsQuestions) mathsQuestions.push(questionObj);
                        else if (subject === 'Biology' && biologyQuestions) biologyQuestions.push(questionObj);
                    });
                }
                actualTotalQuestions = physicsQuestions.length + chemistryQuestions.length + (mathsQuestions?.length ?? 0) + (biologyQuestions?.length ?? 0);

                testDefinition = {
                    ...baseData,
                    testType: 'full_length',
                    stream: data.stream,
                    test_subject: subjectsToFetch,
                    examFilter: data.examFilter,
                    weightage: {
                        physics: weightages.Physics, chemistry: weightages.Chemistry,
                        maths: data.stream === 'PCM' ? weightages.Maths : undefined,
                        biology: data.stream === 'PCB' ? weightages.Biology : undefined,
                    },
                    count: totalQuestionsNeeded,
                    total_questions: actualTotalQuestions,
                    physics: physicsQuestions.length > 0 ? physicsQuestions : undefined,
                    chemistry: chemistryQuestions.length > 0 ? chemistryQuestions : undefined,
                    maths, biology,
                };
            }

            if (testDefinition) {
                const result = await saveGeneratedTest(testDefinition);
                if (!result.success) throw new Error(result.message || "Failed to save test.");
                toast({ title: "Test Created!", description: `Test "${data.name}" (${testCode}) saved.` });
                form.reset();
                setAvailableQuestions([]);
                setSelectedQuestionObjects([]);
            } else {
                 throw new Error("Invalid test type or configuration.");
            }

        } catch (error: any) {
            toast({ variant: "destructive", title: "Creation Failed", description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    const totalSelectedCount = useMemo(() => selectedQuestionIds?.length ?? 0, [selectedQuestionIds]);
    const totalAvailableCount = useMemo(() => availableQuestions.length, [availableQuestions]);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Create New Test</h1>
            <p className="text-muted-foreground">Generate chapterwise or full-length tests.</p>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                     <Card>
                         <CardHeader><CardTitle>1. Select Test Type</CardTitle></CardHeader>
                         <CardContent>
                            <FormField control={form.control} name="testType" render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormControl>
                                        <RadioGroup onValueChange={(value) => field.onChange(value as 'chapterwise' | 'full_length')} value={field.value} className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-4" disabled={isLoading}>
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
                                        <Popover open={lessonPopoverOpen} onOpenChange={setLessonPopoverOpen}><PopoverTrigger asChild><FormControl><Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")} disabled={isLoading || isLoadingLessons || !selectedSubject}><ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />{field.value ? field.value : (isLoadingLessons ? "Loading..." : "Select Lesson")}</Button></FormControl></PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Search lesson..." /><CommandList>{isLoadingLessons ? (<CommandItem disabled>Loading...</CommandItem>) : lessons.length === 0 && selectedSubject ? (<CommandEmpty>No lessons found.</CommandEmpty>) : !selectedSubject ? (<CommandEmpty>Select Subject first.</CommandEmpty>) : null }<CommandGroup>{lessons.map((lesson) => (<CommandItem value={lesson} key={lesson} onSelect={() => { form.setValue("lesson", lesson); setLessonPopoverOpen(false); }}><Check className={cn("mr-2 h-4 w-4", lesson === field.value ? "opacity-100" : "opacity-0")} />{lesson}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent></Popover><FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="examFilter" render={({ field }) => (<FormItem><FormLabel>Exam Filter</FormLabel><Select onValueChange={field.onChange} value={field.value ?? 'all'} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="All Exams" /></SelectTrigger></FormControl><SelectContent><SelectItem value="all">All Exams</SelectItem>{exams.map(ex => <SelectItem key={ex} value={ex}>{ex}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="count" render={({ field }) => (<FormItem><FormLabel>Number of Questions *</FormLabel><Select onValueChange={(value) => field.onChange(parseInt(value, 10))} value={field.value?.toString()} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Select count (1-50)" /></SelectTrigger></FormControl><SelectContent>{Array.from({ length: 50 }, (_, i) => i + 1).map(num => (<SelectItem key={num} value={num.toString()}>{num}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="selectedQuestionIds" render={({ field }) => (
                                    <FormItem>
                                        <div className="mb-2 flex justify-between items-center"><FormLabel>Select Questions * ({totalSelectedCount} / {totalAvailableCount})</FormLabel>
                                        {availableQuestions.length > 0 && (<div className="space-x-2"><Button type="button" size="sm" variant="outline" onClick={handleAutoSelect} disabled={isLoading || isLoadingQuestions || !chapterwiseCount || chapterwiseCount === 0}>Auto-Pick {chapterwiseCount}</Button><Button type="button" size="sm" variant="outline" onClick={() => field.onChange(availableQuestions.map(q => q.id))} disabled={isLoading || isLoadingQuestions}>Select All</Button><Button type="button" size="sm" variant="outline" onClick={() => field.onChange([])} disabled={isLoading || isLoadingQuestions}>Deselect All</Button></div>)}</div>
                                        <FormControl><ScrollArea className="h-72 w-full rounded-md border p-4 bg-muted/20">{isLoadingQuestions ? (<p>Loading...</p>) : availableQuestions.length === 0 ? (<p>No questions.</p>) : (<div className="space-y-2">{availableQuestions.map((item) => (<FormField key={item.id} control={form.control} name="selectedQuestionIds" render={({ field: checkboxField }) => (<FormItem key={item.id} className="flex flex-row items-start space-x-3 space-y-0 p-3 border rounded bg-background"><FormControl><Checkbox checked={checkboxField.value?.includes(item.id)} onCheckedChange={(checked) => checked ? checkboxField.onChange([...(checkboxField.value || []), item.id]) : checkboxField.onChange(checkboxField.value?.filter(id => id !== item.id))} /></FormControl><FormLabel className="text-sm font-normal flex-1 cursor-pointer"><span className="font-medium block">{item.question.text ? item.question.text.substring(0,100)+'...' : `[Image: ${item.question.image}]`}</span><span className="text-xs text-muted-foreground">ID: {item.id}</span></FormLabel></FormItem>))} />))}</ScrollArea></FormControl><FormMessage />
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
                                    {fullLengthStream === 'PCM' && (<FormField control={form.control} name="weightageMaths" render={({ field }) => (<FormItem><FormLabel>Maths</FormLabel><FormControl><Input type="number" min="0" max="100" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} disabled={isLoading} /></FormControl><FormMessage /></FormItem>)} />)}
                                    {fullLengthStream === 'PCB' && (<FormField control={form.control} name="weightageBiology" render={({ field }) => (<FormItem><FormLabel>Biology</FormLabel><FormControl><Input type="number" min="0" max="100" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} disabled={isLoading} /></FormControl><FormMessage /></FormItem>)} />)}
                                </div>
                                <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-700/50 dark:text-blue-300"><AlertTriangle className="h-4 w-4 !text-blue-600 dark:!text-blue-400" /><AlertTitle>Question Selection</AlertTitle><AlertDescription>Questions are auto-selected based on criteria. Ensure enough questions exist.</AlertDescription></Alert>
                            </CardContent>
                        </Card>
                    )}

                    <div className="flex justify-end">
                        <Button type="submit" disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}Create Test</Button>
                    </div>
                </form>
            </Form>
        </div>
    );
}
