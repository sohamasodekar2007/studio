'use client';

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Loader2, Phone } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { academicStatuses, type AcademicStatus, type UserProfile } from '@/types';
import { useAuth } from '@/context/auth-context';
import { sendWelcomeEmail } from '@/actions/otp-actions'; // Still needed for welcome email
import Image from 'next/image';

// Updated schema without OTP
const signupSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  phoneNumber: z.string().min(10, { message: "Please enter a valid 10-digit phone number." }).max(10, { message: "Phone number must be 10 digits." }).regex(/^\d{10}$/, { message: "Please enter a valid 10-digit phone number." }),
  academicStatus: z.enum(academicStatuses, { required_error: "Please select your current academic status." }),
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
        data.academicStatus
      );
      // Success toast and redirection handled by AuthContext
    } catch (error: any) {
      // Error toast handled by AuthContext or thrown error
      console.error("Signup page submission error:", error.message);
       // Removed duplicate toast as error is handled in AuthContext
       // toast({ variant: 'destructive', title: 'Sign Up Failed', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Update combinedLoading
  const combinedLoading = isLoading || authLoading; // Removed isOtpLoading

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
             {/* EduNexus Logo */}
              <Image
                  src="/EduNexus-logo-black.jpg" // Assuming black logo for light theme
                  alt="EduNexus Logo"
                  width={48}
                  height={48}
                  className="h-12 w-12 dark:hidden" // Hide on dark mode
                  unoptimized
              />
             <Image
                src="/EduNexus-logo-white.jpg" // White logo for dark theme
                alt="EduNexus Logo"
                width={48} // Adjust size as needed
                height={48}
                className="h-12 w-12 hidden dark:block" // Show only on dark mode
                unoptimized // Good for local images
            />
          </div>
          <CardTitle className="text-2xl font-bold">Join EduNexus</CardTitle> {/* Updated Title */}
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
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={combinedLoading}>
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
  );
}
