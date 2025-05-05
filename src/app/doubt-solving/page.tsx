// src/app/doubt-solving/page.tsx
'use client';

import { useState, type ChangeEvent, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from 'next/image';
import { Loader2, Upload, X, MessageSquareText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getDoubtAnswer, type DoubtSolvingInput } from '@/ai/flows/doubt-solving-flow'; // Import the new flow

export default function DoubtSolvingPage() {
  const [questionText, setQuestionText] = useState<string>('');
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [generatedAnswer, setGeneratedAnswer] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
              placeholder="e.g., Explain the concept of hybridization..."
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
          <CardHeader>
            <CardTitle>EduNexus by GODWIN Says:</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Use whitespace-pre-wrap to preserve line breaks from AI */}
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{generatedAnswer}</p>
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
