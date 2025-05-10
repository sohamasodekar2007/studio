// src/app/admin/tests/create/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback, ChangeEvent } from 'react';
import { useForm, Controller, useFieldArray, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2, Eye, ListFilter, Settings2, BookOpen, Brain, Sigma, FlaskConical, Atom, Leaf, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuestionBankItem, PricingType, ExamOption, TestStream, GeneratedTest, TestQuestion, AcademicStatus } from '@/types';
import { pricingTypes, academicStatuses as audienceTypes, testStreams, exams as allExams } from '@/types';
import { getSubjects, getLessonsForSubject, getQuestionsForLesson } from '@/actions/question-bank-query-actions';
import { saveGeneratedTest } from '@/actions/generated-test-actions';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Image from 'next/image';
import Script from 'next/script';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import QuestionPreviewDialog from '@/components/admin/question-preview-dialog';

// --- Zod Schemas ---
// Base schema without testType, as testType will be a literal in each specific schema
const baseTestSchema = z.object({
  testName: z.string().min(3, "Test Name must be at least 3 characters."),
  duration: z.number().min(1, "Duration must be at least 1 minute.").positive("Duration must be positive."),
  accessType: z.enum(pricingTypes),
  audience: z.enum(audienceTypes).nullable(),
});

const chapterwiseDetailsSchema = z.object({
  subject: z.string().min(1, "Subject is required."),
  lessons: z.array(z.string()).min(1, "Select at least one lesson."),
  selectedQuestionIds: z.array(z.string()).min(1, "Select at least one question.").max(100, "Max 100 questions for chapterwise."),
  questionCount: z.number().min(1).max(100),
});

// Reconstruct ChapterwiseSchema directly
const ChapterwiseSchema = z.object({
  ...baseTestSchema.shape,
  ...chapterwiseDetailsSchema.shape,
  testType: z.literal('chapterwise'),
});


const subjectConfigSchema = z.object({
  subjectName: z.string(),
  lessons: z.array(z.object({
    lessonName: z.string(),
    weightage: z.number().min(0).max(100),
    questionCount: z.number().min(0),
  })).default([]),
  totalSubjectWeightage: z.number().min(0).max(100).default(0),
  totalSubjectQuestions: z.number().min(0).default(0),
});

const fullLengthDetailsSchema = z.object({
  exam: z.enum(allExams),
  stream: z.enum(testStreams).optional(),
  overallTotalQuestions: z.number().min(10, "Min 10 questions.").max(200, "Max 200 questions."),
  subjectsConfig: z.array(subjectConfigSchema).default([]),
});

// Reconstruct FullLengthSchema directly
const FullLengthSchema = z.object({
  ...baseTestSchema.shape,
  ...fullLengthDetailsSchema.shape,
  testType: z.literal('full_length'),
}).refine(data => { // Apply refinements after the object is fully constructed
  if (data.testType === 'full_length') {
    const totalWeightageSum = data.subjectsConfig.reduce((sum, subj) => sum + subj.totalSubjectWeightage, 0);
    if (Math.abs(totalWeightageSum - 100) >= 0.1 && data.subjectsConfig.length > 0) return false; // Only validate if configs exist
  }
  return true;
}, { message: "Total subject weightages must sum to 100% if subjects are configured.", path: ['subjectsConfig'] })
.refine(data => {
  if (data.testType === 'full_length') {
    for(const subject of data.subjectsConfig) {
        const lessonWeightageSum = subject.lessons.reduce((sum, lesson) => sum + lesson.weightage, 0);
        if (subject.lessons.length > 0 && Math.abs(lessonWeightageSum - 100) > 0.1 && subject.lessons.some(l => l.weightage > 0)) return false; // Validate if any lesson weightage is set
    }
  }
  return true;
}, { message: "Lesson weightages within each subject must sum to 100% if specified.", path: ['subjectsConfig'] });


// Discriminated union schema
const TestCreationSchema = z.discriminatedUnion("testType", [
    ChapterwiseSchema,
    FullLengthSchema,
]);

