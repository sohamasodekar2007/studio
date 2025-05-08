// src/app/settings/page.tsx
"use client";

import React, { useState, useEffect, useCallback, ChangeEvent, useRef } from 'react';
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
import { User, Loader2, AlertTriangle, Star, CalendarClock, Upload, X } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { getUserById, updateUserInJson, updateUserPasswordInJson, findUserByEmailInternal } from '@/actions/user-actions'; // Use updated user actions
import type { UserProfile, AcademicStatus, UserModel, ContextUser } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from "@/components/ui/badge";
import Image from 'next/image';
import bcrypt from 'bcryptjs'; // Import bcryptjs

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB limit for profile pictures
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

// --- Profile Form Schema ---
const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  phone: z.string()
           .min(10, { message: "Please enter a valid 10-digit phone number." })
           .max(10, { message: "Phone number must be 10 digits." })
           .regex(/^\d{10}$/, { message: "Please enter a valid 10-digit phone number." }),
  avatarFile: z.any()
    .optional()
    .refine(
      (file) => !file || (file instanceof File && file.size <= MAX_FILE_SIZE),
      `Max image size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`
    )
    .refine(
      (file) => !file || (file instanceof File && ACCEPTED_IMAGE_TYPES.includes(file.type)),
      "Only .jpg, .jpeg, .png and .webp formats are supported."
    ),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

// --- Password Change Form Schema ---
const passwordSchema = z.object({
  currentPassword: z.string().min(1, { message: "Current password is required." }),
  newPassword: z.string().min(6, { message: "New password must be at least 6 characters." }),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New passwords don't match",
  path: ["confirmPassword"],
});
type PasswordFormValues = z.infer<typeof passwordSchema>;


