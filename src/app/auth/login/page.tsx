// src/app/auth/login/page.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react"; // Removed GraduationCap
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import Image from 'next/image'; // Import Image

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { toast } = useToast();
  const { login, loading: authLoading, initializationError } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    if (initializationError) {
        toast({ variant: 'destructive', title: 'System Error', description: initializationError, duration: 7000 });
        return;
    }
    setIsLoading(true);
    try {
      await login(data.email, data.password);
      // Redirection and success toast handled by AuthContext/login function
    } catch (error: any) {
      // Error toast is handled within AuthContext/login on failure
      // console.error("Login page submission error:", error.message); // Already logged in context
    } finally {
      setIsLoading(false);
    }
  };

  const combinedLoading = isLoading || authLoading;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="space-y-1 text-center">
           <div className="flex justify-center mb-4">
              <Image
                  src="/EduNexus-logo-black.jpg" // Use black logo for light theme default
                  alt="EduNexus Logo"
                  width={48}
                  height={48}
                  className="h-12 w-12 dark:hidden" // Hide on dark mode
                  unoptimized
              />
             <Image
                src="/EduNexus-logo-white.jpg" // White logo for dark theme
                alt="EduNexus Logo"
                width={48} 
                height={48}
                className="h-12 w-12 hidden dark:block" // Show only on dark mode
                unoptimized 
            />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome Back!</CardTitle>
          <CardDescription>Enter your email below to access your EduNexus account.</CardDescription>
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
                      <Input type="email" placeholder="m@example.com" {...field} disabled={combinedLoading} />
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
                       {/* <Link href="#" className="ml-auto inline-block text-sm underline">
                        Forgot your password?
                      </Link> */}
                    </div>
                    <FormControl>
                      <Input type="password" {...field} disabled={combinedLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={combinedLoading}>
                {combinedLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Log in
              </Button>
              <div className="text-center text-sm mt-2">
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