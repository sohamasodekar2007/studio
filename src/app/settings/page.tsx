// src/app/settings/page.tsx
'use client';

import React, { useState, useEffect, useCallback, ChangeEvent, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import { User, Loader2, AlertTriangle, Star, CalendarClock, Upload, X, Edit } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { getUserById, updateUserInJson, updateUserPasswordInJson, findUserByEmailInternal } from '@/actions/user-actions';
import type { UserProfile, AcademicStatus, UserModel, ContextUser } from '@/types';
import { academicStatuses } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from "@/components/ui/badge";
import Image from 'next/image';
import bcrypt from 'bcryptjs';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB limit for profile pictures
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

// Generate dynamic year options for Target Year
const getCurrentAndFutureYears = (count = 3) => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: count }, (_, i) => (currentYear + i).toString());
};


// --- Profile Form Schema ---
const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  // Phone number is now disabled, so no validation needed here, but keep for form structure
  phone: z.string().optional(),
  academicStatus: z.enum(academicStatuses, { required_error: "Academic status is required." }).nullable(),
  targetYear: z.string({ required_error: "Target year is required." }).min(4, "Target year is required.").nullable(),
  avatarFile: z.any()
    .optional()
    .nullable()
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
  const { user, loading, logout, refreshUser, updateUserData: updateContextUserData } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);
  const [fullUserProfile, setFullUserProfile] = useState<Omit<UserProfile, 'password'> | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [yearOptions, setYearOptions] = useState<string[]>([]);


  useEffect(() => {
    setIsMounted(true);
    setYearOptions(getCurrentAndFutureYears());
  }, []);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      phone: "",
      academicStatus: null,
      targetYear: null,
      avatarFile: null,
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!isMounted) return;

    const fetchFullProfile = async () => {
      if (user && user.id) {
        try {
          const profile = await getUserById(user.id);
          if (profile) {
            setFullUserProfile(profile);
            profileForm.reset({
              name: profile.name || "",
              phone: profile.phone || "",
              academicStatus: profile.class || null,
              targetYear: profile.targetYear || null,
              avatarFile: null,
            });
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
  }, [user, loading, router, toast, isMounted]); // isMounted ensures this runs client-side

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
      setAvatarPreview(fullUserProfile?.avatarUrl ? `/avatars/${fullUserProfile.avatarUrl}` : null);
    }
    if (event.target) event.target.value = "";
  };

  const removeAvatar = () => {
    profileForm.setValue("avatarFile", null);
    setAvatarPreview(null);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
    profileForm.clearErrors("avatarFile");
    toast({ title: "Avatar Marked for Removal", description: "Click 'Save Profile Changes' to confirm." });
  };

  const onProfileSubmit = async (data: ProfileFormValues) => {
    if (!user || !fullUserProfile || !fullUserProfile.id) {
      toast({ title: 'Error', description: 'User session invalid.', variant: 'destructive' });
      await logout();
      return;
    }
    setIsLoadingProfile(true);
    
    const formData = new FormData();
    formData.append('name', data.name);
    // Phone is disabled, so we don't need to append it if it wasn't changed.
    // However, updateUserInJson will use existing if not provided.
    // For this example, we assume the form structure ensures phone is available if needed.
    formData.append('phone', fullUserProfile.phone || ''); // Send current phone if not editable, or make it editable and send data.phone
    
    if (data.academicStatus) formData.append('class', data.academicStatus);
    if (data.targetYear) formData.append('targetYear', data.targetYear);

    let removeAvatarFlag = false;
    if (data.avatarFile instanceof File) {
      formData.append('avatarFile', data.avatarFile);
    } else if (avatarPreview === null && fullUserProfile.avatarUrl) {
      // This means the user explicitly removed the avatar without uploading a new one
      formData.append('removeAvatar', 'true');
      removeAvatarFlag = true;
    }

    try {
      const updatePayload: Partial<Omit<UserProfile, 'id' | 'password' | 'createdAt'>> & { avatarFile?: File | null, removeAvatar?: boolean } = {
        name: data.name,
        class: data.academicStatus,
        targetYear: data.targetYear,
        // Phone is intentionally not sent here if it's disabled.
        // If you want to allow phone update, add: phone: data.phone
      };

      if (data.avatarFile instanceof File) {
        updatePayload.avatarFile = data.avatarFile;
      } else if (removeAvatarFlag) {
        updatePayload.removeAvatar = true;
      }
      
      const updateResult = await updateUserInJson(user.id, updatePayload);

      if (!updateResult.success || !updateResult.user) {
        throw new Error(updateResult.message || "Failed to save profile updates.");
      }

      await refreshUser(); // Refresh context to reflect changes everywhere
      updateContextUserData(updateResult.user); // Update context for immediate reflection
      setFullUserProfile(updateResult.user); // Update local state for this component
      toast({ title: "Profile Updated", description: "Your profile info has been saved." });
      profileForm.reset({
        name: updateResult.user.name || "",
        phone: updateResult.user.phone || "",
        academicStatus: updateResult.user.class || null,
        targetYear: updateResult.user.targetYear || null,
        avatarFile: null
      });
      setAvatarPreview(updateResult.user.avatarUrl ? `/avatars/${updateResult.user.avatarUrl}` : null);

    } catch (error: any) {
      console.error("Profile update failed:", error);
      toast({ variant: 'destructive', title: "Update Failed", description: error.message });
       if (data.avatarFile && !(avatarPreview === null && fullUserProfile?.avatarUrl)) {
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
      const userWithPassword = await findUserByEmailInternal(user.email);
      if (!userWithPassword || !userWithPassword.password) {
        throw new Error("Could not verify current password. User data missing.");
      }
      const isMatch = await bcrypt.compare(data.currentPassword, userWithPassword.password);
      if (!isMatch) {
        passwordForm.setError("currentPassword", { message: "Incorrect current password." });
        throw new Error("Incorrect current password.");
      }
      const result = await updateUserPasswordInJson(user.id, data.newPassword);
      if (!result.success) {
        throw new Error(result.message || "Failed to update password.");
      }
      toast({ title: "Password Updated", description: "Your password has been changed successfully." });
      passwordForm.reset();
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
  };

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

  if (!isMounted || loading || (user && !fullUserProfile)) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-1/4 mb-6" />
        <Card><CardHeader><Skeleton className="h-6 w-1/5" /><Skeleton className="h-4 w-2/5" /></CardHeader><CardContent className="space-y-4"><div className="flex items-center gap-4"><Skeleton className="h-16 w-16 rounded-full" /> <Skeleton className="h-10 w-32" /></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div><div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div><div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div></div></CardContent><CardFooter><Skeleton className="h-10 w-24" /></CardFooter></Card>
        <Separator />
        <Card><CardHeader><Skeleton className="h-6 w-1/4" /><Skeleton className="h-4 w-1/3" /></CardHeader><CardContent className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></CardContent><CardFooter><Skeleton className="h-10 w-32" /></CardFooter></Card>
        <Separator />
        <Card><CardHeader><Skeleton className="h-6 w-1/4" /><Skeleton className="h-4 w-1/3" /></CardHeader><CardContent className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></CardContent><CardFooter><Skeleton className="h-10 w-36" /></CardFooter></Card>
      </div>
    );
  }

  if (!user) return null;

  const displayAvatarSrc = avatarPreview ?? (fullUserProfile?.avatarUrl ? `/avatars/${fullUserProfile.avatarUrl}` : (user.email ? `https://avatar.vercel.sh/${user.email}.png` : undefined));
  const avatarKey = avatarPreview || fullUserProfile?.avatarUrl || user.email || user.id;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <Form {...profileForm}>
        <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Profile</CardTitle><CardDescription>Manage your personal information and profile picture.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <FormField control={profileForm.control} name="avatarFile" render={({ field }) => (
                <FormItem>
                  <FormLabel>Profile Picture</FormLabel>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16"><AvatarImage src={displayAvatarSrc} alt={user.name || user.email || 'User Avatar'} key={avatarKey} /><AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback></Avatar>
                    <Input id="avatar-upload" type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')} onChange={handleAvatarChange} className="hidden" ref={avatarInputRef} disabled={isLoadingProfile} />
                    <Button type="button" variant="outline" size="sm" onClick={() => avatarInputRef.current?.click()} disabled={isLoadingProfile}><Upload className="mr-2 h-4 w-4" /> Change</Button>
                    {(avatarPreview || fullUserProfile?.avatarUrl) && (<Button type="button" variant="ghost" size="sm" onClick={removeAvatar} disabled={isLoadingProfile} className="text-destructive hover:text-destructive"><X className="mr-1 h-4 w-4" /> Remove</Button>)}
                  </div>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">Max 2MB. JPG, PNG, WEBP.</p>
                </FormItem>
              )} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                <FormField control={profileForm.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} disabled={isLoadingProfile} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={profileForm.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input type="tel" {...field} disabled={true} /></FormControl><FormMessage /><p className="text-xs text-muted-foreground">Contact support to change phone number.</p></FormItem> )} />
                <div className="space-y-2"> <Label htmlFor="email">Email Address</Label> <Input id="email" type="email" value={user.email || ""} disabled /> <p className="text-xs text-muted-foreground">Email cannot be changed.</p> </div>
                
                <FormField control={profileForm.control} name="academicStatus" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Academic Status</FormLabel>
                    <Select onValueChange={(value) => field.onChange(value as AcademicStatus | null)} value={field.value || ""} disabled={isLoadingProfile}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select academic status" /></SelectTrigger></FormControl>
                      <SelectContent>{academicStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={profileForm.control} name="targetYear" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Exam Year</FormLabel>
                    <Select onValueChange={(value) => field.onChange(value)} value={field.value || ""} disabled={isLoadingProfile}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select target year" /></SelectTrigger></FormControl>
                      <SelectContent>{yearOptions.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
            <CardFooter><Button type="submit" disabled={isLoadingProfile}>{isLoadingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Profile Changes</Button></CardFooter>
          </Card>
        </form>
      </Form>
      <Separator />
      <Card><CardHeader><CardTitle>Subscription</CardTitle><CardDescription>Your current access plan.</CardDescription></CardHeader><CardContent className="space-y-2"><div className="flex items-center gap-2"><Star className="h-5 w-5 text-primary" /><span className="font-medium">Current Plan:</span><Badge variant="secondary" className="capitalize">{fullUserProfile?.model || 'N/A'}</Badge></div>{fullUserProfile?.model !== 'free' && fullUserProfile?.expiry_date && (<div className="flex items-center gap-2 text-muted-foreground"><CalendarClock className="h-5 w-5" /><span>Expires on: {formatDate(fullUserProfile.expiry_date)}</span></div>)}{fullUserProfile?.model === 'free' && (<p className="text-sm text-muted-foreground">Upgrade to access premium test series.</p>)}</CardContent></Card>
      <Separator />
      <Form {...passwordForm}><form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4"><Card><CardHeader><CardTitle>Change Password</CardTitle><CardDescription className="flex items-center gap-2 text-orange-600"><AlertTriangle className="h-4 w-4" />Ensure you remember your new password.</CardDescription></CardHeader><CardContent className="space-y-4"><FormField control={passwordForm.control} name="currentPassword" render={({ field }) => (<FormItem><FormLabel>Current Password</FormLabel><FormControl><Input type="password" {...field} disabled={isLoadingPassword} /></FormControl><FormMessage /></FormItem>)} /><FormField control={passwordForm.control} name="newPassword" render={({ field }) => (<FormItem><FormLabel>New Password</FormLabel><FormControl><Input type="password" {...field} disabled={isLoadingPassword} /></FormControl><FormMessage /></FormItem>)} /><FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => (<FormItem><FormLabel>Confirm New Password</FormLabel><FormControl><Input type="password" {...field} disabled={isLoadingPassword} /></FormControl><FormMessage /></FormItem>)} /></CardContent><CardFooter><Button type="submit" disabled={isLoadingPassword}>{isLoadingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Update Password</Button></CardFooter></Card></form></Form>
      <Separator />
      <Card><CardHeader><CardTitle>Notifications</CardTitle><CardDescription>Manage how you receive notifications (placeholder).</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex items-center justify-between p-4 border rounded-lg"><Label htmlFor="email-notifications" className="flex flex-col space-y-1"><span>Email Notifications</span><span className="font-normal leading-snug text-muted-foreground">Send emails about test results and EduNexus updates.</span></Label><Switch id="email-notifications" defaultChecked disabled /></div><div className="flex items-center justify-between p-4 border rounded-lg"><Label htmlFor="in-app-notifications" className="flex flex-col space-y-1"><span>In-App Notifications</span><span className="font-normal leading-snug text-muted-foreground">Show notifications within the EduNexus platform.</span></Label><Switch id="in-app-notifications" defaultChecked disabled /></div></CardContent><CardFooter><Button disabled>Save Preferences</Button></CardFooter></Card>
    </div>
  );
}
