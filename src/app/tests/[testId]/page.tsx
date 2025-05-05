// src/app/tests/[testId]/page.tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, HelpCircle, ListChecks, CheckCircle, Tag, BookOpen, CalendarDays, CheckSquare } from "lucide-react"; // Added icons
import { Badge } from "@/components/ui/badge";
import Image from 'next/image';
import Link from "next/link";

// --- Mock Data Fetching ---
// Replace this with actual data fetching based on testId
async function getTestData(testId: string) {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 50));

  // Example data including 'model' and 'pricing'
  const allTests = [
    { id: "mht-cet-phy-1", title: "MHT-CET Physics Mock Test 1", type: "Mock Test", exam: "MHT-CET", subject: "Physics", imageHint: "physics formula atoms", status: "New", model: "full_length", pricing: "paid", duration: 90, questions: 50, syllabus: ["Rotational Dynamics", "Mechanical Properties of Fluids", "Thermal Properties of Matter"] },
    { id: "jee-main-full-3", title: "JEE Main Full Syllabus Test 3", type: "Full Syllabus Test", exam: "JEE Main", subject: "PCM", imageHint: "jee exam students writing", status: "Popular", model: "full_length", pricing: "paid", duration: 180, questions: 90, syllabus: ["Physics", "Chemistry", "Mathematics (Full Syllabus)"] },
    { id: "neet-bio-ch-cell", title: "NEET Biology: Cell Structure", type: "Chapter Test", exam: "NEET", subject: "Biology", imageHint: "biology cell microscope dna", status: "", model: "chapterwise", pricing: "free", duration: 45, questions: 45, syllabus: ["Cell: The Unit of Life", "Biomolecules", "Cell Cycle and Cell Division"] },
    { id: "jee-adv-math-calc", title: "JEE Advanced Maths: Calculus", type: "Topic Test", exam: "JEE Advanced", subject: "Maths", imageHint: "mathematics calculus graph", status: "New", model: "topicwise", pricing: "paid", duration: 120, questions: 30, syllabus: ["Limits, Continuity and Differentiability", "Integral Calculus", "Differential Equations"] },
    { id: "mht-cet-chem-org", title: "MHT-CET Chemistry: Organic Basics", type: "Chapter Test", exam: "MHT-CET", subject: "Chemistry", imageHint: "chemistry beakers science lab", status: "", model: "chapterwise", pricing: "free", duration: 60, questions: 50, syllabus: ["Some Basic Concepts of Chemistry", "Structure of Atom", "Classification of Elements and Periodicity in Properties"] },
    { id: "neet-phy-mock-2", title: "NEET Physics Mock Test 2", type: "Mock Test", exam: "NEET", subject: "Physics", imageHint: "physics concepts motion energy", status: "Popular", model: "full_length", pricing: "paid", duration: 180, questions: 180, syllabus: ["Full Physics Syllabus for NEET"] },
    { id: "jee-main-combo-1", title: "JEE Main Physics & Chem Combo", type: "Combo Test", exam: "JEE Main", subject: "Physics, Chemistry", imageHint: "physics chemistry combo equations", status: "", model: "combo", pricing: "paid", duration: 120, questions: 60, syllabus: ["Selected topics from Physics and Chemistry"] },
    { id: "mht-cet-full-free", title: "MHT-CET Full Syllabus Free Mock", type: "Mock Test", exam: "MHT-CET", subject: "PCM", imageHint: "free exam access student", status: "Popular", model: "full_length", pricing: "free", duration: 180, questions: 150, syllabus: ["Complete MHT-CET Syllabus (PCM)"] },
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
      <Card className="overflow-hidden bg-card">
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
                <Badge variant="secondary">{testData.type}</Badge> {/* Keep original type badge */}
            </div>
            <CardTitle className="text-2xl lg:text-3xl">{testData.title}</CardTitle>
            <CardDescription>Detailed information and syllabus for this test.</CardDescription>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
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
            <Button size="lg" disabled={testData.pricing === 'paid'}>
                {testData.pricing === 'free' ? 'Start Test Now' : 'Purchase Test'}
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
            <li>Answers are automatically saved.</li>
            <li>Results will be available immediately after submission.</li>
            <li>For paid tests, ensure you have purchased access before starting.</li>
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
