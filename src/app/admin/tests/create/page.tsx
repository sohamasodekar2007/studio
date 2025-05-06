
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
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, ListChecks, FileJson, FileCheck, Trash2, Eye } from "lucide-react"; // Removed unused icons, added Trash2, Eye
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
import type { QuestionBankItem, PricingType, GeneratedTest } from '@/types'; // Use new GeneratedTest type
import { pricingTypes } from '@/types'; // Import options
import { getSubjects, getQuestionsForLesson } from '@/actions/question-bank-query-actions'; // Import query actions
import { saveGeneratedTest } from '@/actions/generated-test-actions'; // Use new save action
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { v4 as uuidv4 } from 'uuid'; // For generating unique test codes if needed

// --- Zod Schema ---
// Schema based on the new JSON structure
const GeneratedTestSchema = z.object({
  // Meta fields
  name: z.string().min(3, "Test name must be at least 3 characters."),
  duration: z.coerce.number().min(1, "Duration must be at least 1 minute.").max(300, "Duration cannot exceed 300 minutes."),
  count: z.coerce.number().min(1, "Count must be at least 1.").max(20, "Maximum count is 20."), // Dropdown 1-20
  type: z.enum(pricingTypes, { required_error: "Access type is required." }), // FREE, PAID, FREE_PREMIUM
  // Subject and Question fields
  test_subject: z.array(z.string().min(1)).min(1, "At least one subject is required."), // Array of selected subjects
  // Nested questions structure
  physics: z.array(z.object({
    question: z.string().min(1), // Either text or image filename
    image_url: z.string().optional().nullable(), // URL if image question
    options: z.array(z.string().min(1)).length(4, "Must have 4 options"),
    answer: z.string().min(1),
    marks: z.coerce.number().min(0),
    explanation: z.string().optional().nullable(),
  })).optional(),
  chemistry: z.array(z.object({ /* same structure */ })).optional(),
  maths: z.array(z.object({ /* same structure */ })).optional(),
  biology: z.array(z.object({ /* same structure */ })).optional(),
  // These arrays will hold QuestionBankItem IDs temporarily before structuring
  selectedQuestionIds: z.array(z.string()).optional(),
});

type TestCreationFormValues = z.infer<typeof GeneratedTestSchema>;

