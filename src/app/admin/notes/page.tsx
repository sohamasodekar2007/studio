'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Construction, FileText } from "lucide-react";

export default function AdminNotesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Short Notes Management</h1>
      <p className="text-muted-foreground">Create and manage short notes for various subjects and topics (Coming Soon).</p>

      <Card className="text-center">
        <CardHeader>
           <div className="mx-auto bg-primary/10 rounded-full p-3 w-fit">
               <Construction className="h-8 w-8 text-primary" />
           </div>
          <CardTitle className="mt-4">Under Construction</CardTitle>
          <CardDescription>Short notes management features are currently under development.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This section will allow you to:
          </p>
          <ul className="list-disc list-inside text-left max-w-md mx-auto mt-2 text-muted-foreground">
            <li>Create new notes using a rich text editor.</li>
            <li>Organize notes by subject, chapter, or topic.</li>
            <li>Upload associated images or diagrams.</li>
            <li>Edit and update existing notes.</li>
            <li>Manage note visibility (e.g., free vs. premium).</li>
            <li>Search and filter notes.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
