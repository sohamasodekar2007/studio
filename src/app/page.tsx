import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, LineChart, ListChecks } from "lucide-react"; // Updated icons
import Link from "next/link";
import Image from 'next/image';


export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Welcome to ExamPrep Hub!</h1>
      <p className="text-muted-foreground">Your platform for MHT-CET, JEE, and NEET test preparation.</p>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                src="https://picsum.photos/seed/tests/400/200" // Updated seed
                alt="Test Series"
                width={400}
                height={200}
                className="rounded-md mb-4 object-cover"
                data-ai-hint="test series exam paper list" // Updated hint
              />
            <p className="mb-4 text-sm text-muted-foreground">
              Find mock tests for MHT-CET, JEE Main, JEE Advanced, and NEET.
            </p>
            <Link href="/tests" asChild> {/* Use asChild */}
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
                src="https://picsum.photos/seed/practice/400/200" // Updated seed
                alt="Practice Tests"
                width={400}
                height={200}
                className="rounded-md mb-4 object-cover"
                data-ai-hint="student taking exam test computer" // Updated hint
              />
            <p className="mb-4 text-sm text-muted-foreground">
              Simulate exam conditions and improve your time management skills.
            </p>
            <Link href="/tests" asChild> {/* Use asChild */}
              <Button className="w-full bg-accent hover:bg-accent/90">Start Practicing</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow duration-200">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <LineChart className="h-5 w-5 text-secondary-foreground" /> {/* Updated icon */}
                    Performance Analysis
                </CardTitle>
                <CardDescription>Track your scores and identify weak areas.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Image
                    src="https://picsum.photos/seed/results/400/200" // Updated seed
                    alt="Performance Analysis"
                    width={400}
                    height={200}
                    className="rounded-md mb-4 object-cover"
                    data-ai-hint="analytics chart graph report results" // Updated hint
                  />
                <p className="mb-4 text-sm text-muted-foreground">
                    Review detailed results after each test attempt. (Coming Soon)
                </p>
                {/* Link to /results page once created */}
                <Button variant="secondary" disabled className="w-full">View Results</Button>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
