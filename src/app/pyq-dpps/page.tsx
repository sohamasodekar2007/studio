'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function PyqDppsPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-center">PYQ Daily Practice Problems</h1>
      <p className="text-muted-foreground text-center">Practice with questions from previous years' exams.</p>

      <Card className="text-center border-dashed border-amber-500 bg-amber-50 dark:bg-amber-950">
        <CardHeader>
          <div className="mx-auto bg-primary/10 rounded-full p-3 w-fit">
            <Construction className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="mt-4">Under Construction</CardTitle>
          <CardDescription>The PYQ DPPs feature is currently under development.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Soon you'll be able to access daily practice problems sourced directly from previous year MHT-CET, JEE, and NEET papers.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
