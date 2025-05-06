// src/app/admin/tests/create/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, ListFilter, BookOpen, FileJson, FileCheck, SlidersHorizontal, X, Eye } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"

import type {
  QuestionBankItem,
  AcademicStatus,
  ExamOption,
  TestModel,
  PricingType,
  ChapterwiseTestJson,
  FullLengthTestJson
} from '@/types';
import { academicStatuses, exams, pricingTypes, examOptions, classLevels, difficultyLevels } from '@/types'; // Import options
// Import actual actions
import { getSubjects, getLessonsForSubject, getQuestionsForLesson } from '@/actions/question-bank-query-actions';
import { saveGeneratedTest } from '@/actions/test-generation-actions'; // Assume this action exists

// --- Zod Schemas ---

const BaseTestSchema = z.object({
  duration: z.coerce.number().min(1, "Duration must be at least 1 minute.").max(300, "Duration cannot exceed 300 minutes."),
  access: z.enum(pricingTypes, { required_error: "Access type is required." }),
  audience: z.enum(academicStatuses, { required_error: "Target audience is required." }),
});

const ChapterwiseSchema = BaseTestSchema.extend({
  testType: z.literal('chapterwise'),
  subject: z.string().min(1, "Subject is required."),
  lesson: z.string().min(1, "Lesson is required."),
  examFilter: z.enum([...examOptions, "Random Exam"], { required_error: "Exam filter is required." }),
  selectedQuestions: z.array(z.string()).min(1, "Select at least one question."), // Store IDs
});

const FullLengthSchema = BaseTestSchema.extend({
  testType: z.literal('full_length'),
  stream: z.enum(["PCM", "PCB"], { required_error: "Stream is required." }),
  physicsWeight: z.coerce.number().min(0).max(100),
  chemistryWeight: z.coerce.number().min(0).max(100),
  mathsWeight: z.coerce.number().min(0).max(100).optional(),
  biologyWeight: z.coerce.number().min(0).max(100).optional(),
  examFilter: z.enum([...examOptions, "Combined"], { required_error: "Exam filter is required." }),
  totalQuestions: z.coerce.number().min(10, "Must have at least 10 questions").max(200, "Maximum 200 questions"), // Example limits
}).refine(data => {
    const totalWeight = (data.physicsWeight || 0) + (data.chemistryWeight || 0) + (data.mathsWeight || 0) + (data.biologyWeight || 0);
    return totalWeight === 100;
}, {
    message: "Total weightage must sum up to 100%.",
    path: ["physicsWeight"], // Apply error to a relevant field
});

const TestCreationSchema = z.discriminatedUnion("testType", [ChapterwiseSchema, FullLengthSchema]);

type TestCreationFormValues = z.infer<typeof TestCreationSchema>;

// --- Component ---

