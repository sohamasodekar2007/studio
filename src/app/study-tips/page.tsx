'use client';

import { useState, useCallback, useRef, useEffect, ChangeEvent } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Wand2, MessageSquareText, Info, AlertTriangle, ClipboardPaste } from "lucide-react"; // Added ClipboardPaste
import { useToast } from "@/hooks/use-toast";
import { getStudyTips, type StudyTipInput } from '@/ai/flows/study-tip-flow'; // Import the flow
import { useAuth } from '@/context/auth-context'; // Import useAuth
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"; // Import Alert components
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Import Tooltip components
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';

// Constants for image handling
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];


export default function StudyTipsPage() {
  const { user, loading: authLoading } = useAuth();
  const [exam, setExam] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [topic, setTopic] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('');
  const [generatedTips, setGeneratedTips] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const exams = ["MHT-CET", "JEE Main", "JEE Advanced", "NEET"];
  const subjects = ["Physics", "Chemistry", "Mathematics", "Biology"];
  // Add more specific topics later or fetch dynamically
  const topics = ["Calculus", "Organic Chemistry", "Mechanics", "Genetics", "Thermodynamics", "Optics"];
  const difficulties = ["Beginner", "Intermediate", "Advanced"];

  const isPremiumUser = user && user.model !== 'free';

  const handleGenerateTips = async () => {
    if (!exam || !subject || !topic || !difficulty) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please select exam, subject, topic, and difficulty.",
      });
      return;
    }

    setIsLoading(true);
    setGeneratedTips(''); // Clear previous tips

    const input: StudyTipInput = {
      exam,
      subject,
      topic,
      difficultyLevel: difficulty,
    };

    try {
      const result = await getStudyTips(input);
      setGeneratedTips(result.tips);
      toast({
        title: "Study Tips Generated!",
        description: "Here are some personalized tips for you.",
      });
    } catch (error: any) {
      console.error("Failed to generate study tips:", error);
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: error.message || "Could not generate tips. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted/30">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isPremiumUser) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <AlertTriangle className="h-12 w-12 text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Premium Access Required</h1>
        <p className="text-muted-foreground">AI Study Tips are a premium feature. Upgrade to access personalized advice.</p>
         {/* TODO:  Add Upgrade Button Here */}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-center">AI Study Tips Generator</h1>
      <p className="text-muted-foreground text-center">Get personalized study tips based on your selected exam, subject, topic, and difficulty.</p>

      <Card>
        <CardHeader>
          <CardTitle>Configure Your Tips</CardTitle>
          <CardDescription>Select the details for which you need study advice.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Exam Select */}
          <div className="space-y-2">
            <Label htmlFor="exam">Exam</Label>
            <Select onValueChange={setExam} value={exam} disabled={isLoading}>
              <SelectTrigger id="exam">
                <SelectValue placeholder="Select Exam" />
              </SelectTrigger>
              <SelectContent>
                {exams.map((ex) => <SelectItem key={ex} value={ex}>{ex}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Subject Select */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Select onValueChange={setSubject} value={subject} disabled={isLoading}>
              <SelectTrigger id="subject">
                <SelectValue placeholder="Select Subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((sub) => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

           {/* Topic Select */}
          <div className="space-y-2">
            <Label htmlFor="topic">Topic</Label>
             <Select onValueChange={setTopic} value={topic} disabled={isLoading}>
              <SelectTrigger id="topic">
                <SelectValue placeholder="Select Topic" />
              </SelectTrigger>
              <SelectContent>
                {topics.map((top) => <SelectItem key={top} value={top}>{top}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Difficulty Select */}
          <div className="space-y-2">
            <Label htmlFor="difficulty">Difficulty Level</Label>
             <Select onValueChange={setDifficulty} value={difficulty} disabled={isLoading}>
              <SelectTrigger id="difficulty">
                <SelectValue placeholder="Select Difficulty" />
              </SelectTrigger>
              <SelectContent>
                {difficulties.map((diff) => <SelectItem key={diff} value={diff}>{diff}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleGenerateTips} disabled={isLoading || !exam || !subject || !topic || !difficulty} className="w-full sm:w-auto">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            Generate Tips
          </Button>
        </CardFooter>
      </Card>

      {/* Display Generated Tips */}
      {generatedTips && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Generated Study Tips</CardTitle>
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
            <Textarea
              value={generatedTips}
              readOnly
              className="min-h-[100px] text-sm text-muted-foreground whitespace-pre-wrap"
            />
          </CardContent>
        </Card>
      )}
       {isLoading && !generatedTips && (
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
