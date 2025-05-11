// src/app/auth/signup/page.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Phone, Bot, Gift } from "lucide-react"; 
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { academicStatuses, type AcademicStatus, type UserProfile } from '@/types';
import { useAuth } from '@/context/auth-context';
import { sendWelcomeEmail } from '@/actions/otp-actions'; 
import Image from 'next/image';
import Script from 'next/script';
import { useSearchParams } from 'next/navigation'; // Import useSearchParams

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 6 }, (_, i) => (currentYear + i).toString());

const signupSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  phoneNumber: z.string().min(10, { message: "Please enter a valid 10-digit phone number." }).max(10, { message: "Phone number must be 10 digits." }).regex(/^\d{10}$/, { message: "Please enter a valid 10-digit phone number." }),
  academicStatus: z.enum(academicStatuses, { required_error: "Please select your current academic status." }),
  targetYear: z.string().min(4, { message: "Please select your target exam year." }), 
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  confirmPassword: z.string(),
  referralCode: z.string().optional().nullable(), // Add referralCode field
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const { toast } = useToast();
  const { signUp, loading: authLoading, initializationError } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const searchParams = useSearchParams(); // For reading URL query parameters

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      phoneNumber: "",
      academicStatus: undefined,
      targetYear: "", 
      password: "",
      confirmPassword: "",
      referralCode: searchParams.get('referralCode') || "", // Pre-fill from URL
    },
  });

  // Effect to update referral code if URL changes after initial load
  useEffect(() => {
    const referralFromUrl = searchParams.get('referralCode');
    if (referralFromUrl && referralFromUrl !== form.getValues('referralCode')) {
      form.setValue('referralCode', referralFromUrl);
    }
  }, [searchParams, form]);


  const onSubmit = async (data: SignupFormValues) => {
    if (initializationError) {
      toast({ variant: 'destructive', title: 'System Error', description: "Authentication system not ready. Please contact support.", duration: 7000 });
      return;
    }

    setIsLoading(true);
    try {
      await signUp(
        data.email,
        data.password,
        data.name,
        data.phoneNumber,
        data.academicStatus,
        data.targetYear,
        data.referralCode || null // Pass referral code to signUp
      );
      // Redirection and success toast handled by AuthContext/signUp function
    } catch (error: any) {
      // Error toast is handled within AuthContext/signUp on failure
      // console.error("Signup page submission error:", error.message); // Already logged in context
    } finally {
      setIsLoading(false);
    }
  };

  const combinedLoading = isLoading || authLoading; 

  useEffect(() => {
    // This is a client-side effect, safe to use window
    if (typeof window !== 'undefined' && (window as any).Telegram) {
      // Configure Telegram Login Widget
      // This setup assumes the Telegram script is already loaded (e.g., via <Script> tag)
      // And that a div with id `telegram-login-widget-container` exists
      const telegramLoginWidgetContainer = document.getElementById('telegram-login-widget-container');
      if (telegramLoginWidgetContainer && process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME && process.env.NEXT_PUBLIC_TELEGRAM_REDIRECT_URI) {
        // Clear previous widget if any
        telegramLoginWidgetContainer.innerHTML = '';
        // Create script element for Telegram widget
        const script = document.createElement('script');
        script.async = true;
        script.src = "https://telegram.org/js/telegram-widget.js?22";
        script.setAttribute('data-telegram-login', process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME);
        script.setAttribute('data-size', 'large');
        script.setAttribute('data-radius', '6');
        script.setAttribute('data-auth-url', process.env.NEXT_PUBLIC_TELEGRAM_REDIRECT_URI);
        script.setAttribute('data-request-access', 'write');
        telegramLoginWidgetContainer.appendChild(script);
      }
    }
  }, []);


  return (
    <>
    {/* It's better to load the script in the head or body of _document.js or layout.tsx for Next.js,
        but for a single page, this might work. Ensure it only runs client-side. */}
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
              <Image
                  src="/EduNexus-logo-black.jpg" 
                  alt="EduNexus Logo"
                  width={48}
                  height={48}
                  className="h-12 w-12 dark:hidden" 
                  unoptimized
              />
             <Image
                src="/EduNexus-logo-white.jpg" 
                alt="EduNexus Logo"
                width={48} 
                height={48}
                className="h-12 w-12 hidden dark:block" 
                unoptimized 
            />
          </div>
          <CardTitle className="text-2xl font-bold">Join EduNexus</CardTitle> 
          <CardDescription>Create your account to start practicing.</CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="Your Name" {...field} disabled={combinedLoading} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" placeholder="m@example.com" {...field} disabled={combinedLoading} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="phoneNumber" render={({ field }) => ( <FormItem><FormLabel>Phone Number</FormLabel><FormControl><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type="tel" placeholder="e.g., 9876543210" {...field} disabled={combinedLoading} className="pl-10" /></div></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="academicStatus" render={({ field }) => ( <FormItem><FormLabel>Current Academic Status</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={combinedLoading}><FormControl><SelectTrigger><SelectValue placeholder="Select your status" /></SelectTrigger></FormControl><SelectContent>{academicStatuses.map((status) => ( <SelectItem key={status} value={status}>{status}</SelectItem> ))}</SelectContent></Select><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="targetYear" render={({ field }) => ( <FormItem><FormLabel>Target Exam Year</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={combinedLoading}><FormControl><SelectTrigger><SelectValue placeholder="Select target year" /></SelectTrigger></FormControl><SelectContent>{yearOptions.map((year) => ( <SelectItem key={year} value={year}>{year}</SelectItem> ))}</SelectContent></Select><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} disabled={combinedLoading} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="confirmPassword" render={({ field }) => ( <FormItem><FormLabel>Confirm Password</FormLabel><FormControl><Input type="password" {...field} disabled={combinedLoading} /></FormControl><FormMessage /></FormItem> )} />
              <FormField
                control={form.control}
                name="referralCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Referral Code (Optional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Gift className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Enter referral code" {...field} value={field.value || ''} disabled={combinedLoading} className="pl-10" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={combinedLoading}> {combinedLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign Up </Button>
              <div className="relative w-full my-2"> <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div> <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or continue with</span></div> </div>
              {/* Container for Telegram Login Widget */}
              <div id="telegram-login-widget-container" className="w-full flex justify-center">
                {/* Telegram widget will be dynamically inserted here by useEffect */}
                {!(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME && process.env.NEXT_PUBLIC_TELEGRAM_REDIRECT_URI) && (
                  <Button variant="outline" className="w-full" disabled>
                     <Bot className="mr-2 h-4 w-4" /> Telegram Login (Not Configured)
                  </Button>
                )}
              </div>
              <p className="px-8 text-center text-sm text-muted-foreground">By clicking continue, you agree to our{" "}<Link href="/terms" className="underline underline-offset-4 hover:text-primary">Terms of Service</Link>{" "}and{" "}<Link href="/privacy" className="underline underline-offset-4 hover:text-primary">Privacy Policy</Link>.</p>
              <div className="text-center text-sm">Already have an account?{" "}<Link href="/auth/login" className="underline">Log in</Link></div>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
    </>
  );
}