export default function SettingsPage() {
  const { user, loading, logout, refreshUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);
  const [fullUserProfile, setFullUserProfile] = useState<Omit<UserProfile, 'password'> | null>(null); // State to store full profile without password
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isMounted, setIsMounted] = useState(false); // Track mount state

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // --- Profile Form Initialization ---
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      phone: "",
      avatarFile: null,
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

  // Effect to fetch the full user profile
  useEffect(() => {
    if (!isMounted) return; // Don't run on server

    const fetchFullProfile = async () => {
      if (user && user.id) {
        try {
          // Fetch user profile *without* password
          const profile = await getUserById(user.id);
          if (profile) {
            setFullUserProfile(profile);
            profileForm.reset({
              name: profile.name || "",
              phone: profile.phone || "",
              avatarFile: null,
            });
            // Construct the correct path relative to the public directory
            setAvatarPreview(profile.avatarUrl ? `/avatars/${profile.avatarUrl}` : null);
          } else {
            console.error("Settings: User found in context but not in backend data.");
            await logout("Invalid session data. Please log in again.");
            router.push('/auth/login');
          }
        } catch (error) {
          console.error("Settings: Failed to fetch full user profile:", error);
          toast({ title: 'Error', description: 'Could not load profile details.', variant: 'destructive' });
        }
      }
    };

    if (!loading && user) {
      fetchFullProfile();
    } else if (!loading && !user) {
      router.push('/auth/login');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, router, toast, isMounted]); // Add isMounted

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        profileForm.setError("avatarFile", { type: 'manual', message: `Max image size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` });
        return;
      }
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        profileForm.setError("avatarFile", { type: 'manual', message: "Invalid file type." });
        return;
      }
      profileForm.clearErrors("avatarFile");
      profileForm.setValue("avatarFile", file);
      setAvatarPreview(URL.createObjectURL(file));
    } else {
      profileForm.setValue("avatarFile", null);
       // Revert to original stored avatar or null if none exists
      setAvatarPreview(fullUserProfile?.avatarUrl ? `/avatars/${fullUserProfile.avatarUrl}` : null);
    }
    if (event.target) event.target.value = "";
  };

  const removeAvatar = () => {
    profileForm.setValue("avatarFile", null);
    setAvatarPreview(null); // Set preview to null immediately
    if (avatarInputRef.current) avatarInputRef.current.value = "";
    profileForm.clearErrors("avatarFile");
    toast({ title: "Avatar Removed", description: "Click 'Save Profile Changes' to confirm." });
  };

  const onProfileSubmit = async (data: ProfileFormValues) => {
    if (!user || !fullUserProfile || !fullUserProfile.id) {
      toast({ title: 'Error', description: 'User session invalid.', variant: 'destructive' });
      await logout();
      return;
    }
    setIsLoadingProfile(true);
    let newAvatarFilename: string | null = fullUserProfile.avatarUrl || null; // Start with current filename
    const oldAvatarFilename = fullUserProfile.avatarUrl || null;
    let avatarChanged = false;

    try {
        // Check if a new file was uploaded
        if (data.avatarFile instanceof File) {
            avatarChanged = true;
            console.warn("Simulating avatar upload. File would be handled here in a real backend.");
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const extension = data.avatarFile.name.split('.').pop();
            newAvatarFilename = `avatar-${user.id}-${uniqueSuffix}.${extension}`; // Generate new filename
            console.log(`Simulated: Save new avatar as ${newAvatarFilename}`);
            if (oldAvatarFilename) console.log(`Simulated: Delete old avatar ${oldAvatarFilename}`);
            // --- Backend Upload/Delete ---
            // In a real app, call a server action here to:
            // 1. Upload data.avatarFile
            // 2. Delete oldAvatarFilename if it exists
            // 3. Return the actual newAvatarFilename from the server action
            // const uploadResult = await uploadAvatarAction(formData); // Example
            // if (!uploadResult.success) throw new Error('Avatar upload failed');
            // newAvatarFilename = uploadResult.filename;
            // --- End Backend ---
        }
        // Check if the avatar was marked for removal (preview is null but file input wasn't set)
        else if (avatarPreview === null && oldAvatarFilename !== null && !data.avatarFile) {
            avatarChanged = true;
            console.log("Avatar marked for removal.");
            newAvatarFilename = null; // Set filename to null
             // --- Backend Delete ---
             // Call a server action here to delete oldAvatarFilename
             // if (oldAvatarFilename) await deleteAvatarAction(user.id, oldAvatarFilename); // Example
             // --- End Backend ---
        }

        // Only proceed with update if data actually changed
        const nameChanged = data.name !== (fullUserProfile.name || '');
        const phoneChanged = data.phone !== (fullUserProfile.phone || '');

        if (!nameChanged && !phoneChanged && !avatarChanged) {
            toast({ title: "No Changes Detected", description: "No profile information was modified." });
            setIsLoadingProfile(false);
            return;
        }

        // Prepare payload for update (excluding fields not being updated directly)
        const updatePayload: Partial<Omit<UserProfile, 'id' | 'createdAt' | 'email' | 'password' | 'class' | 'model' | 'expiry_date' | 'referral' | 'role' | 'totalPoints'>> = {};
        if (nameChanged) updatePayload.name = data.name;
        if (phoneChanged) updatePayload.phone = data.phone;
        if (avatarChanged) updatePayload.avatarUrl = newAvatarFilename;

        // Call the server action to update the user's JSON data
        const updateResult = await updateUserInJson(user.id, updatePayload);

        if (!updateResult.success || !updateResult.user) {
            throw new Error(updateResult.message || "Failed to save profile updates.");
        }

        // Refresh the user context and update local state
        await refreshUser(); // Refresh context to reflect changes everywhere
        setFullUserProfile(updateResult.user); // Update local state for this component
        toast({ title: "Profile Updated", description: "Your profile info has been saved." });
        profileForm.reset({ name: updateResult.user.name || "", phone: updateResult.user.phone || "", avatarFile: null });
        setAvatarPreview(updateResult.user.avatarUrl ? `/avatars/${updateResult.user.avatarUrl}` : null); // Update preview

    } catch (error: any) {
        console.error("Profile update failed:", error);
        toast({ variant: 'destructive', title: "Update Failed", description: error.message });
        // Revert preview on error ONLY if it wasn't explicitly removed and an avatar file was being processed
         if (data.avatarFile && !(avatarPreview === null && oldAvatarFilename !== null)) {
             setAvatarPreview(fullUserProfile?.avatarUrl ? `/avatars/${fullUserProfile.avatarUrl}` : null);
        }
    } finally {
        setIsLoadingProfile(false);
    }
  };

   const onPasswordSubmit = async (data: PasswordFormValues) => {
        if (!user || !user.id || !user.email) {
            toast({ variant: 'destructive', title: 'Error', description: 'User not logged in or email missing.' });
            return;
        }
        setIsLoadingPassword(true);
        try {
             // Fetch user with password hash from backend using the internal function
             const userWithPassword = await findUserByEmailInternal(user.email);
             if (!userWithPassword || !userWithPassword.password) {
                throw new Error("Could not verify current password. User data missing.");
             }

             // Compare plaintext current password with the stored hash
             const isMatch = await bcrypt.compare(data.currentPassword, userWithPassword.password);
             if (!isMatch) {
                passwordForm.setError("currentPassword", { message: "Incorrect current password." });
                 throw new Error("Incorrect current password.");
             }

             // Call action to update password in JSON (it handles hashing the new password)
             const result = await updateUserPasswordInJson(user.id, data.newPassword);
             if (!result.success) {
                 throw new Error(result.message || "Failed to update password.");
             }

            toast({ title: "Password Updated", description: "Your password has been changed successfully." });
            passwordForm.reset(); // Clear password fields
        } catch (error: any) {
            console.error("Password update failed:", error);
            toast({ variant: 'destructive', title: "Password Update Failed", description: error.message });
        } finally {
            setIsLoadingPassword(false);
        }
    };

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) return name.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return <User className="h-full w-full"/>;
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return 'Invalid Date';
    }
  };

   // Loading state for the entire page until user profile is fetched
   if (!isMounted || loading || (user && !fullUserProfile)) {
     return (
       <div className="space-y-6 max-w-3xl mx-auto">
         <Skeleton className="h-8 w-1/4 mb-6" />
         <Card>
           <CardHeader><Skeleton className="h-6 w-1/5" /><Skeleton className="h-4 w-2/5" /></CardHeader>
           <CardContent className="space-y-4">
             <div className="flex items-center gap-4"><Skeleton className="h-16 w-16 rounded-full" /> <Skeleton className="h-10 w-32" /></div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
               <div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
               <div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
             </div>
           </CardContent>
           <CardFooter><Skeleton className="h-10 w-24" /></CardFooter>
         </Card>
         <Separator />
         <Card>
            <CardHeader><Skeleton className="h-6 w-1/4" /><Skeleton className="h-4 w-1/3" /></CardHeader>
            <CardContent className="space-y-4">
                 <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-10 w-full" />
            </CardContent>
            <CardFooter><Skeleton className="h-10 w-32" /></CardFooter>
         </Card>
          <Separator />
          <Card>
             <CardHeader><Skeleton className="h-6 w-1/4" /><Skeleton className="h-4 w-1/3" /></CardHeader>
             <CardContent className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
             </CardContent>
             <CardFooter><Skeleton className="h-10 w-36" /></CardFooter>
          </Card>
       </div>
     );
   }

  if (!user) {
    return null; // Redirect handled by useEffect
  }

  // Construct avatar source ensuring fallback mechanism
  const displayAvatarSrc = avatarPreview ?? (fullUserProfile?.avatarUrl ? `/avatars/${fullUserProfile.avatarUrl}` : `https://avatar.vercel.sh/${user.email || user.id}.png`);
  const avatarKey = fullUserProfile?.avatarUrl || user.email || user.id; // Unique key for Vercel/fallback


  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      {/* Profile Settings */}
      <Form {...profileForm}>
        <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Manage your personal information and profile picture.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={profileForm.control}
                name="avatarFile"
                render={({ field }) => ( // No need to use field directly here, state manages file
                  <FormItem>
                    <FormLabel>Profile Picture</FormLabel>
                    <div className="flex items-center gap-4">
                       <Avatar className="h-16 w-16">
                         <AvatarImage src={displayAvatarSrc} alt={user.name || user.email || 'User Avatar'} key={avatarKey} /> {/* Use key */}
                         <AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback>
                       </Avatar>
                      <Input
                        id="avatar-upload"
                        type="file"
                        accept={ACCEPTED_IMAGE_TYPES.join(',')}
                        onChange={handleAvatarChange}
                        className="hidden"
                        ref={avatarInputRef}
                        disabled={isLoadingProfile}
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => avatarInputRef.current?.click()} disabled={isLoadingProfile}>
                        <Upload className="mr-2 h-4 w-4" /> Change
                      </Button>
                      {/* Show remove button only if there's a preview or a stored avatar */}
                      {(avatarPreview || fullUserProfile?.avatarUrl) && (
                        <Button type="button" variant="ghost" size="sm" onClick={removeAvatar} disabled={isLoadingProfile} className="text-destructive hover:text-destructive">
                          <X className="mr-1 h-4 w-4" /> Remove
                        </Button>
                      )}
                    </div>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">Max 2MB. JPG, PNG, WEBP.</p>
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                <FormField control={profileForm.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} disabled={isLoadingProfile} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={profileForm.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input type="tel" {...field} disabled={isLoadingProfile} /></FormControl><FormMessage /></FormItem> )} />
                <div className="space-y-2"> <Label htmlFor="email">Email Address</Label> <Input id="email" type="email" value={user.email || ""} disabled /> <p className="text-xs text-muted-foreground">Email cannot be changed.</p> </div>
                <div className="space-y-2"> <Label htmlFor="class">Academic Status</Label> <Input id="class" value={fullUserProfile?.class || "N/A"} disabled /> <p className="text-xs text-muted-foreground">Contact support to change.</p> </div>
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
            <Badge variant="secondary" className="capitalize">{fullUserProfile?.model || 'N/A'}</Badge>
          </div>
          {fullUserProfile?.model !== 'free' && fullUserProfile?.expiry_date && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarClock className="h-5 w-5" />
              <span>Expires on: {formatDate(fullUserProfile.expiry_date)}</span>
            </div>
          )}
          {fullUserProfile?.model === 'free' && (
            <p className="text-sm text-muted-foreground">Upgrade to access premium test series.</p>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Change Password */}
       <Form {...passwordForm}>
        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
         <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
               <CardDescription className="flex items-center gap-2 text-orange-600">
                 <AlertTriangle className="h-4 w-4" />
                 Ensure you remember your new password.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl><Input type="password" {...field} disabled={isLoadingPassword} /></FormControl>
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
                        <FormControl><Input type="password" {...field} disabled={isLoadingPassword} /></FormControl>
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
                        <FormControl><Input type="password" {...field} disabled={isLoadingPassword} /></FormControl>
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
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <Label htmlFor="email-notifications" className="flex flex-col space-y-1">
              <span>Email Notifications</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Send emails about test results and EduNexus updates.
              </span>
            </Label>
            <Switch id="email-notifications" defaultChecked disabled />
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <Label htmlFor="in-app-notifications" className="flex flex-col space-y-1">
              <span>In-App Notifications</span>
              <span className="font-normal leading-snug text-muted-foreground">
                Show notifications within the EduNexus platform.
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
