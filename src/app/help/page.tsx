import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, LifeBuoy, Mail } from "lucide-react";
import Link from "next/link"; // Import Link

export default function HelpPage() {
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
              <AccordionTrigger>How does the recommendation system work?</AccordionTrigger>
              <AccordionContent>
                Our AI-powered recommendation system analyzes your stated learning goals and past performance/experience. It then suggests resources from our library that align with your needs and current skill level. The more detail you provide, the better the recommendations will be.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>Can I track my learning progress?</AccordionTrigger>
              <AccordionContent>
                Yes, progress tracking features are planned for a future update. Soon, you'll be able to see completed modules, scores on exercises, and track your overall learning journey within EduNexus.
              </AccordionContent>
            </AccordionItem>
             <AccordionItem value="item-4">
              <AccordionTrigger>Is my data secure?</AccordionTrigger>
              <AccordionContent>
                We take data security seriously. Please refer to our{' '}
                 <Link href="/privacy" className="underline hover:text-primary">Privacy Policy</Link>
                {' '}for detailed information on how we collect, use, and protect your data.
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
             <a href="mailto:support@edunexus.app">
                 <Mail className="mr-2 h-5 w-5" />
                 Email Us
             </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
