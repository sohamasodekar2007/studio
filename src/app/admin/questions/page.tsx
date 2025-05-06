'use client';

import { useState, useRef, type ChangeEvent, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import crypto from 'crypto'; // Used for hashing image names

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, Loader2, ImagePlus, X, FileText, Upload } from "lucide-react";
import { type QuestionBankItem, questionTypes, difficultyLevels, examOptions, classLevels, type QuestionType } from '@/types';
import Image from 'next/image';
import { addQuestionToBank } from '@/actions/question-bank-actions'; // Import the server action

// --- Zod Schema Definition ---
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const questionSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  class: z.enum(classLevels, { required_error: "Class is required" }),
  lesson: z.string().min(1, "Lesson name is required"),
  examType: z.enum(examOptions, { required_error: "Exam type is required" }),
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
});


type QuestionFormValues = z.infer<typeof questionSchema>;

export default function AdminQuestionBankPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [subjects, setSubjects] = useState<string[]>(["Physics", "Chemistry", "Maths", "Biology"]); // Placeholder
  const [lessons, setLessons] = useState<string[]>(["Topic 1", "Topic 2"]); // Placeholder
  const [tags, setTags] = useState<string[]>(["tag1", "tag2"]); // Placeholder

  const [questionImagePreview, setQuestionImagePreview] = useState<string | null>(null);
  const [explanationImagePreview, setExplanationImagePreview] = useState<string | null>(null);

  const questionFileInputRef = useRef<HTMLInputElement>(null);
  const explanationFileInputRef = useRef<HTMLInputElement>(null);

  // TODO: Fetch subjects, lessons, tags dynamically in useEffect if needed

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
    },
  });

  const questionType = form.watch('questionType'); // Watch for changes

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>,
    fieldName: 'questionImage' | 'explanationImage',
    setPreview: (url: string | null) => void
  ) => {
    const file = event.target.files?.[0];
    if (file) {
        // Basic client-side validation (size, type)
        if (file.size > MAX_FILE_SIZE) {
            form.setError(fieldName, { type: 'manual', message: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit.` });
            setPreview(null);
            event.target.value = ""; // Reset input
            return;
        }
        if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
             form.setError(fieldName, { type: 'manual', message: 'Invalid file type. Use JPG, PNG, or WEBP.' });
             setPreview(null);
             event.target.value = ""; // Reset input
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
  };

  const removeImage = (
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
  };

  const onSubmit = async (data: QuestionFormValues) => {
    setIsLoading(true);
    console.log("Form Data Submitted:", data);

    try {
       const formData = new FormData();

       // Append text fields
        Object.entries(data).forEach(([key, value]) => {
            if (key !== 'questionImage' && key !== 'explanationImage' && value !== null && value !== undefined) {
                formData.append(key, String(value));
            }
        });

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
                     {/* TODO: Replace with searchable Select or Combobox if list is long */}
                     <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Subject" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {subjects.map((sub) => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}
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
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
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
               <FormField
                control={form.control}
                name="lesson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lesson Name *</FormLabel>
                     {/* TODO: Implement auto-suggest */}
                    <FormControl>
                      <Input placeholder="Enter Lesson Name" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="examType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exam Type *</FormLabel>
                     <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
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
                    <FormLabel>Tags (comma-separated)</FormLabel>
                     {/* TODO: Implement auto-suggest tag input */}
                    <FormControl>
                      <Input placeholder="e.g., algebra, geometry" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                        className="flex flex-col space-y-1 md:flex-row md:space-y-0 md:space-x-4"
                        disabled={isLoading}
                    >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                                <RadioGroupItem value="text" />
                            </FormControl>
                            <FormLabel className="font-normal flex items-center gap-2">
                                <FileText className="h-4 w-4" /> Add Text Question
                            </FormLabel>
                        </FormItem>
                         <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                                <RadioGroupItem value="image" />
                            </FormControl>
                            <FormLabel className="font-normal flex items-center gap-2">
                                <ImagePlus className="h-4 w-4" /> Add Image Question
                            </FormLabel>
                        </FormItem>
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
                        {/* TODO: Add Rich Text Editor with MathJax/LaTeX */}
                        <FormControl>
                         <Textarea placeholder="Enter the question here. Use $...$ or $$...$$ for MathJax." {...field} rows={5} disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField control={form.control} name="optionA" render={({ field }) => (<FormItem><FormLabel>Option A *</FormLabel><FormControl><Input placeholder="Option A" {...field} disabled={isLoading}/></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="optionB" render={({ field }) => (<FormItem><FormLabel>Option B *</FormLabel><FormControl><Input placeholder="Option B" {...field} disabled={isLoading}/></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="optionC" render={({ field }) => (<FormItem><FormLabel>Option C *</FormLabel><FormControl><Input placeholder="Option C" {...field} disabled={isLoading}/></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="optionD" render={({ field }) => (<FormItem><FormLabel>Option D *</FormLabel><FormControl><Input placeholder="Option D" {...field} disabled={isLoading}/></FormControl><FormMessage /></FormItem>)} />
                 </div>
                </>
             ) : (
                <FormField
                    control={form.control}
                    name="questionImage"
                    render={({ field }) => ( // field is not directly used for input type="file" but needed for controller
                    <FormItem>
                        <FormLabel>Question Image *</FormLabel>
                        <FormControl>
                             <div className="flex items-center gap-4">
                                <Input
                                    id="question-image-upload"
                                    type="file"
                                    accept={ACCEPTED_IMAGE_TYPES.join(',')}
                                    ref={questionFileInputRef}
                                    onChange={(e) => handleFileChange(e, 'questionImage', setQuestionImagePreview)}
                                    className="hidden"
                                    disabled={isLoading}
                                />
                                 <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => questionFileInputRef.current?.click()}
                                    disabled={isLoading}
                                >
                                    <Upload className="mr-2 h-4 w-4" /> Upload Image
                                </Button>
                                 {questionImagePreview && (
                                    <div className="relative h-24 w-auto border rounded-md overflow-hidden">
                                        <Image src={questionImagePreview} alt="Question Preview" height={96} width={150} objectFit="contain" />
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            className="absolute top-1 right-1 h-5 w-5 opacity-70 hover:opacity-100 z-10"
                                            onClick={() => removeImage('questionImage', setQuestionImagePreview, questionFileInputRef)}
                                            disabled={isLoading}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                 )}
                            </div>
                        </FormControl>
                         <FormMessage />
                         <p className="text-xs text-muted-foreground">Max 4MB. JPG, PNG, WEBP only. Options A, B, C, D are assumed to be in the image.</p>
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
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
                        <FormControl>
                            <SelectTrigger className="w-full md:w-[180px]">
                            <SelectValue placeholder="Select Correct Option" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {["A", "B", "C", "D"].map((opt) => <SelectItem key={opt} value={opt}>Option {opt}</SelectItem>)}
                        </SelectContent>
                        </Select>
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
                        {/* TODO: Add Rich Text Editor */}
                        <FormControl>
                        <Textarea placeholder="Provide a detailed explanation. Use $...$ or $$...$$ for MathJax." {...field} rows={5} disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
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
                             <div className="flex items-center gap-4">
                                <Input
                                    id="explanation-image-upload"
                                    type="file"
                                    accept={ACCEPTED_IMAGE_TYPES.join(',')}
                                    ref={explanationFileInputRef}
                                    onChange={(e) => handleFileChange(e, 'explanationImage', setExplanationImagePreview)}
                                    className="hidden"
                                    disabled={isLoading}
                                />
                                 <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => explanationFileInputRef.current?.click()}
                                    disabled={isLoading}
                                >
                                    <Upload className="mr-2 h-4 w-4" /> Upload Image
                                </Button>
                                 {explanationImagePreview && (
                                    <div className="relative h-24 w-auto border rounded-md overflow-hidden">
                                        <Image src={explanationImagePreview} alt="Explanation Preview" height={96} width={150} objectFit="contain" />
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            className="absolute top-1 right-1 h-5 w-5 opacity-70 hover:opacity-100 z-10"
                                            onClick={() => removeImage('explanationImage', setExplanationImagePreview, explanationFileInputRef)}
                                            disabled={isLoading}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                 )}
                            </div>
                        </FormControl>
                         <FormMessage />
                          <p className="text-xs text-muted-foreground">Max 4MB. JPG, PNG, WEBP only.</p>
                    </FormItem>
                    )}
                />
            </CardContent>
            <CardFooter>
                 <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Question
                </Button>
            </CardFooter>
          </Card>

        </form>
      </Form>
    </div>
  );
}