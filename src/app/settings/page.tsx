// src/app/settings/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/context/auth-context';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Loader2, AlertTriangle, Star, CalendarClock } from "lucide-react"; // Added Star, CalendarClock
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { saveUserToJson } from '@/actions/user-actions'; // Correct import path
import { findUserByEmail } from '@/actions/auth-actions'; // Need this for finding user by email
import type { UserProfile, AcademicStatus, UserModel } from '@/types'; // Import necessary types
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge'; // Import Badge

// --- Profile Form Schema ---
// Allow updating name, phone, and class. Model/expiry are read-only here.
const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  phone: z.string().min(10, { message: "Please enter a valid phone number." }).max(15, { message: "Phone number seems too long." }),
  // Assuming class is editable, add validation if needed (e.g., using academicStatuses enum)
  // class: z.enum(academicStatuses), // Example if making class editable via form
});
type ProfileFormValues = z.infer<typeof profileSchema>;

export default function SettingsPage() {
  const { user, loading, login, logout } = useAuth(); // Get logout as well
  const { toast } = useToast();
  const router = useRouter();
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // --- Profile Form Initialization ---
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      phone: "",
      // class: undefined, // Initialize if class becomes editable
    },
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
      toast({ title: 'Unauthorized', description: 'Please log in to access settings.', variant: 'destructive' });
    } else if (user) {
      // Populate profile form once user data is available
      profileForm.reset({
        name: user.displayName || "",
        phone: user.phone || "",
        // class: user.className || undefined, // Populate if class becomes editable
      });
    }
  }, [user, loading, profileForm, router, toast]);

  // --- Profile Update Logic ---
  const onProfileSubmit = async (data: ProfileFormValues) => {
    if (!user || !user.id || !user.email) { // Need ID and email
      toast({ title: 'Error', description: 'User session is invalid. Please log in again.', variant: 'destructive' });
      await logout(); // Log out user if session is bad
      router.push('/auth/login');
      return;
    }
    setIsLoadingProfile(true);
    try {
      // 1. Find the *full* existing user profile from JSON to get all fields
      //    (needed for fields not included in the form like model, expiry, etc.)
      //    We use findUserByEmail as we don't need password check here.
      const existingUserProfile = await findUserByEmail(user.email);

      if (!existingUserProfile) {
        throw new Error("Could not find existing user data to update. Please log in again.");
      }

      // 2. Update the user data in users.json via Server Action
      //    Pass the updated fields from the form and existing fields from the profile.
      const updateResult = await saveUserToJson(
        existingUserProfile.id, // Use the ID from the found profile
        data.name, // Updated name from form
        existingUserProfile.email!, // Keep existing email
        data.phone, // Updated phone from form
        existingUserProfile.class!, // Keep existing class (assuming not editable here)
        existingUserProfile.model, // Keep existing model
        existingUserProfile.expiry_date // Keep existing expiry date
      );

      if (!updateResult.success) {
        throw new Error(updateResult.message || "Failed to save profile updates locally.");
      }

      // 3. **Crucially, update the Auth Context state**
      // Re-login simulation fetches the *updated* full profile from JSON
      await login(user.email, localStorage.getItem('simulatedPassword') || undefined); // Re-fetch updated data via login simulation
      // Note: Storing password in localStorage is highly insecure, used only for this specific simulation flow.

      toast({
        title: "Profile Updated",
        description: "Your profile information has been successfully updated.",
      });
      // Form reset is handled by the useEffect when `user` updates after login simulation

    } catch (error: any) {
      console.error("Profile update failed:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Could not update profile.",
      });
       if (error.message.includes("Please log in again")) {
           await logout();
           router.push('/auth/login');
       }
    } finally {
      setIsLoadingProfile(false);
    }
  };

  // --- Helper Functions ---
  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) return name.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return <User />;
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch {
      return 'Invalid Date';
    }
  };


  // --- Loading State ---
  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-1/4 mb-6" />
        {/* Profile Card Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/5" />
            <Skeleton className="h-4 w-2/5" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
              <div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
              <div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
            </div>
          </CardContent>
          <CardFooter><Skeleton className="h-10 w-24" /></CardFooter>
        </Card>
        <Separator />
        {/* Subscription Card Skeleton */}
        <Card>
           <CardHeader><Skeleton className="h-6 w-1/4" /><Skeleton className="h-4 w-1/2" /></CardHeader>
           <CardContent className="space-y-4">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-8 w-1/2" />
           </CardContent>
        </Card>
        <Separator />
        {/* Password Card Skeleton */}
        <Card><CardHeader><Skeleton className="h-6 w-1/5" /><Skeleton className="h-4 w-3/5" /></CardHeader></Card>
         <Separator />
        {/* Notifications Card Skeleton */}
        <Card><CardHeader><Skeleton className="h-6 w-1/4" /><Skeleton className="h-4 w-1/2" /></CardHeader></Card>
      </div>
    );
  }

  // --- Not Logged In State ---
  if (!user) {
    // This should ideally be handled by the useEffect redirect, but acts as a fallback
    return <div className="text-center p-8">Please log in to view settings. Redirecting...</div>;
  }

  // --- Logged In View ---
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
                   <AvatarImage src={`https://avatar.vercel.sh/${user.email || user.id}.png`} alt={user.displayName || user.email || 'User Avatar'} />
                  <AvatarFallback>{getInitials(user.displayName, user.email)}</AvatarFallback>
                </Avatar>
                {/* Picture change functionality disabled */}
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
                        <Input {...field} disabled={isLoadingProfile} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                    control={profileForm.control}
                    name="phone"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                            <Input type="tel" {...field} disabled={isLoadingProfile} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" value={user.email || ""} disabled />
                  <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="class">Academic Status</Label>
                   <Input id="class" value={user.className || "N/A"} disabled />
                   {/* If class becomes editable, replace Input with a Select component */}
                   {/* <Select disabled>...</Select> */}
                   <p className="text-xs text-muted-foreground">Contact support to change.</p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isLoadingProfile}>
                {isLoadingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Profile Changes
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>

      <Separator />

        {/* Subscription Details */}
      <Card>
        <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>Your current access plan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
             <div className="flex items-center gap-2">
                 <Star className="h-5 w-5 text-primary" />
                 <span className="font-medium">Current Plan:</span>
                 <Badge variant="secondary" className="capitalize">{user.model || 'N/A'}</Badge>
             </div>
             {user.model !== 'free' && user.expiry_date && (
                 <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarClock className="h-5 w-5" />
                    <span>Expires on: {formatDate(user.expiry_date)}</span>
                 </div>
             )}
              {user.model === 'free' && (
                 <p className="text-sm text-muted-foreground">Upgrade to access premium test series.</p>
             )}
        </CardContent>
         {/* Optionally add a footer with an upgrade button */}
         {/* <CardFooter>
            <Button variant="outline" disabled>Upgrade Plan (Coming Soon)</Button>
         </CardFooter> */}
      </Card>

       <Separator />

      {/* Account Settings (Password) - Disabled */}
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
           <CardDescription className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="h-4 w-4" />
            Password changes are disabled in local mode.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <p className="text-sm text-muted-foreground">
             Password management requires a secure authentication provider.
             This functionality is not available when using local JSON storage.
           </p>
        </CardContent>
        <CardFooter>
          <Button disabled>Update Password</Button>
        </CardFooter>
      </Card>

      <Separator />

      {/* Notification Settings - Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Manage how you receive notifications (placeholder).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <Label htmlFor="email-notifications" className="flex flex-col space-y-1">
              <span>Email Notifications</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Receive emails about test results and platform updates.
              </span>
            </Label>
            <Switch id="email-notifications" defaultChecked disabled />
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <Label htmlFor="in-app-notifications" className="flex flex-col space-y-1">
              <span>In-App Notifications</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Show notifications within the ExamPrep Hub platform.
              </span>
            </Label>
            <Switch id="in-app-notifications" defaultChecked disabled />
          </div>
        </CardContent>
        <CardFooter>
          <Button disabled>Save Preferences</Button>
        </CardFooter>
      </Card>

    </div>
  );
}
