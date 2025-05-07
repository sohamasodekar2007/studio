'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { GraduationCap, Loader2, Chrome } from "lucide-react"; // Added Chrome for Google icon
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { Separator } from '@/components/ui/separator'; // Import Separator

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { toast } = useToast();
  const { login, signInWithGoogle, loading: authLoading, initializationError } = useAuth(); // Use real Firebase functions
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false); // Separate loading state for Google

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    if (initializationError) {
        toast({ variant: 'destructive', title: 'Configuration Error', description: "Firebase Auth not ready.", duration: 7000 });
        return;
    }
    setIsLoadingEmail(true);
    try {
      await login(data.email, data.password);
      // Redirection and success toast handled by onAuthStateChanged in context
    } catch (error: any) {
      // Error toast is handled within AuthContext/login on failure now
      console.error("Login failed:", error.message); // Keep console log for debugging
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
      await signInWithGoogle(); // Call the real Firebase Google sign-in function
      // Redirection and success toast handled within onAuthStateChanged
    } catch (error: any) {
      // Error toast is handled within AuthContext/signInWithGoogle on failure now
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
          <CardTitle className="text-2xl font-bold">Welcome Back!</CardTitle>
          <CardDescription>Enter your email below to access your STUDY SPHERE account.</CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
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
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center">
                      <FormLabel>Password</FormLabel>
                      <Link href="#" className="ml-auto inline-block text-sm underline">
                        Forgot your password?
                      </Link>
                    </div>
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
                Log in
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
                    <Chrome className="mr-2 h-4 w-4" /> // Using Chrome icon for Google
                 )}
                 Sign in with Google
              </Button>


              <div className="text-center text-sm mt-2"> {/* Added margin-top */}
                Don&apos;t have an account?{" "}
                <Link href="/auth/signup" className="underline">
                  Sign up
                </Link>
              </div>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
