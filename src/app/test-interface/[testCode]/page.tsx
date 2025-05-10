// src/app/test-interface/[testCode]/page.tsx
import { getGeneratedTestByCode } from '@/actions/generated-test-actions';
import TestLayoutClient from '@/components/test-interface/test-layout-client';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface TestPageProps {
  params: { testCode: string };
}

export default async function TestInterfacePage({ params }: TestPageProps) {
  const { testCode } = params;
  const testData = await getGeneratedTestByCode(testCode);

  if (!testData) {
    // Gracefully handle test not found on server-side
    return (
        <div className="flex items-center justify-center min-h-screen p-4 bg-background">
            <Card className="w-full max-w-md text-center shadow-xl">
                <CardHeader>
                    <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
                    <CardTitle className="mt-4 text-2xl">Test Not Found</CardTitle>
                    <CardDescription>
                        The test with code "{testCode}" could not be found or is no longer available.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild>
                        <Link href="/tests">Go Back to Test Series</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
  }

  // Check if there are any questions in the test
  const hasQuestions = 
    (testData.testType === 'chapterwise' && testData.questions && testData.questions.length > 0) ||
    (testData.testType === 'full_length' && 
      (testData.test_subject.length > 0 && // Ensure there's at least one subject defined for full length
      ((testData.physics_questions && testData.physics_questions.length > 0) ||
       (testData.chemistry_questions && testData.chemistry_questions.length > 0) ||
       (testData.maths_questions && testData.maths_questions.length > 0) ||
       (testData.biology_questions && testData.biology_questions.length > 0)))
    );

  if (!hasQuestions) {
    return (
        <div className="flex items-center justify-center min-h-screen p-4 bg-background">
            <Card className="w-full max-w-md text-center shadow-xl">
                <CardHeader>
                    <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
                    <CardTitle className="mt-4 text-2xl">No Questions in Test</CardTitle>
                    <CardDescription>
                        This test (Code: "{testData.test_code}") currently has no questions. Please contact support or try another test.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild>
                        <Link href="/tests">Go Back to Test Series</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
  }
  
  return <TestLayoutClient initialTestData={testData} />;
}
