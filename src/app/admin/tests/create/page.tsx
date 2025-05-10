// src/app/admin/tests/create/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback, ChangeEvent } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"; 
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2, Eye, ListFilter, Settings2, BookOpen, Brain, Sigma, FlaskConical, Atom, Leaf, Palette, FileText, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuestionBankItem, PricingType, ExamOption, TestStream, GeneratedTest, TestQuestion, AcademicStatus, ChapterwiseTestJson as ChapterwiseTestJsonType, FullLengthTestJson as FullLengthTestJsonType } from '@/types';
import { pricingTypes, academicStatuses as audienceTypes, testStreams, exams } from '@/types'; 
import { getSubjects, getLessonsForSubject, getQuestionsForLesson } from '@/actions/question-bank-query-actions';
import { saveGeneratedTest } from '@/actions/generated-test-actions';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Image from 'next/image';
import Script from 'next/script';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import QuestionPreviewDialog from '@/components/admin/question-preview-dialog';
import { Badge } from '@/components/ui/badge'; 

// --- Zod Schemas ---

// Base schema for common fields
const BaseTestSchema = z.object({
  testName: z.string().min(3, "Test Name must be at least 3 characters."),
  duration: z.coerce.number().min(1, "Duration must be at least 1 minute.").positive("Duration must be positive."),
  accessType: z.enum(pricingTypes, { required_error: "Access Type is required."}),
  audience: z.enum(audienceTypes).nullable().default(null),
});

const ChapterwiseSchema = BaseTestSchema.extend({
  testseriesType: z.literal('chapterwise'), // Renamed from testType
  subject: z.string().min(1, "Subject is required."),
  lessons: z.array(z.string()).min(1, "Select at least one lesson."),
  selectedQuestionIds: z.array(z.string()).min(1, "Select at least one question.").max(100, "Max 100 questions for chapterwise."),
  questionCount: z.coerce.number().min(1, "Min 1 question").max(100, "Max 100 questions for chapterwise."),
});

const SubjectConfigSchema = z.object({
  subjectName: z.string(),
  lessons: z.array(z.object({
    lessonName: z.string(),
    weightage: z.coerce.number().min(0).max(100).default(0),
    questionCount: z.coerce.number().min(0).default(0),
  })).default([]),
  totalSubjectWeightage: z.coerce.number().min(0).max(100).default(0),
  totalSubjectQuestions: z.coerce.number().min(0).default(0),
});
type SubjectConfigForm = z.infer<typeof SubjectConfigSchema>;


