import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Lightbulb } from "lucide-react";
import Link from "next/link";
import Image from 'next/image';


export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Welcome to EduNexus!</h1>
      <p className="text-muted-foreground">Your personalized learning journey starts here.</p>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Explore Content
            </CardTitle>
            <CardDescription>Dive into our library of educational resources.</CardDescription>
          </CardHeader>
          <CardContent>
             <Image
                src="https://picsum.photos/400/200"
                alt="Educational Content"
                width={400}
                height={200}
                className="rounded-md mb-4 object-cover"
                data-ai-hint="learning study books"
              />
            <p className="mb-4 text-sm text-muted-foreground">
              Find articles, videos, and interactive exercises tailored to your interests.
            </p>
            <Link href="/content" passHref>
              <Button variant="outline" className="w-full">Browse Content</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-accent" />
              Get Recommendations
            </CardTitle>
            <CardDescription>Let our AI guide you to the best resources.</CardDescription>
          </CardHeader>
          <CardContent>
            <Image
                src="https://picsum.photos/400/200"
                alt="AI Recommendations"
                width={400}
                height={200}
                className="rounded-md mb-4 object-cover"
                data-ai-hint="artificial intelligence brain network"
              />
            <p className="mb-4 text-sm text-muted-foreground">
              Tell us your goals and see what our AI suggests for your learning path.
            </p>
            <Link href="/recommendations" passHref>
              <Button className="w-full bg-accent hover:bg-accent/90">Find Resources</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow duration-200">
            <CardHeader>
                <CardTitle>Your Progress</CardTitle>
                <CardDescription>Keep track of your learning journey.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Image
                    src="https://picsum.photos/400/200"
                    alt="Progress Tracking"
                    width={400}
                    height={200}
                    className="rounded-md mb-4 object-cover"
                    data-ai-hint="charts graphs progress"
                  />
                <p className="mb-4 text-sm text-muted-foreground">
                    View completed modules, scores, and achievements. (Coming Soon)
                </p>
                <Button variant="secondary" disabled className="w-full">View Progress</Button>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
