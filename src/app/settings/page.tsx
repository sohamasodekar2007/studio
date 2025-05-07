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
import { User, Loader2, AlertTriangle, Star, CalendarClock, KeyRound } from "lucide-react"; // Added KeyRound
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { saveUserToJson, getUserById } from '@/actions/user-actions'; // Use user-actions
import type { UserProfile, AcademicStatus, UserModel } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import ResetPasswordDialog from '@/components/admin/reset-password-dialog'; // Reuse for user password reset

// --- Profile Form Schema ---
const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  phone: z.string().min(10, { message: "Please enter a valid 10-digit phone number." }).max(15, { message: "Phone number seems too long." }),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

export default function SettingsPage() {
  const { user, loading, logout, refreshUser } = useAuth(); // Get refreshUser from context
  const { toast } = useToast();
  const router = useRouter();
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [fullUserProfile, setFullUserProfile] = useState<UserProfile | null>(null);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false); // State for password reset dialog

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", phone: "" },
  });

  // Effect to fetch the full user profile from local storage or JSON
  useEffect(() => {
    const fetchFullProfile = async () => {
        if (user && user.id) { // Use user.id now
            try {
                // Attempt to get from local storage first (might be slightly stale but faster)
                const storedUserJson = localStorage.getItem('loggedInUser');
                let storedProfile: UserProfile | null = null;
                if (storedUserJson) {
                    try {
                        storedProfile = JSON.parse(storedUserJson);
                    } catch (e) {
                        console.warn("Could not parse loggedInUser from local storage", e);
                        localStorage.removeItem('loggedInUser'); // Clear invalid data
                    }
                }

                // Validate stored profile against current user ID
                if (storedProfile && storedProfile.id === user.id) {
                    setFullUserProfile(storedProfile);
                    profileForm.reset({
                        name: storedProfile.name || "",
                        phone: storedProfile.phone || "",
                    });
                    return; // Exit if found and valid in local storage
                }

                // If not in local storage or ID mismatch, fetch from server action using ID
                console.log("Fetching full profile via action for user ID:", user.id);
                const profile = await getUserById(user.id); // Fetch by ID
                 if (profile) {
                     // Construct the UserProfile type which expects a password field
                     // Since getUserById omits password, we add it back as undefined
                     const profileWithPasswordPlaceholder: UserProfile = {
                         ...(profile as Omit<UserProfile, 'password'>), // Cast to ensure type match
                         password: '', // Add empty password, it won't be saved unless changed
                     };
                     setFullUserProfile(profileWithPasswordPlaceholder);
                     profileForm.reset({
                        name: profileWithPasswordPlaceholder.name || "",
                        phone: profileWithPasswordPlaceholder.phone || "",
                     });
                     // Update local storage with fetched profile
                     localStorage.setItem('loggedInUser', JSON.stringify(profileWithPasswordPlaceholder));
                 } else {
                     console.error(`Failed to fetch profile for user ID: ${user.id}. Logging out.`);
                     toast({ title: 'Error', description: 'Could not load profile details. Please log in again.', variant: 'destructive' });
                     await logout();
                 }
            } catch (error) {
                console.error("Failed to fetch full user profile:", error);
                toast({ title: 'Error', description: 'Could not load profile details.', variant: 'destructive' });
                await logout(); // Log out on error
            }
        }
    };

    if (!loading && user) {
        fetchFullProfile();
    } else if (!loading && !user) {
        router.push('/auth/login?redirect=/settings'); // Redirect to login if not logged in
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, router, toast, profileForm, logout]);


  // --- Profile Update Logic ---
  const onProfileSubmit = async (data: ProfileFormValues) => {
    if (!user || !fullUserProfile || !fullUserProfile.id) {
      toast({ title: 'Error', description: 'User session or profile data is invalid. Please log in again.', variant: 'destructive' });
      await logout();
      return;
    }
    setIsLoadingProfile(true);
    try {
      // Construct the updated profile object using existing full profile and form data
       const updatedProfile: UserProfile = {
         ...fullUserProfile,
         name: data.name,
         phone: data.phone,
         // Retain existing password, email, model, etc.
         password: fullUserProfile.password, // IMPORTANT: Keep the existing password
       };

      // Save the *entire* updated UserProfile object via Server Action
      const updateResult = await saveUserToJson(updatedProfile);

      if (!updateResult.success) {
        throw new Error(updateResult.message || "Failed to save profile updates locally.");
      }

      // **Crucially, update the Auth Context state and local storage**
      const contextUser: ContextUser = {
          id: updatedProfile.id,
          email: updatedProfile.email,
          displayName: updatedProfile.name,
          photoURL: null,
          phone: updatedProfile.phone,
          className: updatedProfile.class,
          model: updatedProfile.model,
          expiry_date: updatedProfile.expiry_date,
      };
      localStorage.setItem('loggedInUser', JSON.stringify(contextUser)); // Update local storage
      await refreshUser(); // Trigger context update

      toast({
        title: "Profile Updated",
        description: "Your profile information has been successfully updated.",
      });
      // Form reset is handled by the useEffect when `user` updates after refreshUser

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
  if (loading || (!user && !loading) || (user && !fullUserProfile)) { // Show skeleton if loading auth OR if user exists but full profile hasn't loaded yet
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

   // --- Profile data is loaded, render the actual settings ---
  return (
    <>
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
          {/* Optionally add an upgrade button */}
          {/* <CardFooter>
             <Button variant="outline" disabled>Upgrade Plan (Coming Soon)</Button>
          </CardFooter> */}
        </Card>

         <Separator />

        {/* Account Settings (Password) */}
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
             <CardDescription>
               Update your account password.
             </CardDescription>
          </CardHeader>
          <CardContent>
             <p className="text-sm text-muted-foreground">
               Click the button below to update your password.
               {/* Note: In a local setup without Firebase Auth, this requires custom logic. */}
             </p>
          </CardContent>
          <CardFooter>
             {/* Button to open the Reset Password Dialog */}
             <Button onClick={() => setIsResetPasswordOpen(true)}>
               <KeyRound className="mr-2 h-4 w-4" /> Update Password
             </Button>
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

       {/* Password Reset Dialog */}
       {fullUserProfile && (
          <ResetPasswordDialog
            user={fullUserProfile} // Pass the full user profile
            isOpen={isResetPasswordOpen}
            onClose={() => setIsResetPasswordOpen(false)}
            // No onUserUpdate needed here as password changes are handled internally
          />
        )}
    </>
  );
}
