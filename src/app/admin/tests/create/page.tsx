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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // Import RadioGroup
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Loader2, Filter, BookOpen, Check, ChevronsUpDown, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuestionBankItem, PricingType, ExamOption, TestStream, GeneratedTest, TestQuestion, AcademicStatus } from '@/types';
import { pricingTypes, academicStatuses as audienceTypes, testStreams, examOptions } from '@/types';
import { getSubjects, getLessonsForSubject, getQuestionsForLesson } from '@/actions/question-bank-query-actions';
import { saveGeneratedTest } from '@/actions/generated-test-actions';
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

// Schema for Chapterwise Test (No 'testType' literal)
const ChapterwiseSchema = BaseTestSchema.extend({
    subject: z.string().min(1, "Subject is required."),
    lesson: z.string().min(1, "Lesson name is required."),
    examFilter: z.enum([...examOptions, 'all'], { required_error: "Exam filter is required." }),
    selectedQuestionIds: z.array(z.string()).min(1, "Select at least one question."),
    count: z.number().min(1, "Must select at least 1 question.").max(50, "Max 50 questions per chapterwise test."),
});

// Schema for Full Length Test (No 'testType' literal)
const FullLengthSchema = BaseTestSchema.extend({
    stream: z.enum(testStreams, { required_error: "Stream selection is required." }),
    examFilter: z.enum([...examOptions, 'all'], { required_error: "Exam filter is required." }),
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

// We will validate against ChapterwiseSchema or FullLengthSchema based on component state,
// so no discriminated union is needed here.
// Define the combined type for form values, making specific fields optional
type TestCreationFormValues = z.infer<typeof BaseTestSchema> & Partial<z.infer<typeof ChapterwiseSchema>> & Partial<z.infer<typeof FullLengthSchema>>;

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
    // --- State to manage selected test type ---
    const [selectedTestType, setSelectedTestType] = useState<'chapterwise' | 'full_length'>('chapterwise');


    const form = useForm<TestCreationFormValues>({
        // We don't use zodResolver directly here as validation depends on selectedTestType
        // We'll validate manually in onSubmit
        defaultValues: {
            name: '',
            duration: 60,
            type: 'FREE',
            audience: 'Dropper',
            // Chapterwise defaults
            subject: '',
            lesson: '',
            examFilter: 'all',
            selectedQuestionIds: [],
            count: 20,
            // Full Length Defaults
            stream: 'PCM',
            totalQuestions: 50,
            weightagePhysics: 34,
            weightageChemistry: 33,
            weightageMaths: 33,
            weightageBiology: 33,
        },
    });

    // Watch relevant fields for dynamic updates
    const selectedSubject = form.watch('subject');
    const selectedLesson = form.watch('lesson');
    const selectedQuestionIds = form.watch('selectedQuestionIds');
    const chapterwiseCount = form.watch('count');
    const fullLengthStream = form.watch('stream');


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
        if (selectedTestType === 'chapterwise' && selectedSubject) {
            setIsLoadingLessons(true);
            setLessons([]);
            form.setValue('lesson', ''); // Reset lesson
            form.setValue('selectedQuestionIds', []); // Clear selected questions
            setAvailableQuestions([]); // Clear questions list
            getLessonsForSubject(selectedSubject)
                .then(setLessons)
                .catch(err => toast({ variant: "destructive", title: "Error", description: `Could not load lessons for ${selectedSubject}.` }))
                .finally(() => setIsLoadingLessons(false));
        } else {
            setLessons([]); // Clear lessons if not chapterwise or no subject
        }
    }, [selectedTestType, selectedSubject, toast, form]);

    // --- Fetch Available Questions when Lesson Changes (for Chapterwise) ---
    useEffect(() => {
        if (selectedTestType === 'chapterwise' && selectedSubject && selectedLesson) {
            setIsLoadingQuestions(true);
            setAvailableQuestions([]);
            form.setValue('selectedQuestionIds', []); // Clear selections when lesson changes
            const filters = {
                subject: selectedSubject,
                lesson: selectedLesson,
                examType: form.getValues('examFilter') !== 'all' ? form.getValues('examFilter') : undefined,
            };
            getQuestionsForLesson(filters)
                .then(setAvailableQuestions)
                .catch(err => toast({ variant: "destructive", title: "Error", description: "Could not load questions." }))
                .finally(() => setIsLoadingQuestions(false));
        } else {
            setAvailableQuestions([]); // Clear if not chapterwise or subject/lesson not set
        }
    }, [selectedTestType, selectedSubject, selectedLesson, form, toast]); // Include form dependency


     // --- Update selected questions preview ---
     useEffect(() => {
         if (selectedTestType === 'chapterwise') {
             const selectedObjects = availableQuestions.filter(q => selectedQuestionIds?.includes(q.id));
             setSelectedQuestionObjects(selectedObjects);
         } else {
             setSelectedQuestionObjects([]); // Clear for full length
         }
     }, [selectedQuestionIds, availableQuestions, selectedTestType]);

    // --- Question Selection Helpers (Chapterwise) ---
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
        if (selectedTestType === 'chapterwise' && availableQuestions.length > 0 && chapterwiseCount && chapterwiseCount > 0) {
            const countToSelect = Math.min(chapterwiseCount, availableQuestions.length);
            const shuffledQuestions = shuffleArray([...availableQuestions]);
            const selectedIds = shuffledQuestions.slice(0, countToSelect).map(q => q.id);
            form.setValue('selectedQuestionIds', selectedIds);
             toast({ title: "Questions Selected", description: `${selectedIds.length} questions randomly selected.` });
        } else {
            toast({ variant: "destructive", title: "Selection Failed", description: "Not enough questions available or count is zero." });
        }
    }, [availableQuestions, chapterwiseCount, form, selectedTestType, toast]);


    // --- Form Submission ---
    const onSubmit = async (data: TestCreationFormValues) => {
        setIsLoading(true);
        console.log("Attempting to submit form data:", data);
        console.log("Selected test type:", selectedTestType);

        let validationResult: z.SafeParseReturnType<any, any>;
        let schemaToUse: z.ZodSchema<any>;

        // 1. Select Schema and Validate
        if (selectedTestType === 'chapterwise') {
            schemaToUse = ChapterwiseSchema;
            validationResult = ChapterwiseSchema.safeParse(data);
        } else { // full_length
            schemaToUse = FullLengthSchema;
            validationResult = FullLengthSchema.safeParse(data);
        }

        if (!validationResult.success) {
            console.error("Form validation failed:", validationResult.error.flatten());
            toast({
                variant: "destructive",
                title: "Validation Error",
                description: "Please check the form fields for errors.",
            });
             // Populate form errors for user feedback
             validationResult.error.errors.forEach((err) => {
                 form.setError(err.path[0] as keyof TestCreationFormValues, { message: err.message });
             });
            setIsLoading(false);
            return;
        }

         // 2. Process Validated Data (validationResult.data contains the correctly typed data)
         const validatedData = validationResult.data;
         let testDefinition: GeneratedTest | null = null;
         const testCode = uuidv4().substring(0, 8);
         const baseData = {
             test_code: testCode,
             name: validatedData.name,
             duration: validatedData.duration,
             type: validatedData.type,
             audience: validatedData.audience,
             createdAt: new Date().toISOString(),
         };

        let finalQuestions: TestQuestion[] = [];
        let actualTotalQuestions = 0;

        try {
             if (selectedTestType === 'chapterwise') {
                // Ensure chapterwise specific fields are present in validatedData
                 if (!validatedData.subject || !validatedData.lesson || !validatedData.selectedQuestionIds || !validatedData.count) {
                     throw new Error("Missing required chapterwise fields after validation.");
                 }
                const selectedQsData = availableQuestions.filter(q => validatedData.selectedQuestionIds.includes(q.id));
                 if (selectedQsData.length === 0) throw new Error("No questions selected.");

                 finalQuestions = selectedQsData.map(q => {
                    const imageUrl = q.question.image ? `/question_bank_images/${q.subject}/${q.lesson}/${q.question.image}` : null;
                    const explanationImageUrl = q.explanation.image ? `/question_bank_images/${q.subject}/${q.lesson}/${q.explanation.image}` : null;
                     // Options: Assuming A, B, C, D structure
                     const optionsArray = [q.options.A, q.options.B, q.options.C, q.options.D];
                    const answerText = `Option ${q.correct}`;
                    return {
                        question: q.question.text || q.question.image || '[No Question Content]', // Text or image filename
                        image_url: imageUrl,
                        options: optionsArray, // Array of 4 option strings
                        answer: answerText, // e.g., "Option A"
                        marks: 1, // Default marks
                        explanation: q.explanation.text || explanationImageUrl || '', // Text or explanation image URL
                    };
                 });
                 actualTotalQuestions = finalQuestions.length;

                 testDefinition = {
                     ...baseData,
                     testType: 'chapterwise',
                     count: validatedData.count,
                     total_questions: actualTotalQuestions,
                     test_subject: [validatedData.subject],
                     lesson: validatedData.lesson,
                     examFilter: validatedData.examFilter,
                     questions: finalQuestions,
                     physics: undefined, // Explicitly undefined for chapterwise
                     chemistry: undefined,
                     maths: undefined,
                     biology: undefined,
                     stream: undefined,
                     weightage: undefined,
                 };

             } else { // Full Length
                 // Ensure full_length specific fields are present
                  if (!validatedData.stream || !validatedData.examFilter || !validatedData.totalQuestions) {
                     throw new Error("Missing required full_length fields after validation.");
                 }

                 const subjectsToFetch = validatedData.stream === 'PCM' ? ['Physics', 'Chemistry', 'Maths'] : ['Physics', 'Chemistry', 'Biology'];
                 const examTypeFilter = validatedData.examFilter !== 'all' ? validatedData.examFilter : undefined;
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

                 if (totalAvailableBankQuestions < validatedData.totalQuestions) {
                     throw new Error(`Not enough questions in bank (${totalAvailableBankQuestions}) for requested total (${validatedData.totalQuestions}).`);
                 }

                 const totalQuestionsNeeded = validatedData.totalQuestions;
                 const weightages = {
                    Physics: validatedData.weightagePhysics ?? (validatedData.stream === 'PCM' ? 34 : 33), // Default if undefined
                    Chemistry: validatedData.weightageChemistry ?? 33,
                    Maths: validatedData.stream === 'PCM' ? (validatedData.weightageMaths ?? 33) : 0,
                    Biology: validatedData.stream === 'PCB' ? (validatedData.weightageBiology ?? 34) : 0,
                 };

                 const targetCounts: { [key: string]: number } = {};
                 let calculatedSum = 0;
                 subjectsToFetch.forEach(subject => {
                    targetCounts[subject] = Math.round((weightages[subject as keyof typeof weightages] / 100) * totalQuestionsNeeded);
                    calculatedSum += targetCounts[subject];
                 });

                 let diff = totalQuestionsNeeded - calculatedSum;
                 while (diff !== 0) {
                    const adjustSubject = subjectsToFetch[Math.floor(Math.random() * subjectsToFetch.length)];
                    if (diff > 0) { targetCounts[adjustSubject]++; diff--; }
                    else if (targetCounts[adjustSubject] > 0) { targetCounts[adjustSubject]--; diff++; }
                     // Safety break if loop runs too long (shouldn't happen with proper logic)
                     if (Math.abs(diff) > totalQuestionsNeeded) { console.error("Weightage adjustment failed"); break; }
                 }

                 let physicsQuestions: TestQuestion[] = [];
                 let chemistryQuestions: TestQuestion[] = [];
                 let mathsQuestions: TestQuestion[] | undefined = validatedData.stream === 'PCM' ? [] : undefined;
                 let biologyQuestions: TestQuestion[] | undefined = validatedData.stream === 'PCB' ? [] : undefined;


                  for (const subject of subjectsToFetch) {
                     const countForSubject = targetCounts[subject];
                     const availableQs = shuffleArray([...allSubjectQuestions[subject] || []]);

                      if (availableQs.length < countForSubject) {
                         console.warn(`Warning: Not enough questions for ${subject} (${availableQs.length} available, ${countForSubject} needed). Selecting all available.`);
                      }

                      const selectedForSubject = availableQs.slice(0, Math.min(countForSubject, availableQs.length));

                      selectedForSubject.forEach(q => {
                          const imageUrl = q.question.image ? `/question_bank_images/${q.subject}/${q.lesson}/${q.question.image}` : null;
                          const explanationImageUrl = q.explanation.image ? `/question_bank_images/${q.subject}/${q.lesson}/${q.explanation.image}` : null;
                          const optionsArray = [q.options.A, q.options.B, q.options.C, q.options.D];
                          const answerText = `Option ${q.correct}`;
                           const questionObj: TestQuestion = {
                               question: q.question.text || q.question.image || '[No Question Content]',
                               image_url: imageUrl,
                               options: optionsArray,
                               answer: answerText,
                               marks: 1,
                               explanation: q.explanation.text || explanationImageUrl || '',
                           };

                           if (subject === 'Physics') physicsQuestions.push(questionObj);
                           else if (subject === 'Chemistry') chemistryQuestions.push(questionObj);
                           else if (subject === 'Maths' && mathsQuestions) mathsQuestions.push(questionObj);
                           else if (subject === 'Biology' && biologyQuestions) biologyQuestions.push(questionObj);
                      });
                  }

                 actualTotalQuestions = physicsQuestions.length + chemistryQuestions.length + (mathsQuestions?.length ?? 0) + (biologyQuestions?.length ?? 0);

                 if (actualTotalQuestions < totalQuestionsNeeded) {
                    console.warn(`Final test has ${actualTotalQuestions} questions, fewer than requested ${totalQuestionsNeeded} due to availability.`);
                 }


                 testDefinition = {
                     ...baseData,
                     testType: 'full_length',
                     stream: validatedData.stream,
                     test_subject: subjectsToFetch,
                     examFilter: validatedData.examFilter,
                     weightage: {
                         physics: weightages.Physics,
                         chemistry: weightages.Chemistry,
                         maths: validatedData.stream === 'PCM' ? weightages.Maths : undefined,
                         biology: validatedData.stream === 'PCB' ? weightages.Biology : undefined,
                     },
                     count: validatedData.totalQuestions, // User specified total
                     total_questions: actualTotalQuestions, // Actual number included
                     physics: physicsQuestions.length > 0 ? physicsQuestions : undefined,
                     chemistry: chemistryQuestions.length > 0 ? chemistryQuestions : undefined,
                     maths: mathsQuestions,
                     biology: biologyQuestions,
                      // Fields specific to chapterwise are undefined
                     lesson: undefined,
                     questions: undefined,
                 };
             }

            // 3. Save Test Definition
            if (testDefinition) {
                console.log("Attempting to save test definition:", JSON.stringify(testDefinition, null, 2));
                const result = await saveGeneratedTest(testDefinition as GeneratedTest); // Assert type

                if (!result.success) {
                    throw new Error(result.message || "Failed to save generated test.");
                }

                toast({
                    title: "Test Created Successfully!",
                    description: `Test "${validatedData.name}" (${testCode}) has been saved.`,
                });
                form.reset(); // Reset form after successful submission
                setAvailableQuestions([]);
                setSelectedQuestionObjects([]);
                setSelectedTestType('chapterwise'); // Reset selection type
            } else {
                 throw new Error("Failed to generate test definition structure.");
            }

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
     const totalAvailableCount = useMemo(() => availableQuestions.length, [availableQuestions]);

    // JSX Starts here
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Create New Test</h1>
            <p className="text-muted-foreground">Generate chapterwise or full-length tests from the question bank.</p>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

                     {/* Test Type Selection using RadioGroup */}
                     <Card>
                         <CardHeader>
                            <CardTitle>1. Select Test Type</CardTitle>
                         </CardHeader>
                         <CardContent>
                             <RadioGroup
                                defaultValue={selectedTestType}
                                onValueChange={(value: 'chapterwise' | 'full_length') => setSelectedTestType(value)}
                                className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-4"
                                disabled={isLoading}
                              >
                                <FormItem className="flex items-center space-x-3 space-y-0">
                                     <FormControl>
                                        <RadioGroupItem value="chapterwise" id="r1" />
                                     </FormControl>
                                     <Label htmlFor="r1" className="font-normal">Chapterwise Test</Label>
                                </FormItem>
                                <FormItem className="flex items-center space-x-3 space-y-0">
                                     <FormControl>
                                         <RadioGroupItem value="full_length" id="r2" />
                                     </FormControl>
                                     <Label htmlFor="r2" className="font-normal">Full Length Test</Label>
                                </FormItem>
                              </RadioGroup>
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
                    {selectedTestType === 'chapterwise' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>3. Chapterwise Details &amp; Questions</CardTitle>
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
                                        <FormLabel>Filter Questions by Exam (Optional)</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value ?? 'all'} disabled={isLoading}>
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

                                {/* Question Count (Chapterwise) */}
                                <FormField
                                    control={form.control}
                                    name="count"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Number of Questions *</FormLabel>
                                             <Select
                                                onValueChange={(value) => field.onChange(parseInt(value, 10))}
                                                value={field.value?.toString()}
                                                disabled={isLoading}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select count (1-50)" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                     {Array.from({ length: 50 }, (_, i) => i + 1).map(num => (
                                                        <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                                                    ))}
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
                                             {/* Add Select All/Deselect All/Auto Buttons */}
                                             {availableQuestions.length > 0 && (
                                                 <div className="space-x-2">
                                                     <Button type="button" size="sm" variant="outline"
                                                        onClick={handleAutoSelect}
                                                        disabled={isLoading || isLoadingQuestions || !chapterwiseCount || chapterwiseCount === 0}>
                                                        Auto-Pick {chapterwiseCount}
                                                    </Button>
                                                    <Button type="button" size="sm" variant="outline"
                                                        onClick={() => field.onChange(availableQuestions.map(q => q.id))}
                                                        disabled={isLoading || isLoadingQuestions}>
                                                        Select All ({totalAvailableCount})
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
                                                ) : availableQuestions.length === 0 ? (
                                                    <p className="text-muted-foreground text-center">No questions found for this lesson/filter. Add questions first.</p>
                                                ) : (
                                                    <div className="space-y-2">
                                                    {availableQuestions.map((item) => (
                                                        <FormField
                                                        key={item.id}
                                                        control={form.control}
                                                        name="selectedQuestionIds"
                                                        render={({ field: checkboxField }) => { // Rename field to avoid conflict
                                                            return (
                                                            <FormItem key={item.id} className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 bg-background hover:bg-muted/50 transition-colors">
                                                                <FormControl>
                                                                <Checkbox
                                                                    checked={checkboxField.value?.includes(item.id)}
                                                                    onCheckedChange={(checked) => {
                                                                    return checked
                                                                        ? checkboxField.onChange([...(checkboxField.value || []), item.id])
                                                                        : checkboxField.onChange(
                                                                            checkboxField.value?.filter(
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
                     {selectedTestType === 'full_length' && (
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
                                         <Select onValueChange={field.onChange} value={field.value ?? 'PCM'} disabled={isLoading}>
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
                                        <Select onValueChange={field.onChange} value={field.value ?? 'all'} disabled={isLoading}>
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

                                    {fullLengthStream === 'PCM' && (
                                        <FormField control={form.control} name="weightageMaths" render={({ field }) => (<FormItem><FormLabel>Maths</FormLabel><FormControl><Input type="number" min="0" max="100" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} disabled={isLoading} /></FormControl><FormMessage /></FormItem>)} />
                                    )}
                                     {fullLengthStream === 'PCB' && (
                                        <FormField control={form.control} name="weightageBiology" render={({ field }) => (<FormItem><FormLabel>Biology</FormLabel><FormControl><Input type="number" min="0" max="100" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} disabled={isLoading} /></FormControl><FormMessage /></FormItem>)} />
                                    )}
                                </div>
                                <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800">
                                     <AlertTriangle className="h-4 w-4 !text-blue-600" />
                                     <AlertTitle>Question Selection</AlertTitle>
                                     <AlertDescription>
                                         Questions will be automatically selected from the question bank based on the stream, weightage, total number, and exam filter specified. Ensure sufficient questions exist in the bank for your criteria.
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

    