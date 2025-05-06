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
import type { QuestionBankItem, PricingType, ChapterwiseTestJson, FullLengthTestJson, ExamOption, AudienceType, TestStream, GeneratedTest, TestQuestion } from '@/types';
import { pricingTypes, audienceTypes, testStreams, examOptions, academicStatuses } from '@/types'; // Import options
import { getSubjects, getLessonsForSubject, getQuestionsForLesson } from '@/actions/question-bank-query-actions'; // Import query actions
import { saveGeneratedTest } from '@/actions/generated-test-actions';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { v4 as uuidv4 } from 'uuid';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// --- Zod Schemas ---

// Base schema - common fields
const BaseTestSchema = z.object({
    name: z.string().min(3, "Test name must be at least 3 characters."),
    duration: z.coerce.number().int().min(1, "Duration must be at least 1 minute.").max(300, "Duration cannot exceed 300 minutes."),
    access: z.enum(pricingTypes, { required_error: "Access type is required." }),
    audience: z.enum(academicStatuses, { required_error: "Target audience is required." }),
    count: z.coerce.number().int().min(1, "Number of questions must be at least 1.").max(50, "Maximum 50 questions per test."),
});

// Chapterwise schema - Add testType literal HERE
const ChapterwiseSchema = BaseTestSchema.extend({
    testType: z.literal('chapterwise'), // Discriminator defined inside
    subject: z.string().min(1, "Subject is required"),
    lesson: z.string().min(1, "Lesson is required"),
    chapterwiseExamFilter: z.enum(['all', ...examOptions], { required_error: "Exam filter is required" }),
    selectedQuestionIds: z.array(z.string()).min(1, "Please select at least one question."),
}).refine(data => data.selectedQuestionIds.length === data.count, {
    message: (data) => `Please select exactly ${data.count} questions.`,
    path: ['selectedQuestionIds'],
});

