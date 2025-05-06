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
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Loader2, Filter, BookOpen, Check, ChevronsUpDown, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuestionBankItem, PricingType, ChapterwiseTestJson, FullLengthTestJson, ExamOption, AudienceType, TestStream, GeneratedTest, TestQuestion } from '@/types';
import { pricingTypes, academicStatuses as audienceTypes, testStreams, examOptions } from '@/types'; // Import options
import { getSubjects, getLessonsForSubject, getQuestionsForLesson } from '@/actions/question-bank-query-actions'; // Import query actions
import { saveGeneratedTest } from '@/actions/generated-test-actions'; // Import save action
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Image from 'next/image';

// --- Zod Schemas ---

// Base schema for common fields
const BaseTestSchema = z.object({
    name: z.string().min(3, "Test name must be at least 3 characters long."),
    duration: z.number().min(1, "Duration must be at least 1 minute.").positive(),
    type: z.enum(pricingTypes, { required_error: "Access type is required." }),
    audience: z.enum(audienceTypes, { required_error: "Target audience is required." }),
});

// Schema for Chapterwise Test
const ChapterwiseSchema = BaseTestSchema.extend({
    testType: z.literal('chapterwise'),
    subject: z.string().min(1, "Subject is required."),
    lesson: z.string().min(1, "Lesson name is required."),
    examFilter: z.enum([...examOptions, 'all'], { required_error: "Exam filter is required." }),
    selectedQuestionIds: z.array(z.string()).min(1, "Select at least one question."),
    // Removed count field, it will be derived from selectedQuestionIds.length
});

