'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Construction, ClipboardList } from "lucide-react";

export default function AdminQuestionBankPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Question Bank</h1>
      <p className="text-muted-foreground">Manage questions used across all tests (Coming Soon).</p>

      <Card className="text-center">
        <CardHeader>
           <div className="mx-auto bg-primary/10 rounded-full p-3 w-fit">
               <Construction className="h-8 w-8 text-primary" />
           </div>
          <CardTitle className="mt-4">Under Construction</CardTitle>
          <CardDescription>Question bank management features are currently under development.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This section will allow you to:
          </p>
          <ul className="list-disc list-inside text-left max-w-md mx-auto mt-2 text-muted-foreground">
            <li>Add new questions (MCQ, Numerical, etc.) with solutions and explanations.</li>
            <li>Organize questions by subject, chapter, topic, difficulty level.</li>
            <li>Edit existing questions.</li>
            <li>Search and filter questions.</li>
            <li>Import/Export questions in bulk.</li>
            <li>View question usage statistics in tests.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