// Full-length schema - Add testType literal HERE
const FullLengthSchema = BaseTestSchema.extend({
    testType: z.literal('full_length'), // Discriminator defined inside
    stream: z.enum(testStreams, { required_error: "Stream (PCM/PCB) is required." }),
    fullLengthExamFilter: z.enum(['all', ...examOptions], { required_error: "Exam filter is required" }),
    physicsWeight: z.number().min(0).max(100).default(34),
    chemistryWeight: z.number().min(0).max(100).default(33),
    mathsWeight: z.number().min(0).max(100).optional(),
    biologyWeight: z.number().min(0).max(100).optional(),
}).refine(data => {
    const totalWeight = (data.physicsWeight ?? 0) + (data.chemistryWeight ?? 0) + (data.stream === 'PCM' ? (data.mathsWeight ?? 0) : (data.biologyWeight ?? 0));
    return Math.abs(totalWeight - 100) < 0.1; // Allow for small float inaccuracies
}, {
    message: "Weightages must add up to 100%",
    path: ["physicsWeight"],
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
  const [subjects, setSubjects] = useState<string[]>([]);
  const [lessons, setLessons] = useState<string[]>([]);
  const [availableQuestions, setAvailableQuestions] = useState<QuestionBankItem[]>([]); // For chapterwise
  const [allStreamQuestions, setAllStreamQuestions] = useState<Record<string, QuestionBankItem[]>>({}); // For full-length
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedTestJson, setGeneratedTestJson] = useState<string | null>(null);
  const [showJsonDialog, setShowJsonDialog] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<QuestionBankItem | null>(null);

  const form = useForm<TestCreationFormValues>({
    resolver: zodResolver(TestCreationSchema),
    defaultValues: {
      testType: 'chapterwise', // Set initial default testType
      name: '',
      duration: 60,
      access: 'FREE',
      audience: 'Dropper',
      count: 10, // Default to 10 questions
      // Chapterwise specific defaults
      subject: '',
      lesson: '',
      chapterwiseExamFilter: 'all',
      selectedQuestionIds: [],
      // Full-length specific defaults
      stream: 'PCM',
      fullLengthExamFilter: 'all',
      physicsWeight: 34,
      chemistryWeight: 33,
      mathsWeight: 33,
      biologyWeight: 0,
    },
     // Revalidate on change for dynamic error messages like weightage sum
     mode: 'onChange'
  });

  // Watch specific form fields to trigger effects or conditional rendering
  const testType = useWatch({ control: form.control, name: 'testType' });
  const selectedSubject = useWatch({ control: form.control, name: 'subject' });
  const selectedLesson = useWatch({ control: form.control, name: 'lesson' });
  const chapterwiseExamFilter = useWatch({ control: form.control, name: 'chapterwiseExamFilter' });
  const selectedQuestionIds = useWatch({ control: form.control, name: 'selectedQuestionIds' });
  const questionCount = useWatch({ control: form.control, name: 'count' });
  const selectedStream = useWatch({ control: form.control, name: 'stream' });
  const fullLengthExamFilter = useWatch({ control: form.control, name: 'fullLengthExamFilter' });
  const physicsWeight = useWatch({ control: form.control, name: 'physicsWeight' });
  const chemistryWeight = useWatch({ control: form.control, name: 'chemistryWeight' });
  const mathsWeight = useWatch({ control: form.control, name: 'mathsWeight' });
  const biologyWeight = useWatch({ control: form.control, name: 'biologyWeight' });

  // --- Effects ---

  // Fetch Subjects on mount
  useEffect(() => {
    setIsLoadingSubjects(true);
    getSubjects()
      .then(setSubjects)
      .catch(() => toast({ variant: "destructive", title: "Error loading subjects" }))
      .finally(() => setIsLoadingSubjects(false));
  }, [toast]);

  // Fetch Lessons when Subject Changes (for Chapterwise)
  useEffect(() => {
    // Ensure this runs only for chapterwise and when subject is selected
    if (testType === 'chapterwise' && selectedSubject) {
      setIsLoadingLessons(true);
      setLessons([]);
      form.setValue('lesson', ''); // Reset lesson
      setAvailableQuestions([]); // Clear questions
      form.setValue('selectedQuestionIds', []); // Clear selection
      getLessonsForSubject(selectedSubject)
        .then(setLessons)
        .catch(err => toast({ variant: "destructive", title: "Error", description: `Could not load lessons for ${selectedSubject}.` }))
        .finally(() => setIsLoadingLessons(false));
    } else {
      // Clear lessons if not chapterwise or no subject selected
      if (testType !== 'chapterwise') {
         setLessons([]);
      }
    }
  }, [testType, selectedSubject, form, toast]);

  // Fetch Available Questions for Chapterwise selection
  useEffect(() => {
    const fetchChapterQuestions = async () => {
      // Trigger only if chapterwise and subject/lesson are selected
      if (testType === 'chapterwise' && selectedSubject && selectedLesson) {
        setIsLoadingQuestions(true);
        setAvailableQuestions([]);
        form.setValue('selectedQuestionIds', []); // Reset selection

        try {
          const questions = await getQuestionsForLesson({
            subject: selectedSubject,
            lesson: selectedLesson,
            examType: chapterwiseExamFilter === 'all' ? undefined : chapterwiseExamFilter,
          });
          setAvailableQuestions(questions);
          console.log(`Fetched ${questions.length} questions for ${selectedSubject}/${selectedLesson}`);
        } catch (err) {
          console.error("Error fetching questions for chapter:", err);
          toast({ variant: "destructive", title: "Error loading questions" });
          setAvailableQuestions([]);
        } finally {
          setIsLoadingQuestions(false);
        }
      } else {
        // Clear questions if filters are incomplete for chapterwise
        if (testType === 'chapterwise') {
            setAvailableQuestions([]);
        }
      }
    };
    fetchChapterQuestions();
  }, [testType, selectedSubject, selectedLesson, chapterwiseExamFilter, form, toast]);


    // Fetch ALL questions for the selected stream subjects (for Full-Length auto-selection)
   useEffect(() => {
    const fetchAllStreamQuestions = async () => {
        if (testType === 'full_length') {
            setIsLoadingQuestions(true);
            setAllStreamQuestions({}); // Reset previous data

            const stream = form.getValues('stream');
            const subjectsToFetch: string[] = ['Physics', 'Chemistry'];
            if (stream === 'PCM') subjectsToFetch.push('Maths');
            if (stream === 'PCB') subjectsToFetch.push('Biology');

            const examFilterValue = form.getValues('fullLengthExamFilter');
            const examFilter = examFilterValue === 'all' ? undefined : examFilterValue;

            console.log(`Fetching all questions for stream: ${stream}, subjects: ${subjectsToFetch.join(', ')}, examFilter: ${examFilter || 'all'}`);

            try {
                const questionsBySub: Record<string, QuestionBankItem[]> = {};
                // Fetch all questions for each required subject concurrently
                const subjectPromises = subjectsToFetch.map(async (sub) => {
                    const lessons = await getLessonsForSubject(sub);
                    const lessonPromises = lessons.map(lesson =>
                        getQuestionsForLesson({ subject: sub, lesson: lesson, examType: examFilter })
                    );
                    const allQuestionsForSubject = (await Promise.all(lessonPromises)).flat();
                     questionsBySub[sub.toLowerCase()] = allQuestionsForSubject; // Use lowercase key
                    console.log(`Fetched ${allQuestionsForSubject.length} questions for ${sub}`);
                });

                await Promise.all(subjectPromises);
                setAllStreamQuestions(questionsBySub);
                console.log("Finished fetching stream questions:", questionsBySub);

            } catch (err) {
                console.error("Error fetching stream questions:", err);
                toast({ variant: "destructive", title: "Error loading questions for stream" });
                 setAllStreamQuestions({}); // Clear on error
            } finally {
                setIsLoadingQuestions(false);
            }
        } else {
            // Clear stream questions if not full length
            setAllStreamQuestions({});
        }
    };
    fetchAllStreamQuestions();
   }, [testType, selectedStream, fullLengthExamFilter, form, toast]); // Added selectedStream, fullLengthExamFilter

    // Effect to adjust weights when stream changes for Full Length
    useEffect(() => {
        if (testType === 'full_length' && selectedStream) {
            const isPCM = selectedStream === 'PCM';
            // Maintain existing values if possible, otherwise distribute remaining
            let currentPhysics = form.getValues('physicsWeight') ?? 0;
            let currentChemistry = form.getValues('chemistryWeight') ?? 0;
            let currentMaths = form.getValues('mathsWeight') ?? 0;
            let currentBiology = form.getValues('biologyWeight') ?? 0;

            let totalAssigned = currentPhysics + currentChemistry + (isPCM ? currentMaths : currentBiology);

            // If switching streams and previous weights don't make sense, reset to defaults
            if ((isPCM && currentBiology > 0) || (!isPCM && currentMaths > 0) || totalAssigned < 1 || totalAssigned > 100.1) {
                currentPhysics = 34;
                currentChemistry = 33;
                currentMaths = isPCM ? 33 : 0;
                currentBiology = !isPCM ? 33 : 0;
                // Adjust last one slightly for 100% total
                if (isPCM) currentMaths = 100 - currentPhysics - currentChemistry;
                else currentBiology = 100 - currentPhysics - currentChemistry;
            }


            form.setValue('physicsWeight', currentPhysics);
            form.setValue('chemistryWeight', currentChemistry);
            form.setValue('mathsWeight', isPCM ? currentMaths : 0);
            form.setValue('biologyWeight', !isPCM ? currentBiology : 0);
            form.trigger(['physicsWeight', 'chemistryWeight', 'mathsWeight', 'biologyWeight']); // Re-validate weights
        }
    }, [testType, selectedStream, form]);

  // --- Event Handlers ---

  const handleQuestionSelect = (id: string) => {
    if (testType !== 'chapterwise') return; // Only for chapterwise

    const currentSelection = form.getValues('selectedQuestionIds') || [];
    const isSelected = currentSelection.includes(id);
    const currentMaxCount = form.getValues('count');

    if (!isSelected && currentSelection.length >= currentMaxCount) {
      toast({
        variant: "destructive",
        title: "Selection Limit Reached",
        description: `You can only select up to ${currentMaxCount} questions.`,
      });
      return;
    }

    const newSelection = isSelected
      ? currentSelection.filter(qid => qid !== id)
      : [...currentSelection, id];
    form.setValue('selectedQuestionIds', newSelection, { shouldValidate: true });
  };

  const handleSelectRandomChapterwise = () => {
     if (testType !== 'chapterwise') return; // Only for chapterwise

    const countToSelect = form.getValues('count');
    const availableCount = availableQuestions.length;

    if (availableCount < 1) {
      toast({ variant: "destructive", title: "No questions available to select." });
      return;
    }

    const actualCountToSelect = Math.min(countToSelect, availableCount);

    if (actualCountToSelect < countToSelect) {
      toast({ variant: "destructive", title: `Only ${actualCountToSelect} questions available`, description: `Selected all available questions.` });
    }

    const shuffled = [...availableQuestions].sort(() => 0.5 - Math.random());
    const randomSelection = shuffled.slice(0, actualCountToSelect).map(q => q.id);
    form.setValue('selectedQuestionIds', randomSelection, { shouldValidate: true });
    toast({ title: `Selected ${randomSelection.length} random questions.` });
  };

  const generateTestCode = (): string => {
    // Simple random 8-digit code (adjust length/complexity as needed)
    return Math.random().toString().slice(2, 10);
  }

  // --- Format and Structure Test Data ---
  const formatQuestion = (q: QuestionBankItem): TestQuestion => {
     // Determine question content: filename if image, text otherwise
     const questionContent = q.type === 'image' && q.question.image ? q.question.image : (q.question.text || '[No Question Text]');
     // Construct image URL only if it's an image question with an image filename
     const imageUrl = q.type === 'image' && q.question.image ? `/question_bank_images/${q.subject}/${q.lesson}/${q.question.image}` : null;
     // Determine explanation content: filename if image, text otherwise
     const explanationContent = q.explanation.image ? q.explanation.image : (q.explanation.text || null);
     // Construct explanation image URL only if an image filename exists
     const explanationImageUrl = q.explanation.image ? `/question_bank_images/${q.subject}/${q.lesson}/${q.explanation.image}` : null;

     return {
         question: questionContent,
         image_url: imageUrl,
         options: [ // Array of option strings
              q.options.A,
              q.options.B,
              q.options.C,
              q.options.D
         ],
          answer: `OPTION ${q.correct}`, // Format "OPTION A/B/C/D"
          marks: 1, // Default marks - consider making this adjustable per question later
          explanation: explanationContent,
          explanation_image_url: explanationImageUrl, // Add explanation image URL
     };
  };

  // Structure questions for Chapterwise JSON
  const structureChapterwiseQuestions = (selectedIds: string[]): TestQuestion[] => {
     if (!availableQuestions || availableQuestions.length === 0) return [];
     return selectedIds
        .map(id => availableQuestions.find(q => q.id === id))
        .filter((q): q is QuestionBankItem => !!q) // Type guard to filter out undefined
        .map(formatQuestion);
  };

   // Auto-select questions based on weightage for Full-Length
   const autoSelectFullLengthQuestions = useCallback((): QuestionBankItem[] => {
        if (testType !== 'full_length' || !selectedStream) return [];

        const weights = {
             physics: physicsWeight ?? 0,
             chemistry: chemistryWeight ?? 0,
             maths: selectedStream === 'PCM' ? (mathsWeight ?? 0) : 0,
             biology: selectedStream === 'PCB' ? (biologyWeight ?? 0) : 0,
         };
        const totalQuestionsToSelect = questionCount;
        const questionsBySubject = allStreamQuestions; // Use the fetched stream questions

        console.log("Starting auto-selection with:", { weights, totalQuestionsToSelect, questionsBySubject });

        const selectedQuestions: QuestionBankItem[] = [];
        const subjectsInStream = ['physics', 'chemistry'];
        if (selectedStream === 'PCM') subjectsInStream.push('maths');
        if (selectedStream === 'PCB') subjectsInStream.push('biology');

        const subjectPoolSizes: Record<string, number> = {};
        subjectsInStream.forEach(sub => {
            subjectPoolSizes[sub] = questionsBySubject[sub]?.length || 0;
        });

        console.log("Available questions per subject:", subjectPoolSizes);

        // Calculate target counts based on weightage and pool size
        const targetCounts: Record<string, number> = {};
        let totalTarget = 0;
        subjectsInStream.forEach(subject => {
            const subjectKey = subject as keyof typeof weights;
            const weight = weights[subjectKey] || 0;
            const poolSize = subjectPoolSizes[subject] || 0;
            const idealCount = Math.round((weight / 100) * totalQuestionsToSelect);
            targetCounts[subject] = Math.min(idealCount, poolSize); // Cap at available questions
            totalTarget += targetCounts[subject];
        });

        console.log("Initial target counts:", targetCounts, "Total:", totalTarget);

        // Adjust counts proportionally if totalTarget doesn't match totalQuestionsToSelect
        let remainingToAdjust = totalQuestionsToSelect - totalTarget;

        if (remainingToAdjust > 0) { // Need to add more questions
            const capacity = subjectsInStream
                .map(sub => ({ sub, canAdd: subjectPoolSizes[sub] - targetCounts[sub] }))
                .filter(s => s.canAdd > 0)
                .sort((a, b) => b.canAdd - a.canAdd);

             capacity.forEach(({ sub, canAdd }) => {
                 const addCount = Math.min(remainingToAdjust, canAdd);
                 targetCounts[sub] += addCount;
                 remainingToAdjust -= addCount;
             });
             console.log("Adjusted counts (added):", targetCounts);

        } else if (remainingToAdjust < 0) { // Need to remove questions
             const overage = subjectsInStream
                .map(sub => ({ sub, canRemove: targetCounts[sub] }))
                .filter(s => s.canRemove > 0)
                .sort((a, b) => a.canRemove - b.canRemove);

             overage.forEach(({ sub, canRemove }) => {
                if (remainingToAdjust >= 0) return;
                 const removeCount = Math.min(Math.abs(remainingToAdjust), canRemove);
                 targetCounts[sub] -= removeCount;
                 remainingToAdjust += removeCount;
             });
             console.log("Adjusted counts (removed):", targetCounts);
        }


        console.log("Final target counts:", targetCounts);

        // Select questions randomly based on final calculated counts
        subjectsInStream.forEach(subject => {
            const count = targetCounts[subject];
            if (questionsBySubject[subject] && count > 0) {
                const shuffled = [...questionsBySubject[subject]].sort(() => 0.5 - Math.random());
                selectedQuestions.push(...shuffled.slice(0, count));
            }
        });

        console.log(`Final selected questions (${selectedQuestions.length}):`, selectedQuestions.length);
        if (selectedQuestions.length !== totalQuestionsToSelect) {
             toast({
                  variant: "destructive",
                  title: "Question Count Mismatch",
                  description: `Could only select ${selectedQuestions.length} questions due to pool limits. Requested ${totalQuestionsToSelect}. Adjust count or add more questions.`,
                  duration: 7000,
             })
        }
        return selectedQuestions;
   }, [testType, selectedStream, physicsWeight, chemistryWeight, mathsWeight, biologyWeight, questionCount, allStreamQuestions, toast]);


   // --- Main Submit Handler ---
    const onSubmit = async (data: TestCreationFormValues) => {
        setIsSaving(true);
        setGeneratedTestJson(null);
        console.log("Form data on submit:", data);

        try {
            const testCode = generateTestCode();
            let finalTestDefinition: GeneratedTest;
            let actualTotalQuestions = 0;
             let finalStructuredQuestions: TestQuestion[] | undefined = undefined;
             let physicsQuestions: TestQuestion[] | undefined = undefined;
             let chemistryQuestions: TestQuestion[] | undefined = undefined;
             let mathsQuestions: TestQuestion[] | undefined = undefined;
             let biologyQuestions: TestQuestion[] | undefined = undefined;

            if (data.testType === 'chapterwise') {
                 // Double-check selection matches count before proceeding
                 if (data.selectedQuestionIds.length !== data.count) {
                    throw new Error(`Selection error: Expected ${data.count} questions, but ${data.selectedQuestionIds.length} were selected.`);
                 }
                finalStructuredQuestions = structureChapterwiseQuestions(data.selectedQuestionIds);
                actualTotalQuestions = finalStructuredQuestions.length;

                const chapterwiseJson: ChapterwiseTestJson = {
                    test_code: testCode,
                    name: data.name,
                    testType: 'chapterwise', // Include discriminator
                    duration: data.duration,
                    count: data.count,
                    total_questions: actualTotalQuestions,
                    access: data.access,
                    audience: data.audience,
                    test_subject: [data.subject], // Array with one subject
                    lesson: data.lesson,
                    examFilter: data.chapterwiseExamFilter,
                    questions: finalStructuredQuestions, // Include the structured questions
                    createdAt: new Date().toISOString(),
                };
                 finalTestDefinition = chapterwiseJson;

            } else { // Full Length
                 const selectedFullLengthQuestions = autoSelectFullLengthQuestions(); // Call the memoized auto-selector
                 actualTotalQuestions = selectedFullLengthQuestions.length;

                 // If auto-selection resulted in fewer questions than requested, show warning but proceed
                  if (actualTotalQuestions !== data.count) {
                      console.warn(`Generated test will have ${actualTotalQuestions} questions instead of the requested ${data.count} due to availability.`);
                      toast({
                          variant: "default",
                          title: "Question Count Adjusted",
                          description: `Generated test will have ${actualTotalQuestions} questions due to pool limits.`,
                          duration: 6000
                      });
                  }
                  if (actualTotalQuestions === 0) {
                    throw new Error("No questions could be selected for the Full-Length test based on current filters and pools.");
                  }

                // Structure the selected questions by subject
                 physicsQuestions = selectedFullLengthQuestions.filter(q => q.subject.toLowerCase() === 'physics').map(formatQuestion);
                 chemistryQuestions = selectedFullLengthQuestions.filter(q => q.subject.toLowerCase() === 'chemistry').map(formatQuestion);
                 mathsQuestions = selectedFullLengthQuestions.filter(q => q.subject.toLowerCase() === 'maths').map(formatQuestion);
                 biologyQuestions = selectedFullLengthQuestions.filter(q => q.subject.toLowerCase() === 'biology').map(formatQuestion);

                const weights = {
                     physics: data.physicsWeight ?? 0,
                     chemistry: data.chemistryWeight ?? 0,
                     maths: data.stream === 'PCM' ? (data.mathsWeight ?? 0) : undefined,
                     biology: data.stream === 'PCB' ? (data.biologyWeight ?? 0) : undefined,
                 };
                 // Filter out undefined weights
                 Object.keys(weights).forEach(key => weights[key as keyof typeof weights] === undefined && delete weights[key as keyof typeof weights]);


                const fullLengthJson: FullLengthTestJson = {
                    test_code: testCode,
                    name: data.name,
                    testType: 'full_length', // Include discriminator
                    duration: data.duration,
                    count: data.count, // Requested count
                    total_questions: actualTotalQuestions, // Actual count included
                    access: data.access,
                    audience: data.audience,
                    stream: data.stream,
                     // Dynamically create test_subject array based on which subjects have questions
                    test_subject: Object.entries({ physicsQuestions, chemistryQuestions, mathsQuestions, biologyQuestions })
                        .filter(([_, questions]) => questions && questions.length > 0)
                         .map(([subjectKey, _]) => subjectKey.replace('Questions', '').charAt(0).toUpperCase() + subjectKey.replace('Questions', '').slice(1)), // Capitalize
                    examFilter: data.fullLengthExamFilter,
                    weightage: weights, // Include requested weights
                    // Only include subject arrays if they have questions
                    physics: physicsQuestions.length > 0 ? physicsQuestions : undefined,
                    chemistry: chemistryQuestions.length > 0 ? chemistryQuestions : undefined,
                    maths: mathsQuestions.length > 0 ? mathsQuestions : undefined,
                    biology: biologyQuestions.length > 0 ? biologyQuestions : undefined,
                    createdAt: new Date().toISOString(),
                };
                finalTestDefinition = fullLengthJson;
            }

            setGeneratedTestJson(JSON.stringify(finalTestDefinition, null, 2));
            setShowJsonDialog(true); // Show dialog for confirmation

        } catch (error: any) {
            console.error("Test generation failed:", error);
            toast({ variant: "destructive", title: "Generation Failed", description: error.message });
            setIsSaving(false);
        }
        // Saving logic moved to handleConfirmSave
    };

    // Handle final save after confirmation
    const handleConfirmSave = async () => {
        if (!generatedTestJson) return;
        setIsSaving(true); // Show saving indicator on confirm button
        try {
            const testDefinition = JSON.parse(generatedTestJson) as GeneratedTest;
            const result = await saveGeneratedTest(testDefinition);
            if (!result.success) throw new Error(result.message || "Failed to save test definition.");

            toast({ title: "Test Saved Successfully!", description: `Test ${testDefinition.name} (${testDefinition.test_code}) saved.` });
            form.reset(); // Reset form after successful save
            setAvailableQuestions([]);
            setAllStreamQuestions({});
            setGeneratedTestJson(null);
            setShowJsonDialog(false);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Save Failed", description: error.message });
        } finally {
            setIsSaving(false); // Reset indicator regardless of outcome
        }
    };

  // Helper to render question preview in table
  const renderQuestionPreview = (q: QuestionBankItem) => {
    if (q.type === 'image' && q.question.image) {
      return <span className="text-blue-600 line-clamp-1">[Image: {q.question.image}]</span>;
    }
     // Basic MathJax preview (relies on MathJax being loaded globally)
    const text = q.question.text || '[No Text]';
    return <span className="line-clamp-1" title={text} dangerouslySetInnerHTML={{ __html: text.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') || '[No Text]' }}></span>;
  }

  // Calculate total weightage for validation message
  const totalWeightage = useMemo(() => {
    if (testType !== 'full_length') return 100;
    const p = physicsWeight ?? 0;
    const c = chemistryWeight ?? 0;
    const m = selectedStream === 'PCM' ? (mathsWeight ?? 0) : 0;
    const b = selectedStream === 'PCB' ? (biologyWeight ?? 0) : 0;
    return p + c + m + b;
  }, [testType, selectedStream, physicsWeight, chemistryWeight, mathsWeight, biologyWeight]);


  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <PlusCircle className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create New Test</h1>
          <p className="text-muted-foreground">Define test parameters and select/generate questions.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

          {/* Test Configuration Card */}
          <Card>
            <CardHeader>
              <CardTitle>1. Test Configuration</CardTitle>
              <CardDescription>Select the type of test and set basic details.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Test Type */}
              <FormField control={form.control} name="testType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Test Type *</FormLabel>
                  <Select onValueChange={(value) => {
                      field.onChange(value);
                      // Reset specific fields when type changes
                      form.reset({
                          ...form.getValues(), // keep common values
                           testType: value as 'chapterwise' | 'full_length', // set new type
                           // Reset chapterwise specifics if switching away
                           subject: value !== 'chapterwise' ? '' : form.getValues('subject'),
                           lesson: value !== 'chapterwise' ? '' : form.getValues('lesson'),
                           chapterwiseExamFilter: value !== 'chapterwise' ? 'all' : form.getValues('chapterwiseExamFilter'),
                           selectedQuestionIds: value !== 'chapterwise' ? [] : form.getValues('selectedQuestionIds'),
                           // Reset full-length specifics if switching away
                           stream: value !== 'full_length' ? 'PCM' : form.getValues('stream'),
                           fullLengthExamFilter: value !== 'full_length' ? 'all' : form.getValues('fullLengthExamFilter'),
                           physicsWeight: value !== 'full_length' ? 34 : form.getValues('physicsWeight'),
                           chemistryWeight: value !== 'full_length' ? 33 : form.getValues('chemistryWeight'),
                           mathsWeight: value !== 'full_length' ? 33 : form.getValues('mathsWeight'),
                           biologyWeight: value !== 'full_length' ? 0 : form.getValues('biologyWeight'),
                      });
                  }} value={field.value} disabled={isSaving}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="chapterwise">Chapterwise Test</SelectItem>
                      <SelectItem value="full_length">Full-Length Test</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              {/* Test Name */}
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Test Name *</FormLabel>
                  <FormControl><Input placeholder="e.g., Physics Chapter 1 Test" {...field} disabled={isSaving} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
               {/* Duration */}
              <FormField control={form.control} name="duration" render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (Minutes) *</FormLabel>
                  <FormControl><Input type="number" {...field} min="1" max="300" disabled={isSaving} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
               {/* Question Count */}
              <FormField control={form.control} name="count" render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Questions *</FormLabel>
                  <Select onValueChange={(value) => field.onChange(parseInt(value, 10))} value={field.value?.toString()} disabled={isSaving}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select Count" /></SelectTrigger></FormControl>
                    <SelectContent>{Array.from({ length: 50 }, (_, i) => i + 1).map((num) => <SelectItem key={num} value={num.toString()}>{num}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              {/* Access Type */}
              <FormField control={form.control} name="access" render={({ field }) => (
                <FormItem>
                  <FormLabel>Access Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isSaving}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select Access" /></SelectTrigger></FormControl>
                    <SelectContent>{pricingTypes.map((pt) => <SelectItem key={pt} value={pt} className="capitalize">{pt.replace('_', ' ')}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              {/* Target Audience */}
              <FormField control={form.control} name="audience" render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Audience *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isSaving}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select Audience" /></SelectTrigger></FormControl>
                    <SelectContent>{academicStatuses.map((aud) => <SelectItem key={aud} value={aud}>{aud}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* --- Chapterwise Specific Section --- */}
          {testType === 'chapterwise' && (
            <Card>
              <CardHeader>
                <CardTitle>2. Chapterwise Details & Questions</CardTitle>
                <CardDescription>Select subject, lesson, filter, and the required number of questions ({questionCount}).</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-3">
                 {/* Filters */}
                <div className="md:col-span-1 space-y-4">
                    <FormField control={form.control} name="subject" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Subject *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingSubjects || isSaving}>
                            <FormControl><SelectTrigger><SelectValue placeholder={isLoadingSubjects ? "Loading..." : "Select Subject"} /></SelectTrigger></FormControl>
                            <SelectContent>{subjects.map((sub) => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="lesson" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Lesson *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingLessons || !selectedSubject || isSaving}>
                            <FormControl><SelectTrigger><SelectValue placeholder={isLoadingLessons ? "Loading..." : (!selectedSubject ? "Select Subject First" : "Select Lesson")} /></SelectTrigger></FormControl>
                            <SelectContent>{lessons.map((lesson) => <SelectItem key={lesson} value={lesson}>{lesson}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="chapterwiseExamFilter" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Exam Filter</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isSaving || !selectedSubject || !selectedLesson}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Filter by Exam (Optional)" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="all">All Exams</SelectItem>
                                {examOptions.map((ex) => <SelectItem key={ex} value={ex}>{ex}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )} />
                </div>
                 {/* Question Selection Table */}
                <div className="md:col-span-2 space-y-3">
                    <div className="flex justify-between items-center">
                        <h3 className="font-medium">Select Questions ({selectedQuestionIds?.length || 0} / {questionCount})</h3>
                         <Button type="button" size="sm" variant="outline" onClick={handleSelectRandomChapterwise} disabled={isLoadingQuestions || availableQuestions.length < 1 || isSaving || !selectedSubject || !selectedLesson || availableQuestions.length < questionCount}>
                             Auto-Pick {questionCount}
                         </Button>
                    </div>
                     <p className="text-xs text-muted-foreground">Available: {availableQuestions.length} questions matching filters.</p>
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
                                <TableCell className="text-right"><Button type="button" variant="ghost" size="icon" onClick={() => setPreviewQuestion(q)}><Eye className="h-4 w-4"/></Button></TableCell>
                            </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={5} className="h-24 text-center">
                                {(!selectedSubject || !selectedLesson) ? "Select Subject and Lesson." : "No questions found matching filters."}
                            </TableCell></TableRow>
                        )}
                        </TableBody>
                    </Table>
                    </ScrollArea>
                     {/* Validation message specifically for selection count */}
                     <FormField control={form.control} name="selectedQuestionIds" render={({ fieldState }) => <FormMessage>{fieldState.error?.message}</FormMessage>} />
                </div>
              </CardContent>
            </Card>
          )}

           {/* --- Full Length Specific Section --- */}
          {testType === 'full_length' && (
            <Card>
              <CardHeader>
                <CardTitle>2. Full-Length Details</CardTitle>
                <CardDescription>Select stream, exam filter, and subject weightages (Total questions: {questionCount}). Questions will be auto-selected based on weightage.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
                 {/* Stream & Filter */}
                <FormField control={form.control} name="stream" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Stream *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isSaving}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select Stream" /></SelectTrigger></FormControl>
                        <SelectContent>{testStreams.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />
                 <FormField control={form.control} name="fullLengthExamFilter" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Exam Filter</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isSaving}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Filter by Exam (Optional)" /></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="all">All Exams</SelectItem>
                            {examOptions.map((ex) => <SelectItem key={ex} value={ex}>{ex}</SelectItem>)}
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                 )} />
              </CardContent>
               {/* Weightage Sliders */}
              <CardContent className="space-y-6 pt-0">
                <h4 className="font-medium border-t pt-4">Subject Weightage (%)</h4>
                <div className="grid gap-4 md:grid-cols-3">
                    <FormField control={form.control} name="physicsWeight" render={({ field }) => (
                        <FormItem className="space-y-3">
                        <FormLabel className="flex items-center justify-between"><span className="flex items-center gap-1.5"><FlaskConical className="h-4 w-4 text-blue-500"/>Physics</span><span className="text-sm font-normal text-muted-foreground">{field.value ?? 0}%</span></FormLabel>
                        <FormControl><Slider defaultValue={[field.value ?? 0]} value={[field.value ?? 0]} max={100} step={1} onValueChange={(value) => field.onChange(value[0])} disabled={isSaving} /></FormControl>
                         <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="chemistryWeight" render={({ field }) => (
                        <FormItem className="space-y-3">
                        <FormLabel className="flex items-center justify-between"><span className="flex items-center gap-1.5"><FlaskConical className="h-4 w-4 text-green-500"/>Chemistry</span><span className="text-sm font-normal text-muted-foreground">{field.value ?? 0}%</span></FormLabel>
                        <FormControl><Slider defaultValue={[field.value ?? 0]} value={[field.value ?? 0]} max={100} step={1} onValueChange={(value) => field.onChange(value[0])} disabled={isSaving} /></FormControl>
                         <FormMessage />
                        </FormItem>
                    )} />
                    {selectedStream === 'PCM' && (
                        <FormField control={form.control} name="mathsWeight" render={({ field }) => (
                        <FormItem className="space-y-3">
                            <FormLabel className="flex items-center justify-between"><span className="flex items-center gap-1.5"><Calculator className="h-4 w-4 text-red-500"/>Maths</span><span className="text-sm font-normal text-muted-foreground">{field.value ?? 0}%</span></FormLabel>
                            <FormControl><Slider defaultValue={[field.value ?? 0]} value={[field.value ?? 0]} max={100} step={1} onValueChange={(value) => field.onChange(value[0])} disabled={isSaving} /></FormControl>
                             <FormMessage />
                        </FormItem>
                        )} />
                    )}
                     {selectedStream === 'PCB' && (
                        <FormField control={form.control} name="biologyWeight" render={({ field }) => (
                        <FormItem className="space-y-3">
                            <FormLabel className="flex items-center justify-between"><span className="flex items-center gap-1.5"><Dna className="h-4 w-4 text-purple-500"/>Biology</span><span className="text-sm font-normal text-muted-foreground">{field.value ?? 0}%</span></FormLabel>
                            <FormControl><Slider defaultValue={[field.value ?? 0]} value={[field.value ?? 0]} max={100} step={1} onValueChange={(value) => field.onChange(value[0])} disabled={isSaving} /></FormControl>
                             <FormMessage />
                        </FormItem>
                        )} />
                    )}
                </div>
                 {/* Display Total Weightage and Validation Message */}
                <div className="flex justify-end items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Total:</span>
                    <span className={cn("font-medium", Math.abs(totalWeightage - 100) > 0.1 ? 'text-destructive' : 'text-foreground')}>{totalWeightage.toFixed(0)}%</span>
                </div>
                 {/* Show specific validation message for weightage sum (attached to physicsWeight field) */}
                <FormField control={form.control} name="physicsWeight" render={({ fieldState }) => <FormMessage>{fieldState.error?.message}</FormMessage>} />
                 <p className="text-xs text-muted-foreground pt-4 border-t">
                    {isLoadingQuestions ? <Skeleton className="h-4 w-3/4" /> : `Based on weightage, questions will be auto-selected from available pools: Physics(${allStreamQuestions.physics?.length || 0}), Chemistry(${allStreamQuestions.chemistry?.length || 0}), ${selectedStream === 'PCM' ? `Maths(${allStreamQuestions.maths?.length || 0})` : `Biology(${allStreamQuestions.biology?.length || 0})`}.`}
                 </p>
              </CardContent>
            </Card>
          )}

          {/* Submit Footer */}
          <Card>
            <CardFooter className="pt-6">
              <Button type="submit" disabled={isSaving || isLoadingQuestions}>
                {(isSaving || isLoadingQuestions) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoadingQuestions ? 'Loading Questions...' : (isSaving ? 'Generating...' : 'Generate Test Definition')}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>

      {/* Question Preview Dialog */}
      <Dialog open={!!previewQuestion} onOpenChange={(open) => !open && setPreviewQuestion(null)}>
         <DialogContent className="max-w-2xl">
           <DialogHeader><DialogTitle>Question Preview: {previewQuestion?.id}</DialogTitle></DialogHeader>
           {previewQuestion && (
             <div className="space-y-4 max-h-[70vh] overflow-y-auto p-4">
               <div className="flex flex-wrap gap-2 text-xs">
                   <Badge variant="secondary">{previewQuestion.subject}</Badge>
                   <Badge variant="secondary">{previewQuestion.lesson}</Badge>
                   <Badge variant="outline">{previewQuestion.class}</Badge>
                   <Badge variant="outline">{previewQuestion.examType}</Badge>
                   <Badge variant="outline">{previewQuestion.difficulty}</Badge>
               </div>
               {previewQuestion.type === 'text' && previewQuestion.question.text && ( <div className="prose prose-sm dark:prose-invert max-w-none border p-3 rounded-md"><p className="font-medium mb-1">Question:</p><p dangerouslySetInnerHTML={{ __html: previewQuestion.question.text.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') || '[No Text]' }}></p></div> )}
               {previewQuestion.type === 'image' && previewQuestion.question.image && ( <div><p className="font-medium mb-1">Question Image:</p><Image src={`/question_bank_images/${previewQuestion.subject}/${previewQuestion.lesson}/${previewQuestion.question.image}`} alt="Question Image" width={500} height={300} className="rounded border"/></div> )}
               <div><p className="font-medium mb-1">Options:</p><ul className="list-none space-y-1 text-sm"><li><strong>A:</strong> {previewQuestion.options.A}</li><li><strong>B:</strong> {previewQuestion.options.B}</li><li><strong>C:</strong> {previewQuestion.options.C}</li><li><strong>D:</strong> {previewQuestion.options.D}</li></ul></div>
               <p className="text-sm"><strong>Correct Answer:</strong> {previewQuestion.correct}</p>
               {previewQuestion.explanation.text && ( <div className="prose prose-sm dark:prose-invert max-w-none border p-3 rounded-md bg-muted/50"><p className="font-medium mb-1">Explanation:</p><p dangerouslySetInnerHTML={{ __html: previewQuestion.explanation.text.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') || '[No Text]' }}></p></div> )}
               {previewQuestion.explanation.image && ( <div><p className="font-medium mb-1">Explanation Image:</p><Image src={`/question_bank_images/${previewQuestion.subject}/${previewQuestion.lesson}/${previewQuestion.explanation.image}`} alt="Explanation Image" width={400} height={200} className="rounded border"/></div> )}
             </div>
           )}
           <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Close</Button></DialogClose></DialogFooter>
         </DialogContent>
       </Dialog>

       {/* JSON Confirmation Dialog */}
       <Dialog open={showJsonDialog} onOpenChange={(open) => { if (!open) { setGeneratedTestJson(null); setIsSaving(false); } setShowJsonDialog(open); }}>
         <DialogContent className="max-w-3xl">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2"><FileJson className="h-5 w-5"/> Test Definition Generated</DialogTitle>
             <DialogDescription>Review the generated test JSON. Click "Confirm & Save" to store it.</DialogDescription>
           </DialogHeader>
           <ScrollArea className="max-h-[60vh] rounded-md border bg-muted/50 p-4">
             <pre className="text-xs whitespace-pre-wrap break-all">{generatedTestJson || "Generating..."}</pre>
           </ScrollArea>
           <DialogFooter>
             <Button type="button" variant="outline" onClick={() => { setShowJsonDialog(false); setGeneratedTestJson(null); setIsSaving(false); }} disabled={isSaving}>Cancel</Button>
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
