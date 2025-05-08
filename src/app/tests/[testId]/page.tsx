// src/app/tests/[testId]/page.tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, HelpCircle, ListChecks, CheckCircle, Tag, BookOpen, CalendarDays, CheckSquare, AlertTriangle } from "lucide-react"; // Added icons
import { Badge } from "@/components/ui/badge";
import Image from 'next/image';
import Link from "next/link";
import { notFound } from 'next/navigation'; // Import notFound
// Import the correct action from the correct file
import { getGeneratedTestByCode } from '@/actions/generated-test-actions';
import StartTestButton from '@/components/test-interface/start-test-button'; // Import the StartTestButton component
import type { PricingType } from '@/types'; // Import PricingType

// Helper function to format pricing type for display
const formatPricing = (pricing: PricingType) => {
    switch (pricing) {
      case 'FREE': return 'Free';
      case 'PAID': return 'Premium'; // Changed 'Paid' to 'Premium' for consistency
      case 'FREE_PREMIUM': return 'Free Premium'; // Display "Free Premium" clearly
      default: return pricing;
    }
};

// Helper function to get badge variant based on pricing
const getPricingBadgeVariant = (pricing: PricingType): "default" | "secondary" | "destructive" | "outline" => {
    switch (pricing) {
        case 'FREE': return 'default'; // Often green, but use default primary here
        case 'PAID': return 'destructive'; // Red for premium/paid
        case 'FREE_PREMIUM': return 'secondary'; // Blue/purple for free_premium
        default: return 'outline';
    }
};

// Helper function to get badge classes based on pricing
const getPricingBadgeClasses = (pricing: PricingType): string => {
    switch (pricing) {
        case 'FREE': return 'bg-green-600 text-white border-green-600';
        case 'PAID': return 'bg-red-600 text-white border-red-600';
        case 'FREE_PREMIUM': return 'bg-blue-600 text-white border-blue-600'; // Example: Blue for FREE_PREMIUM
        default: return '';
    }
};


// --- Page Component ---
export default async function TestDetailPage({ params }: { params: { testId: string } }) {
  const testId = params.testId;
  // Use the imported getGeneratedTestByCode function
  const testData = await getGeneratedTestByCode(testId);

  if (!testData) {
    // Use Next.js notFound() to render the 404 page
    notFound();
  }

  // Determine syllabus - handle both chapterwise and full_length
  const syllabusCovered = testData.testType === 'chapterwise' && testData.lesson
    ? [testData.lesson] // For chapterwise, syllabus is the lesson name
    : testData.test_subject.map(s => `Full Syllabus - ${s}`); // For full_length, list subjects

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/tests" className="text-sm text-muted-foreground hover:text-primary mb-4 inline-block">&larr; Back to Test Series</Link>
      <Card className="overflow-hidden bg-card">
        <CardHeader className="relative p-0">
           <Image
                // Use a placeholder image, maybe based on subject or test code
                src={`https://picsum.photos/seed/${testData.test_code}/800/300`}
                alt={testData.name}
                width={800}
                height={300}
                className="w-full h-48 object-cover"
                data-ai-hint={testData.test_subject.join(' ') + " test"} // Use subjects for hint
                priority // Prioritize loading the main image
            />
             <div className="absolute top-4 right-4 flex gap-1">
                <Badge
                   variant={getPricingBadgeVariant(testData.type)}
                   className={`text-xs ${getPricingBadgeClasses(testData.type)}`}
                 >
                   <Tag className="h-3 w-3 mr-1"/> {formatPricing(testData.type)}
                </Badge>
             </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
            <div className="flex flex-wrap gap-2 mb-2">
                {/* Assuming 'audience' exists on testData */}
                 <Badge variant="outline"><CalendarDays className="h-4 w-4 mr-1"/>For: {testData.audience}</Badge>
                {/* Display Stream or Test Type */}
                 <Badge variant="secondary" className="capitalize"><CheckSquare className="h-4 w-4 mr-1"/>{testData.testType === 'full_length' && testData.stream ? testData.stream : testData.testType.replace('_', ' ')}</Badge>
                {/* Display Subjects */}
                {testData.test_subject.map(sub => (
                   <Badge key={sub} variant="secondary"><BookOpen className="h-4 w-4 mr-1"/>{sub}</Badge>
                ))}
            </div>
            <CardTitle className="text-2xl lg:text-3xl">{testData.name}</CardTitle>
            {/* Optional Description */}
             <CardDescription>Test Code: {testData.test_code}</CardDescription>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
                 <div className="flex items-center gap-2 text-muted-foreground">
                    <HelpCircle className="h-5 w-5 text-primary" />
                    <span>Questions: {testData.total_questions}</span>
                 </div>
                 <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-5 w-5 text-primary" />
                    <span>Duration: {testData.duration} minutes</span>
                 </div>
            </div>

             <div className="pt-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <ListChecks className="h-5 w-5 text-primary" />
                    Syllabus Covered
                </h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {syllabusCovered && syllabusCovered.length > 0 ? (
                        syllabusCovered.map((topic, index) => (
                            <li key={index}>{topic}</li>
                        ))
                    ) : (
                       <li>Syllabus details not available.</li>
                    )}
                </ul>
            </div>

        </CardContent>
        <CardFooter className="bg-muted/50 p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
               {testData.type === 'FREE' ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
               ) : (
                  <Tag className="h-4 w-4 text-orange-600" />
               )}
               {formatPricing(testData.type)} Access
            </p>
            {/* Use the client component for the button logic */}
            <StartTestButton test={testData} />
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
            <li>Your answers are saved as you navigate.</li>
            <li>Results will be available immediately after submission.</li>
            <li>For premium tests, ensure your subscription is active.</li>
            {testData.testType !== 'chapterwise' && (
                <li><AlertTriangle className="h-4 w-4 inline mr-1 text-amber-600"/>The interface for Full Length tests is currently under development.</li>
            )}
          </ul>
        </CardContent>
      </Card>

    </div>
  );
}
