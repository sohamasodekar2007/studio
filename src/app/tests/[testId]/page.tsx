// src/app/tests/[testId]/page.tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, HelpCircle, ListChecks, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Image from 'next/image';
import Link from "next/link";

// --- Mock Data Fetching ---
// Replace this with actual data fetching based on testId
async function getTestData(testId: string) {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 50));

  // Example data - find item matching testId or return a default/not found
  const allTests = [
    { id: "mht-cet-phy-1", title: "MHT-CET Physics Mock Test 1", type: "Mock Test", exam: "MHT-CET", subject: "Physics", imageHint: "physics formula atoms", status: "New", duration: 90, questions: 50, syllabus: ["Rotational Dynamics", "Mechanical Properties of Fluids", "Thermal Properties of Matter"] },
    { id: "jee-main-full-3", title: "JEE Main Full Syllabus Test 3", type: "Full Syllabus Test", exam: "JEE Main", subject: "PCM", imageHint: "jee exam students writing", status: "Popular", duration: 180, questions: 90, syllabus: ["Physics", "Chemistry", "Mathematics (Full Syllabus)"] },
    { id: "neet-bio-ch-cell", title: "NEET Biology: Cell Structure", type: "Chapter Test", exam: "NEET", subject: "Biology", imageHint: "biology cell microscope dna", status: "", duration: 45, questions: 45, syllabus: ["Cell: The Unit of Life", "Biomolecules", "Cell Cycle and Cell Division"] },
    { id: "jee-adv-math-calc", title: "JEE Advanced Maths: Calculus", type: "Topic Test", exam: "JEE Advanced", subject: "Maths", imageHint: "mathematics calculus graph", status: "New", duration: 120, questions: 30, syllabus: ["Limits, Continuity and Differentiability", "Integral Calculus", "Differential Equations"] },
    { id: "mht-cet-chem-org", title: "MHT-CET Chemistry: Organic Basics", type: "Chapter Test", exam: "MHT-CET", subject: "Chemistry", imageHint: "chemistry beakers science lab", status: "", duration: 60, questions: 50, syllabus: ["Some Basic Concepts of Chemistry", "Structure of Atom", "Classification of Elements and Periodicity in Properties"] },
    { id: "neet-phy-mock-2", title: "NEET Physics Mock Test 2", type: "Mock Test", exam: "NEET", subject: "Physics", imageHint: "physics concepts motion energy", status: "Popular", duration: 180, questions: 180, syllabus: ["Full Physics Syllabus for NEET"] },
  ];

  const test = allTests.find(t => t.id === testId);

  if (!test) {
    // In a real app, you might throw an error or return null
    // to show a 404 page via notFound() from next/navigation
    return null;
  }
  return test;
}

// --- Page Component ---
export default async function TestDetailPage({ params }: { params: { testId: string } }) {
  const testData = await getTestData(params.testId);

  if (!testData) {
    // Handle test not found - Next.js 13+ uses notFound()
    // For now, just show a message. Import notFound from 'next/navigation' for proper handling.
    return <div className="text-center p-8">Test not found.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/tests" className="text-sm text-muted-foreground hover:text-primary mb-4 inline-block">&larr; Back to Test Series</Link>
      <Card className="overflow-hidden">
        <CardHeader className="relative p-0">
           <Image
                src={`https://picsum.photos/seed/${testData.id}/800/300`} // Larger image for detail page
                alt={testData.title}
                width={800}
                height={300}
                className="w-full h-48 object-cover" // Adjusted height
                data-ai-hint={testData.imageHint}
                priority // Prioritize loading the main image
            />
            {testData.status && (
                <Badge variant={testData.status === 'Popular' ? 'destructive' : 'secondary'} className="absolute top-4 right-4">
                {testData.status}
                </Badge>
            )}
        </CardHeader>
        <CardContent className="p-6 space-y-4">
            <div className="flex flex-wrap gap-2 mb-2">
                <Badge variant="outline">{testData.exam}</Badge>
                <Badge variant="secondary">{testData.type}</Badge>
                <Badge variant="secondary">{testData.subject}</Badge>
            </div>
            <CardTitle className="text-2xl lg:text-3xl">{testData.title}</CardTitle>
            <CardDescription>Detailed information and syllabus for this test.</CardDescription>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                 <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-5 w-5 text-primary" />
                    <span>Duration: {testData.duration} minutes</span>
                 </div>
                 <div className="flex items-center gap-2 text-muted-foreground">
                    <HelpCircle className="h-5 w-5 text-primary" />
                    <span>Questions: {testData.questions}</span>
                 </div>
            </div>

             <div className="pt-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <ListChecks className="h-5 w-5 text-primary" />
                    Syllabus Covered
                </h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {testData.syllabus.map((topic, index) => (
                        <li key={index}>{topic}</li>
                    ))}
                </ul>
            </div>

        </CardContent>
        <CardFooter className="bg-muted/50 p-6 flex justify-between items-center">
            {/* Add logic here to check if user has already attempted, etc. */}
            <p className="text-sm text-muted-foreground flex items-center gap-1">
               <CheckCircle className="h-4 w-4 text-green-600" /> Ready to Start?
            </p>
            <Button size="lg">
                Start Test Now
            </Button>
        </CardFooter>
      </Card>

      {/* Add sections for instructions, previous attempts, etc. later */}
       <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>Ensure you have a stable internet connection.</li>
            <li>The test timer will start as soon as you click "Start Test Now".</li>
            <li>Do not refresh the page during the test.</li>
            <li>Answers are automatically saved.</li>
            <li>Results will be available immediately after submission.</li>
          </ul>
        </CardContent>
      </Card>

    </div>
  );
}

// Optional: Generate static paths if you know all test IDs beforehand
// export async function generateStaticParams() {
//   // Fetch all possible test IDs
//   // const tests = await fetchAllTestIds();
//   const tests = [ /* ... your list of test IDs ... */ ];
//   return tests.map((test) => ({
//     testId: test.id,
//   }));
// }
