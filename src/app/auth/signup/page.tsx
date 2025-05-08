{'use client';

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Loader2, Phone, Send } from "lucide-react"; // Added Send icon
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { academicStatuses, type AcademicStatus, type UserProfile } from '@/types';
import { useAuth } from '@/context/auth-context';
import { generateOtp, verifyOtp } from '@/actions/otp-actions'; // Import OTP actions
import Image from 'next/image'; // Import Image

// Updated schema with phone number and class selection
const signupSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  phoneNumber: z.string().min(10, { message: "Please enter a valid 10-digit phone number." }).max(10, { message: "Phone number must be 10 digits." }).regex(/^\d{10}$/, { message: "Please enter a valid 10-digit phone number." }),
  academicStatus: z.enum(academicStatuses, { required_error: "Please select your current academic status." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  confirmPassword: z.string(),
  // OTP field is optional initially, required in step 2
  otp: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const { toast } = useToast();
  const { signUp, loading: authLoading, initializationError } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isOtpLoading, setIsOtpLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);


  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      phoneNumber: "",
      academicStatus: undefined,
      password: "",
      confirmPassword: "",
      otp: "",
    },
  });

  // Function to handle OTP generation
  const handleSendOtp = useCallback(async () => {
    // Trigger validation for fields required before sending OTP
    const nameValid = await form.trigger("name");
    const emailValid = await form.trigger("email");
    const phoneValid = await form.trigger("phoneNumber");
    const statusValid = await form.trigger("academicStatus");
    const passValid = await form.trigger("password");
    const confirmValid = await form.trigger("confirmPassword");

    if (!nameValid || !emailValid || !phoneValid || !statusValid || !passValid || !confirmValid) {
      toast({ variant: "destructive", title: "Validation Error", description: "Please fill all required fields correctly before sending OTP." });
      return;
    }

    setIsOtpLoading(true);
    const email = form.getValues("email");
    try {
      const result = await generateOtp(email);
      if (result.success) {
        toast({ title: "OTP Sent", description: result.message });
        setOtpSent(true);
      } else {
        throw new Error(result.message || "Failed to send OTP.");
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "OTP Error", description: error.message });
    } finally {
      setIsOtpLoading(false);
    }
  }, [form, toast]);


  // Function to handle final form submission
  const onSubmit = async (data: SignupFormValues) => {
    if (initializationError) {
      toast({ variant: 'destructive', title: 'System Error', description: "Authentication system not ready. Please contact support.", duration: 7000 });
      return;
    }

    if (!otpSent) {
      toast({ variant: "destructive", title: "OTP Required", description: "Please send and verify the OTP first." });
      return;
    }
    if (!data.otp || data.otp.length !== 6) {
      form.setError("otp", { message: "Please enter the 6-digit OTP." });
      return;
    }

    setIsLoading(true);
    try {
      // 1. Verify OTP
      const otpVerification = await verifyOtp(data.email, data.otp);
      if (!otpVerification.success) {
        form.setError("otp", { message: otpVerification.message });
        throw new Error(otpVerification.message);
      }

      // 2. Proceed with signup if OTP is correct
      await signUp(
        data.email,
        data.password,
        data.name,
        data.phoneNumber,
        data.academicStatus
      );
      // Success toast and redirection handled by AuthContext
    } catch (error: any) {
      // Error toast handled by AuthContext or OTP verification
      console.error("Signup page submission error:", error.message);
       if (!error.message.includes("OTP")) { // Avoid duplicate OTP errors
           toast({ variant: 'destructive', title: 'Sign Up Failed', description: error.message });
       }
    } finally {
      setIsLoading(false);
    }
  };

  // Update combinedLoading
  const combinedLoading = isLoading || authLoading || isOtpLoading;

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
                  className="h-12 w-12" // Adjust size as needed
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

              {/* OTP Field */}
              <FormField
                control={form.control}
                name="otp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Enter OTP</FormLabel>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          placeholder="6-digit code"
                          {...field}
                          disabled={!otpSent || combinedLoading}
                          maxLength={6}
                        />
                      </FormControl>
                       <Button
                        type="button"
                        variant="outline"
                        onClick={handleSendOtp}
                        disabled={otpSent || isOtpLoading || combinedLoading || !form.formState.isValid}
                      >
                        {isOtpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4"/>}
                        {otpSent ? 'Sent' : 'Send OTP'}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              {/* Sign Up button */}
              <Button type="submit" className="w-full" disabled={!otpSent || combinedLoading}>
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
