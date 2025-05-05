// src/app/doubt-solving/page.tsx
'use client';

import { useState, type ChangeEvent, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from 'next/image';
import { Loader2, Upload, X, MessageSquareText, Info, AlertTriangle } from "lucide-react"; // Added Info, AlertTriangle
import { useToast } from "@/hooks/use-toast";
import { getDoubtAnswer, type DoubtSolvingInput } from '@/ai/flows/doubt-solving-flow';
import { useAuth } from '@/context/auth-context'; // Import useAuth
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"; // Import Alert components
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Import Tooltip components
import { Skeleton } from '@/components/ui/skeleton';

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

  // --- MathJax Integration ---
  useEffect(() => {
    const scriptId = 'mathjax-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
      script.async = true;
      document.head.appendChild(script);

      // Configure MathJax
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
      };
    }
  }, []); // Load MathJax script once on mount

  useEffect(() => {
    // Trigger MathJax typesetting when generatedAnswer changes and MathJax is loaded
    if (generatedAnswer && (window as any).MathJax?.typesetPromise) {
      const answerElement = document.getElementById('ai-answer-content');
      if (answerElement) {
        (window as any).MathJax.typesetPromise([answerElement])
          .catch((err: any) => console.error('MathJax typesetting failed:', err));
      }
    }
  }, [generatedAnswer]); // Re-run when answer changes
  // --- End MathJax Integration ---

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) { // Limit file size (e.g., 4MB)
        toast({
          variant: "destructive",
          title: "Image Too Large",
          description: "Please upload an image smaller than 4MB.",
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImageDataUri(result); // Store the full data URI
        setImagePreview(result); // For display
      };
      reader.onerror = (error) => {
        console.error("Error reading file:", error);
        toast({
          variant: "destructive",
          title: "File Read Error",
          description: "Could not read the selected image.",
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageDataUri(null);
    setImagePreview(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Reset file input
    }
  };

  const handleGetAnswer = async () => {
    if (!questionText && !imageDataUri) {
      toast({
        variant: "destructive",
        title: "Input Required",
        description: "Please enter a question or upload an image.",
      });
      return;
    }

    setIsLoading(true);
    setGeneratedAnswer(''); // Clear previous answer

    const input: DoubtSolvingInput = {
      questionText: questionText || undefined, // Send undefined if empty
      imageDataUri: imageDataUri || undefined, // Send undefined if null
    };

    try {
      const result = await getDoubtAnswer(input);
      setGeneratedAnswer(result.answer);
      toast({
        title: "Answer Generated!",
        description: "EduNexus by GODWIN has provided an answer.",
      });
    } catch (error: any) {
      console.error("Failed to get answer:", error);
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: error.message || "Could not get an answer. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Render Loading Skeleton if auth is loading
  if (authLoading) {
     return (
        <div className="max-w-3xl mx-auto space-y-6">
            <Skeleton className="h-8 w-1/2 mx-auto" />
            <Skeleton className="h-6 w-3/4 mx-auto" />
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/4" />
                    <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                 <CardContent className="space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-10 w-1/3" />
                 </CardContent>
                 <CardFooter>
                    <Skeleton className="h-10 w-28" />
                 </CardFooter>
            </Card>
        </div>
     );
  }

  // Render Premium Access Message if not a premium user
  if (!isPremiumUser) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 text-center">
         <h1 className="text-3xl font-bold tracking-tight">Doubt Solving</h1>
         <Alert variant="default" className="text-left bg-primary/5 border-primary/20">
           <AlertTriangle className="h-4 w-4 text-primary" />
           <AlertTitle className="text-primary">Premium Feature</AlertTitle>
           <AlertDescription>
             AI Doubt Solving is available for premium users. Upgrade your plan to get instant answers to your questions from EduNexus by GODWIN.
           </AlertDescription>
           {/* Optional: Add an upgrade button */}
           {/* <Button size="sm" className="mt-4">Upgrade Plan</Button> */}
         </Alert>
      </div>
    );
  }

  // Render Doubt Solving Page for Premium Users
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-center">Doubt Solving</h1>
      <p className="text-muted-foreground text-center">Get help with your MHT-CET, JEE, or NEET questions from EduNexus by GODWIN.</p>

      <Card>
        <CardHeader>
          <CardTitle>Ask Your Doubt</CardTitle>
          <CardDescription>Enter your question below or upload an image.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Text Input */}
          <div className="space-y-2">
            <Label htmlFor="question-text">Type your question (optional if uploading image)</Label>
            <Textarea
              id="question-text"
              placeholder="e.g., Explain the concept of hybridization. Use $ E = mc^2 $ or $$ \\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2} $$ for math."
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={4}
              disabled={isLoading}
            />
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <Label htmlFor="image-upload">Upload an image of your doubt (optional)</Label>
            <div className="flex items-center gap-4">
                <Input
                    id="image-upload"
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleImageChange}
                    className="hidden" // Hide default input
                    ref={fileInputRef}
                    disabled={isLoading}
                />
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()} // Trigger hidden input
                    disabled={isLoading}
                >
                    <Upload className="mr-2 h-4 w-4" /> Choose Image
                </Button>
                 {imagePreview && (
                    <div className="relative h-20 w-20 border rounded-md overflow-hidden">
                        <Image src={imagePreview} alt="Doubt Preview" layout="fill" objectFit="cover" />
                        <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-5 w-5 opacity-70 hover:opacity-100"
                            onClick={removeImage}
                            disabled={isLoading}
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                 )}
            </div>
            <p className="text-xs text-muted-foreground">Max file size: 4MB. Allowed types: PNG, JPG, WEBP.</p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleGetAnswer} disabled={isLoading || (!questionText && !imageDataUri)}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareText className="mr-2 h-4 w-4" />}
            Get Answer
          </Button>
        </CardFooter>
      </Card>

      {/* Display Generated Answer */}
      {generatedAnswer && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
                 <CardTitle>EduNexus by GODWIN Says:</CardTitle>
                 {/* Disclaimer Tooltip */}
                 <TooltipProvider delayDuration={100}>
                   <Tooltip>
                     <TooltipTrigger asChild>
                       <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground">
                         <Info className="h-4 w-4" />
                       </Button>
                     </TooltipTrigger>
                     <TooltipContent side="top" align="start" className="max-w-xs">
                       <p className="text-xs">AI models can make mistakes. Verify critical information and use the answer as a guide, not a definitive solution.</p>
                     </TooltipContent>
                   </Tooltip>
                 </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent>
            {/* Container for MathJax rendering */}
            <div id="ai-answer-content" className="text-sm text-muted-foreground prose dark:prose-invert max-w-none prose-sm">
                {/* Render the answer text directly. MathJax will process it. */}
                {generatedAnswer}
            </div>
          </CardContent>
        </Card>
      )}
       {isLoading && !generatedAnswer && (
         <Card>
            <CardContent className="p-6 flex items-center justify-center text-muted-foreground">
               <Loader2 className="mr-2 h-5 w-5 animate-spin" />
               Thinking...
            </CardContent>
         </Card>
       )}
    </div>
  );
}
