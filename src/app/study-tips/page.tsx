// src/app/study-tips/page.tsx
'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStudyTips, type StudyTipInput } from '@/ai/flows/study-tip-flow'; // Import the flow

export default function StudyTipsPage() {
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
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
            <label className="text-sm font-medium">Exam</label>
            <Select onValueChange={setExam} value={exam} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Select Exam" />
              </SelectTrigger>
              <SelectContent>
                {exams.map((ex) => <SelectItem key={ex} value={ex}>{ex}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Subject Select */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Subject</label>
            <Select onValueChange={setSubject} value={subject} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Select Subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((sub) => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

           {/* Topic Select */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Topic</label>
             <Select onValueChange={setTopic} value={topic} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Select Topic" />
              </SelectTrigger>
              <SelectContent>
                {topics.map((top) => <SelectItem key={top} value={top}>{top}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Difficulty Select */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Difficulty Level</label>
             <Select onValueChange={setDifficulty} value={difficulty} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Select Difficulty" />
              </SelectTrigger>
              <SelectContent>
                {difficulties.map((diff) => <SelectItem key={diff} value={diff}>{diff}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleGenerateTips} disabled={isLoading || !exam || !subject || !topic || !difficulty}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            Generate Tips
          </Button>
        </CardFooter>
      </Card>

      {/* Display Generated Tips */}
      {generatedTips && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Study Tips</CardTitle>
            <CardDescription>Tips tailored for {topic} ({difficulty}) in {subject} for {exam}.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Use whitespace-pre-wrap to preserve line breaks from AI */}
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{generatedTips}</p>
          </CardContent>
        </Card>
      )}
       {isLoading && !generatedTips && (
         <Card>
            <CardContent className="p-6 flex items-center justify-center text-muted-foreground">
               <Loader2 className="mr-2 h-5 w-5 animate-spin" />
               Generating tips...
            </CardContent>
         </Card>
       )}
    </div>
  );
}
