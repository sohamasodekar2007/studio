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
// Allow updating name, phone. Class, model, expiry are read-only here.
const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  phone: z.string().min(10, { message: "Please enter a valid phone number." }).max(15, { message: "Phone number seems too long." }),
  // class is not editable here
});
type ProfileFormValues = z.infer<typeof profileSchema>;

export default function SettingsPage() {
  const { user, loading, login, logout } = useAuth(); // Get logout as well
  const { toast } = useToast();
  const router = useRouter();
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [fullUserProfile, setFullUserProfile] = useState<UserProfile | null>(null); // State to hold the full profile

  // --- Profile Form Initialization ---
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      phone: "",
    },
  });

  // Effect to fetch the full user profile from local storage or JSON
  // This ensures we have all fields needed for saving, not just the ones in the auth context
  useEffect(() => {
    const fetchFullProfile = async () => {
        if (user && user.email) {
            try {
                // Attempt to get from local storage first (might be slightly stale but faster)
                const storedUserJson = localStorage.getItem('loggedInUser');
                if (storedUserJson) {
                    const parsedProfile = JSON.parse(storedUserJson);
                    if (parsedProfile.email === user.email) {
                         setFullUserProfile(parsedProfile);
                         // Populate form with data from the full profile
                         profileForm.reset({
                            name: parsedProfile.name || "",
                            phone: parsedProfile.phone || "",
                         });
                         return; // Exit if found in local storage
                    }
                }
                // If not in local storage or email mismatch, fetch from server action
                const profile = await findUserByEmail(user.email);
                setFullUserProfile(profile);
                 // Populate form with data from the fetched profile
                 profileForm.reset({
                    name: profile?.name || "",
                    phone: profile?.phone || "",
                 });
            } catch (error) {
                console.error("Failed to fetch full user profile:", error);
                toast({ title: 'Error', description: 'Could not load full profile details.', variant: 'destructive' });
            }
        }
    };

    if (!loading && user) {
        fetchFullProfile();
    } else if (!loading && !user) {
        router.push('/auth/login');
        toast({ title: 'Unauthorized', description: 'Please log in to access settings.', variant: 'destructive' });
    }
     // Add profileForm to dependency array to reset form when profile data changes
  }, [user, loading, router, toast, profileForm]);


  // --- Profile Update Logic ---
  const onProfileSubmit = async (data: ProfileFormValues) => {
    if (!user || !fullUserProfile || !fullUserProfile.id || !fullUserProfile.email) { // Check fullUserProfile now
      toast({ title: 'Error', description: 'User session or profile data is invalid. Please log in again.', variant: 'destructive' });
      await logout(); // Log out user if session is bad
      router.push('/auth/login');
      return;
    }
    setIsLoadingProfile(true);
    try {

      // Construct the updated profile object using existing full profile and form data
       const updatedProfile: UserProfile = {
         ...fullUserProfile, // Start with the existing full profile
         name: data.name,    // Update name from form
         phone: data.phone, // Update phone from form
         // Keep other fields like email, class, model, expiry, password, createdAt etc. from fullUserProfile
       };


      // Save the *entire* updated UserProfile object via Server Action
      const updateResult = await saveUserToJson(updatedProfile);

      if (!updateResult.success) {
        throw new Error(updateResult.message || "Failed to save profile updates locally.");
      }

      // **Crucially, update the Auth Context state** by re-simulating login
      // This fetches the *updated* full profile from JSON via findUserByCredentials
      // It assumes the password is correct (or stored/retrieved securely if implemented)
      // For this simulation, we retrieve the stored password from local storage (INSECURE)
      await login(fullUserProfile.email, localStorage.getItem('simulatedPassword') || undefined);

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
  if (loading || (!user && !loading)) { // Show skeleton while auth loading or if user is null initially
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

  // --- Not Logged In State (Should be handled by redirect in useEffect) ---
   if (!user) {
    // This should ideally be handled by the useEffect redirect, but acts as a fallback
    return <div className="text-center p-8">Redirecting to login...</div>;
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
                   {/* Use unique ID or email for avatar generation */}
                   <AvatarImage src={`https://avatar.vercel.sh/${user.email || user.id}.png`} alt={user.displayName || user.email || 'User Avatar'} />
                   <AvatarFallback>{getInitials(user.displayName, user.email)}</AvatarFallback>
                </Avatar>
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
                   {/* Display class from the auth context user */}
                   <Input id="class" value={user.className || "N/A"} disabled />
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
                Show notifications within the STUDY SPHERE platform.
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