// --- Component ---
export default function CreateTestPage() {
  const { toast } = useToast();
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [availableQuestions, setAvailableQuestions] = useState<QuestionBankItem[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedTestJson, setGeneratedTestJson] = useState<string | null>(null);
  const [showJsonDialog, setShowJsonDialog] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<QuestionBankItem | null>(null);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>(''); // For filtering questions

  const form = useForm<TestCreationFormValues>({
    resolver: zodResolver(GeneratedTestSchema),
    defaultValues: {
      name: '',
      duration: 60, // Default duration
      count: 10, // Default count
      type: 'FREE', // Default type
      test_subject: [], // Start with no subjects selected
      physics: [],
      chemistry: [],
      maths: [],
      biology: [],
      selectedQuestionIds: [], // To hold temporary selection
    },
  });

  const selectedSubjects = form.watch('test_subject', []);
  const selectedQuestionIds = form.watch('selectedQuestionIds', []);

  // --- Effects ---

  // Fetch Subjects
  useEffect(() => {
    setIsLoadingSubjects(true);
    getSubjects()
      .then(setSubjects)
      .catch(() => toast({ variant: "destructive", title: "Error loading subjects" }))
      .finally(() => setIsLoadingSubjects(false));
  }, [toast]);

  // Load questions based on the *single selected subject* for the filter dropdown
  const fetchQuestionsForSubject = useCallback(async () => {
    if (selectedSubjectFilter) {
      setIsLoadingQuestions(true);
      setAvailableQuestions([]); // Clear previous
      try {
        // Fetch questions for all lessons within the selected subject
        const questions = await getQuestionsForLesson({
          subject: selectedSubjectFilter,
          lesson: '', // Fetch across all lessons for now
        });
        setAvailableQuestions(questions);
      } catch (err) {
        console.error("Error fetching questions for subject filter:", err);
        toast({ variant: "destructive", title: "Error loading questions" });
      } finally {
        setIsLoadingQuestions(false);
      }
    } else {
      setAvailableQuestions([]); // Clear if no subject selected
      setIsLoadingQuestions(false);
    }
  }, [selectedSubjectFilter, toast]);

  useEffect(() => {
    fetchQuestionsForSubject();
  }, [fetchQuestionsForSubject]);


  // --- Event Handlers ---

  const handleSubjectSelection = (subject: string) => {
    const currentSubjects = form.getValues('test_subject') || [];
    const isSelected = currentSubjects.includes(subject);
    const newSubjects = isSelected
      ? currentSubjects.filter(s => s !== subject)
      : [...currentSubjects, subject];
    form.setValue('test_subject', newSubjects, { shouldValidate: true });
    // Also update the filter dropdown if needed, or keep it separate
    // setSelectedSubjectFilter(newSubjects.length === 1 ? newSubjects[0] : ''); // Example: auto-set filter if only one subject
  };

  const handleQuestionSelect = (id: string) => {
    const currentSelection = form.getValues('selectedQuestionIds') || [];
    const isSelected = currentSelection.includes(id);
    const newSelection = isSelected
      ? currentSelection.filter(qid => qid !== id)
      : [...currentSelection, id];
    form.setValue('selectedQuestionIds', newSelection, { shouldValidate: true });
  };

   const handleSelectRandom = (count: number) => {
     const selectedCount = Math.min(count, availableQuestions.length);
     if (selectedCount < 1) return;
     const shuffled = [...availableQuestions].sort(() => 0.5 - Math.random());
     const randomSelection = shuffled.slice(0, selectedCount).map(q => q.id);
     form.setValue('selectedQuestionIds', randomSelection, { shouldValidate: true });
     toast({ title: `Selected ${randomSelection.length} random questions.` });
   };

  // Generate a random 8-digit numeric code
  const generateTestCode = (): string => {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
  }

  // Function to structure selected questions into the final format
  const structureSelectedQuestions = (
    selectedIds: string[],
    allAvailableQuestions: QuestionBankItem[]
  ): Pick<GeneratedTest, 'physics' | 'chemistry' | 'maths' | 'biology'> => {
    const structured: Pick<GeneratedTest, 'physics' | 'chemistry' | 'maths' | 'biology'> = {
      physics: [],
      chemistry: [],
      maths: [],
      biology: [],
    };

    selectedIds.forEach(id => {
      const question = allAvailableQuestions.find(q => q.id === id);
      if (question) {
        const subjectKey = question.subject.toLowerCase() as keyof typeof structured;
        if (structured[subjectKey]) {
           const formattedQuestion = {
                question: question.type === 'text' ? question.question.text! : question.question.image!,
                image_url: question.type === 'image' ? `/question_bank_images/${question.subject}/${question.lesson}/${question.question.image}` : null,
                options: [question.options.A, question.options.B, question.options.C, question.options.D],
                answer: `OPTION ${question.correct}`, // Format answer as "OPTION X"
                marks: 1, // Default marks to 1, can be adjusted later
                explanation: question.explanation.text || (question.explanation.image ? `Image: /question_bank_images/${question.subject}/${question.lesson}/${question.explanation.image}` : null),
           };
          (structured[subjectKey] as any[]).push(formattedQuestion); // Add to the correct subject array
        }
      }
    });
    return structured;
  };


  const onSubmit = async (data: TestCreationFormValues) => {
    setIsSaving(true);
    setGeneratedTestJson(null);

    // Validate question count against selected questions
    if (!data.selectedQuestionIds || data.selectedQuestionIds.length !== data.count) {
        toast({
            variant: "destructive",
            title: "Validation Error",
            description: `Please select exactly ${data.count} questions for the test.`
        });
        setIsSaving(false);
        return;
    }

    try {
        const testCode = generateTestCode();
        const structuredQuestions = structureSelectedQuestions(
            data.selectedQuestionIds || [],
            availableQuestions // Pass all potentially available questions
        );

        // Construct the final JSON object
        const testDefinition: GeneratedTest = {
            test_code: testCode,
            name: data.name,
            duration: data.duration,
            count: data.count, // Use the selected count
            total_questions: data.selectedQuestionIds?.length || 0, // Total selected questions
            test_subject: data.test_subject,
            type: data.type,
            physics: structuredQuestions.physics || [],
            chemistry: structuredQuestions.chemistry || [],
            maths: structuredQuestions.maths || [],
            biology: structuredQuestions.biology || [],
            // Add createdAt timestamp
            createdAt: new Date().toISOString(),
        };


        setGeneratedTestJson(JSON.stringify(testDefinition, null, 2));
        setShowJsonDialog(true); // Show the dialog for confirmation

    } catch (error: any) {
        console.error("Test generation failed:", error);
        toast({ variant: "destructive", title: "Generation Failed", description: error.message });
        setIsSaving(false); // Ensure loading state is reset on error
    }
    // Removed finally block as we set isSaving false in the try block after showing dialog or in catch
  };

   const handleConfirmSave = async () => {
       if (!generatedTestJson) return;
       setIsSaving(true); // Set saving state for the final save action
       try {
           const testDefinition = JSON.parse(generatedTestJson) as GeneratedTest; // Cast to new type
           const result = await saveGeneratedTest(testDefinition); // Use the new save action
           if (!result.success) throw new Error(result.message || "Failed to save test definition.");
            toast({ title: "Test Saved Successfully!", description: `Test ${testDefinition.name} (${testDefinition.test_code}) saved.` });
           form.reset(); // Reset form
           setSelectedSubjectFilter(''); // Reset filter
           setAvailableQuestions([]); // Clear questions
           setGeneratedTestJson(null); // Clear JSON
           setShowJsonDialog(false); // Close dialog
       } catch (error: any) {
           toast({ variant: "destructive", title: "Save Failed", description: error.message });
       } finally {
           setIsSaving(false); // Reset saving state
       }
   }


  // Helper to render question preview in table/dialog
  const renderQuestionPreview = (q: QuestionBankItem) => {
    if (q.type === 'image' && q.question.image) {
      const imagePath = `/question_bank_images/${q.subject}/${q.lesson}/${q.question.image}`;
      return <span className="text-blue-600 line-clamp-1">[Image: {q.question.image}]</span>;
    }
    return <span className="line-clamp-1">{q.question.text || '[No Text]'}</span>;
  }

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

          {/* --- Test Metadata Card --- */}
          <Card>
            <CardHeader>
              <CardTitle>1. Test Details</CardTitle>
              <CardDescription>Set the name, duration, type, and question count.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel>Test Name *</FormLabel> <FormControl> <Input placeholder="e.g., Physics Chapter 1 Test" {...field} disabled={isSaving} /> </FormControl> <FormMessage /> </FormItem> )} />
              <FormField control={form.control} name="duration" render={({ field }) => ( <FormItem> <FormLabel>Duration (Minutes) *</FormLabel> <FormControl> <Input type="number" {...field} min="1" max="300" disabled={isSaving} /> </FormControl> <FormMessage /> </FormItem> )} />
              <FormField control={form.control} name="type" render={({ field }) => ( <FormItem> <FormLabel>Access Type *</FormLabel> <Select onValueChange={field.onChange} value={field.value} disabled={isSaving}> <FormControl> <SelectTrigger> <SelectValue placeholder="Select Access" /> </SelectTrigger> </FormControl> <SelectContent> {pricingTypes.map((pt) => <SelectItem key={pt} value={pt} className="capitalize">{pt.replace('_', ' ')}</SelectItem>)} </SelectContent> </Select> <FormMessage /> </FormItem> )} />
               <FormField control={form.control} name="count" render={({ field }) => ( <FormItem> <FormLabel>Number of Questions *</FormLabel> <Select onValueChange={(value) => field.onChange(parseInt(value, 10))} value={field.value?.toString()} disabled={isSaving}> <FormControl> <SelectTrigger> <SelectValue placeholder="Select Count" /> </SelectTrigger> </FormControl> <SelectContent> {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => <SelectItem key={num} value={num.toString()}>{num}</SelectItem>)} </SelectContent> </Select> <FormMessage /> </FormItem> )} />
            </CardContent>
          </Card>

          {/* --- Subject and Question Selection Card --- */}
          <Card>
            <CardHeader>
              <CardTitle>2. Select Subject(s) & Questions</CardTitle>
              <CardDescription>Choose the subject(s) this test covers and select the questions.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-3">
               {/* Subject Selection (Multi-select can be complex, starting with single filter) */}
              <div className="md:col-span-1 space-y-4">
                 <FormItem>
                   <FormLabel>Filter Questions by Subject</FormLabel>
                   <Select onValueChange={setSelectedSubjectFilter} value={selectedSubjectFilter} disabled={isLoadingSubjects || isSaving}>
                     <FormControl>
                       <SelectTrigger>
                         <SelectValue placeholder={isLoadingSubjects ? "Loading..." : "Select Subject to Load Questions"} />
                       </SelectTrigger>
                     </FormControl>
                     <SelectContent>
                       <SelectItem value="">-- Select Subject --</SelectItem>
                       {subjects.map((sub) => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}
                     </SelectContent>
                   </Select>
                   <FormMessage />
                 </FormItem>

                 {/* Test Subject Multi-select - Hidden for now, link to Filter */}
                 <FormField
                    control={form.control}
                    name="test_subject"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Test Covers Subject(s) *</FormLabel>
                            <Input value={field.value.join(', ') || 'Select subjects below'} disabled readOnly className="bg-muted/50" />
                            {/* This can be improved with a multi-select component later */}
                             <div className="flex flex-wrap gap-2 pt-2">
                               {subjects.map(sub => (
                                   <Button
                                       key={sub}
                                       type="button"
                                       variant={field.value.includes(sub) ? 'default' : 'outline'}
                                       size="sm"
                                       onClick={() => handleSubjectSelection(sub)}
                                       disabled={isSaving}
                                   >
                                       {sub}
                                   </Button>
                               ))}
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                    />


              </div>

               {/* Question Selection Table */}
               <div className="md:col-span-2 space-y-3">
                 <h3 className="font-medium">Select Questions ({selectedQuestionIds?.length || 0} / {form.getValues('count')})</h3>
                 <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">Available: {availableQuestions.length} questions</p>
                     <Button type="button" size="sm" variant="outline" onClick={() => handleSelectRandom(form.getValues('count'))} disabled={isLoadingQuestions || availableQuestions.length < 1 || isSaving || !selectedSubjectFilter}>
                        Auto-Pick {form.getValues('count')}
                     </Button>
                 </div>

                 <ScrollArea className="h-72 w-full rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead>Question Preview</TableHead>
                        <TableHead>Lesson</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">View</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingQuestions ? (
                        <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></TableCell></TableRow>
                      ) : availableQuestions.length > 0 ? (
                        availableQuestions.map((q) => (
                          <TableRow key={q.id} className={selectedQuestionIds?.includes(q.id) ? 'bg-muted/50' : ''}>
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={selectedQuestionIds?.includes(q.id)}
                                onCheckedChange={() => handleQuestionSelect(q.id)}
                                aria-label={`Select question ${q.id}`}
                                disabled={isSaving}
                              />
                            </TableCell>
                            <TableCell>{renderQuestionPreview(q)}</TableCell>
                            <TableCell>{q.lesson}</TableCell>
                            <TableCell>
                               <Badge variant={q.type === 'text' ? 'secondary' : 'outline'} className="capitalize text-xs">
                                  {q.type}
                               </Badge>
                            </TableCell>
                             <TableCell className="text-right">
                               <Button variant="ghost" size="icon" onClick={() => setPreviewQuestion(q)}><Eye className="h-4 w-4"/></Button>
                             </TableCell>
                          </TableRow>
                        ))
                     ) : (
                         <TableRow><TableCell colSpan={5} className="h-24 text-center">
                            {selectedSubjectFilter ? "No questions found for this subject." : "Select a subject to load questions."}
                         </TableCell></TableRow>
                     )}
                    </TableBody>
                  </Table>
                 </ScrollArea>
                 {/* Display validation message for selectedQuestionIds array */}
                 <FormField
                    control={form.control}
                    name="selectedQuestionIds"
                    render={({ fieldState }) => (
                        <FormMessage className="mt-2 text-destructive">
                            {/* Custom message if count doesn't match */}
                            {(fieldState.error?.message || (selectedQuestionIds?.length !== form.getValues('count')) ? `Please select exactly ${form.getValues('count')} questions.` : '')}
                        </FormMessage>
                    )}
                    />
               </div>

            </CardContent>
          </Card>

          {/* --- Submit Footer --- */}
          <Card>
            <CardFooter className="pt-6">
                 <Button type="submit" disabled={isSaving || selectedSubjects.length === 0 || (selectedQuestionIds?.length || 0) !== form.getValues('count') }>
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
