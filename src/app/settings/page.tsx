'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
// Remove Firebase imports
// import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
// import { auth } from '@/lib/firebase';
import { useAuth } from '@/context/auth-context';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Loader2, AlertTriangle } from "lucide-react"; // Added AlertTriangle
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { saveUserToJson } from '@/actions/save-user'; // Import action to update user
import type { UserProfile } from '@/types';

// --- Profile Form ---
const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  // Add other editable fields if needed, e.g., academicStatus, phoneNumber
  // email: z.string().email().optional(), // Email cannot be changed
});
type ProfileFormValues = z.infer<typeof profileSchema>;

// --- Password Form Removed ---

export default function SettingsPage() {
  const { user, loading, login } = useAuth(); // Use simulated user, loading state, and login
  const { toast } = useToast();
  const router = useRouter();
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  // const [isLoadingPassword, setIsLoadingPassword] = useState(false); // Removed password loading state

  // --- Profile Form Initialization ---
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      // Initialize other fields if added
    },
  });

  // --- Password Form Initialization Removed ---

  useEffect(() => {
    // Redirect if not logged in and not loading
    if (!loading && !user) {
       router.push('/auth/login');
       toast({ title: 'Unauthorized', description: 'Please log in to access settings.', variant: 'destructive' });
    } else if (user) {
       // Populate profile form once user data is available
      profileForm.reset({ name: user.displayName || "" });
       // Reset other fields if added
    }
  }, [user, loading, profileForm, router, toast]);


  const onProfileSubmit = async (data: ProfileFormValues) => {
    if (!user || !user.email) { // Need email to find user in JSON
         toast({ title: 'Error', description: 'User not found.', variant: 'destructive' });
         return;
    };
    setIsLoadingProfile(true);
    try {
       // 1. Find the existing user data in users.json (inefficiently)
        // In a real DB, you'd fetch by UID directly. Here we simulate with findUserByCredentials.
        // We pass undefined for password as we only need to find the user by email here.
       const existingUserProfile = await findUserByCredentials(user.email);

       if (!existingUserProfile) {
            throw new Error("Could not find existing user data to update.");
       }

      // 2. Update the user data in users.json via Server Action
      // WARNING: This modifies the JSON file directly, which is not ideal.
      // We are only updating the name here based on the form schema.
       const updateResult = await saveUserToJson(
            existingUserProfile.uid,
            data.name, // Updated name
            existingUserProfile.email!, // Keep existing email
            existingUserProfile.academicStatus!, // Keep existing status
            existingUserProfile.phoneNumber! // Keep existing phone
            // Add other fields if they become editable
       );

        if (!updateResult.success) {
            throw new Error(updateResult.message || "Failed to save profile updates locally.");
        }

        // 3. **Crucially, update the Auth Context state**
        // This requires re-logging in the user with the updated details in our simulated setup
        // Alternatively, you could add an `updateUser` function to the context.
        // Re-login simulation:
        await login(user.email); // Re-fetch updated data via login simulation

        toast({
            title: "Profile Updated",
            description: "Your name has been successfully updated.",
        });
        // Optionally trigger a re-fetch or update context if not using re-login
        profileForm.reset({ name: data.name }); // Reflect changes in the form


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

   // --- Password Submit Function Removed ---


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
                     {/* Use a placeholder avatar since local auth doesn't have photoURL */}
                     <AvatarImage src={`https://avatar.vercel.sh/${user.email || user.uid}.png`} alt={user.displayName || user.email || 'User Avatar'} />
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
                    <Input id="email" type="email" value={user.email || ""} disabled />
                    <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                  </div>
                  {/* Add inputs for other editable fields here if needed */}
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

       {/* Account Settings (Password) - Removed/Disabled */}
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
                    Password management requires a secure authentication provider like Firebase Auth.
                    This functionality is not available when using local JSON storage for users.
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
