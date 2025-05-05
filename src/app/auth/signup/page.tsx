import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap } from "lucide-react";
import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="space-y-1 text-center">
           <div className="flex justify-center mb-4">
             <GraduationCap className="h-10 w-10 text-primary" />
           </div>
          <CardTitle className="text-2xl font-bold">Join EduNexus</CardTitle>
          <CardDescription>Create your account to start your personalized learning journey.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" placeholder="Your Name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="m@example.com" required />
          </div>
          <div className="space-y-2">
             <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required />
          </div>
           <div className="space-y-2">
             <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input id="confirm-password" type="password" required />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button className="w-full">Sign Up</Button>
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
      </Card>
    </div>
  );
}


// Override layout for auth pages to remove sidebar/header
// Note: Layout override might not be standard in App Router, consider Route Groups instead if needed.
// export function Layout({ children }: { children: React.ReactNode }) {
//   return <>{children}</>;
// }

// If a specific layout is needed for auth routes, it should be placed in src/app/auth/layout.tsx
// The current src/app/auth/layout.tsx already achieves this minimal layout.