// Schema for Full Length Test
const FullLengthSchema = BaseTestSchema.extend({
    testType: z.literal('full_length'),
    stream: z.enum(testStreams, { required_error: "Stream selection is required." }),
    examFilter: z.enum([...examOptions, 'all'], { required_error: "Exam filter is required." }),
    totalQuestions: z.number().min(10, "Must select at least 10 total questions.").positive(), // Total desired questions
    weightagePhysics: z.number().min(0).max(100).optional(),
    weightageChemistry: z.number().min(0).max(100).optional(),
    weightageMaths: z.number().min(0).max(100).optional(),
    weightageBiology: z.number().min(0).max(100).optional(),
}).refine(data => {
    // Validate weightage sum for PCM
    if (data.stream === 'PCM') {
        const sum = (data.weightagePhysics ?? 0) + (data.weightageChemistry ?? 0) + (data.weightageMaths ?? 0);
        return sum === 100;
    }
    // Validate weightage sum for PCB
    if (data.stream === 'PCB') {
         const sum = (data.weightagePhysics ?? 0) + (data.weightageChemistry ?? 0) + (data.weightageBiology ?? 0);
        return sum === 100;
    }
    return true; // Should not happen if stream is selected
}, {
    message: "Weightages must add up to 100% for the selected stream.",
    path: ["weightagePhysics"], // Apply error to the first weightage field
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
    const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
    const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
    const [isLoadingLessons, setIsLoadingLessons] = useState(false);
    const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
    const [lessonPopoverOpen, setLessonPopoverOpen] = useState(false);
    const [selectedQuestionObjects, setSelectedQuestionObjects] = useState<QuestionBankItem[]>([]); // For preview

    const form = useForm<TestCreationFormValues>({
        resolver: zodResolver(TestCreationSchema),
        defaultValues: {
            testType: 'chapterwise', // Default to chapterwise
            name: '',
            duration: 60,
            type: 'FREE',
            audience: 'Dropper',
            subject: '',
            lesson: '',
            examFilter: 'all',
            selectedQuestionIds: [],
            // Full Length Defaults (conditional rendering will handle visibility)
            stream: undefined,
            totalQuestions: 50,
            weightagePhysics: 34,
            weightageChemistry: 33,
            weightageMaths: 33,
            weightageBiology: 33,
        },
    });

    const testType = form.watch('testType');
    const selectedSubject = form.watch('subject');
    const selectedLesson = form.watch('lesson');
    const selectedQuestionIds = form.watch('selectedQuestionIds'); // Watch selected IDs

    // --- Fetch Subjects ---
    useEffect(() => {
        setIsLoadingSubjects(true);
        getSubjects()
            .then(setSubjects)
            .catch(err => toast({ variant: "destructive", title: "Error", description: "Could not load subjects." }))
            .finally(() => setIsLoadingSubjects(false));
    }, [toast]);

    // --- Fetch Lessons when Subject Changes (for Chapterwise) ---
    useEffect(() => {
        if (testType === 'chapterwise' && selectedSubject) {
            setIsLoadingLessons(true);
            setLessons([]);
            form.setValue('lesson', ''); // Reset lesson
            form.setValue('selectedQuestionIds', []); // Clear selected questions
            setQuestions([]); // Clear questions list
            getLessonsForSubject(selectedSubject)
                .then(setLessons)
                .catch(err => toast({ variant: "destructive", title: "Error", description: `Could not load lessons for ${selectedSubject}.` }))
                .finally(() => setIsLoadingLessons(false));
        } else {
            setLessons([]);
        }
    }, [testType, selectedSubject, toast, form]);

    // --- Fetch Questions when Lesson Changes (for Chapterwise) ---
    useEffect(() => {
        if (testType === 'chapterwise' && selectedSubject && selectedLesson) {
            setIsLoadingQuestions(true);
            setQuestions([]);
            form.setValue('selectedQuestionIds', []); // Clear selections when lesson changes
            const filters = {
                subject: selectedSubject,
                lesson: selectedLesson,
                // Add other filters if needed based on examFilter, classFilter etc.
                // examType: form.getValues('examFilter') !== 'all' ? form.getValues('examFilter') : undefined,
            };
            getQuestionsForLesson(filters)
                .then(setQuestions)
                .catch(err => toast({ variant: "destructive", title: "Error", description: "Could not load questions." }))
                .finally(() => setIsLoadingQuestions(false));
        } else {
            setQuestions([]); // Clear if subject/lesson not set
        }
    }, [testType, selectedSubject, selectedLesson, toast, form]); // Re-fetch when lesson changes

     // --- Update selected questions preview ---
     useEffect(() => {
         if (testType === 'chapterwise') {
             const selectedObjects = questions.filter(q => selectedQuestionIds?.includes(q.id));
             setSelectedQuestionObjects(selectedObjects);
         } else {
             setSelectedQuestionObjects([]); // Clear for full length for now
         }
     }, [selectedQuestionIds, questions, testType]);


    // --- Form Submission ---
    const onSubmit = async (data: TestCreationFormValues) => {
        setIsLoading(true);
        console.log("Form Submitted Data:", data);

        try {
            let testDefinition: GeneratedTest;
            const testCode = uuidv4().substring(0, 8); // Generate unique 8-char code
            const baseData = {
                test_code: testCode,
                name: data.name,
                duration: data.duration,
                type: data.type,
                audience: data.audience,
                createdAt: new Date().toISOString(),
            };

            if (data.testType === 'chapterwise') {
                 // Fetch full data for selected questions
                const selectedQsData = questions.filter(q => data.selectedQuestionIds.includes(q.id));
                 if (selectedQsData.length !== data.selectedQuestionIds.length) {
                    throw new Error("Could not find all selected question details. Please refresh and try again.");
                 }

                const chapterwiseQuestions: TestQuestion[] = selectedQsData.map(q => ({
                    question: q.question.text || q.question.image || '', // Use text or image filename
                    image_url: q.question.image ? `/question_bank_images/${q.subject}/${q.lesson}/${q.question.image}` : null,
                    options: [`Option A: ${q.options.A}`, `Option B: ${q.options.B}`, `Option C: ${q.options.C}`, `Option D: ${q.options.D}`],
                    answer: `Option ${q.correct}`,
                    marks: 1, // Assuming 1 mark per question for now
                    explanation: q.explanation.text || q.explanation.image ? `/question_bank_images/${q.subject}/${q.lesson}/${q.explanation.image}` : null,
                }));

                testDefinition = {
                    ...baseData,
                    testType: 'chapterwise', // Ensure discriminator is set
                    count: chapterwiseQuestions.length,
                    total_questions: chapterwiseQuestions.length,
                    test_subject: [data.subject],
                    lesson: data.lesson,
                    examFilter: data.examFilter,
                    questions: chapterwiseQuestions,
                };
            } else { // Full Length Test
                 // TODO: Implement robust question fetching and distribution based on weightage
                 // This requires fetching questions from *multiple* subjects/lessons filtered by exam type/class
                 // and then randomly selecting based on calculated counts per subject.
                 // For now, we'll create a placeholder structure.

                 console.warn("Full-length test question selection logic is not fully implemented.");

                 const subjectCounts: { [key: string]: number } = {};
                 const subjectQuestions: { [key: string]: TestQuestion[] } = {};
                 let fetchedQuestions: TestQuestion[] = []; // Placeholder

                if (data.stream === 'PCM') {
                    subjectCounts['physics'] = Math.round((data.weightagePhysics ?? 0) / 100 * data.totalQuestions);
                    subjectCounts['chemistry'] = Math.round((data.weightageChemistry ?? 0) / 100 * data.totalQuestions);
                    subjectCounts['maths'] = data.totalQuestions - subjectCounts['physics'] - subjectCounts['chemistry']; // Ensure total adds up

                     // Placeholder: Fetch random questions (replace with actual logic)
                     // This would involve calling getQuestionsForLesson for relevant subjects/lessons
                     // and then sampling according to counts.
                     subjectQuestions['physics'] = Array(subjectCounts['physics']).fill({ question: 'Placeholder Physics Q', options: [], answer: '', marks: 1 });
                     subjectQuestions['chemistry'] = Array(subjectCounts['chemistry']).fill({ question: 'Placeholder Chem Q', options: [], answer: '', marks: 1 });
                     subjectQuestions['maths'] = Array(subjectCounts['maths']).fill({ question: 'Placeholder Maths Q', options: [], answer: '', marks: 1 });
                } else { // PCB
                    subjectCounts['physics'] = Math.round((data.weightagePhysics ?? 0) / 100 * data.totalQuestions);
                    subjectCounts['chemistry'] = Math.round((data.weightageChemistry ?? 0) / 100 * data.totalQuestions);
                    subjectCounts['biology'] = data.totalQuestions - subjectCounts['physics'] - subjectCounts['chemistry'];

                     subjectQuestions['physics'] = Array(subjectCounts['physics']).fill({ question: 'Placeholder Physics Q', options: [], answer: '', marks: 1 });
                     subjectQuestions['chemistry'] = Array(subjectCounts['chemistry']).fill({ question: 'Placeholder Chem Q', options: [], answer: '', marks: 1 });
                     subjectQuestions['biology'] = Array(subjectCounts['biology']).fill({ question: 'Placeholder Bio Q', options: [], answer: '', marks: 1 });
                }

                testDefinition = {
                    ...baseData,
                    testType: 'full_length', // Ensure discriminator is set
                    stream: data.stream!,
                    test_subject: Object.keys(subjectCounts),
                    examFilter: data.examFilter,
                    weightage: {
                        physics: data.weightagePhysics ?? 0,
                        chemistry: data.weightageChemistry ?? 0,
                        maths: data.stream === 'PCM' ? data.weightageMaths ?? 0 : undefined,
                        biology: data.stream === 'PCB' ? data.weightageBiology ?? 0 : undefined,
                    },
                    count: data.totalQuestions, // User specified total
                    total_questions: data.totalQuestions, // Actual matches specified total here
                    physics: subjectQuestions['physics'],
                    chemistry: subjectQuestions['chemistry'],
                    maths: subjectQuestions['maths'],
                    biology: subjectQuestions['biology'],
                };
            }

            // Save the generated test definition
            const result = await saveGeneratedTest(testDefinition);

            if (!result.success) {
                throw new Error(result.message || "Failed to save generated test.");
            }

            toast({
                title: "Test Created Successfully!",
                description: `Test "${data.name}" (${testCode}) has been saved.`,
            });
            form.reset(); // Reset form after successful submission
            setQuestions([]);
            setSelectedQuestionObjects([]);

        } catch (error: any) {
            console.error("Failed to create test:", error);
            toast({
                variant: "destructive",
                title: "Test Creation Failed",
                description: error.message || "An unexpected error occurred.",
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Calculate total selected questions for display
     const totalSelectedCount = useMemo(() => selectedQuestionIds?.length ?? 0, [selectedQuestionIds]);
     const totalAvailableCount = useMemo(() => questions.length, [questions]);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Create New Test</h1>
            <p className="text-muted-foreground">Generate chapterwise or full-length tests from the question bank.</p>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

                    {/* Test Type Selection */}
                    <Card>
                         <CardHeader>
                            <CardTitle>1. Select Test Type</CardTitle>
                         </CardHeader>
                         <CardContent>
                             <FormField
                                control={form.control}
                                name="testType"
                                render={({ field }) => (
                                <FormItem>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Test Type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="chapterwise">Chapterwise Test</SelectItem>
                                            <SelectItem value="full_length">Full Length Test</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                         </CardContent>
                    </Card>

                    {/* Metadata Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>2. Test Details</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Test Name *</FormLabel><FormControl><Input placeholder="e.g., Physics Mock Test 1" {...field} disabled={isLoading} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="duration" render={({ field }) => (<FormItem><FormLabel>Duration (Minutes) *</FormLabel><FormControl><Input type="number" placeholder="e.g., 60" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} disabled={isLoading} /></FormControl><FormMessage /></FormItem>)} />
                             <FormField control={form.control} name="type" render={({ field }) => ( <FormItem><FormLabel>Access Type *</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Select Access" /></SelectTrigger></FormControl><SelectContent>{pricingTypes.map(pt => <SelectItem key={pt} value={pt} className="capitalize">{pt.replace('_', ' ')}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                             <FormField control={form.control} name="audience" render={({ field }) => ( <FormItem><FormLabel>Target Audience *</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Select Audience" /></SelectTrigger></FormControl><SelectContent>{audienceTypes.map(aud => <SelectItem key={aud} value={aud}>{aud}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        </CardContent>
                    </Card>


                    {/* Conditional Fields: Chapterwise */}
                    {testType === 'chapterwise' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>3. Chapterwise Details & Questions</CardTitle>
                             </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Subject Dropdown */}
                                <FormField
                                    control={form.control}
                                    name="subject"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Subject *</FormLabel>
                                        <Select onValueChange={(value) => { field.onChange(value); }} value={field.value} disabled={isLoading || isLoadingSubjects}>
                                        <FormControl><SelectTrigger><SelectValue placeholder={isLoadingSubjects ? "Loading..." : "Select Subject"} /></SelectTrigger></FormControl>
                                        <SelectContent>{subjects.map((sub) => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                {/* Lesson Combobox */}
                                <FormField
                                    control={form.control}
                                    name="lesson"
                                    render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Lesson *</FormLabel>
                                        <Popover open={lessonPopoverOpen} onOpenChange={setLessonPopoverOpen}>
                                            <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")} disabled={isLoading || isLoadingLessons || !selectedSubject}>
                                                    {field.value ? field.value : (isLoadingLessons ? "Loading..." : "Select Lesson")}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                <Command>
                                                <CommandInput placeholder="Search lesson..." disabled={isLoadingLessons} />
                                                <CommandList>
                                                     {isLoadingLessons ? (<CommandItem disabled>Loading...</CommandItem>) : lessons.length === 0 && selectedSubject ? (<CommandEmpty>No lessons found.</CommandEmpty>) : !selectedSubject ? (<CommandEmpty>Select Subject first.</CommandEmpty>) : null }
                                                    <CommandGroup>
                                                    {lessons.map((lesson) => (
                                                        <CommandItem value={lesson} key={lesson} onSelect={() => { form.setValue("lesson", lesson); setLessonPopoverOpen(false); }}>
                                                        <Check className={cn("mr-2 h-4 w-4", lesson === field.value ? "opacity-100" : "opacity-0")} />
                                                        {lesson}
                                                        </CommandItem>
                                                    ))}
                                                    </CommandGroup>
                                                </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                {/* Exam Filter Dropdown */}
                                 <FormField
                                    control={form.control}
                                    name="examFilter"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Filter by Exam (Optional)</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="All Exams" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="all">All Exams</SelectItem>
                                            {examOptions.map(ex => <SelectItem key={ex} value={ex}>{ex}</SelectItem>)}
                                        </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />

                                {/* Question Selection List */}
                                <FormField
                                    control={form.control}
                                    name="selectedQuestionIds"
                                    render={({ field }) => (
                                    <FormItem>
                                         <div className="mb-2 flex justify-between items-center">
                                             <FormLabel>Select Questions * ({totalSelectedCount} / {totalAvailableCount})</FormLabel>
                                             {/* Add Select All/Deselect All Buttons */}
                                             {questions.length > 0 && (
                                                 <div className="space-x-2">
                                                    <Button type="button" size="sm" variant="outline"
                                                        onClick={() => field.onChange(questions.map(q => q.id))}
                                                        disabled={isLoading || isLoadingQuestions}>
                                                        Select All
                                                    </Button>
                                                    <Button type="button" size="sm" variant="outline"
                                                        onClick={() => field.onChange([])}
                                                        disabled={isLoading || isLoadingQuestions}>
                                                        Deselect All
                                                    </Button>
                                                 </div>
                                             )}
                                         </div>
                                         <FormControl>
                                            <ScrollArea className="h-72 w-full rounded-md border p-4 bg-muted/20">
                                                {isLoadingQuestions ? (
                                                    <p className="text-muted-foreground text-center">Loading questions...</p>
                                                ) : questions.length === 0 ? (
                                                    <p className="text-muted-foreground text-center">No questions found for this lesson. Add questions first.</p>
                                                ) : (
                                                    <div className="space-y-2">
                                                    {questions.map((item) => (
                                                        <FormField
                                                        key={item.id}
                                                        control={form.control}
                                                        name="selectedQuestionIds"
                                                        render={({ field }) => {
                                                            return (
                                                            <FormItem key={item.id} className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 bg-background hover:bg-muted/50 transition-colors">
                                                                <FormControl>
                                                                <Checkbox
                                                                    checked={field.value?.includes(item.id)}
                                                                    onCheckedChange={(checked) => {
                                                                    return checked
                                                                        ? field.onChange([...(field.value || []), item.id])
                                                                        : field.onChange(
                                                                            field.value?.filter(
                                                                            (value) => value !== item.id
                                                                            )
                                                                        )
                                                                    }}
                                                                />
                                                                </FormControl>
                                                                <FormLabel className="text-sm font-normal flex-1 cursor-pointer">
                                                                     <span className="font-medium block">{item.question.text ? item.question.text.substring(0,100)+'...' : `[Image: ${item.question.image}]`}</span>
                                                                     <span className="text-xs text-muted-foreground">ID: {item.id} | Exam: {item.examType} | Diff: {item.difficulty}</span>
                                                                </FormLabel>
                                                            </FormItem>
                                                            )
                                                        }}
                                                        />
                                                    ))}
                                                    </div>
                                                )}
                                            </ScrollArea>
                                         </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />

                                 {/* Preview Selected Questions (Optional) */}
                                 {selectedQuestionObjects.length > 0 && (
                                    <div className="mt-4 space-y-2">
                                        <h4 className="font-medium">Selected Questions Preview ({selectedQuestionObjects.length})</h4>
                                        <ScrollArea className="h-40 rounded-md border p-2 text-xs text-muted-foreground">
                                        <ul>
                                            {selectedQuestionObjects.map(q => (
                                                <li key={q.id} className="truncate"> - {q.question.text ? q.question.text.substring(0,50)+'...' : `[Image: ${q.question.image}]`} ({q.id})</li>
                                            ))}
                                        </ul>
                                        </ScrollArea>
                                    </div>
                                )}

                            </CardContent>
                        </Card>
                    )}

                    {/* Conditional Fields: Full Length */}
                    {testType === 'full_length' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>3. Full Length Details</CardTitle>
                            </CardHeader>
                             <CardContent className="space-y-4">
                                 {/* Stream Selection */}
                                 <FormField
                                     control={form.control}
                                     name="stream"
                                     render={({ field }) => (
                                     <FormItem>
                                         <FormLabel>Stream *</FormLabel>
                                         <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                                             <FormControl><SelectTrigger><SelectValue placeholder="Select Stream" /></SelectTrigger></FormControl>
                                             <SelectContent>{testStreams.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}</SelectContent>
                                         </Select>
                                         <FormMessage />
                                     </FormItem>
                                     )}
                                 />
                                 {/* Exam Filter */}
                                 <FormField
                                    control={form.control}
                                    name="examFilter"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Source Question Exams *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select Exam Pool" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="all">All Exams (Combined Pool)</SelectItem>
                                            {examOptions.map(ex => <SelectItem key={ex} value={ex}>Only {ex} Questions</SelectItem>)}
                                        </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                 {/* Total Questions */}
                                 <FormField
                                     control={form.control}
                                     name="totalQuestions"
                                     render={({ field }) => (
                                     <FormItem>
                                         <FormLabel>Total Questions *</FormLabel>
                                         <FormControl><Input type="number" placeholder="e.g., 50" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} disabled={isLoading} /></FormControl>
                                         <FormMessage />
                                     </FormItem>
                                     )}
                                 />

                                 {/* Weightage Inputs */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
                                    <h4 className="md:col-span-3 font-medium text-sm">Weightage (%)</h4>
                                     <FormField control={form.control} name="weightagePhysics" render={({ field }) => (<FormItem><FormLabel>Physics</FormLabel><FormControl><Input type="number" min="0" max="100" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} disabled={isLoading} /></FormControl><FormMessage /></FormItem>)} />
                                     <FormField control={form.control} name="weightageChemistry" render={({ field }) => (<FormItem><FormLabel>Chemistry</FormLabel><FormControl><Input type="number" min="0" max="100" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} disabled={isLoading} /></FormControl><FormMessage /></FormItem>)} />

                                    {form.getValues('stream') === 'PCM' && (
                                        <FormField control={form.control} name="weightageMaths" render={({ field }) => (<FormItem><FormLabel>Maths</FormLabel><FormControl><Input type="number" min="0" max="100" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} disabled={isLoading} /></FormControl><FormMessage /></FormItem>)} />
                                    )}
                                     {form.getValues('stream') === 'PCB' && (
                                        <FormField control={form.control} name="weightageBiology" render={({ field }) => (<FormItem><FormLabel>Biology</FormLabel><FormControl><Input type="number" min="0" max="100" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} disabled={isLoading} /></FormControl><FormMessage /></FormItem>)} />
                                    )}
                                </div>
                                <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800">
                                     <AlertTriangle className="h-4 w-4 !text-blue-600" />
                                     <AlertTitle>Question Selection</AlertTitle>
                                     <AlertDescription>
                                         Questions will be automatically selected from the question bank based on the stream, weightage, and total number specified. Manual selection is not available for full-length tests in this version.
                                     </AlertDescription>
                                 </Alert>
                             </CardContent>
                        </Card>
                    )}

                    {/* Submit Button */}
                     <div className="flex justify-end">
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                            Create Test
                        </Button>
                    </div>

                </form>
            </Form>
        </div>
    );
}
