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
import { Loader2, Phone, Bot } from "lucide-react"; 
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { academicStatuses, type AcademicStatus, type UserProfile } from '@/types';
import { useAuth } from '@/context/auth-context';
import { sendWelcomeEmail } from '@/actions/otp-actions'; 
import Image from 'next/image';
import Script from 'next/script'; // For Telegram Widget

// Generate year options for target year
const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 6 }, (_, i) => (currentYear + i).toString());


// Updated schema without OTP, includes targetYear
const signupSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  phoneNumber: z.string().min(10, { message: "Please enter a valid 10-digit phone number." }).max(10, { message: "Phone number must be 10 digits." }).regex(/^\d{10}$/, { message: "Please enter a valid 10-digit phone number." }),
  academicStatus: z.enum(academicStatuses, { required_error: "Please select your current academic status." }),
  targetYear: z.string().min(4, { message: "Please select your target exam year." }), 
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const { toast } = useToast();
  const { signUp, loading: authLoading, initializationError } = useAuth();
  const [isLoading, setIsLoading] = useState(false);


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
    },
  });


  // Updated onSubmit function without OTP verification
  const onSubmit = async (data: SignupFormValues) => {
    if (initializationError) {
      toast({ variant: 'destructive', title: 'System Error', description: "Authentication system not ready. Please contact support.", duration: 7000 });
      return;
    }

    setIsLoading(true);
    try {
      // Directly call signUp without OTP step
      await signUp(
        data.email,
        data.password,
        data.name,
        data.phoneNumber,
        data.academicStatus,
        data.targetYear 
      );
      // Success toast and redirection handled by AuthContext
    } catch (error: any) {
      // Error toast handled by AuthContext or thrown error
      console.error("Signup page submission error:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Update combinedLoading
  const combinedLoading = isLoading || authLoading; 

  useEffect(() => {
    // This function will be called by the Telegram widget after successful authentication
    (window as any).onTelegramAuth = (user: any) => {
        // The user object from Telegram contains:
        // id, first_name, last_name (optional), username (optional), photo_url (optional), auth_date, hash
        // We need to redirect to our backend callback or send this data via a server action
        // For simplicity, we'll redirect to a callback page which will handle server-side verification
        const queryParams = new URLSearchParams(user).toString();
        window.location.href = `/auth/telegram/callback?${queryParams}`;
    };
  }, []);


  return (
    <>
    <Script src="https://telegram.org/js/telegram-widget.js?22" strategy="lazyOnload" />
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
              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your Name" {...field} disabled={combinedLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Email Field */}
               <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                        <Input
                          type="email"
                          placeholder="m@example.com"
                          {...field}
                          disabled={combinedLoading}
                        />
                      </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Phone Number */}
              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="tel" placeholder="e.g., 9876543210" {...field} disabled={combinedLoading} className="pl-10" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Academic Status */}
              <FormField
                control={form.control}
                name="academicStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Academic Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={combinedLoading}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {academicStatuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Target Year */}
              <FormField
                control={form.control}
                name="targetYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Exam Year</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={combinedLoading}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select target year" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {yearOptions.map((year) => (
                          <SelectItem key={year} value={year}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Password */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} disabled={combinedLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Confirm Password */}
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} disabled={combinedLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              {/* Sign Up button */}
              <Button type="submit" className="w-full" disabled={combinedLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign Up
              </Button>
              
              {/* Telegram Login Button */}
              <div className="relative w-full my-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>
              
              <div id="telegram-login-widget-container" className="w-full flex justify-center">
                  <script async src="https://telegram.org/js/telegram-widget.js?22" 
                      data-telegram-login={process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "YOUR_TELEGRAM_BOT_USERNAME_HERE"} // Replace with your bot's username
                      data-size="large" // or medium, small
                      data-radius="6" // Example border radius
                      data-auth-url={process.env.NEXT_PUBLIC_TELEGRAM_REDIRECT_URI || "YOUR_WEBSITE_DOMAIN/auth/telegram/callback"} // Your callback URL
                      data-request-access="write" // To request phone number
                  ></script>
                  {/* Fallback if script fails to load button */}
                  {!process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME && (
                      <Button variant="outline" className="w-full" disabled>
                          <Bot className="mr-2 h-4 w-4" /> Telegram Login (Not Configured)
                      </Button>
                  )}
              </div>


              <p className="px-8 text-center text-sm text-muted-foreground">
                By clicking continue, you agree to our{" "}
                <Link
                  href="/terms"
                  className="underline underline-offset-4 hover:text-primary"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className="underline underline-offset-4 hover:text-primary"
                >
                  Privacy Policy
                </Link>
                .
              </p>
              <div className="text-center text-sm">
                Already have an account?{" "}
                <Link href="/auth/login" className="underline">
                  Log in
                </Link>
              </div>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
    </>
  );
}
