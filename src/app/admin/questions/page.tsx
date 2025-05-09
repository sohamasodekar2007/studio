// src/app/admin/questions/page.tsx
'use client';

import React from 'react';
import { useState, useRef, type ChangeEvent, useEffect, useCallback } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from '@/hooks/use-toast';
import { ClipboardList, Loader2, ImagePlus, X, FileText, Upload, ClipboardPaste, Check, ChevronsUpDown, CalendarIcon, TagIcon, FileJson, FileUp, AlignLeft, FileType, Eye } from "lucide-react";
import {
    type QuestionBankItem, questionTypes, difficultyLevels, exams, classLevels, type QuestionType,
    pyqShifts, type PyqShift, type ExamOption
} from '@/types';
import Image from 'next/image';
import { addQuestionToBank, addBulkQuestionsToBank } from '@/actions/question-bank-actions';
import { getSubjects, getLessonsForSubject } from '@/actions/question-bank-query-actions';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import Script from 'next/script';
import JsonEditorDialog from '@/components/admin/json-editor-dialog'; // Import the new dialog

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ACCEPTED_JSON_TYPE = "application/json";

const singleQuestionSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  class: z.enum(classLevels, { required_error: "Class is required" }),
  lesson: z.string().min(1, "Lesson name is required"),
  examType: z.enum(exams, { required_error: "Primary exam type is required" }),
  difficulty: z.enum(difficultyLevels, { required_error: "Difficulty level is required" }),
  tags: z.string().optional(),
  questionType: z.enum(questionTypes, { required_error: "Question type is required" }),
  questionText: z.string().optional(),
  optionA: z.string().optional(),
  optionB: z.string().optional(),
  optionC: z.string().optional(),
  optionD: z.string().optional(),
  questionImage: z.any().optional(),
  correctAnswer: z.enum(["A", "B", "C", "D"], { required_error: "Correct answer is required" }),
  explanationText: z.string().optional(),
  explanationImage: z.any().optional(),
  marks: z.number().min(1, "Marks must be at least 1.").positive("Marks must be positive."),
  isPyq: z.boolean().default(false).optional(),
  pyqExam: z.enum(exams).optional(),
  pyqDate: z.date().optional().nullable(),
  pyqShift: z.enum(pyqShifts).optional(),
}).refine(data => {
  if (data.questionType === 'text') {
    return !!data.questionText && !!data.optionA && !!data.optionB && !!data.optionC && !!data.optionD;
  }
  return true;
}, {
  message: "Question text and all four options are required for Text Questions.",
  path: ["questionText"],
}).refine(data => {
  if (data.questionType === 'image') {
    return !!data.questionImage;
  }
  return true;
}, {
  message: "Question image is required for Image Questions.",
  path: ["questionImage"],
}).refine(data => {
  if (data.questionImage && data.questionImage instanceof File) {
    if (data.questionImage.size > MAX_FILE_SIZE) return false;
    if (!ACCEPTED_IMAGE_TYPES.includes(data.questionImage.type)) return false;
  }
  return true;
}, {
  message: `Question image must be a valid image file (JPG, PNG, WEBP) and less than ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
  path: ["questionImage"],
}).refine(data => {
  if (data.explanationImage && data.explanationImage instanceof File) {
    if (data.explanationImage.size > MAX_FILE_SIZE) return false;
    if (!ACCEPTED_IMAGE_TYPES.includes(data.explanationImage.type)) return false;
  }
  return true;
}, {
  message: `Explanation image must be a valid image file (JPG, PNG, WEBP) and less than ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
  path: ["explanationImage"],
}).refine(data => {
  if (data.isPyq) {
    return !!data.pyqExam && !!data.pyqDate && !!data.pyqShift;
  }
  return true;
}, {
  message: "Exam, Date, and Shift are required for PYQ.",
  path: ["pyqExam"],
});

type SingleQuestionFormValues = z.infer<typeof singleQuestionSchema>;

const bulkUploadSchema = z.object({
    subject: z.string().min(1, "Subject is required"),
    lesson: z.string().min(1, "Lesson name is required (can be new)"),
    examType: z.enum(exams, { required_error: "Default exam type for questions in file is required" }),
    jsonFile: z.any().optional(), // File input is optional
    // jsonInputText: z.string().optional(), // We'll handle this via component state and logic, not directly in Zod for now
    isAllPyq: z.boolean().default(false).optional(),
    pyqExamForAll: z.enum(exams).optional(),
    pyqYearForAll: z.string().optional().refine(year => !year || /^\d{4}$/.test(year), "Invalid year format (YYYY)."),
});
type BulkUploadFormValues = z.infer<typeof bulkUploadSchema>;


