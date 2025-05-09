// src/app/tests/[testCode]/page.tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, HelpCircle, ListChecks, CheckCircle, Tag, BookOpen, CalendarDays, CheckSquare, AlertTriangle } from "lucide-react"; // Added icons
import { Badge } from "@/components/ui/badge";
import Image from 'next/image';
import Link from "next/link";
import { notFound } from 'next/navigation';
import { getGeneratedTestByCode } from '@/actions/generated-test-actions';
import StartTestButton from '@/components/test-interface/start-test-button';
import type { PricingType } from '@/types';

const formatPricing = (pricing: PricingType) => {
    switch (pricing) {
      case 'FREE': return 'Free';
      case 'PAID': return 'Premium';
      case 'FREE_PREMIUM': return 'Free Premium';
      default: return pricing;
    }
};

const getPricingBadgeVariant = (pricing: PricingType): "default" | "secondary" | "destructive" | "outline" => {
    switch (pricing) {
        case 'FREE': return 'default';
        case 'PAID': return 'destructive';
        case 'FREE_PREMIUM': return 'secondary';
        default: return 'outline';
    }
};

const getPricingBadgeClasses = (pricing: PricingType): string => {
    switch (pricing) {
        case 'FREE': return 'bg-green-600 text-white border-green-600';
        case 'PAID': return 'bg-red-600 text-white border-red-600';
        case 'FREE_PREMIUM': return 'bg-blue-600 text-white border-blue-600';
        default: return '';
    }
};

export default async function TestDetailPage({ params }: { params: { testCode: string } }) {
  const testCode = params.testCode; 
  const testData = await getGeneratedTestByCode(testCode);

  if (!testData) {
    notFound();
  }

  const syllabusCovered = testData.testType === 'chapterwise' && testData.lesson
    ? [testData.lesson]
    : testData.test_subject.map(s => `Full Syllabus - ${s}`);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/tests" className="text-sm text-muted-foreground hover:text-primary mb-4 inline-block">&larr; Back to Test Series</Link>
      <Card className="overflow-hidden bg-card">
        <CardHeader className="relative p-0">
           <Image
                src={`https://picsum.photos/seed/${testData.test_code}/800/300`}
                alt={testData.name}
                width={800}
                height={300}
                className="w-full h-48 object-cover"
                data-ai-hint={testData.test_subject.join(' ') + " test"}
                priority
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
                 <Badge variant="outline"><CalendarDays className="h-4 w-4 mr-1"/>For: {testData.audience}</Badge>
                 <Badge variant="secondary" className="capitalize"><CheckSquare className="h-4 w-4 mr-1"/>{testData.testType === 'full_length' && testData.stream ? testData.stream : testData.testType.replace('_', ' ')}</Badge>
                {testData.test_subject.map(sub => (
                   <Badge key={sub} variant="secondary"><BookOpen className="h-4 w-4 mr-1"/>{sub}</Badge>
                ))}
            </div>
            <CardTitle className="text-2xl lg:text-3xl">{testData.name}</CardTitle>
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
            <StartTestButton test={testData} />
        </CardFooter>
      </Card>

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