type TestCreationFormValues = z.infer<typeof TestCreationSchema>;


const examSubjectMap: Record<ExamOption, string[]> = {
    "MHT-CET": ["Physics", "Chemistry", "Mathematics", "Biology"],
    "JEE Main": ["Physics", "Chemistry", "Mathematics"],
    "JEE Advanced": ["Physics", "Chemistry", "Mathematics"],
    "NEET": ["Physics", "Chemistry", "Biology"],
    "WBJEE": ["Physics", "Chemistry", "Mathematics"],
    "KCET": ["Physics", "Chemistry", "Mathematics", "Biology"],
    "BITSAT": ["Physics", "Chemistry", "Mathematics", "English Proficiency", "Logical Reasoning"],
    "VITEEE": ["Physics", "Chemistry", "Mathematics", "Biology", "English"],
    "CUET": ["Physics", "Chemistry", "Mathematics", "Biology"],
    "AIEEE": ["Physics", "Chemistry", "Mathematics"],
    "Other": ["Physics", "Chemistry", "Mathematics", "Biology"],
};


export default function CreateTestPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [dbSubjects, setDbSubjects] = useState<string[]>([]);
  const [lessonsBySubject, setLessonsBySubject] = useState<Record<string, string[]>>({});
  const [availableQuestions, setAvailableQuestions] = useState<QuestionBankItem[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [isLoadingLessons, setIsLoadingLessons] = useState<Record<string, boolean>>({});
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<QuestionBankItem | null>(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);


  const form = useForm<TestCreationFormValues>({
    resolver: zodResolver(TestCreationSchema),
    defaultValues: {
      testType: 'chapterwise',
      testName: '',
      duration: 60,
      accessType: 'FREE',
      audience: null,
      // Chapterwise defaults
      subject: '',
      lessons: [],
      selectedQuestionIds: [],
      questionCount: 20,
      // Full-length defaults
      exam: 'MHT-CET',
      stream: undefined,
      overallTotalQuestions: 50,
      subjectsConfig: [],
    },
  });

  const { fields: subjectConfigFields, replace: replaceSubjectConfigs, update: updateSubjectConfigField } = useFieldArray({
    control: form.control,
    name: "subjectsConfig" as any, // Type assertion for Zod discriminated union
  });


  const testType = form.watch('testType');
  const chapterwiseSubject = form.watch('subject');
  const chapterwiseLessons = form.watch('lessons');
  const fullLengthExam = form.watch('exam');
  const fullLengthStream = form.watch('stream');
  const overallTotalQuestions = form.watch('overallTotalQuestions');
  const subjectsConfigValues = form.watch('subjectsConfig');


  const handleMathJaxLoad = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).MathJax?.typesetPromise) {
      console.log('MathJax loaded for Create Test page, typesetting initial content if any.');
      typesetMathJax();
    }
  }, []);

  const typesetMathJax = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).MathJax?.typesetPromise) {
      (window as any).MathJax.typesetPromise().catch((err: any) => console.error("MathJax typeset error:", err));
    }
  }, []);

  useEffect(() => {
    setIsLoadingSubjects(true);
    getSubjects()
      .then(setDbSubjects)
      .catch(() => toast({ variant: 'destructive', title: 'Error', description: 'Could not load subjects.' }))
      .finally(() => setIsLoadingSubjects(false));
  }, [toast]);

  const fetchAllLessonsForSubject = async (subject: string) => {
    if (lessonsBySubject[subject]) return; // Already fetched or fetching

    setIsLoadingLessons(prev => ({...prev, [subject]: true}));
    try {
        const fetchedLessons = await getLessonsForSubject(subject);
        setLessonsBySubject(prev => ({ ...prev, [subject]: fetchedLessons }));
    } catch (err) {
        toast({ variant: "destructive", title: "Error", description: `Could not load lessons for ${subject}.` });
        setLessonsBySubject(prev => ({ ...prev, [subject]: [] }));
    } finally {
        setIsLoadingLessons(prev => ({...prev, [subject]: false}));
    }
  };
  
  useEffect(() => {
    if (testType === 'chapterwise' && chapterwiseSubject) {
        fetchAllLessonsForSubject(chapterwiseSubject);
    } else if (testType === 'full_length' && fullLengthExam) {
        const subjectsForExam = examSubjectMap[fullLengthExam] || [];
        subjectsForExam.forEach(sub => {
           fetchAllLessonsForSubject(sub);
        });
    }
  }, [testType, chapterwiseSubject, fullLengthExam, toast]); // Removed lessonsBySubject from deps to avoid loop

  useEffect(() => {
    if (testType === 'full_length' && fullLengthExam) {
      let subjectsForStream = examSubjectMap[fullLengthExam] || [];
      if ((fullLengthExam === 'MHT-CET' || fullLengthExam === 'KCET' || fullLengthExam === 'VITEEE' || fullLengthExam === 'CUET') && fullLengthStream) {
        if (fullLengthStream === 'PCM') {
          subjectsForStream = subjectsForStream.filter(s => s !== 'Biology');
        } else if (fullLengthStream === 'PCB') {
          subjectsForStream = subjectsForStream.filter(s => !['Mathematics', 'English Proficiency', 'Logical Reasoning', 'English'].includes(s));
        }
      } else if (fullLengthExam === 'BITSAT') {
         subjectsForStream = ["Physics", "Chemistry", "Mathematics", "English Proficiency", "Logical Reasoning"];
      }

      const currentConfigs = form.getValues('subjectsConfig') || [];
      const newConfigs = subjectsForStream.map(subjectName => {
        const existingConfig = currentConfigs.find(sc => sc.subjectName === subjectName);
        return {
          subjectName,
          lessons: lessonsBySubject[subjectName]?.map(ln => ({ lessonName: ln, weightage: 0, questionCount:0 })) || [],
          totalSubjectWeightage: existingConfig?.totalSubjectWeightage || 0,
          totalSubjectQuestions: existingConfig?.totalSubjectQuestions || 0,
        };
      });
      replaceSubjectConfigs(newConfigs as any); // Type assertion for Zod discriminated union
    } else {
      replaceSubjectConfigs([]);
    }
  }, [testType, fullLengthExam, fullLengthStream, lessonsBySubject, replaceSubjectConfigs, form]);


  useEffect(() => {
    if (testType === 'full_length' && subjectsConfigValues && subjectsConfigValues.length > 0 && overallTotalQuestions > 0) {
        const totalWeightageSum = subjectsConfigValues.reduce((sum, config) => sum + (config.totalSubjectWeightage || 0), 0);
        
        let distributedQuestionsSum = 0;
        const newConfigs = subjectsConfigValues.map((config, subjectIndex) => {
            let questionsForSubject = 0;
            if (totalWeightageSum > 0) {
                 questionsForSubject = Math.round((config.totalSubjectWeightage / totalWeightageSum) * overallTotalQuestions);
            }
            form.setValue(`subjectsConfig.${subjectIndex}.totalSubjectQuestions`, questionsForSubject);
            distributedQuestionsSum += questionsForSubject;

            let lessonsQuestionsSumInSubject = 0;
            if (config.lessons && config.lessons.length > 0) {
                const totalLessonWeightage = config.lessons.reduce((s, l) => s + (l.weightage || 0), 0);
                if (totalLessonWeightage > 0) {
                    config.lessons.forEach((lesson, lessonIndex) => {
                        const lessonProportion = (lesson.weightage || 0) / totalLessonWeightage;
                        const questionsForLesson = Math.round(questionsForSubject * lessonProportion);
                        form.setValue(`subjectsConfig.${subjectIndex}.lessons.${lessonIndex}.questionCount`, questionsForLesson);
                        lessonsQuestionsSumInSubject += questionsForLesson;
                    });
                    // Adjust last lesson in subject if sum doesn't match
                    if (lessonsQuestionsSumInSubject !== questionsForSubject && config.lessons.length > 0) {
                         const diff = questionsForSubject - lessonsQuestionsSumInSubject;
                         const currentVal = form.getValues(`subjectsConfig.${subjectIndex}.lessons.${config.lessons.length - 1}.questionCount`);
                         form.setValue(`subjectsConfig.${subjectIndex}.lessons.${config.lessons.length - 1}.questionCount`, Math.max(0, (currentVal || 0) + diff));
                    }
                } else { // If no lesson weightages, distribute equally or leave for manual
                     const questionsPerLesson = config.lessons.length > 0 ? Math.floor(questionsForSubject / config.lessons.length) : 0;
                     let remainder = config.lessons.length > 0 ? questionsForSubject % config.lessons.length : 0;
                     config.lessons.forEach((lesson, lessonIndex) => {
                         let qCount = questionsPerLesson + (remainder > 0 ? 1 : 0);
                         form.setValue(`subjectsConfig.${subjectIndex}.lessons.${lessonIndex}.questionCount`, qCount);
                         if (remainder > 0) remainder--;
                     });
                }
            }
            return { ...config, totalSubjectQuestions: questionsForSubject };
        });

        // Final adjustment for overallTotalQuestions
        if (distributedQuestionsSum !== overallTotalQuestions && newConfigs.length > 0) {
            const diff = overallTotalQuestions - distributedQuestionsSum;
            const lastConfigIndex = newConfigs.length - 1;
            const currentTotal = form.getValues(`subjectsConfig.${lastConfigIndex}.totalSubjectQuestions`);
            form.setValue(`subjectsConfig.${lastConfigIndex}.totalSubjectQuestions`, Math.max(0, (currentTotal || 0) + diff));
        }
    }
  }, [overallTotalQuestions, subjectsConfigValues, testType, form]);


  useEffect(() => {
    if (testType === 'chapterwise' && chapterwiseSubject && chapterwiseLessons && chapterwiseLessons.length > 0) {
      setIsLoadingQuestions(true);
      Promise.all(
        chapterwiseLessons.map(lesson => getQuestionsForLesson({ subject: chapterwiseSubject, lesson }))
      ).then(results => {
        setAvailableQuestions(results.flat());
      }).catch(() => {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load questions.' });
        setAvailableQuestions([]);
      }).finally(() => {
        setIsLoadingQuestions(false);
        typesetMathJax();
      });
    } else {
      setAvailableQuestions([]);
    }
  }, [testType, chapterwiseSubject, chapterwiseLessons, toast, typesetMathJax]);

  const onSubmit = async (data: TestCreationFormValues) => {
    setIsLoading(true);
    let testToSave: Omit<GeneratedTest, 'test_code' | 'createdAt'>;

    try {
      if (data.testType === 'chapterwise') {
        if (data.selectedQuestionIds.length !== data.questionCount) {
            toast({variant: 'destructive', title: 'Question Count Mismatch', description: `Please select exactly ${data.questionCount} questions.`});
            setIsLoading(false);
            return;
        }
        const selectedFullQuestions = availableQuestions.filter(q => data.selectedQuestionIds.includes(q.id));

        if (selectedFullQuestions.length !== data.questionCount) {
            toast({variant: 'destructive', title: 'Error', description: 'Could not find all selected questions. Please re-select.'});
            setIsLoading(false);
            return;
        }
        
        const chapterwiseQuestions: TestQuestion[] = selectedFullQuestions.map(q => ({
            id: q.id,
            type: q.type,
            question_text: q.question.text,
            question_image_url: q.question.image ? constructImagePath(q.subject, q.lesson, q.question.image) : null,
            options: [q.options.A, q.options.B, q.options.C, q.options.D],
            answer: q.correct,
            marks: q.marks,
            explanation_text: q.explanation.text,
            explanation_image_url: q.explanation.image ? constructImagePath(q.subject, q.lesson, q.explanation.image) : null,
        }));

        testToSave = {
          testType: 'chapterwise',
          name: data.testName,
          duration: data.duration,
          total_questions: data.questionCount,
          type: data.accessType,
          audience: data.audience,
          test_subject: [data.subject],
          lessons: data.lessons,
          lesson: data.lessons.join(', '),
          questions: chapterwiseQuestions,
          examFilter: 'all', // Default or from form if added
        };
      } else { // Full-length
        let allSelectedQuestionsForFLT: TestQuestion[] = [];
        let physicsQs: TestQuestion[] = [];
        let chemistryQs: TestQuestion[] = [];
        let mathsQs: TestQuestion[] = [];
        let biologyQs: TestQuestion[] = [];

        for (const subjectConfig of data.subjectsConfig) {
            for (const lessonConfig of subjectConfig.lessons) {
                if (lessonConfig.questionCount > 0) {
                    const questionsFromBank = await getQuestionsForLesson({ subject: subjectConfig.subjectName, lesson: lessonConfig.lessonName });
                    const shuffled = [...questionsFromBank].sort(() => 0.5 - Math.random());
                    const selected = shuffled.slice(0, lessonConfig.questionCount).map(q => ({
                        id: q.id, type: q.type, question_text: q.question.text, question_image_url: q.question.image ? constructImagePath(q.subject, q.lesson, q.question.image) : null,
                        options: [q.options.A, q.options.B, q.options.C, q.options.D], answer: q.correct, marks: q.marks, explanation_text: q.explanation.text,
                        explanation_image_url: q.explanation.image ? constructImagePath(q.subject, q.lesson, q.explanation.image) : null,
                    }));
                    
                    if (subjectConfig.subjectName.toLowerCase() === 'physics') physicsQs.push(...selected);
                    else if (subjectConfig.subjectName.toLowerCase() === 'chemistry') chemistryQs.push(...selected);
                    else if (subjectConfig.subjectName.toLowerCase() === 'mathematics') mathsQs.push(...selected);
                    else if (subjectConfig.subjectName.toLowerCase() === 'biology') biologyQs.push(...selected);
                    
                    allSelectedQuestionsForFLT.push(...selected);
                }
            }
        }
         // Ensure total questions match, adjust if necessary
         if (allSelectedQuestionsForFLT.length !== data.overallTotalQuestions) {
            // This part needs careful logic to trim or pad questions if counts don't match
            console.warn(`Fetched ${allSelectedQuestionsForFLT.length} questions, but expected ${data.overallTotalQuestions}. Final test might differ slightly.`);
            // For now, we'll use the fetched questions, but ideally, this should be handled more gracefully
         }

        testToSave = {
          testType: 'full_length',
          name: data.testName,
          duration: data.duration,
          total_questions: data.overallTotalQuestions, // Use the target total
          type: data.accessType,
          audience: data.audience,
          test_subject: data.subjectsConfig.map(s => s.subjectName),
          stream: data.stream!,
          examTypeTarget: data.exam,
          physics_questions: physicsQs.length > 0 ? physicsQs : undefined,
          chemistry_questions: chemistryQs.length > 0 ? chemistryQs : undefined,
          maths_questions: mathsQs.length > 0 && data.stream === 'PCM' ? mathsQs : undefined,
          biology_questions: biologyQs.length > 0 && data.stream === 'PCB' ? biologyQs : undefined,
          weightage: data.subjectsConfig.reduce((acc, curr) => {
            acc[curr.subjectName] = curr.lessons.reduce((lessonAcc, lesson) => {
              lessonAcc[lesson.lessonName] = lesson.weightage;
              return lessonAcc;
            }, {} as Record<string, number>);
            return acc;
          }, {} as Record<string, Record<string, number>>)
        };
      }

      const result = await saveGeneratedTest(testToSave as GeneratedTest);

      if (result.success && result.test_code) {
        toast({ title: 'Test Created!', description: `Test "${testToSave.name}" (Code: ${result.test_code}) saved.` });
        form.reset({
            testType: data.testType, // Keep current test type
            testName: '', duration: 60, accessType: 'FREE', audience: null,
            subject: '', lessons: [], selectedQuestionIds: [], questionCount: 20,
            exam: 'MHT-CET', stream: undefined, overallTotalQuestions: 50, subjectsConfig: [],
        });
        setAvailableQuestions([]);
        setLessonsBySubject({});
      } else {
        throw new Error(result.message || "Failed to save test.");
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Creation Failed', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const totalAvailableCount = useMemo(() => availableQuestions.length, [availableQuestions]);
    
  const constructImagePathForPreview = (subject: string, lesson: string, filename: string | null | undefined): string | null => {
      if (!filename) return null;
      const basePath = '/question_bank_images'; 
      return `${basePath}/${encodeURIComponent(subject)}/${encodeURIComponent(lesson)}/images/${encodeURIComponent(filename)}`;
  };

  const renderQuestionPreview = (q: QuestionBankItem) => {
    const imagePath = constructImagePathForPreview(q.subject, q.lesson, q.question.image);
    if (q.type === 'image' && imagePath) {
        return (
            <span className="flex items-center gap-1 text-blue-600" title={`View Image: ${q.question.image}`}>
                <ImageIcon className="h-3 w-3"/>
                <span className="font-mono text-xs">({q.id})</span>
            </span>
        );
    }
    const text = q.question.text || '[No Text]';
    return (
        <span
            className="line-clamp-1"
            title={text}
            dangerouslySetInnerHTML={{ __html: text.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}
        />
    );
  }
  
  return (
    <>
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
                    <FormField
                        control={form.control}
                        name="testType"
                        render={({ field }) => (
                            <FormItem className="space-y-3">
                                <FormLabel className="text-lg font-semibold">Select Test Type *</FormLabel>
                                <FormControl>
                                    <RadioGroup
                                        onValueChange={(value) => {
                                            field.onChange(value);
                                            form.reset({ 
                                                ...form.getValues(), 
                                                testType: value as 'chapterwise' | 'full_length', 
                                                subject: '', lessons: [], selectedQuestionIds: [], questionCount: 20,
                                                exam: 'MHT-CET', stream: undefined, overallTotalQuestions: 50, subjectsConfig: [],
                                            });
                                            setAvailableQuestions([]);
                                            setLessonsBySubject({});
                                        }}
                                        value={field.value}
                                        className="flex space-x-4"
                                    >
                                        <FormItem className="flex items-center space-x-2">
                                            <FormControl><RadioGroupItem value="chapterwise" /></FormControl>
                                            <FormLabel className="font-normal">Chapterwise</FormLabel>
                                        </FormItem>
                                        <FormItem className="flex items-center space-x-2">
                                            <FormControl><RadioGroupItem value="full_length" /></FormControl>
                                            <FormLabel className="font-normal">Full-Length</FormLabel>
                                        </FormItem>
                                    </RadioGroup>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <Card>
                        <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="testName" render={({ field }) => (<FormItem><FormLabel>Test Name *</FormLabel><FormControl><Input {...field} placeholder="e.g., Physics Motion Test 1" /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="duration" render={({ field }) => (<FormItem><FormLabel>Duration (minutes) *</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value,10) || 0)} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="accessType" render={({ field }) => (<FormItem><FormLabel>Access Type *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select access type" /></SelectTrigger></FormControl><SelectContent>{pricingTypes.map(pt => <SelectItem key={pt} value={pt}>{pt.replace('_', ' ')}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="audience" render={({ field }) => (<FormItem><FormLabel>Target Audience</FormLabel><Select onValueChange={field.onChange} value={field.value || ""}><FormControl><SelectTrigger><SelectValue placeholder="Select audience" /></SelectTrigger></FormControl><SelectContent><SelectItem value="">Any</SelectItem>{audienceTypes.map(aud => <SelectItem key={aud} value={aud}>{aud}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        </CardContent>
                    </Card>
                    
                    {testType === 'chapterwise' && (
                        <Card>
                            <CardHeader><CardTitle>Chapterwise Setup</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <FormField control={form.control} name="subject" render={({ field }) => (<FormItem><FormLabel>Subject *</FormLabel><Select onValueChange={(val) => {field.onChange(val); form.setValue('lessons', []); setAvailableQuestions([]);}} value={field.value} disabled={isLoadingSubjects}><FormControl><SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger></FormControl><SelectContent>{dbSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                 <FormField
                                    control={form.control}
                                    name="lessons"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Lessons * (Select one or more)</FormLabel>
                                            {(isLoadingLessons[chapterwiseSubject as string] && chapterwiseSubject) ? <p className="text-sm text-muted-foreground">Loading lessons...</p> : !chapterwiseSubject ? <p className="text-sm text-muted-foreground">Select a subject first.</p> : (lessonsBySubject[chapterwiseSubject as string] || []).length === 0 ? <p className="text-sm text-muted-foreground">No lessons found for this subject.</p> : null}
                                            { (lessonsBySubject[chapterwiseSubject as string] || []).length > 0 &&
                                                <ScrollArea className="h-40 border rounded-md p-2">
                                                {lessonsBySubject[chapterwiseSubject as string]?.map(lesson => (
                                                    <FormItem key={lesson} className="flex flex-row items-center space-x-3 space-y-0 py-1">
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={field.value?.includes(lesson)}
                                                                onCheckedChange={(checked) => {
                                                                    return checked
                                                                    ? field.onChange([...(field.value || []), lesson])
                                                                    : field.onChange(field.value?.filter(value => value !== lesson))
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormLabel className="text-sm font-normal">{lesson}</FormLabel>
                                                    </FormItem>
                                                ))}
                                                </ScrollArea>
                                            }
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField control={form.control} name="questionCount" render={({ field }) => (<FormItem><FormLabel>Number of Questions to Select *</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value,10) || 0)} min="1" max={totalAvailableCount > 0 ? totalAvailableCount : 100} /></FormControl><FormDescription>{totalAvailableCount} questions available from selected lessons.</FormDescription><FormMessage /></FormItem>)} />
                                
                                {availableQuestions.length > 0 && (
                                    <div className="space-y-2">
                                        <Label>Select Questions ({form.watch('selectedQuestionIds')?.length || 0} / {form.watch('questionCount')}) *</Label>
                                        <ScrollArea className="h-64 border rounded-md p-2">
                                            {availableQuestions.map(q => (
                                                <FormField
                                                    key={q.id}
                                                    control={form.control}
                                                    name="selectedQuestionIds"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-2 hover:bg-muted/50 rounded">
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={field.value?.includes(q.id)}
                                                                    onCheckedChange={(checked) => {
                                                                        return checked
                                                                        ? field.onChange([...(field.value || []), q.id])
                                                                        : field.onChange(field.value?.filter(value => value !== q.id))
                                                                    }}
                                                                     disabled={(field.value?.length || 0) >= (form.getValues('questionCount') || 0) && !field.value?.includes(q.id)}
                                                                />
                                                            </FormControl>
                                                            <FormLabel className="text-sm font-normal flex-grow cursor-pointer" onClick={() => {setPreviewQuestion(q); setIsPreviewDialogOpen(true);}}>
                                                               {renderQuestionPreview(q)}
                                                               <Badge variant="outline" className="ml-2 text-xs">{q.difficulty}</Badge>
                                                            </FormLabel>
                                                        </FormItem>
                                                    )}
                                                />
                                            ))}
                                        </ScrollArea>
                                        <FormMessage>{form.formState.errors.selectedQuestionIds?.message}</FormMessage>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {testType === 'full_length' && (
                        <Card>
                            <CardHeader><CardTitle>Full-Length Setup</CardTitle></CardHeader>
                            <CardContent className="space-y-6">
                                <FormField control={form.control} name="exam" render={({ field }) => (<FormItem><FormLabel>Target Exam *</FormLabel><Select onValueChange={(val) => {field.onChange(val); form.setValue('stream', undefined);}} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Exam" /></SelectTrigger></FormControl><SelectContent>{allExams.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                {(fullLengthExam === 'MHT-CET' || fullLengthExam === 'KCET' || fullLengthExam === 'VITEEE' || fullLengthExam === 'CUET') && (
                                    <FormField control={form.control} name="stream" render={({ field }) => (<FormItem><FormLabel>Stream *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Stream" /></SelectTrigger></FormControl><SelectContent>{testStreams.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                )}
                                <FormField control={form.control} name="overallTotalQuestions" render={({ field }) => (<FormItem><FormLabel>Total Questions in Test *</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value,10) || 0)} min="10" max="200" /></FormControl><FormMessage /></FormItem>)} />
                                
                                <Separator/>
                                <h3 className="text-md font-semibold">Subject &amp; Lesson Weightages</h3>
                                {isLoadingLessons[(form.getValues('subjectsConfig')?.[0]?.subjectName as string)] && <p className="text-sm text-muted-foreground">Loading lessons for subjects...</p>}
                                {subjectConfigFields.map((subjectField, subjectIndex) => (
                                    <div key={subjectField.id} className="space-y-3 p-3 border rounded-md">
                                        <div className="flex justify-between items-center">
                                            <h4 className="font-medium text-primary">{subjectField.subjectName}</h4>
                                             <FormField
                                                control={form.control}
                                                name={`subjectsConfig.${subjectIndex}.totalSubjectWeightage`}
                                                render={({ field }) => (
                                                    <FormItem className="w-40">
                                                        <FormLabel className="text-xs">Overall %</FormLabel>
                                                        <FormControl><Input type="number" {...field} value={field.value || ''} onChange={e => field.onChange(parseInt(e.target.value,10) || 0)} min="0" max="100" className="h-8"/></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        {subjectField.lessons && subjectField.lessons.length > 0 && (
                                            <ScrollArea className="h-32 border rounded p-2 bg-muted/20">
                                                <FormDescription className="text-xs mb-2">Set lesson weightages for {subjectField.subjectName} (must sum to 100% if any are set).</FormDescription>
                                                {subjectField.lessons.map((lessonItem, lessonIndex) => (
                                                     <FormField
                                                        key={lessonItem.lessonName}
                                                        control={form.control}
                                                        name={`subjectsConfig.${subjectIndex}.lessons.${lessonIndex}.weightage`}
                                                        render={({ field: lessonWeightField }) => (
                                                            <FormItem className="flex items-center justify-between gap-2 py-1 text-xs">
                                                                <FormLabel className="truncate flex-1">{lessonItem.lessonName}</FormLabel>
                                                                <div className="w-28 flex items-center gap-1">
                                                                    <FormControl><Input type="number" {...lessonWeightField} value={lessonWeightField.value || ''} onChange={e => lessonWeightField.onChange(parseInt(e.target.value,10) || 0)} min="0" max="100" className="h-7 text-xs"/></FormControl>
                                                                    <span>%</span>
                                                                </div>
                                                            </FormItem>
                                                        )}
                                                    />
                                                ))}
                                            </ScrollArea>
                                        )}
                                        <p className="text-xs text-muted-foreground">Est. Questions for {subjectField.subjectName}: {form.watch(`subjectsConfig.${subjectIndex}.totalSubjectQuestions`)}</p>
                                        {form.formState.errors.subjectsConfig?.[subjectIndex]?.totalSubjectWeightage?.message && <FormMessage>{form.formState.errors.subjectsConfig?.[subjectIndex]?.totalSubjectWeightage?.message}</FormMessage>}
                                        {form.formState.errors.subjectsConfig?.[subjectIndex]?.lessons?.message && <FormMessage>{form.formState.errors.subjectsConfig?.[subjectIndex]?.lessons?.message}</FormMessage>}
                                    </div>
                                ))}
                                <FormMessage>{form.formState.errors.subjectsConfig?.root?.message || form.formState.errors.subjectsConfig?.message}</FormMessage>
                            </CardContent>
                        </Card>
                    )}

                    <CardFooter>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                            Create Test
                        </Button>
                    </CardFooter>
                </form>
            </Form>
            {previewQuestion && (
                <QuestionPreviewDialog
                    question={previewQuestion}
                    isOpen={isPreviewDialogOpen}
                    onClose={() => setIsPreviewDialogOpen(false)}
                    constructImagePath={constructImagePathForPreview}
                />
            )}
        </div>
    </>
  );
}
