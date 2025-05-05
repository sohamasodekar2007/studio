'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { BarChart3, Construction } from "lucide-react";

export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Platform Analytics</h1>
      <p className="text-muted-foreground">View usage statistics and performance metrics (Coming Soon).</p>

      <Card className="text-center">
        <CardHeader>
           <div className="mx-auto bg-primary/10 rounded-full p-3 w-fit">
               <Construction className="h-8 w-8 text-primary" />
           </div>
          <CardTitle className="mt-4">Under Construction</CardTitle>
          <CardDescription>Analytics features are currently under development.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This section will provide insights into:
          </p>
          <ul className="list-disc list-inside text-left max-w-md mx-auto mt-2 text-muted-foreground">
            <li>User engagement (active users, session duration).</li>
            <li>Test performance trends (average scores, completion rates).</li>
            <li>Most popular tests and subjects.</li>
            <li>Signup and conversion rates.</li>
            <li>Revenue analytics (if applicable).</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
