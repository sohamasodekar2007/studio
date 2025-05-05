import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, LineChart, ListChecks, Wand2 } from "lucide-react"; // Added Wand2
import Link from "next/link";
import Image from 'next/image';


export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Welcome to ExamPrep Hub!</h1>
      <p className="text-muted-foreground">Your platform for MHT-CET, JEE, and NEET test preparation.</p>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"> {/* Changed to 4 columns for the new card */}
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              Browse Test Series
            </CardTitle>
            <CardDescription>Explore full syllabus and chapter-wise tests.</CardDescription>
          </CardHeader>
          <CardContent>
             <Image
                src="https://picsum.photos/seed/tests/400/200"
                alt="Test Series"
                width={400}
                height={200}
                className="rounded-md mb-4 object-cover h-32" // Consistent height
                data-ai-hint="test series exam paper list"
              />
            <p className="mb-4 text-sm text-muted-foreground">
              Find mock tests for MHT-CET, JEE Main, JEE Advanced, and NEET.
            </p>
            <Link href="/tests" passHref>
               <Button variant="outline" className="w-full">Browse Tests</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-accent" />
              Practice Tests
            </CardTitle>
            <CardDescription>Take tests to evaluate your preparation.</CardDescription>
          </CardHeader>
          <CardContent>
            <Image
                src="https://picsum.photos/seed/practice/400/200"
                alt="Practice Tests"
                width={400}
                height={200}
                className="rounded-md mb-4 object-cover h-32" // Consistent height
                data-ai-hint="student taking exam test computer"
              />
            <p className="mb-4 text-sm text-muted-foreground">
              Simulate exam conditions and improve your time management skills.
            </p>
            <Link href="/tests" passHref>
               <Button className="w-full bg-primary hover:bg-primary/90">Start Practicing</Button> {/* Changed variant to primary */}
            </Link>
          </CardContent>
        </Card>

         <Card className="hover:shadow-md transition-shadow duration-200">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Wand2 className="h-5 w-5 text-purple-600" /> {/* Added AI icon */}
                    AI Study Tips
                </CardTitle>
                <CardDescription>Get personalized tips for tricky topics.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Image
                    src="https://picsum.photos/seed/ai-tips/400/200"
                    alt="AI Study Tips"
                    width={400}
                    height={200}
                    className="rounded-md mb-4 object-cover h-32" // Consistent height
                    data-ai-hint="artificial intelligence brain lightbulb ideas"
                  />
                <p className="mb-4 text-sm text-muted-foreground">
                    Leverage AI to get focused advice on subjects and topics.
                </p>
                 <Link href="/study-tips" passHref>
                     <Button variant="goo" className="w-full bg-purple-600 hover:bg-purple-700 text-white">Get Tips</Button> {/* Custom color */}
                </Link>
            </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow duration-200">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <LineChart className="h-5 w-5 text-orange-600" /> {/* Changed color */}
                    Performance Analysis
                </CardTitle>
                <CardDescription>Track your scores and identify weak areas.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Image
                    src="https://picsum.photos/seed/results/400/200"
                    alt="Performance Analysis"
                    width={400}
                    height={200}
                    className="rounded-md mb-4 object-cover h-32" // Consistent height
                    data-ai-hint="analytics chart graph report results"
                  />
                <p className="mb-4 text-sm text-muted-foreground">
                    Review detailed results after each test attempt. (Coming Soon)
                </p>
                <Button variant="secondary" disabled className="w-full">View Results</Button>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
