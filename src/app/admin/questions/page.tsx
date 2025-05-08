'use client';

import React from 'react';

import { useState, useRef, type ChangeEvent, useEffect, useCallback } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from "date-fns"; // Import format

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import { Calendar } from "@/components/ui/calendar"; // Import Calendar
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // For Combobox and Date Picker
import { useToast } from '@/hooks/use-toast';
import { ClipboardList, Loader2, ImagePlus, X, FileText, Upload, ClipboardPaste, Check, ChevronsUpDown, CalendarIcon, TagIcon } from "lucide-react";
import {
    type QuestionBankItem, questionTypes, difficultyLevels, examOptions, classLevels, type QuestionType,
    pyqShifts, type PyqShift, type ExamOption as PyqExamOption // Import PYQ related types
} from '@/types';
import Image from 'next/image';
import { addQuestionToBank } from '@/actions/question-bank-actions'; // Import the server action
import { getSubjects, getLessonsForSubject } from '@/actions/question-bank-query-actions'; // Import query actions
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"; // For Combobox
import { cn } from "@/lib/utils";

// --- Zod Schema Definition ---
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const questionSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  class: z.enum(classLevels, { required_error: "Class is required" }),
  lesson: z.string().min(1, "Lesson name is required"),
  examType: z.enum(examOptions, { required_error: "Primary exam type is required" }), // Changed label
  difficulty: z.enum(difficultyLevels, { required_error: "Difficulty level is required" }),
  tags: z.string().optional(), // Simple string for now, parse later
  questionType: z.enum(questionTypes, { required_error: "Question type is required" }),

  // Text Question Fields
  questionText: z.string().optional(),
  optionA: z.string().optional(),
  optionB: z.string().optional(),
  optionC: z.string().optional(),
  optionD: z.string().optional(),

  // Image Question Fields
  questionImage: z.any().optional(), // Use 'any' for File object

  correctAnswer: z.enum(["A", "B", "C", "D"], { required_error: "Correct answer is required" }),
  explanationText: z.string().optional(),
  explanationImage: z.any().optional(), // Use 'any' for File object

  // PYQ Fields
  isPyq: z.boolean().default(false).optional(),
  pyqExam: z.enum(examOptions).optional(),
  pyqDate: z.date().optional().nullable(), // Date object
  pyqShift: z.enum(pyqShifts).optional(),

}).refine(data => {
    // If text question, questionText and options are required
    if (data.questionType === 'text') {
      return !!data.questionText && !!data.optionA && !!data.optionB && !!data.optionC && !!data.optionD;
    }
    return true;
  }, {
    message: "Question text and all four options are required for Text Questions.",
    path: ["questionText"], // Apply error to a relevant field
}).refine(data => {
    // If image question, questionImage is required
    if (data.questionType === 'image') {
      return !!data.questionImage;
    }
    return true;
  }, {
    message: "Question image is required for Image Questions.",
    path: ["questionImage"],
}).refine(data => {
    // Validate questionImage file
    if (data.questionImage && data.questionImage instanceof File) {
        if (data.questionImage.size > MAX_FILE_SIZE) return false;
        if (!ACCEPTED_IMAGE_TYPES.includes(data.questionImage.type)) return false;
    }
    return true;
}, {
    message: `Question image must be a valid image file (JPG, PNG, WEBP) and less than ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
    path: ["questionImage"],
}).refine(data => {
    // Validate explanationImage file
    if (data.explanationImage && data.explanationImage instanceof File) {
        if (data.explanationImage.size > MAX_FILE_SIZE) return false;
        if (!ACCEPTED_IMAGE_TYPES.includes(data.explanationImage.type)) return false;
    }
    return true;
}, {
    message: `Explanation image must be a valid image file (JPG, PNG, WEBP) and less than ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
    path: ["explanationImage"],
}).refine(data => {
    // If isPyq is true, then pyqExam, pyqDate, and pyqShift are required
    if (data.isPyq) {
      return !!data.pyqExam && !!data.pyqDate && !!data.pyqShift;
    }
    return true;
  }, {
    message: "Exam, Date, and Shift are required for PYQ.",
    // Apply error path to one of the required fields if isPyq is true
    path: ["pyqExam"],
});


type QuestionFormValues = z.infer<typeof questionSchema>;

