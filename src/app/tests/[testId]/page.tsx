// src/app/tests/[testId]/page.tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, HelpCircle, ListChecks, CheckCircle, Tag, BookOpen, CalendarDays, CheckSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Image from 'next/image';
import Link from "next/link";
import { notFound } from 'next/navigation'; // Import notFound
import { getTestById } from '@/actions/get-tests'; // Import the server action

// Remove mock data fetching function
// async function getTestData(testId: string) { ... }

// --- Page Component ---
export default async function TestDetailPage({ params }: { params: { testId: string } }) {
  // Fetch test data using the server action
  const testData = await getTestById(params.testId);

  if (!testData) {
    // Use Next.js notFound() to render the 404 page
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/tests" className="text-sm text-muted-foreground hover:text-primary mb-4 inline-block">&larr; Back to Test Series</Link>
      <Card className="overflow-hidden bg-card">
        <CardHeader className="relative p-0">
           <Image
                // Use imageUrl from data if available, otherwise fallback to picsum
                src={testData.imageUrl || `https://picsum.photos/seed/${testData.id}/800/300`}
                alt={testData.title}
                width={800}
                height={300}
                className="w-full h-48 object-cover"
                data-ai-hint={testData.imageHint || `${testData.exam} ${testData.subject} test`} // Use imageHint or generate one
                priority // Prioritize loading the main image
            />
             <div className="absolute top-4 right-4 flex gap-1">
                 {testData.status && (
                    <Badge variant={testData.status === 'Popular' ? 'destructive' : 'secondary'} className="text-xs">
                    {testData.status}
                    </Badge>
                )}
                <Badge variant={testData.pricing === 'free' ? 'default' : 'outline'} className={`text-xs ${testData.pricing === 'free' ? 'bg-green-600 text-white border-green-600' : ''}`}>
                    <Tag className="h-3 w-3 mr-1"/> {testData.pricing === 'free' ? 'Free' : 'Paid'}
                </Badge>
             </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
            <div className="flex flex-wrap gap-2 mb-2">
                <Badge variant="outline"><CalendarDays className="h-4 w-4 mr-1"/>{testData.exam}</Badge>
                <Badge variant="secondary" className="capitalize"><CheckSquare className="h-4 w-4 mr-1"/>{testData.model.replace('_', ' ')}</Badge>
                <Badge variant="secondary"><BookOpen className="h-4 w-4 mr-1"/>{testData.subject}</Badge>
                <Badge variant="secondary">{testData.type}</Badge>
            </div>
            <CardTitle className="text-2xl lg:text-3xl">{testData.title}</CardTitle>
            <CardDescription>{testData.description || 'Detailed information and syllabus for this test.'}</CardDescription> {/* Use description if available */}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
                 <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-5 w-5 text-primary" />
                    <span>Duration: {testData.durationMinutes} minutes</span> {/* Updated field name */}
                 </div>
                 <div className="flex items-center gap-2 text-muted-foreground">
                    <HelpCircle className="h-5 w-5 text-primary" />
                    <span>Questions: {testData.questionsCount}</span> {/* Updated field name */}
                 </div>
            </div>

             <div className="pt-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <ListChecks className="h-5 w-5 text-primary" />
                    Syllabus Covered
                </h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {testData.syllabus && testData.syllabus.length > 0 ? (
                        testData.syllabus.map((topic, index) => (
                            <li key={index}>{topic}</li>
                        ))
                    ) : (
                       <li>Syllabus details not available.</li>
                    )}
                </ul>
            </div>

        </CardContent>
        <CardFooter className="bg-muted/50 p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            {/* Add logic here to check if user has already attempted, etc. */}
            <p className="text-sm text-muted-foreground flex items-center gap-1">
               {testData.pricing === 'free' ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
               ) : (
                  <Tag className="h-4 w-4 text-orange-600" />
               )}
               {testData.pricing === 'free' ? 'Ready to Start?' : 'This is a paid test.'}
            </p>
            {/* Consider adding purchase logic for paid tests */}
            {/* Disable button if test is not published */}
            <Button size="lg" disabled={testData.pricing === 'paid' || !testData.published}>
                {!testData.published ? 'Coming Soon' : (testData.pricing === 'free' ? 'Start Test Now' : 'Purchase Test')}
            </Button>
        </CardFooter>
      </Card>

      {/* Instructions Section */}
       <Card className="bg-card">
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>Ensure you have a stable internet connection.</li>
            <li>The test timer will start as soon as you click "Start Test Now".</li>
            <li>Do not refresh the page during the test.</li>
            <li>Answers are automatically saved (feature coming soon).</li>
            <li>Results will be available immediately after submission (feature coming soon).</li>
            <li>For paid tests, ensure you have purchased access before starting.</li>
             <li>This test is currently {testData.published ? 'available' : 'not available'} to take.</li>
          </ul>
        </CardContent>
      </Card>

    </div>
  );
}

// Optional: Generate static paths if using SSG and know all test IDs beforehand
// export async function generateStaticParams() {
//   // Fetch all possible test IDs from tests.json or an API
//   const tests = await getTests(); // Use your action
//   return tests.map((test) => ({
//     testId: test.id,
//   }));
// }
