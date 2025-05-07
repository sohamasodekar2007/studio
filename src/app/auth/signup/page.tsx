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

// Zod schema with OTP field
const signupSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  confirmPassword: z.string(),
  academicStatus: z.enum(academicStatuses, { required_error: "Please select your current academic status." }),
  phoneNumber: z.string().min(10, { message: "Please enter a valid 10-digit phone number." }).max(10, { message: "Phone number must be 10 digits." }).regex(/^\d{10}$/, { message: "Please enter a valid 10-digit phone number." }),
  otp: z.string().length(4, { message: "OTP must be 4 digits." }).regex(/^\d{4}$/, "OTP must be numeric."), // Added OTP field
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const { toast } = useToast();
  const { signUpLocally, signInWithGoogleLocally } = useAuth(); // Get signup and Google sign-in functions
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false); // Google loading state
  const [isOtpSending, setIsOtpSending] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null); // Store simulated OTP
  const [isOtpSent, setIsOtpSent] = useState(false); // Track if OTP UI should be shown

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      academicStatus: undefined,
      phoneNumber: "",
      otp: "", // Default OTP
    },
  });

  // Watch email field to enable/disable OTP button
  const emailValue = form.watch('email');
  const isEmailValid = z.string().email().safeParse(emailValue).success;

  // Simulate sending OTP
  const handleSendOtp = useCallback(async () => {
    if (!isEmailValid) {
      toast({ variant: "destructive", title: "Invalid Email", description: "Please enter a valid email address first." });
      return;
    }
    setIsOtpSending(true);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
    const otp = Math.floor(1000 + Math.random() * 9000).toString(); // Generate 4-digit OTP
    setGeneratedOtp(otp);
    setIsOtpSent(true); // Show OTP input field
    setIsOtpSending(false);
    toast({
      title: "OTP Sent (Simulated)",
      description: `For testing, your OTP is: ${otp}`,
      duration: 10000, // Show OTP longer for testing
    });
  }, [isEmailValid, toast]);

  const onSubmit = async (data: SignupFormValues) => {
    if (!generatedOtp) {
        toast({ variant: "destructive", title: "OTP Required", description: "Please generate and enter the OTP." });
        return;
    }
    if (data.otp !== generatedOtp) {
        toast({ variant: "destructive", title: "Invalid OTP", description: "The entered OTP is incorrect." });
        form.setError("otp", { message: "Incorrect OTP" });
        return;
    }

    setIsLoading(true);
    try {
        const newUserFormData: Omit<UserProfile, 'id' | 'createdAt' | 'password' | 'model' | 'expiry_date' | 'referral'> & { class: AcademicStatus | null; phone: string | null } = {
            name: data.name,
            email: data.email,
            class: data.academicStatus,
            phone: data.phoneNumber,
        };

        await signUpLocally(newUserFormData, data.password);

        toast({
            title: "Account Created (Locally)",
            description: "You have successfully signed up!",
        });
        // Redirection is handled within signUpLocally

    } catch (error: any) {
        console.error("Signup failed (local simulation):", error);
        toast({
            variant: "destructive",
            title: "Sign Up Failed",
            description: error.message || "An unexpected error occurred. Please try again.",
        });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await signInWithGoogleLocally();
      // Redirection handled within context
       toast({
        title: "Google Sign-In Successful (Simulated)",
        description: "Welcome!",
      });
    } catch (error: any) {
      console.error("Google Sign-in failed (simulated):", error);
      toast({
        variant: "destructive",
        title: "Google Sign-In Failed",
        description: error.message || "Could not sign in with Google (Simulated).",
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

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
                      <Input placeholder="Your Name" {...field} disabled={isLoading || isGoogleLoading} />
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
                    <div className="flex items-center gap-2">
                      <FormControl className="flex-1">
                         <Input type="email" placeholder="m@example.com" {...field} disabled={isLoading || isGoogleLoading} />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSendOtp}
                        disabled={!isEmailValid || isOtpSending || isLoading || isGoogleLoading}
                        className="flex-shrink-0"
                      >
                        {isOtpSending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Mail className="h-4 w-4"/>}
                        <span className="ml-1 hidden sm:inline">{isOtpSent ? 'Resend OTP' : 'Send OTP'}</span>
                      </Button>
                    </div>
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
                        <Input type="tel" placeholder="e.g., 9876543210" {...field} disabled={isLoading || isGoogleLoading} className="pl-10" />
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
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading || isGoogleLoading}>
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
                      <Input type="password" {...field} disabled={isLoading || isGoogleLoading} />
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
                      <Input type="password" {...field} disabled={isLoading || isGoogleLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
                {/* OTP Input Field (Conditional) */}
              {isOtpSent && (
                <FormField
                    control={form.control}
                    name="otp"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Enter OTP</FormLabel>
                        <FormControl>
                        <Input type="text" placeholder="4-digit OTP" {...field} maxLength={4} disabled={isLoading || isGoogleLoading} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                )}

            </CardContent>
            <CardFooter className="flex flex-col gap-4">
               <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading || !isOtpSent}>
                 {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                 Sign Up
               </Button>

                {/* OR Separator */}
              <div className="flex items-center w-full my-1">
                <Separator className="flex-1" />
                <span className="mx-2 text-xs text-muted-foreground">OR</span>
                <Separator className="flex-1" />
              </div>

               {/* Google Sign In Button */}
              <Button variant="outline" type="button" className="w-full" onClick={handleGoogleSignIn} disabled={isLoading || isGoogleLoading}>
                 {isGoogleLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                 ) : (
                    <Chrome className="mr-2 h-4 w-4" />
                 )}
                 Sign up with Google (Simulated)
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
