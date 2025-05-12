// src/app/doubt-solving/page.tsx
'use client';

import { useState, type ChangeEvent, useRef, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from 'next/image';
import { Loader2, Upload, X, MessageSquareText, Info, AlertTriangle, ClipboardPaste } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
// Corrected import name from solveDoubt to solveDoubtWithGemini
import { solveDoubtWithGemini, type SolveDoubtInput } from '@/ai/flows/custom-doubt-solving-flow'; 
import { useAuth } from '@/context/auth-context';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Skeleton } from '@/components/ui/skeleton';

// Constants for image handling
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export default function DoubtSolvingPage() {
  const { user, loading: authLoading } = useAuth();
  const [questionText, setQuestionText] = useState<string>('');
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [generatedAnswer, setGeneratedAnswer] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPremiumUser = user && user.model !== 'free';

  const typesetMathJax = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).MathJax?.typesetPromise) {
        const mathJax = (window as any).MathJax;
        // Ensure MathJax is fully configured before typesetting
        mathJax.startup.promise.then(() => {
            const elements = document.querySelectorAll('#ai-answer-content');
            if (elements.length > 0) {
                mathJax.typesetPromise(Array.from(elements))
                    .catch((err: any) => console.error('MathJax typesetting failed:', err));
            }
        }).catch((err:any) => console.error("MathJax startup promise failed:", err));
    }
  }, []);

  useEffect(() => {
    const scriptId = 'mathjax-script';
    if (!document.getElementById(scriptId) && typeof window !== 'undefined') {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
      script.async = true;
      document.head.appendChild(script);

      (window as any).MathJax = {
        tex: {
          inlineMath: [['$', '$'], ['\\(', '\\)']],
          displayMath: [['$$', '$$'], ['\\[', '\\]']],
          processEscapes: true,
        },
        svg: {
          fontCache: 'global'
        },
        options: {
          skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre'],
        },
         startup: {
          ready: () => {
            if((window as any).MathJax?.startup?.defaultReady) {
                (window as any).MathJax.startup.defaultReady();
            }
            typesetMathJax(); // Typeset once ready
          }
        }
      };
    }
  }, [typesetMathJax]);

  useEffect(() => {
    if (generatedAnswer) {
        const timerId = setTimeout(() => typesetMathJax(), 50); // Delay to ensure content is in DOM
        return () => clearTimeout(timerId);
    }
  }, [generatedAnswer, typesetMathJax]);

  const processImageFile = useCallback((file: File | null) => {
      if (file) {
          if (file.size > MAX_FILE_SIZE) {
              toast({
                  variant: "destructive",
                  title: "Image Too Large",
                  description: `Please upload an image smaller than ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
              });
              return false;
          }
          if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
              toast({
                  variant: "destructive",
                  title: "Invalid File Type",
                  description: "Please use JPG, PNG, or WEBP format.",
              });
              return false;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
              const result = reader.result as string;
              setImageDataUri(result);
              setImagePreview(result);
          };
          reader.onerror = (error) => {
              console.error("Error reading file:", error);
              toast({ variant: "destructive", title: "File Read Error", description: "Could not read image."});
          };
          reader.readAsDataURL(file);
          return true;
      } else {
          setImageDataUri(null);
          setImagePreview(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return false;
      }
  }, [toast]);

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processImageFile(file);
    if (event.target) event.target.value = "";
  };

  const removeImage = () => {
    setImageDataUri(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

   const handlePasteImage = useCallback(async () => {
    if (!navigator.clipboard?.read) {
      toast({ variant: "destructive", title: "Clipboard API Not Supported"});
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      const imageBlob = items.find(item => item.types.some(type => type.startsWith('image/')))?.getType(items.find(item => item.types.some(type => type.startsWith('image/')))!.types.find(type => type.startsWith('image/'))!);
      if (imageBlob) {
        const imageFile = new File([await imageBlob], `pasted_doubt_${Date.now()}.png`, { type: (await imageBlob).type });
        if (processImageFile(imageFile)) toast({ title: "Image Pasted!" });
      } else {
        toast({ variant: "destructive", title: "No Image Found"});
      }
    } catch (error: any) {
      console.error("Paste image error:", error);
      toast({ variant: "destructive", title: "Paste Failed", description: error.name === 'NotAllowedError' ? "Clipboard permission denied." : "Could not paste image."});
    }
  }, [processImageFile, toast]);

  const handleGetAnswer = async () => {
    if (!questionText && !imageDataUri) {
      toast({ variant: "destructive", title: "Input Required", description: "Please enter question or upload image."});
      return;
    }
    setIsLoading(true);
    setGeneratedAnswer('');
    const input: SolveDoubtInput = {
      questionText: questionText || undefined,
      imageDataUri: imageDataUri || undefined,
    };
    try {
      // Use the corrected function name here
      const result = await solveDoubtWithGemini(input); 
      setGeneratedAnswer(result.answer);
      toast({ title: "Answer Generated!", description: "EduNexus by GODWIN has provided an answer."});
    } catch (error: any) {
      console.error("Failed to get answer:", error);
      toast({ variant: "destructive", title: "Generation Failed", description: error.message || "Could not get answer."});
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
     return (
        <div className="max-w-3xl mx-auto space-y-6 p-4">
            <Skeleton className="h-10 w-1/2 mx-auto" />
            <Skeleton className="h-6 w-3/4 mx-auto mb-6" />
            <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-10 w-1/4" /></CardContent><CardFooter><Skeleton className="h-10 w-32" /></CardFooter></Card>
        </div>
     );
  }

  if (!isPremiumUser) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 text-center p-4">
         <h1 className="text-3xl font-bold tracking-tight">Doubt Solving</h1>
         <Alert variant="default" className="text-left bg-primary/5 border-primary/20">
           <AlertTriangle className="h-4 w-4 text-primary" />
           <AlertTitle className="text-primary">Premium Feature</AlertTitle>
           <AlertDescription>AI Doubt Solving is available for premium users. Upgrade your plan.</AlertDescription>
         </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">
      <h1 className="text-3xl font-bold tracking-tight text-center">Doubt Solving</h1>
      <p className="text-muted-foreground text-center">Get help from EduNexus by GODWIN.</p>
      <Card>
        <CardHeader><CardTitle>Ask Your Doubt</CardTitle><CardDescription>Enter question or upload image.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label htmlFor="question-text">Type question (optional if image)</Label><Textarea id="question-text" placeholder="e.g., Explain hybridization. Use $E=mc^2$ for math." value={questionText} onChange={(e) => setQuestionText(e.target.value)} rows={4} disabled={isLoading} /></div>
          <div className="space-y-2"><Label htmlFor="image-upload">Upload image (optional)</Label>
            <div className="flex items-center gap-2 flex-wrap">
                <Input id="image-upload" type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')} onChange={handleImageChange} className="hidden" ref={fileInputRef} disabled={isLoading} />
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isLoading}><Upload className="mr-2 h-4 w-4" /> Choose</Button>
                 <Button type="button" variant="outline" onClick={handlePasteImage} disabled={isLoading}><ClipboardPaste className="mr-2 h-4 w-4" /> Paste</Button>
                 {imagePreview && (<div className="relative h-20 w-20 border rounded-md overflow-hidden"><Image src={imagePreview} alt="Doubt Preview" layout="fill" objectFit="cover" /><Button type="button" variant="destructive" size="icon" className="absolute top-0.5 right-0.5 h-5 w-5 opacity-70 hover:opacity-100" onClick={removeImage} disabled={isLoading}><X className="h-3 w-3" /></Button></div>)}
            </div>
            <p className="text-xs text-muted-foreground">Max 4MB. JPG, PNG, WEBP.</p>
          </div>
        </CardContent>
        <CardFooter><Button onClick={handleGetAnswer} disabled={isLoading || (!questionText && !imageDataUri)}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareText className="mr-2 h-4 w-4" />} Get Answer</Button></CardFooter>
      </Card>
      {generatedAnswer && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2"><CardTitle>EduNexus by GODWIN Says:</CardTitle>
                 <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground"><Info className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent side="top" align="start" className="max-w-xs"><p className="text-xs">AI may make mistakes. Verify critical info.</p></TooltipContent></Tooltip></TooltipProvider>
            </div>
          </CardHeader>
          <CardContent><div id="ai-answer-content" className="prose dark:prose-invert max-w-none prose-sm" dangerouslySetInnerHTML={{ __html: generatedAnswer.replace(/\$(.*?)\$/g, '\\($1\\)').replace(/\$\$(.*?)\$\$/g, '\\[$1\\]') }}></div></CardContent>
        </Card>
      )}
       {isLoading && !generatedAnswer && (<Card><CardContent className="p-6 flex items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Thinking...</CardContent></Card>)}
    </div>
  );
}