export default function CreateTestPage() {
  const { toast } = useToast();
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [lessons, setLessons] = useState<string[]>([]);
  const [availableQuestions, setAvailableQuestions] = useState<QuestionBankItem[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedTestJson, setGeneratedTestJson] = useState<string | null>(null);
  const [showJsonDialog, setShowJsonDialog] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<QuestionBankItem | null>(null);

  const form = useForm<TestCreationFormValues>({
    resolver: zodResolver(TestCreationSchema),
    defaultValues: {
      testType: 'chapterwise', // Default type
      // Chapterwise defaults
      subject: '',
      lesson: '',
      examFilter: 'Random Exam',
      selectedQuestions: [],
      // Full-Length defaults
      stream: undefined,
      physicsWeight: 33,
      chemistryWeight: 34,
      mathsWeight: 33,
      biologyWeight: 0, // Default PCB to 0 initially
      totalQuestions: 50, // Default total question count
      // Common defaults
      duration: 60,
      access: 'FREE_PREMIUM',
      audience: '12th Class',
    },
  });

  const testType = form.watch('testType');
  const selectedSubject = form.watch('subject');
  const selectedLesson = form.watch('lesson');
  const chapterExamFilter = form.watch('examFilter'); // For chapterwise
  const selectedQuestions = form.watch('selectedQuestions');
  const stream = form.watch('stream');
  const pWeight = form.watch('physicsWeight');
  const cWeight = form.watch('chemistryWeight');
  const mWeight = form.watch('mathsWeight');
  const bWeight = form.watch('biologyWeight');

  // --- Effects for Dynamic Data Loading ---

   // Fetch Subjects
   useEffect(() => {
       setIsLoadingSubjects(true);
       getSubjects()
           .then(setSubjects)
           .catch(() => toast({ variant: "destructive", title: "Error loading subjects" }))
           .finally(() => setIsLoadingSubjects(false));
   }, [toast]);

   // Fetch Lessons when Subject Changes
   useEffect(() => {
       if (selectedSubject) {
           setIsLoadingLessons(true);
           setLessons([]); // Clear previous lessons
           form.setValue('lesson', ''); // Reset lesson selection in form
           getLessonsForSubject(selectedSubject)
               .then(setLessons)
               .catch(() => toast({ variant: "destructive", title: `Error loading lessons for ${selectedSubject}` }))
               .finally(() => setIsLoadingLessons(false));
       } else {
           setLessons([]);
       }
   }, [selectedSubject, toast, form]);

   // Load questions for Chapterwise test
   const fetchChapterQuestions = useCallback(async () => {
        if (testType === 'chapterwise' && selectedSubject && selectedLesson && chapterExamFilter) {
            setIsLoadingQuestions(true);
            setAvailableQuestions([]); // Clear previous
            try {
                // Ensure examFilter is correctly typed for the action
                const filterValue = chapterExamFilter as ExamOption | 'Random Exam';
                const questions = await getQuestionsForLesson({
                    subject: selectedSubject,
                    lesson: selectedLesson,
                    examType: filterValue === 'Random Exam' ? undefined : filterValue
                });
                setAvailableQuestions(questions);
            } catch (err) {
                 console.error("Error fetching chapter questions:", err);
                 toast({ variant: "destructive", title: "Error loading questions" });
            } finally {
                 setIsLoadingQuestions(false);
            }
        } else {
            setAvailableQuestions([]); // Clear if not chapterwise or filters incomplete
            setIsLoadingQuestions(false); // Ensure loading state is off
        }
   }, [testType, selectedSubject, selectedLesson, chapterExamFilter, toast]); // Add dependencies


   useEffect(() => {
       fetchChapterQuestions();
   }, [fetchChapterQuestions]); // Run effect when the callback changes


  // Adjust weights for Full Length stream change
  useEffect(() => {
    if (testType === 'full_length') {
      if (stream === 'PCM') {
        form.setValue('biologyWeight', 0);
        const currentTotal = (pWeight || 0) + (cWeight || 0) + (mWeight || 0);
        if (currentTotal !== 100 && currentTotal > 0) {
             const factor = 100 / currentTotal;
             form.setValue('physicsWeight', Math.round((pWeight || 0) * factor));
             form.setValue('chemistryWeight', Math.round((cWeight || 0) * factor));
             const adjustedM = 100 - Math.round((pWeight || 0) * factor) - Math.round((cWeight || 0) * factor);
             form.setValue('mathsWeight', adjustedM);
        } else if (currentTotal === 0) {
             form.setValue('physicsWeight', 33);
             form.setValue('chemistryWeight', 34);
             form.setValue('mathsWeight', 33);
        }

      } else if (stream === 'PCB') {
        form.setValue('mathsWeight', 0);
         const currentTotal = (pWeight || 0) + (cWeight || 0) + (bWeight || 0);
        if (currentTotal !== 100 && currentTotal > 0) {
            const factor = 100 / currentTotal;
             form.setValue('physicsWeight', Math.round((pWeight || 0) * factor));
             form.setValue('chemistryWeight', Math.round((cWeight || 0) * factor));
             const adjustedB = 100 - Math.round((pWeight || 0) * factor) - Math.round((cWeight || 0) * factor);
             form.setValue('biologyWeight', adjustedB);
         } else if (currentTotal === 0) {
             form.setValue('physicsWeight', 33);
             form.setValue('chemistryWeight', 34);
             form.setValue('biologyWeight', 33);
        }
      }
    }
  }, [stream, testType, form, pWeight, cWeight, mWeight, bWeight]); // Add weights to dependencies

  // --- Event Handlers ---

  const handleQuestionSelect = (id: string) => {
    const currentSelection = form.getValues('selectedQuestions') || [];
    const isSelected = currentSelection.includes(id);
    form.setValue(
      'selectedQuestions',
      isSelected ? currentSelection.filter(qid => qid !== id) : [...currentSelection, id],
       { shouldValidate: true } // Trigger validation after selection change
    );
  };

  const handleSelectRandom = (count: number) => {
    const shuffled = [...availableQuestions].sort(() => 0.5 - Math.random());
    const randomSelection = shuffled.slice(0, count).map(q => q.id);
    form.setValue('selectedQuestions', randomSelection, { shouldValidate: true });
    toast({ title: `Selected ${randomSelection.length} random questions.` });
  };

  const generateTestId = (data: TestCreationFormValues): string => {
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD
    if (data.testType === 'chapterwise') {
        const subjectShort = data.subject.substring(0, 3).toLowerCase();
        const lessonShort = data.lesson.replace(/\s+/g, '-').substring(0, 15).toLowerCase();
        const examFilterShort = (data.examFilter as string).replace(/\s+/g, '-').toLowerCase();
        return `${subjectShort}_${lessonShort}_${examFilterShort}_${dateStr}`;
    } else { // full_length
        const streamShort = data.stream.toLowerCase();
        const examFilterShort = (data.examFilter as string).replace(/\s+/g, '-').toLowerCase();
         return `${streamShort}_${examFilterShort}_${dateStr}`;
    }
  }

   // --- Generate Full Length Questions (Simulated - Needs Backend Implementation) ---
  const generateFullLengthQuestions = async (data: Extract<TestCreationFormValues, { testType: 'full_length' }>): Promise<Omit<FullLengthTestJson, 'test_id' | 'title' | 'duration' | 'access' | 'audience' | 'type' | 'createdAt'>> => {
      console.warn("Full-length question generation is simulated. Implement backend logic.");
      const { stream, physicsWeight, chemistryWeight, mathsWeight, biologyWeight, totalQuestions, examFilter } = data;

      // **Replace this entire section with a call to your backend/server action**
      // The backend should handle fetching questions based on filters and applying weightage logic.

       const fetchPool = async (subject: string) => {
          // Simulate fetching a large pool - adjust filters as needed
          return getQuestionsForLesson({ subject, lesson: '', // Fetch across all lessons for full length? Or specific ones?
            examType: examFilter === 'Combined' ? undefined : examFilter });
       };


      const [physicsPool, chemistryPool, mathsPool, biologyPool] = await Promise.all([
          fetchPool('Physics'),
          fetchPool('Chemistry'),
          stream === 'PCM' ? fetchPool('Maths') : Promise.resolve([]),
          stream === 'PCB' ? Promise.resolve([]),
      ]);

       const calcCount = (weight: number) => Math.max(0, Math.round((weight / 100) * totalQuestions));

       const selectRandomIds = (pool: QuestionBankItem[], count: number): string[] => {
            const available = pool.filter(q => q !== null && q !== undefined); // Ensure pool items are valid
            const shuffled = [...available].sort(() => 0.5 - Math.random());
            return shuffled.slice(0, count).map(q => q.id);
       }

       let physicsCount = calcCount(physicsWeight);
       let chemistryCount = calcCount(chemistryWeight);
       let mathsCount = stream === 'PCM' ? calcCount(mathsWeight || 0) : 0;
       let biologyCount = stream === 'PCB' ? calcCount(biologyWeight || 0) : 0;

       // Adjust counts to meet totalQuestions precisely (simple distribution adjustment)
       let currentTotal = physicsCount + chemistryCount + mathsCount + biologyCount;
       let diff = totalQuestions - currentTotal;

        // Prioritize adding/removing from the largest weightage subject (example)
        while(diff !== 0) {
            if (diff > 0) {
                 // Add to largest pool that has more questions available
                if (stream === 'PCM' && (mathsWeight || 0) >= Math.max(physicsWeight, chemistryWeight) && mathsCount < mathsPool.length) mathsCount++;
                else if (stream === 'PCB' && (biologyWeight || 0) >= Math.max(physicsWeight, chemistryWeight) && biologyCount < biologyPool.length) biologyCount++;
                else if (physicsWeight >= chemistryWeight && physicsCount < physicsPool.length) physicsCount++;
                 else if (chemistryCount < chemistryPool.length) chemistryCount++;
                else break; // Cannot add more
                diff--;
            } else {
                 // Remove from largest pool that has questions
                if (stream === 'PCM' && (mathsWeight || 0) >= Math.max(physicsWeight, chemistryWeight) && mathsCount > 0) mathsCount--;
                else if (stream === 'PCB' && (biologyWeight || 0) >= Math.max(physicsWeight, chemistryWeight) && biologyCount > 0) biologyCount--;
                else if (physicsWeight >= chemistryWeight && physicsCount > 0) physicsCount--;
                 else if (chemistryCount > 0) chemistryCount--;
                 else break; // Cannot remove more
                 diff++;
            }
        }

       // Select final IDs
       const finalPhysicsIds = selectRandomIds(physicsPool, physicsCount);
       const finalChemistryIds = selectRandomIds(chemistryPool, chemistryCount);
       const finalMathsIds = stream === 'PCM' ? selectRandomIds(mathsPool, mathsCount) : [];
       const finalBiologyIds = stream === 'PCB' ? selectRandomIds(biologyPool, biologyCount) : [];


      return {
          stream: stream,
          examFilter: examFilter as ExamOption | 'Combined',
          physics: finalPhysicsIds,
          chemistry: finalChemistryIds,
          maths: stream === 'PCM' ? finalMathsIds : undefined,
          biology: stream === 'PCB' ? finalBiologyIds : undefined,
          weightage: {
              physics: physicsWeight,
              chemistry: chemistryWeight,
              ...(stream === 'PCM' && { maths: mathsWeight || 0 }),
              ...(stream === 'PCB' && { biology: biologyWeight || 0 }),
          },
      };
  }


  const onSubmit = async (data: TestCreationFormValues) => {
    setIsSaving(true);
    setGeneratedTestJson(null); // Clear previous JSON

    try {
        const testId = generateTestId(data);
        const title = `${data.testType === 'chapterwise' ? `${data.subject} - ${data.lesson}` : data.stream} Test (${data.examFilter})`;
        const nowISO = new Date().toISOString();
        let testDefinition: ChapterwiseTestJson | FullLengthTestJson;

        if (data.testType === 'chapterwise') {
             testDefinition = {
                test_id: testId,
                title: title,
                subject: data.subject,
                lesson: data.lesson,
                examFilter: data.examFilter as ExamOption | 'Random Exam',
                questions: data.selectedQuestions,
                duration: data.duration,
                access: data.access,
                audience: data.audience,
                type: 'chapterwise',
                createdAt: nowISO,
            };
        } else { // full_length
             const generatedQuestions = await generateFullLengthQuestions(data);
             testDefinition = {
                test_id: testId,
                title: title,
                ...generatedQuestions, // Spread the generated question lists, weights, etc.
                duration: data.duration,
                access: data.access,
                audience: data.audience,
                type: 'full_length',
                createdAt: nowISO,
             };
        }

        setGeneratedTestJson(JSON.stringify(testDefinition, null, 2));
        setShowJsonDialog(true); // Show the dialog for confirmation

    } catch (error: any) {
        console.error("Test generation failed:", error);
        toast({ variant: "destructive", title: "Generation Failed", description: error.message });
    } finally {
        setIsSaving(false);
    }
  };

   const handleConfirmSave = async () => {
       if (!generatedTestJson) return;
       setIsSaving(true);
       try {
           const testDefinition = JSON.parse(generatedTestJson);
           const result = await saveGeneratedTest(testDefinition);
           if (!result.success) throw new Error(result.message || "Failed to save test definition.");
            toast({ title: "Test Saved Successfully!", description: `Test saved to ${result.filePath} (simulated).` });
           form.reset(); // Reset form
           setGeneratedTestJson(null); // Clear JSON
           setShowJsonDialog(false); // Close dialog
       } catch (error: any) {
           toast({ variant: "destructive", title: "Save Failed", description: error.message });
       } finally {
           setIsSaving(false);
       }
   }


  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <PlusCircle className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create New Test</h1>
          <p className="text-muted-foreground">Generate Chapterwise or Full-Length tests.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* --- Test Type Selection --- */}
           <Card>
             <CardHeader>
                 <CardTitle>1. Select Test Type</CardTitle>
             </CardHeader>
             <CardContent>
                 <FormField
                    control={form.control}
                    name="testType"
                    render={({ field }) => (
                    <FormItem className="space-y-3">
                        <FormControl>
                            <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-4"
                                disabled={isSaving}
                            >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                <RadioGroupItem value="chapterwise" />
                                </FormControl>
                                <FormLabel className="font-normal flex items-center gap-2">
                                <BookOpen className="h-4 w-4" /> Chapterwise Test
                                </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                <RadioGroupItem value="full_length" />
                                </FormControl>
                                <FormLabel className="font-normal flex items-center gap-2">
                                <ListFilter className="h-4 w-4" /> Full-Length Test
                                </FormLabel>
                            </FormItem>
                            </RadioGroup>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                 />
             </CardContent>
           </Card>

           {/* --- Chapterwise Configuration --- */}
          {testType === 'chapterwise' && (
            <Card>
              <CardHeader>
                <CardTitle>2. Chapterwise Test Setup</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
                 <FormField control={form.control} name="subject" render={({ field }) => ( <FormItem> <FormLabel>Subject *</FormLabel> <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingSubjects || isSaving}> <FormControl> <SelectTrigger> <SelectValue placeholder={isLoadingSubjects ? "Loading..." : "Select Subject"} /> </SelectTrigger> </FormControl> <SelectContent> {subjects.map((sub) => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)} </SelectContent> </Select> <FormMessage /> </FormItem> )} />
                 <FormField control={form.control} name="lesson" render={({ field }) => ( <FormItem> <FormLabel>Lesson *</FormLabel> <Select onValueChange={field.onChange} value={field.value} disabled={!selectedSubject || isLoadingLessons || isSaving}> <FormControl> <SelectTrigger> <SelectValue placeholder={isLoadingLessons ? "Loading..." : (selectedSubject ? "Select Lesson" : "Select Subject First")} /> </SelectTrigger> </FormControl> <SelectContent> {lessons.map((lesson) => <SelectItem key={lesson} value={lesson}>{lesson}</SelectItem>)} </SelectContent> </Select> <FormMessage /> </FormItem> )} />
                <FormField control={form.control} name="examFilter" render={({ field }) => ( <FormItem> <FormLabel>Exam Filter</FormLabel> <Select onValueChange={field.onChange} value={field.value} disabled={!selectedLesson || isSaving}> <FormControl> <SelectTrigger> <SelectValue placeholder="Filter Questions by Exam" /> </SelectTrigger> </FormControl> <SelectContent> <SelectItem value="Random Exam">Random Exam Mix</SelectItem> {examOptions.map((ex) => <SelectItem key={ex} value={ex}>{ex}</SelectItem>)} </SelectContent> </Select> <FormMessage /> </FormItem> )} />
              </CardContent>
              <CardContent>
                <h3 className="mb-3 font-medium">Select Questions ({selectedQuestions?.length || 0} selected)</h3>
                 <div className="flex justify-between items-center mb-3">
                    <p className="text-sm text-muted-foreground">Available: {availableQuestions.length} questions</p>
                     <Button type="button" size="sm" variant="outline" onClick={() => handleSelectRandom(20)} disabled={isLoadingQuestions || availableQuestions.length < 20 || isSaving}>
                        Auto-Pick 20
                     </Button>
                 </div>

                 <ScrollArea className="h-72 w-full rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead>Question Preview</TableHead>
                        <TableHead>Exam Type</TableHead>
                         <TableHead>Difficulty</TableHead>
                         <TableHead className="text-right">View</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingQuestions ? (
                        <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></TableCell></TableRow>
                      ) : availableQuestions.length > 0 ? (
                        availableQuestions.map((q) => (
                          <TableRow key={q.id}>
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={selectedQuestions?.includes(q.id)}
                                onCheckedChange={() => handleQuestionSelect(q.id)}
                                aria-label={`Select question ${q.id}`}
                                disabled={isSaving}
                              />
                            </TableCell>
                            <TableCell className="line-clamp-1">{q.question.text || "[Image Question]"}</TableCell>
                            <TableCell>{q.examType}</TableCell>
                            <TableCell>{q.difficulty}</TableCell>
                             <TableCell className="text-right">
                               <Button variant="ghost" size="icon" onClick={() => setPreviewQuestion(q)}><Eye className="h-4 w-4"/></Button>
                             </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow><TableCell colSpan={5} className="h-24 text-center">No questions found for this lesson/filter.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                 </ScrollArea>
                 <FormField control={form.control} name="selectedQuestions" render={({ field }) => (<FormItem className="mt-2"><FormMessage /></FormItem>)} /> {/* For showing array validation error */}

              </CardContent>
            </Card>
          )}

           {/* --- Full-Length Configuration --- */}
          {testType === 'full_length' && (
             <Card>
              <CardHeader>
                <CardTitle>2. Full-Length Test Setup</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
                 <FormField control={form.control} name="stream" render={({ field }) => ( <FormItem> <FormLabel>Stream *</FormLabel> <Select onValueChange={field.onChange} value={field.value} disabled={isSaving}> <FormControl> <SelectTrigger> <SelectValue placeholder="Select Stream" /> </SelectTrigger> </FormControl> <SelectContent> <SelectItem value="PCM">PCM (Physics, Chemistry, Maths)</SelectItem> <SelectItem value="PCB">PCB (Physics, Chemistry, Biology)</SelectItem> </SelectContent> </Select> <FormMessage /> </FormItem> )} />
                 <FormField control={form.control} name="examFilter" render={({ field }) => ( <FormItem> <FormLabel>Exam Filter</FormLabel> <Select onValueChange={field.onChange} value={field.value} disabled={isSaving}> <FormControl> <SelectTrigger> <SelectValue placeholder="Filter Questions by Exam" /> </SelectTrigger> </FormControl> <SelectContent> <SelectItem value="Combined">Combined (All Exams)</SelectItem> {examOptions.map((ex) => <SelectItem key={ex} value={ex}>{ex}</SelectItem>)} </SelectContent> </Select> <FormMessage /> </FormItem> )} />
                  <FormField control={form.control} name="totalQuestions" render={({ field }) => ( <FormItem> <FormLabel>Total Questions *</FormLabel> <FormControl> <Input type="number" {...field} min="10" max="200" disabled={isSaving} /> </FormControl> <FormMessage /> </FormItem> )} />
              </CardContent>
               <CardContent>
                 <Label className="mb-4 block font-medium flex items-center gap-2"><SlidersHorizontal className="h-4 w-4"/>Set Subject Weightage (%)</Label>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <FormField control={form.control} name="physicsWeight" render={({ field }) => ( <FormItem> <FormLabel>Physics</FormLabel> <FormControl> <Input type="number" {...field} min="0" max="100" disabled={isSaving} /> </FormControl> <FormMessage /> </FormItem> )} />
                    <FormField control={form.control} name="chemistryWeight" render={({ field }) => ( <FormItem> <FormLabel>Chemistry</FormLabel> <FormControl> <Input type="number" {...field} min="0" max="100" disabled={isSaving} /> </FormControl> <FormMessage /> </FormItem> )} />
                    {stream === 'PCM' && <FormField control={form.control} name="mathsWeight" render={({ field }) => ( <FormItem> <FormLabel>Maths</FormLabel> <FormControl> <Input type="number" {...field} min="0" max="100" disabled={isSaving} /> </FormControl> <FormMessage /> </FormItem> )} />}
                    {stream === 'PCB' && <FormField control={form.control} name="biologyWeight" render={({ field }) => ( <FormItem> <FormLabel>Biology</FormLabel> <FormControl> <Input type="number" {...field} min="0" max="100" disabled={isSaving} /> </FormControl> <FormMessage /> </FormItem> )} />}
                  </div>
                   {/* General message for weightage validation */}
                   <FormMessage className="mt-2">{form.formState.errors.physicsWeight?.message}</FormMessage>
               </CardContent>
               <CardContent>
                 <p className="text-sm text-muted-foreground">Questions will be automatically selected based on the weightage and exam filter from the entire question bank (simulation). Final question list can be reviewed before saving.</p>
               </CardContent>
             </Card>
          )}


          {/* --- Common Test Metadata --- */}
          <Card>
            <CardHeader>
              <CardTitle>3. Test Metadata</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField control={form.control} name="duration" render={({ field }) => ( <FormItem> <FormLabel>Duration (Minutes) *</FormLabel> <FormControl> <Input type="number" {...field} min="1" disabled={isSaving} /> </FormControl> <FormMessage /> </FormItem> )} />
              <FormField control={form.control} name="access" render={({ field }) => ( <FormItem> <FormLabel>Access Type *</FormLabel> <Select onValueChange={field.onChange} value={field.value} disabled={isSaving}> <FormControl> <SelectTrigger> <SelectValue placeholder="Select Access" /> </SelectTrigger> </FormControl> <SelectContent> {pricingTypes.map((pt) => <SelectItem key={pt} value={pt} className="capitalize">{pt.replace('_', ' ')}</SelectItem>)} </SelectContent> </Select> <FormMessage /> </FormItem> )} />
              <FormField control={form.control} name="audience" render={({ field }) => ( <FormItem> <FormLabel>Target Audience *</FormLabel> <Select onValueChange={field.onChange} value={field.value} disabled={isSaving}> <FormControl> <SelectTrigger> <SelectValue placeholder="Select Audience" /> </SelectTrigger> </FormControl> <SelectContent> {academicStatuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)} </SelectContent> </Select> <FormMessage /> </FormItem> )} />
            </CardContent>
            <CardFooter>
                <Button type="submit" disabled={isSaving || (testType === 'chapterwise' && (!selectedSubject || !selectedLesson)) || (testType === 'full_length' && !stream)}>
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
                        {/* IMPORTANT: Adjust this path */}
                         <Image src={`/question_bank_images/${previewQuestion.subject}/${previewQuestion.lesson}/${previewQuestion.question.image}`} alt="Question Image" width={500} height={300} className="rounded border"/>
                         {/* <p className="text-muted-foreground text-sm">[Image Preview Placeholder for {previewQuestion.question.image}]</p> */}
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
                        {/* IMPORTANT: Adjust this path */}
                         <Image src={`/question_bank_images/${previewQuestion.subject}/${previewQuestion.lesson}/${previewQuestion.explanation.image}`} alt="Explanation Image" width={400} height={200} className="rounded border"/>
                          {/* <p className="text-muted-foreground text-sm">[Image Preview Placeholder for {previewQuestion.explanation.image}]</p> */}
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
       <Dialog open={showJsonDialog} onOpenChange={setShowJsonDialog}>
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
             <Button type="button" variant="outline" onClick={() => setShowJsonDialog(false)} disabled={isSaving}>
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
