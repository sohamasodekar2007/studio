'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/context/auth-context';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Loader2 } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation'; // Import useRouter

// --- Profile Form ---
const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  // email: z.string().email().optional(), // Email cannot be changed directly here for security
});
type ProfileFormValues = z.infer<typeof profileSchema>;

// --- Password Form ---
const passwordSchema = z.object({
  currentPassword: z.string().min(1, { message: "Current password is required."}),
  newPassword: z.string().min(6, { message: "New password must be at least 6 characters." }),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New passwords don't match",
  path: ["confirmPassword"],
});
type PasswordFormValues = z.infer<typeof passwordSchema>;


export default function SettingsPage() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const router = useRouter(); // Initialize router
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);

  // --- Profile Form Initialization ---
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
    },
  });

  // --- Password Form Initialization ---
   const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });


  useEffect(() => {
    if (user) {
      profileForm.reset({ name: user.displayName || "" });
    }
     // Redirect if not logged in and not loading
     if (!loading && !user) {
        router.push('/auth/login');
        toast({ title: 'Unauthorized', description: 'Please log in to access settings.', variant: 'destructive' });
    }
  }, [user, loading, profileForm, router, toast]);


  const onProfileSubmit = async (data: ProfileFormValues) => {
    if (!user) return;
    setIsLoadingProfile(true);
    try {
      await updateProfile(user, { displayName: data.name });
       // Consider forcing a reload or context update if display name is used widely immediately
      toast({
        title: "Profile Updated",
        description: "Your name has been successfully updated.",
      });
    } catch (error: any) {
      console.error("Profile update failed:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Could not update profile.",
      });
    } finally {
      setIsLoadingProfile(false);
    }
  };

   const onPasswordSubmit = async (data: PasswordFormValues) => {
    if (!user || !user.email) return; // Ensure user and email exist
    setIsLoadingPassword(true);

    try {
      // Re-authenticate user first
      const credential = EmailAuthProvider.credential(user.email, data.currentPassword);
      await reauthenticateWithCredential(user, credential);

      // If re-authentication is successful, update the password
      await updatePassword(user, data.newPassword);

      passwordForm.reset(); // Clear password fields after success
      toast({
        title: "Password Updated",
        description: "Your password has been successfully changed.",
      });

    } catch (error: any) {
       console.error("Password update failed:", error);
       let description = "Could not update password.";
       if (error.code === 'auth/wrong-password') {
         description = "Incorrect current password. Please try again.";
         // Optionally set an error on the currentPassword field
         passwordForm.setError("currentPassword", { type: "manual", message: description });
       } else if (error.code === 'auth/too-many-requests') {
            description = "Too many attempts. Please try again later.";
       } else {
            description = error.message || description;
       }
       toast({
        variant: "destructive",
        title: "Update Failed",
        description: description,
      });
    } finally {
      setIsLoadingPassword(false);
    }
  };


  // Get first letter of display name or email for fallback
  const getInitials = (name: string | null | undefined, email: string | null | undefined) => {
    if (name) return name.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return <User />;
  }

  if (loading) {
     return (
       <div className="space-y-6 max-w-3xl mx-auto">
           <Skeleton className="h-8 w-1/4" />
           <Skeleton className="h-40 w-full" />
           <Separator />
           <Skeleton className="h-40 w-full" />
           <Separator />
           <Skeleton className="h-40 w-full" />
       </div>
     );
  }

  if (!user) {
    // This should ideally be handled by the useEffect redirect, but acts as a fallback
    return <div className="text-center p-8">Please log in to view settings.</div>;
  }


  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      {/* Profile Settings */}
       <Form {...profileForm}>
         <form onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Manage your personal information.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                     <AvatarImage src={user.photoURL || `https://avatar.vercel.sh/${user.email}.png`} alt={user.displayName || user.email || 'User Avatar'} />
                    <AvatarFallback>{getInitials(user.displayName, user.email)}</AvatarFallback>
                  </Avatar>
                   {/* <Button type="button" variant="outline" disabled>Change Picture (Coming Soon)</Button> */}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <FormField
                      control={profileForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={isLoadingProfile}/>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" type="email" defaultValue={user.email || ""} disabled />
                    <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                 <Button type="submit" disabled={isLoadingProfile}>
                   {isLoadingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                   Save Changes
                 </Button>
              </CardFooter>
            </Card>
         </form>
       </Form>

      <Separator />

       {/* Account Settings (Password) */}
       <Form {...passwordForm}>
         <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}>
            <Card>
              <CardHeader>
                <CardTitle>Password</CardTitle>
                <CardDescription>Update your account password.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} disabled={isLoadingPassword}/>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} disabled={isLoadingPassword}/>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} disabled={isLoadingPassword}/>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </CardContent>
              <CardFooter>
                 <Button type="submit" disabled={isLoadingPassword}>
                    {isLoadingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update Password
                 </Button>
              </CardFooter>
            </Card>
          </form>
        </Form>

       <Separator />

       {/* Notification Settings - Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Manage how you receive notifications (placeholder).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="email-notifications" className="flex flex-col space-y-1">
              <span>Email Notifications</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Receive emails about test results and platform updates.
              </span>
            </Label>
            <Switch id="email-notifications" defaultChecked disabled/>
          </div>
           <div className="flex items-center justify-between">
            <Label htmlFor="in-app-notifications" className="flex flex-col space-y-1">
              <span>In-App Notifications</span>
               <span className="font-normal leading-snug text-muted-foreground">
                Show notifications within the ExamPrep Hub platform.
              </span>
            </Label>
            <Switch id="in-app-notifications" defaultChecked disabled/>
          </div>
        </CardContent>
         <CardFooter>
          <Button disabled>Save Preferences</Button>
        </CardFooter>
      </Card>

    </div>
  );
}
