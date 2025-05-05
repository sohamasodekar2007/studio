'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { recommendResources, type ResourceRecommendationInput, type ResourceRecommendationOutput } from '@/ai/flows/resource-recommendation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";


const formSchema = z.object({
  learningGoals: z.string().min(10, { message: 'Please describe your learning goals in at least 10 characters.' }).max(500),
  pastPerformance: z.string().min(10, { message: 'Please describe your past performance or experience in at least 10 characters.' }).max(500),
});

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<ResourceRecommendationOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      learningGoals: '',
      pastPerformance: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setError(null);
    setRecommendations(null); // Clear previous recommendations

    try {
        console.log("Sending to AI:", values);
      const result = await recommendResources(values);
      console.log("Received from AI:", result);
      setRecommendations(result);
      toast({
        title: "Recommendations Generated!",
        description: "Your personalized resource suggestions are ready.",
      });
    } catch (err) {
      console.error("Error fetching recommendations:", err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(`Failed to get recommendations: ${errorMessage}`);
      toast({
        title: "Error",
        description: `Could not fetch recommendations. ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Personalized Recommendations</h1>
      <p className="text-muted-foreground">
        Tell us about your learning aspirations and experience, and our AI will suggest relevant resources for you.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Find Your Next Learning Step</CardTitle>
          <CardDescription>Fill out the form below to get AI-powered recommendations.</CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="learningGoals"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Learning Goals</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g., Master React state management, understand data structures, build a full-stack application..." {...field} />
                    </FormControl>
                    <FormDescription>
                      What specific skills or topics do you want to learn? Be as detailed as possible.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pastPerformance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Past Performance / Experience</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g., Completed a beginner Python course, comfortable with HTML/CSS, built small projects with Node.js..." {...field} />
                    </FormControl>
                    <FormDescription>
                      Describe your current knowledge level, relevant courses taken, or projects completed.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? 'Generating...' : 'Get Recommendations'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      {error && (
         <Alert variant="destructive">
           <Terminal className="h-4 w-4" />
           <AlertTitle>Error</AlertTitle>
           <AlertDescription>{error}</AlertDescription>
         </Alert>
      )}

      {recommendations && (
        <Card>
          <CardHeader>
            <CardTitle>Recommended Resources</CardTitle>
            <CardDescription>Here are some resources tailored to your goals and experience:</CardDescription>
          </CardHeader>
          <CardContent className="prose max-w-none dark:prose-invert">
            {/* Displaying the raw string for now, consider parsing if format is consistent */}
            <pre className="whitespace-pre-wrap text-sm">{recommendations.recommendedResources}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
