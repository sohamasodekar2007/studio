// src/components/admin/edit-question-dialog.tsx
'use client';

import { useState, useRef, useCallback, useEffect, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, ClipboardPaste, X } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import type { QuestionBankItem } from '@/types';
import { updateQuestionDetails } from '@/actions/question-bank-actions';
import Script from 'next/script'; 

const MAX_FILE_SIZE = 4 * 1024 * 1024; 
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const constructImagePath = (subject: string, lesson: string, filename: string | null | undefined): string | null => {
    if (!filename) return null;
    const basePath = '/question_bank_images'; 
    return `${basePath}/${encodeURIComponent(subject)}/${encodeURIComponent(lesson)}/images/${encodeURIComponent(filename)}`;
};

const editQuestionSchema = z.object({
  correctAnswer: z.enum(["A", "B", "C", "D"], { required_error: "Correct answer is required" }),
  explanationText: z.string().optional(),
  explanationImage: z.any().optional(), 
  removeExplanationImage: z.boolean().optional().default(false),
  marks: z.number().min(1, "Marks must be at least 1").positive("Marks must be positive"), 
}).refine(data => {
    if (data.explanationImage && data.explanationImage instanceof File) {
        if (data.explanationImage.size > MAX_FILE_SIZE) return false;
        if (!ACCEPTED_IMAGE_TYPES.includes(data.explanationImage.type)) return false;
    }
    return true;
}, {
    message: `Explanation image must be a valid image file (JPG, PNG, WEBP) and less than ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
    path: ["explanationImage"],
});


type EditQuestionFormValues = z.infer<typeof editQuestionSchema>;

interface EditQuestionDialogProps {
  question: QuestionBankItem;
  isOpen: boolean;
  onClose: () => void;
  onQuestionUpdate: (updatedQuestion: QuestionBankItem) => void;
}

export default function EditQuestionDialog({ question, isOpen, onClose, onQuestionUpdate }: EditQuestionDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [explanationImagePreview, setExplanationImagePreview] = useState<string | null>(null);
  const explanationFileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<EditQuestionFormValues>({
    resolver: zodResolver(editQuestionSchema),
    defaultValues: {
      correctAnswer: question.correct,
      explanationText: question.explanation.text || '',
      explanationImage: null, 
      removeExplanationImage: false,
      marks: question.marks || 1, 
    },
  });

  const typesetMathJax = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).MathJax && typeof (window as any).MathJax.typesetPromise === 'function') {
        const elements = document.querySelectorAll('.mathjax-dialog-preview'); // Specific class for dialog
        if (elements.length > 0) {
            (window as any).MathJax.typesetPromise(Array.from(elements))
                .catch((err: any) => console.error("MathJax typeset error (dialog-preview):", err));
        }
    }
  }, []);

   useEffect(() => {
       if (isOpen) {
           const initialExplanationImagePath = constructImagePath(question.subject, question.lesson, question.explanation.image);
           setExplanationImagePreview(initialExplanationImagePath);
           form.reset({
               correctAnswer: question.correct,
               explanationText: question.explanation.text || '',
               explanationImage: null, 
               removeExplanationImage: false,
               marks: question.marks || 1,
           });
           const timerId = setTimeout(() => typesetMathJax(), 50); // Typeset after dialog content is likely rendered
           return () => clearTimeout(timerId);
       } else {
            setExplanationImagePreview(null);
       }
   }, [question, isOpen, form, typesetMathJax]);


   const processImageFile = useCallback((
    file: File | null,
    setPreview: (url: string | null) => void
  ) => {
    if (file) {
      if (file.size > MAX_FILE_SIZE || !ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        form.setError('explanationImage', { type: 'manual', message: `Invalid file (Max ${MAX_FILE_SIZE / 1024 / 1024}MB, JPG/PNG/WEBP).` });
        setPreview(constructImagePath(question.subject, question.lesson, question.explanation.image)); 
        form.setValue('explanationImage', null); 
        return false;
      }
      form.clearErrors('explanationImage');
      form.setValue('explanationImage', file); 
      form.setValue('removeExplanationImage', false); 
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string); 
      reader.readAsDataURL(file);
      return true;
    } else {
       setPreview(constructImagePath(question.subject, question.lesson, question.explanation.image)); 
       form.setValue('explanationImage', null); 
       return false;
    }
  }, [form, question.subject, question.lesson, question.explanation.image]);

   const handleFileChange = useCallback((
    event: ChangeEvent<HTMLInputElement>,
    setPreview: (url: string | null) => void
  ) => {
    const file = event.target.files?.[0] || null;
    processImageFile(file, setPreview);
    if (event.target) event.target.value = ""; 
  }, [processImageFile]);

   const removeImage = useCallback(() => {
        setExplanationImagePreview(null);
        if (explanationFileInputRef.current) explanationFileInputRef.current.value = "";
        form.setValue('explanationImage', null); 
        form.setValue('removeExplanationImage', true); 
        form.clearErrors('explanationImage');
        toast({ title: "Image Marked for Removal", description: "Click 'Save Changes' to confirm." });
   }, [form, toast]);


   const handlePasteImage = useCallback(async (
     setPreview: (url: string | null) => void
   ) => {
      if (!navigator.clipboard?.read) {
       toast({ variant: "destructive", title: "Clipboard API Not Supported" });
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
         const fileName = `pasted_expl_${timestamp}.${fileExtension}`;
         const imageFile = new File([imageBlob], fileName, { type: imageBlob.type });
         const success = processImageFile(imageFile, setPreview); 
          if (success) {
             toast({ title: "Image Pasted Successfully!" });
          }
       } else {
         toast({ variant: "destructive", title: "No Image Found on Clipboard" });
       }
     } catch (error: any) {
       console.error("Failed to paste image:", error);
        if (error.name === 'NotAllowedError') {
            toast({ variant: "destructive", title: "Clipboard Permission Denied" });
        } else {
            toast({ variant: "destructive", title: "Paste Failed" });
        }
     }
   }, [processImageFile, toast]);

  const onSubmit = async (data: EditQuestionFormValues) => {
    setIsLoading(true);
    try {
        const formData = new FormData();
        formData.append('questionId', question.id);
        formData.append('subject', question.subject);
        formData.append('lesson', question.lesson);
        formData.append('correctAnswer', data.correctAnswer);
        formData.append('marks', data.marks.toString()); 
        if (data.explanationText) {
            formData.append('explanationText', data.explanationText);
        }
        if (data.explanationImage instanceof File) {
            formData.append('explanationImage', data.explanationImage, data.explanationImage.name);
        }
         if (data.removeExplanationImage) {
            formData.append('removeExplanationImage', 'true');
        }
        const result = await updateQuestionDetails(formData);
        if (!result.success || !result.question) {
            throw new Error(result.error || 'Failed to update question.');
        }
        toast({
            title: 'Question Updated',
            description: `Details for ${question.id} have been saved.`,
        });
        onQuestionUpdate(result.question); 
        onClose(); 
    } catch (error: any) {
      console.error('Failed to update question:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Could not save changes.',
      });
    } finally {
      setIsLoading(false);
    }
  };

   const renderQuestionPreview = (q: QuestionBankItem) => {
       const imagePath = constructImagePath(q.subject, q.lesson, q.question.image);

       if (q.type === 'image' && imagePath) {
            return (
                <div className="space-y-2">
                   <p className="text-sm font-medium">Question Image:</p>
                    <div className="relative w-full max-w-sm h-48"> 
                       <Image
                           src={imagePath}
                           alt="Question Image Preview"
                           layout="fill" 
                           objectFit="contain" 
                           className="rounded border"
                           data-ai-hint="question diagram"
                           unoptimized 
                       />
                    </div>
                    <p className="text-xs text-muted-foreground">Options A, B, C, D are assumed to be in the image.</p>
                </div>
           );
       }
       if (q.type === 'text' && q.question.text) {
           return (
                <div className="space-y-2 mathjax-dialog-preview">
                   <p className="text-sm font-medium">Question Text:</p>
                   <div className="prose prose-sm dark:prose-invert max-w-none border p-3 rounded-md text-foreground bg-background">
                       <div dangerouslySetInnerHTML={{ __html: q.question.text.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}></div>
                   </div>
                   <p className="text-sm font-medium mt-2">Options:</p>
                    <ul className="list-none space-y-1 pl-2 text-sm">
                       <li><span className="font-semibold">A:</span> <span dangerouslySetInnerHTML={{ __html: (q.options.A || "").replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}></span></li>
                       <li><span className="font-semibold">B:</span> <span dangerouslySetInnerHTML={{ __html: (q.options.B || "").replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}></span></li>
                       <li><span className="font-semibold">C:</span> <span dangerouslySetInnerHTML={{ __html: (q.options.C || "").replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}></span></li>
                       <li><span className="font-semibold">D:</span> <span dangerouslySetInnerHTML={{ __html: (q.options.D || "").replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}></span></li>
                    </ul>
                </div>
           );
       }
       return <p className="text-sm text-muted-foreground">[Question content not available]</p>;
   }


  return (
    <>
    <Script
        id="mathjax-script-edit-dialog" 
        src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
        strategy="lazyOnload"
        onLoad={() => {
            if (isOpen) typesetMathJax();
        }}
      />
    <Dialog open={isOpen} onOpenChange={(open) => {if (!open) onClose();}}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Question: {question.id}</DialogTitle>
          <DialogDescription>
            Update the correct answer, explanation, and marks. Question content cannot be changed here.
          </DialogDescription>
        </DialogHeader>

         <div className="my-4 p-4 border rounded-md bg-muted/30 max-h-60 overflow-y-auto">
             <h4 className="text-base font-semibold mb-2">Question Preview</h4>
            {renderQuestionPreview(question)}
         </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
             <FormField
                control={form.control}
                name="correctAnswer"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Correct Answer *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
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
                name="marks"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Marks *</FormLabel>
                        <FormControl>
                            <Input
                                type="number"
                                {...field}
                                onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} 
                                min="1"
                                placeholder="Marks for correct answer"
                                disabled={isLoading}
                                className="w-full md:w-[180px]"
                             />
                         </FormControl>
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
                    <FormControl>
                       <Textarea placeholder="Provide a detailed explanation. Use $...$ or $$...$$ for MathJax." {...field} value={field.value ?? ''} rows={4} disabled={isLoading} className="mathjax-dialog-preview"/>
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="explanationImage"
                render={() => ( 
                <FormItem>
                    <FormLabel>Explanation Image (Optional)</FormLabel>
                    <FormControl>
                        <div className="flex flex-wrap items-center gap-4">
                            <Input
                                id="explanation-image-edit-upload"
                                type="file"
                                accept={ACCEPTED_IMAGE_TYPES.join(',')}
                                ref={explanationFileInputRef}
                                onChange={(e) => handleFileChange(e, setExplanationImagePreview)}
                                className="hidden"
                                disabled={isLoading}
                            />
                             <Button type="button" variant="outline" size="sm" onClick={() => explanationFileInputRef.current?.click()} disabled={isLoading}>
                                <Upload className="mr-2 h-4 w-4" /> Upload New
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => handlePasteImage(setExplanationImagePreview)} disabled={isLoading}>
                                <ClipboardPaste className="mr-2 h-4 w-4" /> Paste
                            </Button>
                             {explanationImagePreview && (
                                <div className="relative h-24 w-auto border rounded-md overflow-hidden group">
                                    <Image src={explanationImagePreview} alt="Explanation Preview" height={96} width={150} style={{ objectFit: 'contain' }} data-ai-hint="explanation image" unoptimized/>
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-70 hover:!opacity-100 z-10"
                                        onClick={removeImage} 
                                        disabled={isLoading}
                                        title="Remove Image"
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </FormControl>
                    <FormMessage />
                     <p className="text-xs text-muted-foreground">Uploading or pasting will replace the existing image. Click remove (X) to delete it.</p>
                </FormItem>
                )}
            />
             <FormField
                control={form.control}
                name="removeExplanationImage"
                render={({ field }) => <input type="hidden" {...field} value={field.value ? 'true' : 'false'} />}
             />
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
                <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    </>
  );
}
