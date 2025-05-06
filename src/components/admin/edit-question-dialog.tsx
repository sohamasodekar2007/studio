'use client';

import { useState, useRef, useCallback, useEffect, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input"; // For potential future use
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Image as ImageIcon, FileText, Upload, ClipboardPaste, X, Info } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import type { QuestionBankItem } from '@/types';
import { updateQuestionDetails } from '@/actions/question-bank-actions'; // Server action for updating

// --- Zod Schema Definition for Editing ---
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const editQuestionSchema = z.object({
  // Readonly fields (passed via props, not part of form state for editing core fields)
  // questionId: z.string(),
  // subject: z.string(),
  // lesson: z.string(),

  // Editable fields
  correctAnswer: z.enum(["A", "B", "C", "D"], { required_error: "Correct answer is required" }),
  explanationText: z.string().optional(),
  explanationImage: z.any().optional(), // Use 'any' for File object or existing filename string
  removeExplanationImage: z.boolean().optional(), // Hidden field to signal image removal
});

type EditQuestionFormValues = z.infer<typeof editQuestionSchema>;

interface EditQuestionDialogProps {
  question: QuestionBankItem;
  isOpen: boolean;
  onClose: () => void;
  onQuestionUpdate: (updatedQuestion: QuestionBankItem) => void; // Callback to update parent list
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
      explanationImage: question.explanation.image || null, // Store initial filename if exists
      removeExplanationImage: false,
    },
  });

   // Effect to set initial image preview if an image exists
   useEffect(() => {
       if (question.explanation.image && typeof question.explanation.image === 'string') {
           // Construct the potential path to the image based on convention
           // IMPORTANT: This path might need adjustment based on how images are served publicly
           const imagePath = `/question_bank_images/${question.subject}/${question.lesson}/${question.explanation.image}`;
           setExplanationImagePreview(imagePath);
       } else {
           setExplanationImagePreview(null);
       }
       // Reset form when question changes (important if dialog is reused)
        form.reset({
            correctAnswer: question.correct,
            explanationText: question.explanation.text || '',
            explanationImage: question.explanation.image || null,
            removeExplanationImage: false,
        });

   }, [question, form]);


   // --- Image Handling Callbacks (Similar to Add Question) ---
   const processImageFile = useCallback((
    file: File | null,
    setPreview: (url: string | null) => void
  ) => {
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        form.setError('explanationImage', { type: 'manual', message: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit.` });
        setPreview(null);
        return;
      }
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        form.setError('explanationImage', { type: 'manual', message: 'Invalid file type. Use JPG, PNG, or WEBP.' });
        setPreview(null);
        return;
      }

      form.clearErrors('explanationImage');
      form.setValue('explanationImage', file); // Set File object
      form.setValue('removeExplanationImage', false); // Ensure remove flag is off if new image added
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      // If file is nullified (e.g., by removeImage), keep the field null
      // form.setValue('explanationImage', null); // This might clear the existing filename unintentionally
      setPreview(null);
    }
  }, [form]);

   const handleFileChange = useCallback((
    event: ChangeEvent<HTMLInputElement>,
    setPreview: (url: string | null) => void
  ) => {
    const file = event.target.files?.[0] || null;
    processImageFile(file, setPreview);
    if (event.target) event.target.value = "";
  }, [processImageFile]);

   const removeImage = useCallback(() => {
        // Clear preview
        setExplanationImagePreview(null);
        // Reset file input
        if (explanationFileInputRef.current) explanationFileInputRef.current.value = "";
        // Set the File object to null in the form state
        form.setValue('explanationImage', null);
        // Explicitly set the flag to remove the existing image on the server
        form.setValue('removeExplanationImage', true);
        // Clear any validation errors
        form.clearErrors('explanationImage');
   }, [form]);


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
         processImageFile(imageFile, setPreview);
         toast({ title: "Image Pasted Successfully!" });
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
   // --- End Image Handling ---


  const onSubmit = async (data: EditQuestionFormValues) => {
    setIsLoading(true);
    try {
        const formData = new FormData();
        formData.append('questionId', question.id);
        formData.append('subject', question.subject);
        formData.append('lesson', question.lesson);
        formData.append('correctAnswer', data.correctAnswer);
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
        onQuestionUpdate(result.question); // Pass updated question back to parent
        onClose(); // Close the dialog

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
        if (q.type === 'image' && q.question.image) {
            // IMPORTANT: Adjust this path based on how images are served
            const imagePath = `/question_bank_images/${q.subject}/${q.lesson}/${q.question.image}`;
             return (
                <div className="space-y-2">
                    <p className="text-sm font-medium">Question Image:</p>
                    <Image src={imagePath} alt="Question Image Preview" width={300} height={200} className="rounded border max-w-full h-auto" />
                     <p className="text-xs text-muted-foreground">Options A, B, C, D are assumed to be in the image.</p>
                </div>
            );
        }
        if (q.type === 'text' && q.question.text) {
            return (
                 <div className="space-y-2">
                    <p className="text-sm font-medium">Question Text:</p>
                    <div className="prose prose-sm dark:prose-invert max-w-none border p-3 rounded-md text-foreground">
                        {/* Render MathJax content dangerously */}
                        <p dangerouslySetInnerHTML={{ __html: q.question.text.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}></p>
                    </div>
                    <p className="text-sm font-medium mt-2">Options:</p>
                     <ul className="list-disc list-inside pl-4 text-sm">
                        <li>A: {q.options.A}</li>
                        <li>B: {q.options.B}</li>
                        <li>C: {q.options.C}</li>
                        <li>D: {q.options.D}</li>
                     </ul>
                 </div>
            );
        }
        return <p className="text-sm text-muted-foreground">[Question content not available]</p>;
    }


  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl"> {/* Wider dialog */}
        <DialogHeader>
          <DialogTitle>Edit Question: {question.id}</DialogTitle>
          <DialogDescription>
            Update the correct answer and explanation. Question content cannot be changed here.
          </DialogDescription>
        </DialogHeader>

         {/* Display Question Preview */}
         <div className="my-4 p-4 border rounded-md bg-muted/30 max-h-60 overflow-y-auto">
             <h4 className="text-base font-semibold mb-2">Question Preview</h4>
            {renderQuestionPreview(question)}
         </div>


        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Correct Answer */}
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

            {/* Explanation Text */}
             <FormField
                control={form.control}
                name="explanationText"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Explanation Text</FormLabel>
                    <FormControl>
                    <Textarea placeholder="Provide a detailed explanation. Use $...$ or $$...$$ for MathJax." {...field} value={field.value ?? ''} rows={4} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />

            {/* Explanation Image */}
            <FormField
                control={form.control}
                name="explanationImage" // Name matches schema
                render={({ field }) => ( // field contains value, onChange etc.
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
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => explanationFileInputRef.current?.click()}
                                disabled={isLoading}
                            >
                                <Upload className="mr-2 h-4 w-4" /> Upload New Image
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handlePasteImage(setExplanationImagePreview)}
                                disabled={isLoading}
                            >
                                <ClipboardPaste className="mr-2 h-4 w-4" /> Paste Image
                            </Button>
                             {explanationImagePreview && (
                                <div className="relative h-24 w-auto border rounded-md overflow-hidden group">
                                    <Image src={explanationImagePreview} alt="Explanation Preview" height={96} width={150} style={{ objectFit: 'contain' }} />
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-70 hover:!opacity-100 z-10"
                                        onClick={removeImage} // Use removeImage callback
                                        disabled={isLoading}
                                        title="Remove Image"
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            )}
                             {!explanationImagePreview && field.value && typeof field.value === 'string' && (
                                 <p className="text-xs text-muted-foreground italic">(No new image selected)</p>
                             )}
                        </div>
                    </FormControl>
                    <FormMessage />
                     <p className="text-xs text-muted-foreground">Uploading or pasting will replace the existing image.</p>
                </FormItem>
                )}
            />
             {/* Hidden field for remove flag */}
             <FormField
                control={form.control}
                name="removeExplanationImage"
                render={({ field }) => <input type="hidden" {...field} value={field.value?.toString()} />}
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
  );
}
