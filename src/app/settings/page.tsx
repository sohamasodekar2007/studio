// src/app/settings/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/context/auth-context';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Loader2, AlertTriangle, Star, CalendarClock, KeyRound } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { saveUserToJson, getUserById } from '@/actions/user-actions';
import type { UserProfile, AcademicStatus, UserModel, ContextUser } from '@/types'; // Ensure ContextUser is imported
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import ResetPasswordDialog from '@/components/admin/reset-password-dialog';

const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  phone: z.string().min(10, { message: "Please enter a valid 10-digit phone number." }).max(10, { message: "Phone number must be 10 digits." }).regex(/^\d{10}$/, { message: "Please enter a valid 10-digit phone number." }),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

export default function SettingsPage() {
  const { user, loading, logout, refreshUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [fullUserProfile, setFullUserProfile] = useState<UserProfile | null>(null);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", phone: "" },
  });

  useEffect(() => {
    const fetchFullProfile = async () => {
        if (user && user.id) {
            try {
                const profile = await getUserById(user.id);
                 if (profile) {
                     const profileWithPasswordPlaceholder: UserProfile = {
                         ...(profile as Omit<UserProfile, 'password'>),
                         password: '', // Local auth doesn't expose password hash here
                     };
                     setFullUserProfile(profileWithPasswordPlaceholder);
                     profileForm.reset({
                        name: profileWithPasswordPlaceholder.name || "",
                        phone: profileWithPasswordPlaceholder.phone || "",
                     });
                 } else {
                     toast({ title: 'Error', description: 'Could not load profile details. Please log in again.', variant: 'destructive' });
                     await logout();
                 }
            } catch (error) {
                console.error("Failed to fetch full user profile:", error);
                toast({ title: 'Error', description: 'Could not load profile details.', variant: 'destructive' });
                await logout();
            }
        }
    };

    if (!loading && user) {
        fetchFullProfile();
    } else if (!loading && !user) {
        router.push('/auth/login?redirect=/settings');
    }
  }, [user, loading, router, toast, profileForm, logout]);


  const onProfileSubmit = async (data: ProfileFormValues) => {
    if (!user || !fullUserProfile || !fullUserProfile.id) {
      toast({ title: 'Error', description: 'User session or profile data is invalid. Please log in again.', variant: 'destructive' });
      await logout();
      return;
    }
    setIsLoadingProfile(true);
    try {
       const updatedProfile: UserProfile = {
         ...fullUserProfile,
         name: data.name,
         phone: data.phone,
         password: fullUserProfile.password,
       };
      const updateResult = await saveUserToJson(updatedProfile);
      if (!updateResult.success) {
        throw new Error(updateResult.message || "Failed to save profile updates locally.");
      }
      await refreshUser();
      toast({
        title: "Profile Updated",
        description: "Your profile information has been successfully updated.",
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

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) return name.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return <User className="h-full w-full" />;
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

  if (loading || (user && !fullUserProfile && !loading)) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-1/4 mb-6" />
        <Card>
          <CardHeader><Skeleton className="h-6 w-1/5" /><Skeleton className="h-4 w-2/5" /></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4"><Skeleton className="h-16 w-16 rounded-full" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
              <div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
              <div className="space-y-2"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
            </div>
          </CardContent>
          <CardFooter><Skeleton className="h-10 w-24" /></CardFooter>
        </Card>
      </div>
    );
  }

   if (!user) {
    return <div className="text-center p-8">Redirecting to login...</div>;
   }

  return (
    <>
      <div className="space-y-6 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <Form {...profileForm}>
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
            <Card>
              <CardHeader><CardTitle>Profile</CardTitle><CardDescription>Manage your personal information.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                     <AvatarImage src={`https://avatar.vercel.sh/${user.email || user.id}.png`} alt={user.displayName || user.email || 'User Avatar'} />
                     <AvatarFallback>{getInitials(user.displayName, user.email)}</AvatarFallback>
                  </Avatar>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={profileForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} disabled={isLoadingProfile} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={profileForm.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input type="tel" {...field} disabled={isLoadingProfile} /></FormControl><FormMessage /></FormItem>)} />
                  <div className="space-y-2"><Label htmlFor="email">Email Address</Label><Input id="email" type="email" value={user.email || ""} disabled /><p className="text-xs text-muted-foreground">Email cannot be changed.</p></div>
                  <div className="space-y-2"><Label htmlFor="class">Academic Status</Label><Input id="class" value={user.className || "N/A"} disabled /><p className="text-xs text-muted-foreground">Contact support to change.</p></div>
                </div>
              </CardContent>
              <CardFooter><Button type="submit" disabled={isLoadingProfile}>{isLoadingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Profile Changes</Button></CardFooter>
            </Card>
          </form>
        </Form>
        <Separator />
        <Card>
          <CardHeader><CardTitle>Subscription</CardTitle><CardDescription>Your current access plan.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2"><Star className="h-5 w-5 text-primary" /><span className="font-medium">Current Plan:</span><Badge variant="secondary" className="capitalize">{user.model || 'N/A'}</Badge></div>
            {user.model !== 'free' && user.expiry_date && (<div className="flex items-center gap-2 text-muted-foreground"><CalendarClock className="h-5 w-5" /><span>Expires on: {formatDate(user.expiry_date)}</span></div>)}
            {user.model === 'free' && (<p className="text-sm text-muted-foreground">Upgrade to access premium test series.</p>)}
          </CardContent>
        </Card>
        <Separator />
        <Card>
          <CardHeader><CardTitle>Password</CardTitle><CardDescription>Update your account password.</CardDescription></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Click the button below to update your password.</p></CardContent>
          <CardFooter><Button onClick={() => setIsResetPasswordOpen(true)}><KeyRound className="mr-2 h-4 w-4" /> Update Password</Button></CardFooter>
        </Card>
        <Separator />
        <Card>
          <CardHeader><CardTitle>Notifications</CardTitle><CardDescription>Manage how you receive notifications (placeholder).</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <Label htmlFor="email-notifications" className="flex flex-col space-y-1"><span>Email Notifications</span><span className="font-normal leading-snug text-muted-foreground">Receive emails about test results and platform updates.</span></Label>
              <Switch id="email-notifications" defaultChecked disabled />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <Label htmlFor="in-app-notifications" className="flex flex-col space-y-1"><span>In-App Notifications</span><span className="font-normal leading-snug text-muted-foreground">Show notifications within the STUDY SPHERE platform.</span></Label>
              <Switch id="in-app-notifications" defaultChecked disabled />
            </div>
          </CardContent>
          <CardFooter><Button disabled>Save Preferences</Button></CardFooter>
        </Card>
      </div>
      {fullUserProfile && (
          <ResetPasswordDialog
            user={fullUserProfile}
            isOpen={isResetPasswordOpen}
            onClose={() => setIsResetPasswordOpen(false)}
          />
        )}
    </>
  );
}