export default function AdminQuestionBankPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]); // Fetched dynamically
  const [lessons, setLessons] = useState<string[]>([]); // Fetched dynamically
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  // Removed static tags, could fetch dynamically if needed
  // const [tags, setTags] = useState<string[]>([]);

  const [questionImagePreview, setQuestionImagePreview] = useState<string | null>(null);
  const [explanationImagePreview, setExplanationImagePreview] = useState<string | null>(null);

  const questionFileInputRef = useRef<HTMLInputElement>(null);
  const explanationFileInputRef = useRef<HTMLInputElement>(null);
  const [lessonPopoverOpen, setLessonPopoverOpen] = useState(false); // State for Combobox popover


  const form = useForm<QuestionFormValues>({
    resolver: zodResolver(questionSchema),
    defaultValues: {
      subject: '',
      class: undefined,
      lesson: '',
      examType: undefined,
      difficulty: undefined,
      tags: '',
      questionType: 'text', // Default to text
      questionText: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      questionImage: null,
      correctAnswer: undefined,
      explanationText: '',
      explanationImage: null,
      isPyq: false,
      pyqExam: undefined,
      pyqDate: null,
      pyqShift: undefined,
    },
  });

  const questionType = form.watch('questionType'); // Watch for changes
  const selectedSubject = form.watch('subject'); // Watch selected subject
  const isPyqChecked = useWatch({ control: form.control, name: "isPyq" }); // Watch PYQ checkbox


   // --- Fetch Subjects ---
   useEffect(() => {
        setIsLoadingSubjects(true);
        getSubjects()
        .then(setSubjects)
        .catch(err => toast({ variant: "destructive", title: "Error", description: "Could not load subjects." }))
        .finally(() => setIsLoadingSubjects(false));
   }, [toast]);


   // --- Fetch Lessons when Subject Changes ---
    useEffect(() => {
        if (selectedSubject) {
            setIsLoadingLessons(true);
            setLessons([]); // Clear previous lessons
            form.setValue('lesson', ''); // Reset lesson selection in form
            getLessonsForSubject(selectedSubject)
                .then(setLessons)
                .catch(err => toast({ variant: "destructive", title: "Error", description: `Could not load lessons for ${selectedSubject}.` }))
                .finally(() => setIsLoadingLessons(false));
        } else {
            setLessons([]); // Clear lessons if no subject selected
        }
    }, [selectedSubject, toast, form]);


  // --- Image Handling Callbacks ---
  const processImageFile = useCallback((
    file: File | null,
    fieldName: 'questionImage' | 'explanationImage',
    setPreview: (url: string | null) => void
  ) => {
    if (file) {
      // Basic client-side validation (size, type)
      if (file.size > MAX_FILE_SIZE) {
        form.setError(fieldName, { type: 'manual', message: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit.` });
        setPreview(null);
        return;
      }
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        form.setError(fieldName, { type: 'manual', message: 'Invalid file type. Use JPG, PNG, or WEBP.' });
        setPreview(null);
        return;
      }

      form.clearErrors(fieldName); // Clear previous errors
      form.setValue(fieldName, file); // Set the file object in the form state
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      form.setValue(fieldName, null);
      setPreview(null);
    }
  }, [form]); // Include form in dependencies

  const handleFileChange = useCallback((
    event: ChangeEvent<HTMLInputElement>,
    fieldName: 'questionImage' | 'explanationImage',
    setPreview: (url: string | null) => void
  ) => {
    const file = event.target.files?.[0] || null;
    processImageFile(file, fieldName, setPreview);
    // Reset input value to allow re-uploading the same file if needed
    if (event.target) {
      event.target.value = "";
    }
  }, [processImageFile]);

  const removeImage = useCallback((
    fieldName: 'questionImage' | 'explanationImage',
    setPreview: (url: string | null) => void,
    fileInputRef: React.RefObject<HTMLInputElement>
  ) => {
    form.setValue(fieldName, null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    form.clearErrors(fieldName);
  }, [form]);

  const handlePasteImage = useCallback(async (
    fieldName: 'questionImage' | 'explanationImage',
    setPreview: (url: string | null) => void
  ) => {
    if (!navigator.clipboard?.read) {
      toast({
        variant: "destructive",
        title: "Clipboard API Not Supported",
        description: "Pasting images is not supported in your browser.",
      });
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
        // Convert Blob to File
        const timestamp = Date.now();
        const fileExtension = imageBlob.type.split('/')[1] || 'png'; // Default to png if type is generic
        const fileName = `pasted_image_${timestamp}.${fileExtension}`;
        const imageFile = new File([imageBlob], fileName, { type: imageBlob.type });
        processImageFile(imageFile, fieldName, setPreview); // Use the processing callback
        toast({ title: "Image Pasted Successfully!" });
      } else {
        toast({
          variant: "destructive",
          title: "No Image Found",
          description: "No image data was found on the clipboard.",
        });
      }
    } catch (error: any) {
      console.error("Failed to paste image:", error);
       if (error.name === 'NotAllowedError') {
          toast({
            variant: "destructive",
            title: "Clipboard Permission Denied",
            description: "Please allow clipboard access in your browser settings.",
          });
       } else {
           toast({
            variant: "destructive",
            title: "Paste Failed",
            description: "Could not paste image from clipboard. Try uploading instead.",
           });
       }
    }
  }, [processImageFile, toast]); // Add dependencies
  // --- End Image Handling ---


  const onSubmit = async (data: QuestionFormValues) => {
    setIsLoading(true);
    console.log("Form Data Submitted:", data);

    try {
       const formData = new FormData();

       // Append text fields and simple booleans
        Object.entries(data).forEach(([key, value]) => {
            // Skip file objects and PYQ date object for now
             if (key !== 'questionImage' && key !== 'explanationImage' && key !== 'pyqDate' && value !== null && value !== undefined && typeof value !== 'object') {
                 formData.append(key, String(value));
             }
             // Append boolean specifically
             if (key === 'isPyq') {
                 formData.append(key, data.isPyq ? 'true' : 'false');
             }
        });

        // Append PYQ details if isPyq is true
         if (data.isPyq) {
             if (data.pyqExam) formData.append('pyqExam', data.pyqExam);
             if (data.pyqDate) formData.append('pyqDate', format(data.pyqDate, 'yyyy-MM-dd')); // Format date
             if (data.pyqShift) formData.append('pyqShift', data.pyqShift);
         }

       // Append files if they exist
        if (data.questionImage instanceof File) {
            formData.append('questionImage', data.questionImage, data.questionImage.name);
        }
        if (data.explanationImage instanceof File) {
            formData.append('explanationImage', data.explanationImage, data.explanationImage.name);
        }

       // Call the server action
       const result = await addQuestionToBank(formData);

        if (result.success && result.question) {
            toast({
                title: "Question Saved Successfully!",
                description: `Question ID: ${result.question.id} added to ${result.question.subject}/${result.question.lesson}.`,
            });
            form.reset(); // Reset form after successful submission
            setQuestionImagePreview(null);
            setExplanationImagePreview(null);
            if (questionFileInputRef.current) questionFileInputRef.current.value = "";
            if (explanationFileInputRef.current) explanationFileInputRef.current.value = "";
             // Refresh lessons for the current subject in case a new one was added
            if (!lessons.includes(data.lesson)) {
                getLessonsForSubject(data.subject).then(setLessons);
            }
        } else {
            throw new Error(result.error || "Failed to save question.");
        }

    } catch (error: any) {
      console.error("Failed to save question:", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error.message || "An unexpected error occurred.",
      });
    } finally {
      setIsLoading(false);
    }
  };

    return (
    <>
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <ClipboardList className="h-8 w-8 text-primary" />
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Question Bank</h1>
            <p className="text-muted-foreground">Create and manage questions for your test series.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* --- Hierarchical Selection Card --- */}
          <Card>
            <CardHeader>
              <CardTitle>Question Details</CardTitle>
              <CardDescription>Categorize the question using the fields below.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject *</FormLabel>
                     <Select onValueChange={(value) => {
                         field.onChange(value);
                         // Reset lesson when subject changes (handled by useEffect)
                     }} value={field.value} disabled={isLoading || isLoadingSubjects}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingSubjects ? "Loading..." : "Select Subject"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {subjects.map((sub) => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}
                         {isLoadingSubjects && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                         {!isLoadingSubjects && subjects.length === 0 && <SelectItem value="no-subjects" disabled>No subjects found</SelectItem>}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="class"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Class" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {classLevels.map((level) => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
               {/* Lesson Name Combobox */}
               <FormField
                control={form.control}
                name="lesson"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Lesson Name *</FormLabel>
                  <>
                         Select or type Lesson
                  </>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="examType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Exam Type *</FormLabel>
                     <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Exam" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {examOptions.map((ex) => <SelectItem key={ex} value={ex}>{ex}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="difficulty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Difficulty *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Difficulty" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {difficultyLevels.map((level) => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                     <FormLabel className="flex items-center gap-1">
                        <TagIcon className="h-4 w-4 text-muted-foreground" /> Tags (comma-separated)
                     </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., algebra, geometry" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               {/* PYQ Checkbox */}
                <FormField
                  control={form.control}
                  name="isPyq"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm md:col-span-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Is this a Previous Year Question (PYQ)?
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
                {/* Conditional PYQ Fields */}
                {isPyqChecked && (
                    <>
                    <FormField
                        control={form.control}
                        name="pyqExam"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>PYQ Exam *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select PYQ Exam" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {examOptions.map((ex) => <SelectItem key={ex} value={ex}>{ex}</SelectItem>)}
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <>
                            
                                
                                    
                                        Pick PYQ date
                                    
                                
                                
                                
                                    
                                        
                                        
                                    
                                
                            
                            
                            
                        </>
                        
                    
                     <FormField
                        control={form.control}
                        name="pyqShift"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>PYQ Shift *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select Shift" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {pyqShifts.map((shift) => <SelectItem key={shift} value={shift}>{shift}</SelectItem>)}
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    </>
                )}
            </CardContent>
          </Card>

          {/* --- Question Type Selection --- */}
           <FormField
                control={form.control}
                name="questionType"
                render={({ field }) => (
                 <FormItem className="space-y-3">
                   <FormLabel className="text-lg font-semibold">Select Question Type *</FormLabel>
                   <FormControl>
                    <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-4"
                        // disabled={isLoading} // Re-enable if needed, but often type selection shouldn't be disabled by loading
                    >
                        <>
                            
                                
                                
                            </>
                            <>
                               
                                
                            </>
                        
                    </RadioGroup>
                   </FormControl>
                   <FormMessage />
                 </FormItem>
                )}
            />

          {/* --- Question Input Area --- */}
          <Card>
            <CardHeader>
                <CardTitle>Question Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
             {questionType === 'text' ? (
                <>
                <FormField
                    control={form.control}
                    name="questionText"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Question Text *</FormLabel>
                        <FormControl>
                         <>
                        </>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <>
                    
                    
                    
                    
                 </>
                </>
             ) : (
                <FormField
                    control={form.control}
                    name="questionImage"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Question Image *</FormLabel>
                        <FormControl>
                             <>
                                 
                                    Upload Image
                                </>
                                 <>
                                     Paste
                                 </>
                                 {questionImagePreview && (
                                    <>
                                         
                                             
                                         
                                     </>
                                 )}
                            </>
                        </FormControl>
                         <FormMessage />
                         
                    </FormItem>
                    )}
                />
             )}
            </CardContent>
          </Card>

           {/* --- Answer and Explanation --- */}
          <Card>
            <CardHeader>
                <CardTitle>Answer & Explanation</CardTitle>
            </CardHeader>
             <CardContent className="space-y-4">
                 <FormField
                    control={form.control}
                    name="correctAnswer"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Correct Answer *</FormLabel>
                        <>
                            
                                
                                    Option A
                                </>
                                <>
                                    Option B
                                </>
                                <>
                                    Option C
                                </>
                                <>
                                    Option D
                                </>
                            
                        </>
                        <FormMessage />
                    </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="explanationText"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Explanation Text</FormLabel>
                        <>
                        </>
                        
                        
                    </FormItem>
                    )}
                />

                 <FormField
                    control={form.control}
                    name="explanationImage"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Explanation Image (Optional)</FormLabel>
                        <FormControl>
                             <>
                                
                                     Upload Image
                                </>
                                 {/* Paste Button */}
                                 <>
                                     Paste
                                 </>
                                 {explanationImagePreview && (
                                    <>
                                         
                                             
                                         
                                     </>
                                 )}
                            </>
                        </FormControl>
                         <FormMessage />
                          
                    </FormItem>
                    )}
                />
            </CardContent>
            <CardFooter>
                 <>
                    
                    Save Question
                </>
            </CardFooter>
          </Card>

        </form>
      </Form>
    </div>
    </>
  );
}
//add validation for all and make this to that it will