const FullLengthSchema = BaseTestSchema.extend({
  testseriesType: z.literal('full_length'), // Renamed from testType
  exam: z.enum(exams, { required_error: "Target Exam is required."}), 
  stream: z.enum(testStreams).optional().nullable().default(null),
  overallTotalQuestions: z.coerce.number().min(1, "Min 1 question.").max(200, "Max 200 questions."),
  subjectsConfig: z.array(SubjectConfigSchema).default([]),
}).superRefine((data, ctx) => {
    if (data.subjectsConfig && data.subjectsConfig.length > 0) {
        const totalWeightageSum = data.subjectsConfig.reduce((sum, subj) => sum + (subj.totalSubjectWeightage || 0), 0);
        if (Math.abs(totalWeightageSum - 100) >= 0.01 && totalWeightageSum !== 0 && totalWeightageSum !== 100) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Total subject weightages should ideally sum to 100% if any weightage is specified. Current sum: ${totalWeightageSum.toFixed(1)}%. If no weightage is set, questions are distributed equally.`,
                path: ['subjectsConfig'],
            });
        }
    }
    if (data.subjectsConfig) {
        data.subjectsConfig.forEach((subject, subjectIndex) => {
            if (subject.lessons && subject.lessons.length > 0 && subject.lessons.some((l) => (l.weightage || 0) > 0)) {
                const lessonWeightageSum = subject.lessons.reduce((sum, lesson) => sum + (lesson.weightage || 0), 0);
                if (Math.abs(lessonWeightageSum - 100) >= 0.01 && lessonWeightageSum !== 0 && lessonWeightageSum !== 100) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `Lesson weightages for ${subject.subjectName} should sum to 100% if any specific lesson weightage is set. Current sum: ${lessonWeightageSum.toFixed(1)}%. If not set, questions are distributed equally among selected lessons.`,
                        path: [`subjectsConfig`, subjectIndex, 'lessons'],
                    });
                }
            }
        });
    }
});

// Discriminated union schema
const TestCreationSchema = z.discriminatedUnion("testseriesType", [ // Renamed from testType
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
      testseriesType: 'chapterwise', // Renamed from testType
      testName: '',
      duration: 60,
      accessType: 'FREE',
      audience: null,
      // Chapterwise defaults
      subject: '',
      lessons: [],
      selectedQuestionIds: [],
      questionCount: 20,
      // FullLength defaults
      exam: 'MHT-CET',
      stream: null,
      overallTotalQuestions: 50,
      subjectsConfig: [],
    },
  });

  const { fields: subjectConfigFields, replace: replaceSubjectConfigs } = useFieldArray({
    control: form.control as any, 
    name: "subjectsConfig",
  });


  const testseriesType = form.watch('testseriesType'); // Renamed from testType
  const chapterwiseSubject = form.watch('subject' as 'subject');
  const chapterwiseLessons = form.watch('lessons' as 'lessons');
  const fullLengthExam = form.watch('exam' as 'exam');
  const fullLengthStream = form.watch('stream' as 'stream');
  const overallTotalQuestions = form.watch('overallTotalQuestions' as 'overallTotalQuestions');
  const subjectsConfigValues = form.watch('subjectsConfig' as 'subjectsConfig');


  const typesetMathJax = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).MathJax?.typesetPromise) {
      (window as any).MathJax.typesetPromise().catch((err: any) => console.error("MathJax typeset error:", err));
    }
  }, []);

  const handleMathJaxLoad = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).MathJax?.typesetPromise) {
      typesetMathJax();
    }
  }, [typesetMathJax]);

  useEffect(() => {
    setIsLoadingSubjects(true);
    getSubjects()
      .then(setDbSubjects)
      .catch(() => toast({ variant: 'destructive', title: 'Error', description: 'Could not load subjects.' }))
      .finally(() => setIsLoadingSubjects(false));
  }, [toast]);

  const fetchAllLessonsForSubject = useCallback(async (subject: string) => {
    if (lessonsBySubject[subject] || isLoadingLessons[subject]) return;

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
  }, [toast, lessonsBySubject, isLoadingLessons]);

  useEffect(() => {
    if (testseriesType === 'chapterwise' && chapterwiseSubject) { // Renamed from testType
        fetchAllLessonsForSubject(chapterwiseSubject);
    } else if (testseriesType === 'full_length' && fullLengthExam) { // Renamed from testType
        const subjectsForExam = examSubjectMap[fullLengthExam as ExamOption] || [];
        subjectsForExam.forEach(sub => {
           if(dbSubjects.includes(sub)) fetchAllLessonsForSubject(sub);
        });
    }
  }, [testseriesType, chapterwiseSubject, fullLengthExam, dbSubjects, fetchAllLessonsForSubject]); // Renamed from testType

  useEffect(() => {
    if (testseriesType === 'full_length' && fullLengthExam) { // Renamed from testType
      let subjectsForStream = examSubjectMap[fullLengthExam as ExamOption] || [];
      if ((fullLengthExam === 'MHT-CET' || fullLengthExam === 'KCET' || fullLengthExam === 'VITEEE' || fullLengthExam === 'CUET') && fullLengthStream) {
        if (fullLengthStream === 'PCM') {
          subjectsForStream = subjectsForStream.filter(s => s !== 'Biology' && s !== 'English Proficiency' && s !== 'Logical Reasoning' && s !== 'English');
        } else if (fullLengthStream === 'PCB') {
          subjectsForStream = subjectsForStream.filter(s => !['Mathematics', 'English Proficiency', 'Logical Reasoning', 'English'].includes(s));
        }
      } else if (fullLengthExam === 'BITSAT') {
         subjectsForStream = ["Physics", "Chemistry", "Mathematics", "English Proficiency", "Logical Reasoning"];
      }

      const currentConfigs = form.getValues('subjectsConfig' as any) || [];
      const newConfigs: SubjectConfigForm[] = subjectsForStream
        .filter(subjectName => dbSubjects.includes(subjectName))
        .map((subjectName): SubjectConfigForm => {
            const existingConfig = currentConfigs.find((sc: SubjectConfigForm) => sc.subjectName === subjectName);
            return {
            subjectName,
            lessons: (lessonsBySubject[subjectName] || []).map(ln => ({ lessonName: ln, weightage: 0, questionCount:0 })),
            totalSubjectWeightage: existingConfig?.totalSubjectWeightage || 0,
            totalSubjectQuestions: existingConfig?.totalSubjectQuestions || 0,
            };
      });
      replaceSubjectConfigs(newConfigs);
    } else {
      replaceSubjectConfigs([]);
    }
  }, [testseriesType, fullLengthExam, fullLengthStream, lessonsBySubject, dbSubjects, replaceSubjectConfigs, form]); // Renamed from testType


  useEffect(() => {
    if (testseriesType === 'full_length' && subjectsConfigValues && subjectsConfigValues.length > 0 && overallTotalQuestions && overallTotalQuestions > 0) { // Renamed from testType
        const totalWeightageSum = subjectsConfigValues.reduce((sum: number, config: SubjectConfigForm) => sum + (config.totalSubjectWeightage || 0), 0);

        let distributedQuestionsSum = 0;
        const newConfigs = subjectsConfigValues.map((config: SubjectConfigForm, subjectIndex: number) => {
            let questionsForSubject = 0;
            if (totalWeightageSum > 0 && (config.totalSubjectWeightage || 0) > 0) {
                 questionsForSubject = Math.round(((config.totalSubjectWeightage || 0) / totalWeightageSum) * overallTotalQuestions);
            } else if (totalWeightageSum === 0 && subjectsConfigValues.length > 0) {
                questionsForSubject = Math.floor(overallTotalQuestions / subjectsConfigValues.length);
            }

            form.setValue(`subjectsConfig.${subjectIndex}.totalSubjectQuestions` as any, questionsForSubject);
            distributedQuestionsSum += questionsForSubject;

            let lessonsQuestionsSumInSubject = 0;
            if (config.lessons && config.lessons.length > 0 && questionsForSubject > 0) {
                const totalLessonWeightage = config.lessons.reduce((s: number, l: any) => s + (l.weightage || 0), 0);
                if (totalLessonWeightage > 0) {
                    config.lessons.forEach((lesson: any, lessonIndex: number) => {
                        const lessonProportion = (lesson.weightage || 0) / totalLessonWeightage;
                        const questionsForLesson = Math.round(questionsForSubject * lessonProportion);
                        form.setValue(`subjectsConfig.${subjectIndex}.lessons.${lessonIndex}.questionCount` as any, questionsForLesson);
                        lessonsQuestionsSumInSubject += questionsForLesson;
                    });
                } else {
                     const questionsPerLesson = Math.floor(questionsForSubject / config.lessons.length);
                     let remainder = questionsForSubject % config.lessons.length;
                     config.lessons.forEach((lesson: any, lessonIndex: number) => {
                         let qCount = questionsPerLesson + (remainder > 0 ? 1 : 0);
                         form.setValue(`subjectsConfig.${subjectIndex}.lessons.${lessonIndex}.questionCount` as any, qCount);
                         lessonsQuestionsSumInSubject += qCount;
                         if (remainder > 0) remainder--;
                     });
                }

                 if (lessonsQuestionsSumInSubject !== questionsForSubject && config.lessons.length > 0) {
                     const diff = questionsForSubject - lessonsQuestionsSumInSubject;
                     const lastLessonIdx = config.lessons.length -1;
                     const currentVal = form.getValues(`subjectsConfig.${subjectIndex}.lessons.${lastLessonIdx}.questionCount` as any);
                     form.setValue(`subjectsConfig.${subjectIndex}.lessons.${lastLessonIdx}.questionCount` as any, Math.max(0, (currentVal || 0) + diff));
                 }
            }
            return { ...config, totalSubjectQuestions: questionsForSubject };
        });

        if (distributedQuestionsSum !== overallTotalQuestions && newConfigs.length > 0) {
            const diff = overallTotalQuestions - distributedQuestionsSum;
            const lastConfigIndex = newConfigs.length - 1;
            const currentTotal = form.getValues(`subjectsConfig.${lastConfigIndex}.totalSubjectQuestions` as any);
            form.setValue(`subjectsConfig.${lastConfigIndex}.totalSubjectQuestions` as any, Math.max(0, (currentTotal || 0) + diff));

             const lastSubjectConfig = form.getValues(`subjectsConfig.${lastConfigIndex}` as any);
             if (lastSubjectConfig && lastSubjectConfig.lessons && lastSubjectConfig.lessons.length > 0) {
                const questionsForLastSubject = form.getValues(`subjectsConfig.${lastConfigIndex}.totalSubjectQuestions` as any) || 0;
                 const questionsPerLesson = Math.floor(questionsForLastSubject / lastSubjectConfig.lessons.length);
                 let remainder = questionsForLastSubject % lastSubjectConfig.lessons.length;
                 lastSubjectConfig.lessons.forEach((_: any, lessonIdx: number) => {
                     let qCount = questionsPerLesson + (remainder > 0 ? 1 : 0);
                     form.setValue(`subjectsConfig.${lastConfigIndex}.lessons.${lessonIdx}.questionCount` as any, qCount);
                     if (remainder > 0) remainder--;
                 });
             }
        }
    }
  }, [overallTotalQuestions, subjectsConfigValues, testseriesType, form]); // Renamed from testType


  useEffect(() => {
    if (testseriesType === 'chapterwise' && chapterwiseSubject && chapterwiseLessons && chapterwiseLessons.length > 0) { // Renamed from testType
      setIsLoadingQuestions(true);
      Promise.all(
        chapterwiseLessons.map((lesson: string) => getQuestionsForLesson({ subject: chapterwiseSubject, lesson }))
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
  }, [testseriesType, chapterwiseSubject, chapterwiseLessons, toast, typesetMathJax]); // Renamed from testType

  const constructPublicImagePath = (subject: string, lesson: string, filename: string | null | undefined): string | null => {
      if (!filename) return null;
      const basePath = '/question_bank_images';
      return `${basePath}/${encodeURIComponent(subject)}/${encodeURIComponent(lesson)}/images/${encodeURIComponent(filename)}`;
  };


  const onSubmit = async (data: TestCreationFormValues) => {
    setIsLoading(true);
    let testToSave: Omit<GeneratedTest, 'test_code' | 'createdAt'>;

    try {
      const finalAudience = data.audience === "_any_" ? null : data.audience;

      if (data.testseriesType === 'chapterwise') { // Renamed from testType
        const chapterwiseData = data;
        if (chapterwiseData.selectedQuestionIds.length !== chapterwiseData.questionCount) {
            toast({variant: 'destructive', title: 'Question Count Mismatch', description: `Please select exactly ${chapterwiseData.questionCount} questions.`});
            setIsLoading(false);
            return;
        }
        const selectedFullQuestions = availableQuestions.filter(q => chapterwiseData.selectedQuestionIds.includes(q.id));

        if (selectedFullQuestions.length !== chapterwiseData.questionCount) {
            toast({variant: 'destructive', title: 'Error', description: 'Could not find all selected questions. Please re-select.'});
            setIsLoading(false);
            return;
        }

        const finalQuestions: TestQuestion[] = selectedFullQuestions.map(q => ({
            id: q.id,
            type: q.type,
            question_text: q.question.text,
            question_image_url: q.question.image ? constructPublicImagePath(q.subject, q.lesson, q.question.image) : null,
            options: [q.options.A, q.options.B, q.options.C, q.options.D],
            answer: q.correct,
            marks: q.marks,
            explanation_text: q.explanation.text,
            explanation_image_url: q.explanation.image ? constructPublicImagePath(q.subject, q.lesson, q.explanation.image) : null,
        }));

        testToSave = {
          testseriesType: 'chapterwise', // Renamed from testType
          name: chapterwiseData.testName,
          duration: chapterwiseData.duration,
          total_questions: chapterwiseData.questionCount,
          type: chapterwiseData.accessType,
          audience: finalAudience,
          test_subject: [chapterwiseData.subject],
          lessons: chapterwiseData.lessons,
          lesson: chapterwiseData.lessons.length === 1 ? chapterwiseData.lessons[0] : chapterwiseData.lessons.join(', '),
          questions: finalQuestions,
        } as Omit<ChapterwiseTestJsonType, 'test_code' | 'createdAt'>;

      } else { // FullLength
        const fullLengthData = data;
        let allSelectedQuestionsForFLT: TestQuestion[] = [];
        let physicsQs: TestQuestion[] = [];
        let chemistryQs: TestQuestion[] = [];
        let mathsQs: TestQuestion[] = [];
        let biologyQs: TestQuestion[] = [];

        if (fullLengthData.subjectsConfig) {
            for (const subjectConfig of fullLengthData.subjectsConfig) {
                if (subjectConfig.lessons) {
                    for (const lessonConfig of subjectConfig.lessons) {
                        if (lessonConfig.questionCount > 0) {
                            const questionsFromBank = await getQuestionsForLesson({ subject: subjectConfig.subjectName, lesson: lessonConfig.lessonName });
                            const shuffled = [...questionsFromBank].sort(() => 0.5 - Math.random());
                            const selected = shuffled.slice(0, lessonConfig.questionCount).map(q => ({
                                id: q.id, type: q.type, question_text: q.question.text, question_image_url: q.question.image ? constructPublicImagePath(q.subject, q.lesson, q.question.image) : null,
                                options: [q.options.A, q.options.B, q.options.C, q.options.D], answer: q.correct, marks: q.marks, explanation_text: q.explanation.text,
                                explanation_image_url: q.explanation.image ? constructPublicImagePath(q.subject, q.lesson, q.explanation.image) : null,
                            }));

                            if (subjectConfig.subjectName.toLowerCase() === 'physics') physicsQs.push(...selected);
                            else if (subjectConfig.subjectName.toLowerCase() === 'chemistry') chemistryQs.push(...selected);
                            else if (subjectConfig.subjectName.toLowerCase() === 'mathematics') mathsQs.push(...selected);
                            else if (subjectConfig.subjectName.toLowerCase() === 'biology') biologyQs.push(...selected);
                            allSelectedQuestionsForFLT.push(...selected);
                        }
                    }
                }
            }
        }

        if (allSelectedQuestionsForFLT.length !== fullLengthData.overallTotalQuestions) {
            console.warn(`Actual questions selected (${allSelectedQuestionsForFLT.length}) for FLT does not match target (${fullLengthData.overallTotalQuestions}). Check question availability and distribution logic.`);
            toast({
                variant: 'destructive',
                title: 'Question Count Discrepancy',
                description: `Generated ${allSelectedQuestionsForFLT.length} questions for the Full-Length test, but expected ${fullLengthData.overallTotalQuestions}. This might be due to insufficient questions in the bank for the selected criteria. The test will be saved with the available questions.`,
                duration: 10000
            });
        }

        testToSave = {
          testseriesType: 'full_length', // Renamed from testType
          name: fullLengthData.testName,
          duration: fullLengthData.duration,
          total_questions: allSelectedQuestionsForFLT.length,
          type: fullLengthData.accessType,
          audience: finalAudience,
          test_subject: fullLengthData.subjectsConfig?.map((s: SubjectConfigForm) => s.subjectName) || [],
          stream: fullLengthData.stream!,
          examTypeTarget: fullLengthData.exam,
          physics_questions: physicsQs.length > 0 ? physicsQs : undefined,
          chemistry_questions: chemistryQs.length > 0 ? chemistryQs : undefined,
          maths_questions: mathsQs.length > 0 && (fullLengthData.stream === 'PCM' || fullLengthData.exam === 'BITSAT') ? mathsQs : undefined,
          biology_questions: biologyQs.length > 0 && fullLengthData.stream === 'PCB' ? biologyQs : undefined,
          weightage: fullLengthData.subjectsConfig?.reduce((acc: Record<string, Record<string, number>>, curr: SubjectConfigForm) => {
            if (curr.lessons) {
                 acc[curr.subjectName] = curr.lessons.reduce((lessonAcc: Record<string, number>, lesson: any) => {
                    lessonAcc[lesson.lessonName] = lesson.weightage || 0;
                    return lessonAcc;
                }, {} as Record<string, number>);
            }
            return acc;
          }, {} as Record<string, Record<string, number>>)
        } as Omit<FullLengthTestJsonType, 'test_code' | 'createdAt'>;
      }

      const result = await saveGeneratedTest(testToSave as Omit<GeneratedTest, 'test_code' | 'createdAt'>);

      if (result.success && result.test_code) {
        toast({ title: 'Test Created!', description: `Test "${testToSave.name}" (Code: ${result.test_code}) saved successfully.` });
        form.reset({
            testseriesType: data.testseriesType, // Renamed from testType
            testName: '', duration: 60, accessType: 'FREE', audience: null,
            subject: '', lessons: [], selectedQuestionIds: [], questionCount: 20,
            exam: 'MHT-CET', stream: null, overallTotalQuestions: 50, subjectsConfig: [],
        });
        setAvailableQuestions([]);
        setLessonsBySubject({});
      } else {
        throw new Error(result.message || "Failed to save test definition.");
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Creation Failed', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const totalAvailableCount = useMemo(() => availableQuestions.length, [availableQuestions]);

  const renderQuestionPreviewItem = (q: QuestionBankItem) => {
    const imagePath = constructPublicImagePath(q.subject, q.lesson, q.question.image);
    if (q.type === 'image' && imagePath) {
        return (
            <span className="flex items-center gap-1 text-blue-600" title={`Image Question: ${q.id}`}>
                <ImageIcon className="h-3 w-3"/>
                <span className="font-mono text-xs">({q.id})</span>
            </span>
        );
    }
    const text = q.question.text || '[No Text]';
    return (
        <span
            className="line-clamp-1 mathjax-content"
            title={text}
            dangerouslySetInnerHTML={{ __html: text.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}
        />
    );
  };

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
                        name="testseriesType" // Renamed from testType
                        render={({ field }) => (
                            <FormItem className="space-y-3">
                                <FormLabel className="text-lg font-semibold">Select Test Type *</FormLabel>
                                <FormControl>
                                    <RadioGroup
                                        onValueChange={(value) => {
                                            const newTestType = value as 'chapterwise' | 'full_length';
                                            field.onChange(newTestType);

                                            form.reset((prev) => {
                                                const baseDefaults = {
                                                    testseriesType: newTestType, // Renamed from testType
                                                    testName: '',
                                                    duration: 60,
                                                    accessType: 'FREE' as PricingType,
                                                    audience: null as AcademicStatus | null,
                                                };
                                                if (newTestType === 'chapterwise') {
                                                    return {
                                                        ...baseDefaults,
                                                        subject: (prev as TestCreationFormValues).subject || '',
                                                        lessons: (prev as TestCreationFormValues).lessons || [],
                                                        selectedQuestionIds: [],
                                                        questionCount: 20,
                                                    };
                                                } else { // full_length
                                                    return {
                                                        ...baseDefaults,
                                                        exam: (prev as TestCreationFormValues).exam || 'MHT-CET',
                                                        stream: (prev as TestCreationFormValues).stream || null,
                                                        overallTotalQuestions: 50,
                                                        subjectsConfig: [],
                                                    };
                                                }
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
                            <FormField control={form.control} name="audience" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Target Audience</FormLabel>
                                    <Select
                                        onValueChange={(value: string) => field.onChange(value === '_any_' ? null : value as AcademicStatus | null)}
                                        value={(field.value as string | null) === null ? '_any_' : field.value || "_any_"}
                                    >
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select audience" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="_any_">Any</SelectItem>
                                        {audienceTypes.map(aud => <SelectItem key={aud} value={aud}>{aud}</SelectItem>)}
                                    </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </CardContent>
                    </Card>

                    {testseriesType === 'chapterwise' && (form.getValues('testseriesType') === 'chapterwise') && ( // Renamed from testType
                        <Card>
                            <CardHeader><CardTitle>Chapterwise Setup</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <FormField control={form.control} name="subject" render={({ field }) => (<FormItem><FormLabel>Subject *</FormLabel><Select onValueChange={(val) => {field.onChange(val); form.setValue('lessons', []); setAvailableQuestions([]);}} value={field.value || ''} disabled={isLoadingSubjects}><FormControl><SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger></FormControl><SelectContent>{dbSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                 <FormField
                                    control={form.control}
                                    name="lessons"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Lessons * (Select one or more)</FormLabel>
                                            {(isLoadingLessons[chapterwiseSubject as string] && chapterwiseSubject) ? <p className="text-sm text-muted-foreground">Loading lessons...</p> : !chapterwiseSubject ? <p className="text-sm text-muted-foreground">Select a subject first.</p> : (lessonsBySubject[chapterwiseSubject as string] || []).length === 0 ? <p className="text-sm text-muted-foreground">No lessons found for this subject.</p> : null}
                                            { chapterwiseSubject && (lessonsBySubject[chapterwiseSubject as string] || []).length > 0 &&
                                                <ScrollArea className="h-40 border rounded-md p-2">
                                                {(lessonsBySubject[chapterwiseSubject as string] || []).map(lesson => (
                                                    <FormItem key={lesson} className="flex flex-row items-center space-x-3 space-y-0 py-1">
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={(field.value)?.includes(lesson)}
                                                                onCheckedChange={(checked) => {
                                                                    return checked
                                                                    ? field.onChange([...(field.value || []), lesson])
                                                                    : field.onChange((field.value)?.filter(value => value !== lesson))
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
                                <FormField control={form.control} name="questionCount" render={({ field }) => (<FormItem><FormLabel>Number of Questions to Select *</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value,10) || 0)} min="1" max={totalAvailableCount > 0 ? totalAvailableCount : 100} /></FormControl><FormMessage>{(form.formState.errors.questionCount as any)?.message || `Selected ${form.watch('selectedQuestionIds')?.length || 0} of ${form.getValues('questionCount') || 0}. Available: ${totalAvailableCount}`}</FormMessage></FormItem>)} />

                                {availableQuestions.length > 0 && (
                                    <div className="space-y-2">
                                        <Label>Select Questions ({form.watch('selectedQuestionIds')?.length || 0} / {form.watch('questionCount') || 0}) *</Label>
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
                                                                    checked={(field.value)?.includes(q.id)}
                                                                    onCheckedChange={(checked) => {
                                                                        return checked
                                                                        ? field.onChange([...(field.value || []), q.id])
                                                                        : field.onChange((field.value)?.filter(value => value !== q.id))
                                                                    }}
                                                                     disabled={((field.value)?.length || 0) >= (form.getValues('questionCount') || 0) && !(field.value)?.includes(q.id)}
                                                                />
                                                            </FormControl>
                                                            <FormLabel className="text-sm font-normal flex-grow cursor-pointer" onClick={() => {setPreviewQuestion(q); setIsPreviewDialogOpen(true);}}>
                                                               {renderQuestionPreviewItem(q)}
                                                               <Badge variant="outline" className="ml-2 text-xs">{q.difficulty}</Badge>
                                                            </FormLabel>
                                                        </FormItem>
                                                    )}
                                                />
                                            ))}
                                        </ScrollArea>
                                        <FormMessage>{(form.formState.errors.selectedQuestionIds as any)?.message as React.ReactNode}</FormMessage>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {testseriesType === 'full_length' && (form.getValues('testseriesType') === 'full_length') && ( // Renamed from testType
                        <Card>
                            <CardHeader><CardTitle>Full-Length Setup</CardTitle></CardHeader>
                            <CardContent className="space-y-6">
                                <FormField control={form.control} name="exam" render={({ field }) => (<FormItem><FormLabel>Target Exam *</FormLabel><Select onValueChange={(val: string) => {field.onChange(val as ExamOption); form.setValue('stream' as any, null);}} value={field.value || 'MHT-CET'}><FormControl><SelectTrigger><SelectValue placeholder="Select Exam" /></SelectTrigger></FormControl><SelectContent>{exams.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                {(fullLengthExam === 'MHT-CET' || fullLengthExam === 'KCET' || fullLengthExam === 'VITEEE' || fullLengthExam === 'CUET') && (
                                    <FormField control={form.control} name="stream" render={({ field }) => (<FormItem><FormLabel>Stream *</FormLabel><Select onValueChange={field.onChange} value={field.value || undefined}><FormControl><SelectTrigger><SelectValue placeholder="Select Stream" /></SelectTrigger></FormControl><SelectContent>{testStreams.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                )}
                                <FormField control={form.control} name="overallTotalQuestions" render={({ field }) => (<FormItem><FormLabel>Total Questions in Test *</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value,10) || 0)} min="1" max="200" /></FormControl><FormMessage /></FormItem>)} />

                                <Separator/>
                                <h3 className="text-md font-semibold">Subject &amp; Lesson Weightages</h3>
                                {isLoadingSubjects && <p className="text-sm text-muted-foreground">Loading subjects and lessons...</p>}
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
                                                <FormDescription className="text-xs px-1 pb-1">Set lesson weightages for {subjectField.subjectName} (must sum to 100% if used). If not set, questions are picked equally.</FormDescription>
                                                {subjectField.lessons.map((lessonItem: any, lessonIndex: number) => (
                                                     <FormField
                                                        key={`${subjectField.subjectName}-${lessonItem.lessonName}-${lessonIndex}`}
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
                                        <p className="text-xs text-muted-foreground">Est. Questions for {subjectField.subjectName}: {form.watch(`subjectsConfig.${subjectIndex}.totalSubjectQuestions` as any)}</p>
                                        <FormMessage>{(form.formState.errors.subjectsConfig as any)?.[subjectIndex]?.totalSubjectWeightage?.message as React.ReactNode}</FormMessage>
                                        <FormMessage>{(form.formState.errors.subjectsConfig as any)?.[subjectIndex]?.lessons?.message as React.ReactNode}</FormMessage>
                                    </div>
                                ))}
                                <FormMessage>{(form.formState.errors.subjectsConfig as any)?.message as React.ReactNode}</FormMessage>
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
                    constructImagePath={constructPublicImagePath}
                />
            )}
        </div>
    </>
  );
}
