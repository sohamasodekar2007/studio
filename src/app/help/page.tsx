// src/app/help/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, LifeBuoy, Mail } from "lucide-react";
import Link from "next/link"; // Import Link

export default function HelpPage() {
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
  }, []);


  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight text-center">Help & Support</h1>
      <p className="text-muted-foreground text-center">Find answers to common questions or get in touch with our support team.</p>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input placeholder="Search help topics..." className="pl-10 py-6 text-lg" />
      </div>

      {/* FAQ Section */}
      <Card>
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
          <CardDescription>Quick answers to common queries.</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>How do I update my profile information?</AccordionTrigger>
              <AccordionContent>
                You can update your profile information, including your name and profile picture, by navigating to the{' '}
                <Link href="/settings" className="underline hover:text-primary">Settings page</Link>.
                Your email address cannot be changed.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>How can I view my test results and analysis?</AccordionTrigger> {/* Updated Question */}
              <AccordionContent>
                 {/* Updated Answer */}
                 After completing a test, your results, including score, percentage, time taken, and question-wise analysis, will be available immediately on the results page. You can review past attempts on the <Link href="/progress" className="underline hover:text-primary">My Progress</Link> page. This will help you understand your strengths and weaknesses.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>What types of tests are available?</AccordionTrigger> {/* Updated Question */}
              <AccordionContent>
                We offer a variety of tests including full syllabus mock tests, chapter-wise tests, and topic-wise tests for MHT-CET, JEE Main, JEE Advanced, and NEET. You can browse all available tests on the{' '}
                <Link href="/tests" className="underline hover:text-primary">Test Series page</Link>. {/* Updated Answer */}
              </AccordionContent>
            </AccordionItem>
             <AccordionItem value="item-4">
              <AccordionTrigger>Is my data secure?</AccordionTrigger>
              <AccordionContent>
                We take data security seriously. Please refer to our{' '}
                 <Link href="/privacy" className="underline hover:text-primary">Privacy Policy</Link>
                {' '}for detailed information on how we collect, use, and protect your data, including test performance data. {/* Updated Answer */}
              </AccordionContent>
            </AccordionItem>
             <AccordionItem value="item-5">
              <AccordionTrigger>How are the tests created?</AccordionTrigger> {/* Added Question */}
              <AccordionContent>
                 Our tests are designed by subject matter experts based on the latest syllabus and exam patterns for MHT-CET, JEE, and NEET to provide an authentic exam experience. {/* Added Answer */}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Contact Support Section */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Support</CardTitle>
          <CardDescription>Still need help? Reach out to our support team.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" disabled> {/* Disabled chat button as it's coming soon */}
            <LifeBuoy className="mr-2 h-5 w-5" />
            Chat with Support (Coming Soon)
          </Button>
          <Button variant="outline" size="lg" asChild>
             {/* Updated email */}
             <a href="mailto:support@edunexus.com" className="text-muted-foreground hover:text-primary">
                 <Mail className="mr-2 h-5 w-5" />
                 Email Us
             </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
