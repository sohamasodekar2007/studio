// src/app/auth/signup/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Loader2, Phone, ShieldCheck, MailIcon } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { academicStatuses, type AcademicStatus, type UserProfile } from '@/types';
import { useAuth } from '@/context/auth-context';
import { generateOtp, verifyOtp } from '@/actions/otp-actions'; // Import OTP actions

// Update schema to include OTP field
const signupSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  phoneNumber: z.string().min(10, { message: "Please enter a valid 10-digit phone number." }).max(10, { message: "Phone number must be 10 digits." }).regex(/^\d{10}$/, { message: "Please enter a valid 10-digit phone number." }),
  academicStatus: z.enum(academicStatuses, { required_error: "Please select your current academic status." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  confirmPassword: z.string(),
  otp: z.string().length(6, { message: "OTP must be 6 digits." }), // Add OTP field validation
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const { toast } = useToast();
  const { signUp, loading: authLoading, initializationError } = useAuth(); // Use local signUp
  const [isLoading, setIsLoading] = useState(false);
  // Add state variables for OTP flow
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);


  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      phoneNumber: "",
      academicStatus: undefined,
      password: "",
      confirmPassword: "",
      otp: "", // Initialize OTP field
    },
  });

  const emailValue = form.watch("email"); // Watch email field for OTP sending

  // Timer effect for OTP resend cooldown
  useEffect(() => {
    let timerId: NodeJS.Timeout;
    if (resendTimer > 0) {
      setResendDisabled(true);
      timerId = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    } else {
      setResendDisabled(false);
    }
    return () => clearTimeout(timerId);
  }, [resendTimer]);


  // Function to handle sending OTP
  const handleSendOtp = async () => {
    if (!emailValue) {
      form.setError("email", { type: "manual", message: "Email is required to send OTP." });
      return;
    }
    // Basic email format validation before sending request
    if (!z.string().email().safeParse(emailValue).success) {
        form.setError("email", { type: "manual", message: "Please enter a valid email address." });
        return;
    }

    setIsSendingOtp(true);
    try {
      const result = await generateOtp(emailValue); // Call server action
      if (result.success) {
        toast({ title: "OTP Sent", description: result.message });
        setOtpSent(true);
        setResendTimer(60); // Start 60-second cooldown
      } else {
        toast({ variant: "destructive", title: "OTP Error", description: result.message });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "OTP Error", description: error.message || "Failed to send OTP." });
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Function to handle verifying OTP
   const handleVerifyOtp = async () => {
    const otpValue = form.getValues("otp");
    if (!otpValue || otpValue.length !== 6) {
        form.setError("otp", {type: "manual", message: "Please enter a valid 6-digit OTP."});
        return;
    }
    setIsVerifyingOtp(true);
    try {
      const result = await verifyOtp(emailValue, otpValue); // Call server action
      if (result.success) {
        toast({ title: "OTP Verified", description: result.message });
        setOtpVerified(true); // Set OTP as verified
        form.clearErrors("otp"); // Clear any previous OTP errors
      } else {
        toast({ variant: "destructive", title: "OTP Verification Failed", description: result.message });
        form.setError("otp", {type: "manual", message: result.message})
        setOtpVerified(false);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "OTP Verification Error", description: error.message || "Failed to verify OTP." });
       setOtpVerified(false);
    } finally {
      setIsVerifyingOtp(false);
    }
  };


  // Function to handle final form submission
  const onSubmit = async (data: SignupFormValues) => {
    if (initializationError) {
      toast({ variant: 'destructive', title: 'System Error', description: "Authentication system not ready. Please contact support.", duration: 7000 });
      return;
    }
    // Ensure OTP is verified before proceeding
    if (!otpVerified) {
      toast({ variant: 'destructive', title: 'OTP Not Verified', description: 'Please verify your OTP before signing up.' });
      return;
    }

    setIsLoading(true);
    try {
      // Call the local signUp function from AuthContext
      await signUp(
        data.email,
        data.password, // Pass password
        data.name,
        data.phoneNumber,
        data.academicStatus
      );
      // Success toast and redirection handled by AuthContext
    } catch (error: any) {
      // Error toast handled by AuthContext
      console.error("Signup page submission error:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const combinedLoading = isLoading || authLoading || isSendingOtp || isVerifyingOtp;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
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
              {/* Email and OTP */}
               <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="m@example.com"
                          {...field}
                          disabled={combinedLoading || otpSent} // Disable email after OTP is sent
                        />
                      </FormControl>
                       {/* Conditionally render Send/Resend OTP button */}
                        {!otpVerified && (
                             <Button
                                type="button"
                                onClick={handleSendOtp}
                                disabled={isSendingOtp || resendDisabled || otpSent}
                                variant="outline"
                                size="sm"
                              >
                                {isSendingOtp ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : resendDisabled ? (
                                  `Resend in ${resendTimer}s`
                                ) : otpSent ? (
                                    'Resend OTP' // Change text after sent
                                ) : (
                                  <>
                                    <MailIcon className="h-4 w-4 mr-1"/>
                                    Send OTP
                                  </>
                                )}
                              </Button>
                         )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* OTP Input and Verify Button (Show only if OTP sent and not yet verified) */}
              {otpSent && !otpVerified && (
                <FormField
                  control={form.control}
                  name="otp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Enter OTP</FormLabel>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input
                            type="text"
                            maxLength={6}
                            placeholder="6-digit OTP"
                            {...field}
                            disabled={isVerifyingOtp || otpVerified} // Disable input if verifying or already verified
                          />
                        </FormControl>
                        <Button
                          type="button"
                          onClick={handleVerifyOtp}
                          disabled={isVerifyingOtp || field.value?.length !== 6 || otpVerified}
                          variant="outline"
                          size="sm"
                        >
                          {isVerifyingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
                          Verify OTP
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {/* Show verification success message */}
              {otpVerified && (
                 <div className="flex items-center text-sm text-green-600">
                    <ShieldCheck className="h-4 w-4 mr-2" /> Email Verified Successfully!
                 </div>
              )}


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
              {/* Disable signup button until OTP is verified */}
              <Button type="submit" className="w-full" disabled={combinedLoading || !otpVerified}>
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
