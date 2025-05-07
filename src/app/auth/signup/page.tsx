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
import { GraduationCap, Loader2, Phone, Mail, Chrome } from "lucide-react"; // Added Mail, Chrome icons
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { academicStatuses, type AcademicStatus, type UserProfile } from '@/types';
import { useAuth } from '@/context/auth-context'; // Import useAuth
import { Separator } from '@/components/ui/separator'; // Import Separator

// Updated schema with phone number
const signupSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  confirmPassword: z.string(),
  academicStatus: z.enum(academicStatuses, { required_error: "Please select your current academic status." }),
  phoneNumber: z.string().min(10, { message: "Please enter a valid 10-digit phone number." }).max(10, { message: "Phone number must be 10 digits." }).regex(/^\d{10}$/, { message: "Please enter a valid 10-digit phone number." }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const { toast } = useToast();
  const { signUpLocally, signInWithGoogle, loading: authLoading, initializationError } = useAuth(); // Use real Firebase functions
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false); // Google loading state

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      academicStatus: undefined,
      phoneNumber: "",
    },
  });

  const onSubmit = async (data: SignupFormValues) => {
     if (initializationError) {
        toast({ variant: 'destructive', title: 'Configuration Error', description: "Firebase Auth not ready.", duration: 7000 });
        return;
    }
    setIsLoadingEmail(true);
    try {
        // Prepare data for signUpLocally (context handles profile creation)
        const userDataForContext = {
            name: data.name,
            email: data.email,
            class: data.academicStatus,
            phone: data.phoneNumber,
        };

        await signUpLocally(userDataForContext, data.password);
        // Success toast and redirection handled by onAuthStateChanged in context
    } catch (error: any) {
        // Error toast handled by signUpLocally in context
        console.error("Signup failed:", error.message); // Keep console log
    } finally {
      setIsLoadingEmail(false);
    }
  };

  const handleGoogleSignIn = async () => {
     if (initializationError) {
        toast({ variant: 'destructive', title: 'Configuration Error', description: "Firebase Auth not ready.", duration: 7000 });
        return;
    }
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
      // Redirection and success toast handled within onAuthStateChanged
    } catch (error: any) {
      // Error toast handled within signInWithGoogle in context
      console.error("Google Sign-in failed:", error.message); // Keep console log
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const isLoading = isLoadingEmail || isGoogleLoading || authLoading; // Combined loading state

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <GraduationCap className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Join STUDY SPHERE</CardTitle>
          <CardDescription>Create your account to start practicing.</CardDescription>
        </CardHeader>
         <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
               <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your Name" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                     <FormControl>
                       <Input type="email" placeholder="m@example.com" {...field} disabled={isLoading} />
                     </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               {/* Phone Number Field */}
               <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                     <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="tel" placeholder="e.g., 9876543210" {...field} disabled={isLoading} className="pl-10" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               {/* Academic Status Select */}
              <FormField
                control={form.control}
                name="academicStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Academic Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
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
               <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
               <Button type="submit" className="w-full" disabled={isLoading}>
                 {isLoadingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                 Sign Up
               </Button>

                {/* OR Separator */}
              <div className="flex items-center w-full my-1">
                <Separator className="flex-1" />
                <span className="mx-2 text-xs text-muted-foreground">OR</span>
                <Separator className="flex-1" />
              </div>

               {/* Google Sign In Button */}
              <Button variant="outline" type="button" className="w-full" onClick={handleGoogleSignIn} disabled={isLoading}>
                 {isGoogleLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                 ) : (
                    <Chrome className="mr-2 h-4 w-4" />
                 )}
                 Sign up with Google
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
