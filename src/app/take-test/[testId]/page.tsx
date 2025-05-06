// src/app/take-test/[testId]/page.tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getGeneratedTestByCode } from "@/actions/generated-test-actions"; // Assuming this fetches the test details
import { notFound } from "next/navigation";
import { Clock, ListChecks, AlertTriangle } from "lucide-react";

export default async function TakeTestPage({ params }: { params: { testId: string } }) {
  const testId = params.testId;
  const test = await getGeneratedTestByCode(testId);

  if (!test) {
    notFound();
  }

  // Basic test information display - Actual test taking logic is complex and would go here
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <Link href="/tests" className="text-sm text-muted-foreground hover:text-primary">
          &larr; Back to Test Series
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl">{test.name}</CardTitle>
          <CardDescription>
            You are about to start the test: <span className="font-semibold">{test.test_code}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ListChecks className="h-5 w-5 text-primary" />
              <span>Total Questions: {test.total_questions}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-5 w-5 text-primary" />
              <span>Duration: {test.duration} minutes</span>
            </div>
          </div>

          <div className="bg-muted/50 p-4 rounded-md">
            <h3 className="font-semibold mb-2 text-lg">Instructions:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Ensure you have a stable internet connection.</li>
              <li>The timer will start once you begin the test.</li>
              <li>Do not refresh the page during the test.</li>
              <li>Answers will be automatically saved (feature coming soon).</li>
              <li>Results will be available after submission (feature coming soon).</li>
            </ul>
          </div>

          <div className="mt-6 p-4 border border-amber-500 bg-amber-50 dark:bg-amber-950 rounded-md text-amber-700 dark:text-amber-300">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold">Test Interface Under Development</h4>
                <p className="text-sm">
                  The actual test-taking interface with questions and options is currently under development.
                  This page serves as a placeholder for the test start.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button size="lg" className="w-full sm:w-auto" disabled>
            Start Test (Coming Soon)
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
