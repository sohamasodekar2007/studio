'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function PyqMockTestsPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-center">PYQ Mock Tests</h1>
      <p className="text-muted-foreground text-center">Full syllabus mock tests based on previous year questions.</p>

       <Card className="text-center border-dashed border-amber-500 bg-amber-50 dark:bg-amber-950">
        <CardHeader>
          <div className="mx-auto bg-primary/10 rounded-full p-3 w-fit">
            <Construction className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="mt-4">Under Construction</CardTitle>
          <CardDescription>The PYQ Mock Tests feature is currently under development.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Soon you'll be able to attempt full-length mock tests created using actual questions from past MHT-CET, JEE, and NEET exams.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