export default function AdminQuestionBankPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [lessons, setLessons] = useState<string[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);

  const [questionImagePreview, setQuestionImagePreview] = useState<string | null>(null);
  const [explanationImagePreview, setExplanationImagePreview] = useState<string | null>(null);

  const questionFileInputRef = useRef<HTMLInputElement>(null);
  const explanationFileInputRef = useRef<HTMLInputElement>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const [lessonPopoverOpen, setLessonPopoverOpen] = useState(false);
  const [bulkLessonPopoverOpen, setBulkLessonPopoverOpen] = useState(false);

  const [uploadMode, setUploadMode] = useState<'single' | 'bulk'>('single');
  const [jsonInputText, setJsonInputText] = useState(''); // State for JSON textarea
  
  const [isJsonEditorOpen, setIsJsonEditorOpen] = useState(false);
  const [sampleJsonContent, setSampleJsonContent] = useState('');
  const [isLoadingSampleJson, setIsLoadingSampleJson] = useState(false);

  const singleForm = useForm<SingleQuestionFormValues>({
    resolver: zodResolver(singleQuestionSchema),
    defaultValues: {
      subject: '', class: undefined, lesson: '', examType: undefined, difficulty: undefined, tags: '',
      questionType: 'text', questionText: '', optionA: '', optionB: '', optionC: '', optionD: '',
      questionImage: null, correctAnswer: undefined, explanationText: '', explanationImage: null,
      marks: 1, isPyq: false, pyqExam: undefined, pyqDate: null, pyqShift: undefined,
    },
  });

  const bulkForm = useForm<BulkUploadFormValues>({
    resolver: zodResolver(bulkUploadSchema),
    defaultValues: {
        subject: '', lesson: '', examType: undefined, jsonFile: null,
        isAllPyq: false, pyqExamForAll: undefined, pyqYearForAll: '',
    }
  });

  const questionType = singleForm.watch('questionType');
  const selectedSubject = singleForm.watch('subject');
  const isPyqChecked = useWatch({ control: singleForm.control, name: "isPyq" });
  const questionTextContent = singleForm.watch('questionText');
  const explanationTextContent = singleForm.watch('explanationText');

  const bulkSelectedSubject = bulkForm.watch('subject');
  const isBulkPyqChecked = bulkForm.watch('isAllPyq');


  const typesetMathJax = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).MathJax && typeof (window as any).MathJax.typesetPromise === 'function') {
      const elements = document.querySelectorAll('.mathjax-live-preview');
      if (elements.length > 0) {
        (window as any).MathJax.typesetPromise(Array.from(elements))
          .catch((err: any) => console.error("MathJax typeset error (live-preview):", err));
      }
    }
  }, []);

  useEffect(() => {
    const timerId = setTimeout(() => typesetMathJax(), 50);
    return () => clearTimeout(timerId);
  }, [questionTextContent, explanationTextContent, typesetMathJax]);

  useEffect(() => {
    setIsLoadingSubjects(true);
    getSubjects()
      .then(fetchedSubjects => {
        const coreSubjects = ["Physics", "Chemistry", "Mathematics", "Biology"]; // Added Maths and Bio
        const allSubjectsSet = new Set([...fetchedSubjects, ...coreSubjects]);
        setSubjects(Array.from(allSubjectsSet).sort());
      })
      .catch(err => toast({ variant: "destructive", title: "Error", description: "Could not load subjects." }))
      .finally(() => setIsLoadingSubjects(false));
  }, [toast]);

  const fetchLessonsForSubject = useCallback((subjectValue: string, formInstance: typeof singleForm | typeof bulkForm) => {
    if (subjectValue) {
        setIsLoadingLessons(true);
        setLessons([]);
        formInstance.setValue('lesson', '');
        getLessonsForSubject(subjectValue)
            .then(setLessons)
            .catch(err => toast({ variant: "destructive", title: "Error", description: `Could not load lessons for ${subjectValue}.` }))
            .finally(() => setIsLoadingLessons(false));
    } else {
        setLessons([]);
    }
  }, [toast]);

  useEffect(() => {
    if (uploadMode === 'single' && selectedSubject) {
        fetchLessonsForSubject(selectedSubject, singleForm);
    } else if (uploadMode === 'bulk' && bulkSelectedSubject) {
        fetchLessonsForSubject(bulkSelectedSubject, bulkForm);
    } else {
        setLessons([]);
    }
  }, [selectedSubject, bulkSelectedSubject, uploadMode, fetchLessonsForSubject, singleForm, bulkForm]);


  const processImageFile = useCallback((
    file: File | null,
    fieldName: 'questionImage' | 'explanationImage',
    setPreview: (url: string | null) => void
  ) => {
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        singleForm.setError(fieldName, { type: 'manual', message: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit.` });
        setPreview(null);
        return false;
      }
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        singleForm.setError(fieldName, { type: 'manual', message: 'Invalid file type. Use JPG, PNG, or WEBP.' });
        setPreview(null);
        return false;
      }
      singleForm.clearErrors(fieldName);
      singleForm.setValue(fieldName, file);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
      return true;
    } else {
      singleForm.setValue(fieldName, null);
      setPreview(null);
      return false;
    }
  }, [singleForm]);

  const handleFileChange = useCallback((
    event: ChangeEvent<HTMLInputElement>,
    fieldName: 'questionImage' | 'explanationImage',
    setPreview: (url: string | null) => void
  ) => {
    const file = event.target.files?.[0] || null;
    processImageFile(file, fieldName, setPreview);
    if (event.target) {
      event.target.value = "";
    }
  }, [processImageFile]);

  const removeImage = useCallback((
    fieldName: 'questionImage' | 'explanationImage',
    setPreview: (url: string | null) => void,
    fileInputRef: React.RefObject<HTMLInputElement>
  ) => {
    singleForm.setValue(fieldName, null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    singleForm.clearErrors(fieldName);
  }, [singleForm]);

  const handlePasteImage = useCallback(async (
    fieldName: 'questionImage' | 'explanationImage',
    setPreview: (url: string | null) => void
  ) => {
    if (!navigator.clipboard?.read) {
      toast({ variant: "destructive", title: "Clipboard API Not Supported", description: "Pasting images is not supported in your browser." });
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      let imageBlob: Blob | null = null;
      for (const item of items) {
        const imageType = item.types.find(type => type.startsWith('image/'));
        if (imageType) {
          imageBlob = await item.getType(imageType);
          break;
        }
      }
      if (imageBlob) {
        const timestamp = Date.now();
        const fileExtension = imageBlob.type.split('/')[1] || 'png';
        const fileName = `pasted_image_${timestamp}.${fileExtension}`;
        const imageFile = new File([imageBlob], fileName, { type: imageBlob.type });
        const success = processImageFile(imageFile, fieldName, setPreview);
        if (success) {
          toast({ title: "Image Pasted Successfully!" });
        }
      } else {
        toast({ variant: "destructive", title: "No Image Found", description: "No image data was found on the clipboard." });
      }
    } catch (error: any) {
      console.error("Failed to paste image:", error);
      if (error.name === 'NotAllowedError') {
        toast({ variant: "destructive", title: "Clipboard Permission Denied", description: "Please allow clipboard access in your browser settings." });
      } else {
        toast({ variant: "destructive", title: "Paste Failed", description: "Could not paste image from clipboard. Try uploading instead." });
      }
    }
  }, [processImageFile, toast]);

  const onSingleSubmit = async (data: SingleQuestionFormValues) => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (key !== 'questionImage' && key !== 'explanationImage' && key !== 'pyqDate' && value !== null && value !== undefined && typeof value !== 'object') {
          formData.append(key, String(value));
        }
        if (key === 'isPyq') {
          formData.append(key, data.isPyq ? 'true' : 'false');
        }
      });
      if (data.isPyq) {
        if (data.pyqExam) formData.append('pyqExam', data.pyqExam);
        if (data.pyqDate) formData.append('pyqDate', format(data.pyqDate, 'yyyy-MM-dd'));
        if (data.pyqShift) formData.append('pyqShift', data.pyqShift);
      }
      if (data.questionImage instanceof File) {
        formData.append('questionImage', data.questionImage, data.questionImage.name);
      }
      if (data.explanationImage instanceof File) {
        formData.append('explanationImage', data.explanationImage, data.explanationImage.name);
      }
      const result = await addQuestionToBank(formData);
      if (result.success && result.question) {
        toast({
          title: "Question Saved Successfully!",
          description: `Question ID: ${result.question.id} added to ${result.question.subject}/${result.question.lesson}.`,
        });
        singleForm.reset();
        setQuestionImagePreview(null);
        setExplanationImagePreview(null);
        if (questionFileInputRef.current) questionFileInputRef.current.value = "";
        if (explanationFileInputRef.current) explanationFileInputRef.current.value = "";
        if (selectedSubject && !lessons.includes(data.lesson)) {
          fetchLessonsForSubject(data.subject, singleForm);
        }
      } else {
        throw new Error(result.error || "Failed to save question.");
      }
    } catch (error: any) {
      console.error("Failed to save question:", error);
      toast({ variant: "destructive", title: "Save Failed", description: error.message || "An unexpected error occurred." });
    } finally {
      setIsLoading(false);
    }
  };

  const onBulkSubmit = async (data: BulkUploadFormValues) => {
    setIsLoading(true);
    try {
        const formData = new FormData();
        formData.append('subject', data.subject);
        formData.append('lesson', data.lesson);
        formData.append('examType', data.examType);
        formData.append('isAllPyq', data.isAllPyq ? 'true' : 'false');
        if (data.isAllPyq) {
            if (data.pyqExamForAll) formData.append('pyqExamForAll', data.pyqExamForAll);
            if (data.pyqYearForAll) formData.append('pyqYearForAll', data.pyqYearForAll);
        }

        let jsonFileToUpload: File | null = null;

        if (jsonInputText.trim()) {
            try {
                JSON.parse(jsonInputText); // Validate JSON structure
                jsonFileToUpload = new File([jsonInputText], "bulk_input.json", { type: "application/json" });
            } catch (e) {
                toast({ variant: "destructive", title: "Invalid JSON", description: "The provided JSON text is not valid." });
                setIsLoading(false);
                return;
            }
        } else if (data.jsonFile instanceof File) {
            jsonFileToUpload = data.jsonFile;
        }

        if (!jsonFileToUpload) {
             toast({ variant: "destructive", title: "No JSON Data", description: "Please upload a JSON file or paste JSON content." });
             setIsLoading(false);
             return;
        }

        formData.append('jsonFile', jsonFileToUpload);

        const result = await addBulkQuestionsToBank(formData);

        if (result.success) {
            toast({
                title: "Bulk Upload Successful!",
                description: `${result.questionsAdded} questions added. ${result.questionsFailed} failed.`,
            });
            bulkForm.reset();
            setJsonInputText(''); // Clear textarea
            if (jsonFileInputRef.current) jsonFileInputRef.current.value = "";
            if (data.subject && !lessons.includes(data.lesson)) {
              fetchLessonsForSubject(data.subject, bulkForm);
            }
        } else {
            throw new Error(result.message || "Bulk upload failed.");
        }
    } catch (error: any) {
        console.error("Bulk upload failed:", error);
        toast({ variant: "destructive", title: "Bulk Upload Failed", description: error.message });
    } finally {
        setIsLoading(false);
    }
  };

  const handleViewSampleJson = async () => {
    setIsLoadingSampleJson(true);
    try {
      const response = await fetch('/sample-bulk-text-questions.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const jsonData = await response.json();
      setSampleJsonContent(JSON.stringify(jsonData, null, 2)); // Prettify
      setIsJsonEditorOpen(true);
    } catch (error) {
      console.error("Failed to fetch sample JSON:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load sample JSON." });
    } finally {
      setIsLoadingSampleJson(false);
    }
  };


  return (
    <>
      <Script
        id="mathjax-script-add-question"
        src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
        strategy="lazyOnload"
        onLoad={() => {
          console.log('MathJax loaded for Add Question page.');
          typesetMathJax();
        }}
      />
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
                <ClipboardList className="h-8 w-8 text-primary" />
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Question Bank</h1>
                    <p className="text-muted-foreground">Create and manage questions for your test series.</p>
                </div>
            </div>
            <RadioGroup
                defaultValue="single"
                onValueChange={(value: 'single' | 'bulk') => setUploadMode(value)}
                className="flex space-x-2"
                disabled={isLoading}
            >
                <Label htmlFor="single-mode"
                    className={cn(
                        "px-3 py-1.5 rounded-md border cursor-pointer text-sm",
                        uploadMode === 'single' ? "bg-primary text-primary-foreground border-primary" : "bg-muted hover:bg-muted/80"
                    )}
                >
                    <RadioGroupItem value="single" id="single-mode" className="sr-only" />
                    Single Question
                </Label>
                <Label htmlFor="bulk-mode"
                    className={cn(
                        "px-3 py-1.5 rounded-md border cursor-pointer text-sm",
                        uploadMode === 'bulk' ? "bg-primary text-primary-foreground border-primary" : "bg-muted hover:bg-muted/80"
                    )}
                >
                     <RadioGroupItem value="bulk" id="bulk-mode" className="sr-only" />
                    Bulk Upload
                </Label>
            </RadioGroup>
        </div>

        {uploadMode === 'single' && (
          <Form {...singleForm}>
            <form onSubmit={singleForm.handleSubmit(onSingleSubmit)} className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Question Details</CardTitle>
                  <CardDescription>Categorize the question using the fields below.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <FormField control={singleForm.control} name="subject" render={({ field }) => (<FormItem><FormLabel>Subject *</FormLabel><Select onValueChange={(value) => { field.onChange(value); }} value={field.value} disabled={isLoading || isLoadingSubjects}><FormControl><SelectTrigger><SelectValue placeholder={isLoadingSubjects ? "Loading..." : "Select Subject"} /></SelectTrigger></FormControl><SelectContent>{subjects.map((sub) => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                  <FormField control={singleForm.control} name="class" render={({ field }) => (<FormItem><FormLabel>Class Level *</FormLabel><Select onValueChange={field.onChange} value={field.value ?? undefined} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger></FormControl><SelectContent>{classLevels.map((level) => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                  <FormField control={singleForm.control} name="lesson" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Lesson Name *</FormLabel><Popover open={lessonPopoverOpen} onOpenChange={setLessonPopoverOpen}><PopoverTrigger asChild><FormControl><Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")} disabled={isLoading || isLoadingLessons || !selectedSubject}><FileText className="mr-2 h-4 w-4 opacity-50" />{field.value ? lessons.find(l => l === field.value) || field.value : (isLoadingLessons ? "Loading..." : "Select or type Lesson")}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command shouldFilter={false}><CommandInput placeholder="Search or type new lesson..." value={field.value ?? ''} onValueChange={field.onChange} disabled={isLoadingLessons || !selectedSubject} /><CommandList>{isLoadingLessons ? (<CommandItem disabled>Loading...</CommandItem>) : lessons.length === 0 && selectedSubject ? (<CommandEmpty>No existing lessons. Type to create new.</CommandEmpty>) : !selectedSubject ? (<CommandEmpty>Select Subject first.</CommandEmpty>) : null}<CommandGroup>{lessons.map((lesson) => (<CommandItem value={lesson} key={lesson} onSelect={() => { singleForm.setValue("lesson", lesson); setLessonPopoverOpen(false); }}><Check className={cn("mr-2 h-4 w-4", lesson === field.value ? "opacity-100" : "opacity-0")} />{lesson}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent></Popover><FormMessage /></FormItem>)} />
                  <FormField control={singleForm.control} name="examType" render={({ field }) => (<FormItem><FormLabel>Exam Type Tag *</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Select Exam" /></SelectTrigger></FormControl><SelectContent>{exams.map((exam) => <SelectItem key={exam} value={exam}>{exam}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                  <FormField control={singleForm.control} name="difficulty" render={({ field }) => (<FormItem><FormLabel>Difficulty *</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Select Difficulty" /></SelectTrigger></FormControl><SelectContent>{difficultyLevels.map((level) => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                  <FormField control={singleForm.control} name="tags" render={({ field }) => (<FormItem><FormLabel>Tags (comma-separated)</FormLabel><FormControl><div className="relative"><TagIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input {...field} placeholder="e.g., algebra, pyq, important" className="pl-10" disabled={isLoading} /></div></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={singleForm.control} name="marks" render={({ field }) => (<FormItem><FormLabel>Marks *</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} min="1" placeholder="Marks for correct answer" disabled={isLoading} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={singleForm.control} name="isPyq" render={({ field }) => (<FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 md:col-span-3"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isLoading} /></FormControl><div className="space-y-1 leading-none"><FormLabel>Is this a Previous Year Question (PYQ)?</FormLabel></div></FormItem>)} />
                  {isPyqChecked && (<><FormField control={singleForm.control} name="pyqExam" render={({ field }) => (<FormItem><FormLabel>PYQ Exam *</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Select PYQ Exam" /></SelectTrigger></FormControl><SelectContent>{exams.map((exam) => <SelectItem key={exam} value={exam}>{exam}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} /><FormField control={singleForm.control} name="pyqDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>PYQ Date *</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={isLoading}><CalendarIcon className="mr-2 h-4 w-4 opacity-50" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} disabled={(date) => date > new Date() || isLoading} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} /><FormField control={singleForm.control} name="pyqShift" render={({ field }) => (<FormItem><FormLabel>PYQ Shift *</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Select Shift" /></SelectTrigger></FormControl><SelectContent>{pyqShifts.map((shift) => <SelectItem key={shift} value={shift}>{shift}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} /></>)}
                </CardContent>
              </Card>
              <FormField control={singleForm.control} name="questionType" render={({ field }) => (<FormItem className="space-y-3"><FormLabel className="text-lg font-semibold">Select Question Type *</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1 md:flex-row md:space-y-0 md:space-x-4" disabled={isLoading}><FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="text" /></FormControl><FormLabel className="font-normal flex items-center gap-2"><FileText className="h-4 w-4" /> Text Question</FormLabel></FormItem><FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="image" /></FormControl><FormLabel className="font-normal flex items-center gap-2"><ImagePlus className="h-4 w-4" /> Image Question</FormLabel></FormItem></RadioGroup></FormControl><FormMessage /></FormItem>)} />
              <Card>
                <CardHeader><CardTitle>Question Content</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {questionType === 'text' ? (<><FormField control={singleForm.control} name="questionText" render={({ field }) => (<FormItem><FormLabel>Question Text *</FormLabel><FormControl><Textarea placeholder="Type the question here. Use $...$ or $$...$$ for MathJax." {...field} value={field.value ?? ''} rows={5} disabled={isLoading} className="mathjax-live-preview" /></FormControl><FormMessage /></FormItem>)} /><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><FormField control={singleForm.control} name="optionA" render={({ field }) => (<FormItem><FormLabel>Option A *</FormLabel><FormControl><Input {...field} placeholder="Option A Text" disabled={isLoading} className="mathjax-live-preview" /></FormControl><FormMessage /></FormItem>)} /><FormField control={singleForm.control} name="optionB" render={({ field }) => (<FormItem><FormLabel>Option B *</FormLabel><FormControl><Input {...field} placeholder="Option B Text" disabled={isLoading} className="mathjax-live-preview" /></FormControl><FormMessage /></FormItem>)} /><FormField control={singleForm.control} name="optionC" render={({ field }) => (<FormItem><FormLabel>Option C *</FormLabel><FormControl><Input {...field} placeholder="Option C Text" disabled={isLoading} className="mathjax-live-preview" /></FormControl><FormMessage /></FormItem>)} /><FormField control={singleForm.control} name="optionD" render={({ field }) => (<FormItem><FormLabel>Option D *</FormLabel><FormControl><Input {...field} placeholder="Option D Text" disabled={isLoading} className="mathjax-live-preview" /></FormControl><FormMessage /></FormItem>)} /></div></>) : (<FormField control={singleForm.control} name="questionImage" render={() => (<FormItem><FormLabel>Question Image *</FormLabel><FormControl><div className="flex flex-col items-start gap-4"><div className="flex items-center gap-2"><Input id="question-image-upload" type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')} ref={questionFileInputRef} onChange={(e) => handleFileChange(e, 'questionImage', setQuestionImagePreview)} className="hidden" disabled={isLoading} /><Button type="button" variant="outline" size="sm" onClick={() => questionFileInputRef.current?.click()} disabled={isLoading}><Upload className="mr-2 h-4 w-4" /> Choose Image</Button><Button type="button" variant="outline" size="sm" onClick={() => handlePasteImage('questionImage', setQuestionImagePreview)} disabled={isLoading}><ClipboardPaste className="mr-2 h-4 w-4" /> Paste</Button></div>{questionImagePreview && (<div className="relative h-40 w-auto border rounded-md overflow-hidden group"><Image src={questionImagePreview} alt="Question Preview" height={160} width={300} style={{ objectFit: 'contain' }} data-ai-hint="question diagram" /><Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-70 hover:!opacity-100 z-10" onClick={() => removeImage('questionImage', setQuestionImagePreview, questionFileInputRef)} disabled={isLoading} title="Remove Image"><X className="h-3 w-3" /></Button></div>)}</div></FormControl><FormMessage /><p className="text-xs text-muted-foreground">Max 4MB. JPG, PNG, WEBP.</p></FormItem>)} />)}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Answer & Explanation</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={singleForm.control} name="correctAnswer" render={({ field }) => (<FormItem><FormLabel>Correct Answer *</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isLoading}><FormControl><SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Select Correct Option" /></SelectTrigger></FormControl><SelectContent>{["A", "B", "C", "D"].map((opt) => <SelectItem key={opt} value={opt}>Option {opt}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                  <FormField control={singleForm.control} name="explanationText" render={({ field }) => (<FormItem><FormLabel>Explanation Text</FormLabel><FormControl><Textarea placeholder="Provide a detailed explanation. Use $...$ or $$...$$ for MathJax." {...field} value={field.value ?? ''} rows={4} disabled={isLoading} className="mathjax-live-preview" /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={singleForm.control} name="explanationImage" render={() => (<FormItem><FormLabel>Explanation Image (Optional)</FormLabel><FormControl><div className="flex flex-col items-start gap-4"><div className="flex items-center gap-2"><Input id="explanation-image-upload" type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')} ref={explanationFileInputRef} onChange={(e) => handleFileChange(e, 'explanationImage', setExplanationImagePreview)} className="hidden" disabled={isLoading} /><Button type="button" variant="outline" size="sm" onClick={() => explanationFileInputRef.current?.click()} disabled={isLoading}><Upload className="mr-2 h-4 w-4" /> Choose Image</Button><Button type="button" variant="outline" size="sm" onClick={() => handlePasteImage('explanationImage', setExplanationImagePreview)} disabled={isLoading}><ClipboardPaste className="mr-2 h-4 w-4" /> Paste</Button></div>{explanationImagePreview && (<div className="relative h-24 w-auto border rounded-md overflow-hidden group"><Image src={explanationImagePreview} alt="Explanation Preview" height={96} width={150} style={{ objectFit: 'contain' }} data-ai-hint="explanation image" /><Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-70 hover:!opacity-100 z-10" onClick={() => removeImage('explanationImage', setExplanationImagePreview, explanationFileInputRef)} disabled={isLoading} title="Remove Image"><X className="h-3 w-3" /></Button></div>)}</div></FormControl><FormMessage /><p className="text-xs text-muted-foreground">Max 4MB. JPG, PNG, WEBP.</p></FormItem>)} />
                </CardContent>
                <CardFooter><Button type="submit" disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save Question</Button></CardFooter>
              </Card>
            </form>
          </Form>
        )}

        {uploadMode === 'bulk' && (
            <Form {...bulkForm}>
                <form onSubmit={bulkForm.handleSubmit(onBulkSubmit)} className="space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><FileType className="h-5 w-5 text-primary"/> Bulk Question Upload</CardTitle>
                            <CardDescription>
                                Upload multiple text-based questions using a JSON file or paste JSON content.
                                View sample JSON for text questions {' '}
                                <Button
                                  type="button"
                                  variant="link"
                                  className="p-0 h-auto text-primary hover:text-primary/80"
                                  onClick={handleViewSampleJson}
                                  disabled={isLoadingSampleJson}
                                >
                                  {isLoadingSampleJson ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                                  here
                                </Button>
                                .
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <FormField control={bulkForm.control} name="subject" render={({ field }) => (<FormItem><FormLabel>Subject *</FormLabel><Select onValueChange={(value) => { field.onChange(value); }} value={field.value} disabled={isLoading || isLoadingSubjects}><FormControl><SelectTrigger><SelectValue placeholder={isLoadingSubjects ? "Loading..." : "Select Subject"} /></SelectTrigger></FormControl><SelectContent>{subjects.map((sub) => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={bulkForm.control} name="lesson" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Lesson Name *</FormLabel><Popover open={bulkLessonPopoverOpen} onOpenChange={setBulkLessonPopoverOpen}><PopoverTrigger asChild><FormControl><Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")} disabled={isLoading || isLoadingLessons || !bulkSelectedSubject}><FileText className="mr-2 h-4 w-4 opacity-50" />{field.value ? lessons.find(l => l === field.value) || field.value : (isLoadingLessons ? "Loading..." : "Select or type Lesson")}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command shouldFilter={false}><CommandInput placeholder="Search or type new lesson..." value={field.value ?? ''} onValueChange={field.onChange} disabled={isLoadingLessons || !bulkSelectedSubject} /><CommandList>{isLoadingLessons ? (<CommandItem disabled>Loading...</CommandItem>) : lessons.length === 0 && bulkSelectedSubject ? (<CommandEmpty>No existing lessons. Type to create new.</CommandEmpty>) : !bulkSelectedSubject ? (<CommandEmpty>Select Subject first.</CommandEmpty>) : null}<CommandGroup>{lessons.map((lesson) => (<CommandItem value={lesson} key={lesson} onSelect={() => { bulkForm.setValue("lesson", lesson); setBulkLessonPopoverOpen(false); }}><Check className={cn("mr-2 h-4 w-4", lesson === field.value ? "opacity-100" : "opacity-0")} />{lesson}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent></Popover><FormMessage /></FormItem>)} />
                            <FormField control={bulkForm.control} name="examType" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Default Exam Type for File *</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Select Exam" /></SelectTrigger></FormControl><SelectContent>{exams.map((exam) => <SelectItem key={exam} value={exam}>{exam}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />

                            <FormField control={bulkForm.control} name="isAllPyq" render={({ field }) => (<FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 md:col-span-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isLoading} /></FormControl><div className="space-y-1 leading-none"><FormLabel>Are all questions in this file PYQs?</FormLabel><FormDescription>If checked, specify PYQ details below. Individual question PYQ data will be overridden.</FormDescription></div></FormItem>)} />
                            {isBulkPyqChecked && (<>
                                <FormField control={bulkForm.control} name="pyqExamForAll" render={({ field }) => ( <FormItem><FormLabel>PYQ Exam (for all) *</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Select PYQ Exam" /></SelectTrigger></FormControl><SelectContent>{exams.map((exam) => <SelectItem key={exam} value={exam}>{exam}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                                <FormField control={bulkForm.control} name="pyqYearForAll" render={({ field }) => ( <FormItem><FormLabel>PYQ Year (for all) *</FormLabel><FormControl><Input type="text" placeholder="YYYY" {...field} disabled={isLoading} maxLength={4} /></FormControl><FormMessage /></FormItem> )} />
                            </>)}
                            
                            {/* JSON Text Input Area */}
                            <div className="md:col-span-2 space-y-2">
                                <Label htmlFor="json-input-text">Paste JSON Content Here</Label>
                                <Textarea
                                    id="json-input-text"
                                    placeholder="Paste your array of questions in JSON format here..."
                                    value={jsonInputText}
                                    onChange={(e) => setJsonInputText(e.target.value)}
                                    rows={10}
                                    disabled={isLoading}
                                    className="font-mono text-xs"
                                />
                                <FormDescription>This will be used if no file is uploaded. Supports only text-based questions with MathJax syntax.</FormDescription>
                            </div>
                            
                            <div className="md:col-span-2 flex items-center justify-center text-sm text-muted-foreground">OR</div>

                            <FormField control={bulkForm.control} name="jsonFile" render={({ field: { onChange, value, ...rest } }) => (
                                <FormItem className="md:col-span-2">
                                    <FormLabel>Upload JSON File</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="file"
                                            accept={ACCEPTED_JSON_TYPE}
                                            onChange={(e) => onChange(e.target.files ? e.target.files[0] : null)}
                                            disabled={isLoading}
                                            ref={jsonFileInputRef}
                                            className="file:text-primary file:font-medium file:border-0 file:bg-transparent hover:file:bg-primary/10"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                    <FormDescription>Max file size: {MAX_FILE_SIZE*5 /1024/1024}MB. Ensure it's a valid JSON array of questions.</FormDescription>
                                </FormItem>
                            )} />
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4"/>}
                                Upload and Process
                            </Button>
                        </CardFooter>
                    </Card>
                </form>
            </Form>
        )}
      </div>
      {isJsonEditorOpen && (
        <JsonEditorDialog
          isOpen={isJsonEditorOpen}
          onClose={() => setIsJsonEditorOpen(false)}
          jsonString={sampleJsonContent}
          onSave={(editedJson) => {
            // Handle saving the edited JSON if needed, e.g., update state or send to backend
            setJsonInputText(editedJson); // Example: update the textarea for bulk upload
            setIsJsonEditorOpen(false);
            toast({title: "JSON Content Updated", description: "Pasted into the text area."});
          }}
        />
      )}
    </>
  );
}
