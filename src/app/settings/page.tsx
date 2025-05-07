// src/app/settings/page.tsx
'use client';

import { useState, useEffect, useCallback, ChangeEvent } from 'react';
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
import { User, Loader2, AlertTriangle, Star, CalendarClock, Upload, X } from 'lucide-react'; // Added Upload, X
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { saveUserToJson, getUserById, updateUserInJson } from '@/actions/user-actions'; // Import updateUserInJson
import type { UserProfile, AcademicStatus, UserModel, ContextUser } from '@/types'; // Ensure ContextUser is imported
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from "@/components/ui/badge";
import Image from 'next/image'; // Import next/image

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB limit for profile pictures
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];


// --- Profile Form Schema ---
// Allow updating name, phone. Class, model, expiry are read-only here.
const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  phone: z.string().min(10, { message: "Please enter a valid 10-digit phone number." }).max(15, { message: "Phone number seems too long." }).regex(/^\d{10}$/, { message: "Please enter a valid 10-digit phone number." }),
  // New field for avatar file (optional)
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

export default function SettingsPage() {
  const { user, loading, logout, refreshUser } = useAuth(); // Get refreshUser
  const { toast } = useToast();
  const [router] = useState(useRouter()); // Keep using useState for router
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [fullUserProfile, setFullUserProfile] = useState<UserProfile | null>(null); // State to hold the full profile
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null); // State for image preview
  const avatarInputRef = React.useRef<HTMLInputElement>(null);

  // --- Profile Form Initialization ---
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      phone: "",
      avatarFile: null, // Initialize avatarFile field
    },
  });

  // Effect to fetch the full user profile
  useEffect(() => {
    const fetchFullProfile = async () => {
        if (user && user.id) { // Check user.id exists
            try {
                const profile = await getUserById(user.id); // Fetch by ID
                if (profile) {
                     setFullUserProfile(profile);
                     profileForm.reset({
                        name: profile.name || "",
                        phone: profile.phone || "",
                         avatarFile: null, // Reset file input on profile load
                     });
                      setAvatarPreview(profile.avatarUrl ? `/avatars/${profile.avatarUrl}` : null); // Set initial preview
                } else {
                    // User not found in backend, likely an issue
                     console.error("User found in context but not in backend data.");
                     toast({ title: 'Error', description: 'Could not load profile details. Please try logging in again.', variant: 'destructive' });
                     await logout(); // Log out if profile is inconsistent
                     router.push('/auth/login');
                }
            } catch (error) {
                console.error("Failed to fetch full user profile:", error);
                toast({ title: 'Error', description: 'Could not load profile details.', variant: 'destructive' });
            }
        }
    };

    if (!loading && user) {
        fetchFullProfile();
    } else if (!loading && !user) {
        router.push('/auth/login');
        toast({ title: 'Unauthorized', description: 'Please log in to access settings.', variant: 'destructive' });
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, router, toast]); // Removed profileForm from dependencies

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
     const file = event.target.files?.[0];
     if (file) {
         // Validate file using zod refine logic (or manually check here)
         if (file.size > MAX_FILE_SIZE) {
             profileForm.setError("avatarFile", { type: 'manual', message: `Max image size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` });
             return;
         }
         if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
             profileForm.setError("avatarFile", { type: 'manual', message: "Invalid file type." });
             return;
         }
         profileForm.clearErrors("avatarFile"); // Clear previous errors
         profileForm.setValue("avatarFile", file); // Set the File object
         setAvatarPreview(URL.createObjectURL(file)); // Create preview URL
     } else {
         profileForm.setValue("avatarFile", null);
         setAvatarPreview(fullUserProfile?.avatarUrl ? `/avatars/${fullUserProfile.avatarUrl}` : null); // Revert to original or null
     }
      // Reset input value to allow re-uploading the same file
     if (event.target) {
       event.target.value = "";
     }
  };

   const removeAvatar = () => {
     profileForm.setValue("avatarFile", null); // Clear file input in form state
     setAvatarPreview(null); // Clear preview
     if (avatarInputRef.current) {
       avatarInputRef.current.value = ""; // Clear the actual file input
     }
      profileForm.clearErrors("avatarFile");
     // Optionally: Add logic here if you want to immediately delete the avatar from storage on remove click
     // e.g., call a server action to delete the existing avatar file
     // For now, it will be removed/replaced only on saving changes.
     toast({ title: "Avatar Removed", description: "Click 'Save Profile Changes' to confirm." });
   };

  const onProfileSubmit = async (data: ProfileFormValues) => {
    if (!user || !fullUserProfile || !fullUserProfile.id || !fullUserProfile.email) {
      toast({ title: 'Error', description: 'User session or profile data is invalid. Please log in again.', variant: 'destructive' });
      await logout();
      router.push('/auth/login');
      return;
    }
    setIsLoadingProfile(true);
    let newAvatarFilename: string | null = fullUserProfile.avatarUrl; // Start with existing filename
    let oldAvatarFilename: string | null = fullUserProfile.avatarUrl; // Store old filename for potential deletion

    try {
        // --- Handle Avatar Upload ---
        if (data.avatarFile instanceof File) {
            const formData = new FormData();
            formData.append('userId', user.id);
            formData.append('avatar', data.avatarFile);
             formData.append('oldAvatarFilename', oldAvatarFilename || ''); // Send old filename if exists


             // TODO: Create and call a separate Server Action for avatar upload
             // This action should:
             // 1. Receive userId, avatar file, oldAvatarFilename.
             // 2. Validate the file server-side.
             // 3. Generate a unique filename (e.g., userId + timestamp + extension).
             // 4. Save the file to `public/avatars/`.
             // 5. If an oldAvatarFilename was provided and exists, delete the old file.
             // 6. Return the unique filename of the *new* avatar.

             // Placeholder for the action call:
             // const uploadResult = await uploadAvatarAction(formData);
             // if (!uploadResult.success || !uploadResult.filename) {
             //     throw new Error(uploadResult.message || 'Failed to upload avatar.');
             // }
             // newAvatarFilename = uploadResult.filename;

             // --- Simulation for Local Development ---
              console.warn("Avatar upload action not implemented. Simulating save.");
              // Generate a simple unique name locally (replace with proper action)
              const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
              const extension = data.avatarFile.name.split('.').pop();
              newAvatarFilename = `avatar-${user.id}-${uniqueSuffix}.${extension}`;
              // In a real scenario, the server action would handle saving the file
              // to `public/avatars/${newAvatarFilename}` and deleting the old one.
              console.log(`Simulated: Would save avatar as ${newAvatarFilename}`);
               if (oldAvatarFilename) console.log(`Simulated: Would delete old avatar ${oldAvatarFilename}`);
             // --- End Simulation ---

        } else if (avatarPreview === null && oldAvatarFilename !== null) {
            // User removed the avatar without uploading a new one
             console.log("Avatar removed by user. Will delete on save.");
              // In a real scenario, the server action `updateUserInJson` should handle deletion
              // For now, we'll set newAvatarFilename to null to signal deletion.
              newAvatarFilename = null; // Signal to delete
              // TODO: If you have a separate delete action, call it here or pass a flag to updateUserInJson
        }

      // --- Prepare User Profile Data for Update ---
       const updatedDataPayload: Partial<Omit<UserProfile, 'id' | 'createdAt' | 'email' | 'password' | 'class' | 'model' | 'expiry_date' | 'referral'>> = {
         name: data.name,
         phone: data.phone,
          avatarUrl: newAvatarFilename, // Update with the new filename or null
       };


      // Save other profile fields using the existing action
      const updateResult = await updateUserInJson(user.id, updatedDataPayload);

      if (!updateResult.success || !updateResult.user) {
        throw new Error(updateResult.message || "Failed to save profile updates locally.");
      }

      // Refresh user context to reflect changes immediately
      await refreshUser();

      toast({
        title: "Profile Updated",
        description: "Your profile information has been successfully updated.",
      });
      profileForm.reset({ // Reset form with new data, clear file input
          name: updateResult.user.name || "",
          phone: updateResult.user.phone || "",
          avatarFile: null,
      });
       setAvatarPreview(updateResult.user.avatarUrl ? `/avatars/${updateResult.user.avatarUrl}` : null); // Update preview

    } catch (error: any) {
      console.error("Profile update failed:", error);
      toast({
        variant: 'destructive',
        title: "Update Failed",
        description: error.message || "Could not update profile.",
      });
       if (error.message.includes("Please log in again")) {
           await logout();
           router.push('/auth/login');
       }
       // Revert preview if upload failed but data change succeeded partially? Complex.
       // Maybe revert preview only if the entire save process fails.
        setAvatarPreview(fullUserProfile?.avatarUrl ? `/avatars/${fullUserProfile.avatarUrl}` : null);
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
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return 'Invalid Date';
    }
  };


  // --- Loading State ---
  if (loading || (user && !fullUserProfile && !loading)) {
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
        {/* Other skeletons... */}
      </div>
    );
  }

  // --- Not Logged In State (Should be handled by redirect in useEffect) ---
   if (!user) {
    return <div className="text-center p-8">Redirecting to login...</div>;
   }


  // --- Logged In View ---
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
              {/* Avatar Section */}
               <FormField
                 control={profileForm.control}
                 name="avatarFile"
                 render={({ field }) => ( // No need to use field directly here, we manage with state/ref
                    <FormItem>
                        <FormLabel>Profile Picture</FormLabel>
                        <div className="flex items-center gap-4">
                            <Avatar className="h-16 w-16">
                                <AvatarImage src={avatarPreview || `https://avatar.vercel.sh/${user.email || user.id}.png`} alt={user.name || user.email || 'User Avatar'} />
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
                             {avatarPreview && (
                                <Button type="button" variant="ghost" size="sm" onClick={removeAvatar} disabled={isLoadingProfile} className="text-destructive hover:text-destructive">
                                    <X className="mr-1 h-4 w-4" /> Remove
                                </Button>
                            )}
                        </div>
                        <FormMessage /> {/* Show validation errors */}
                        <p className="text-xs text-muted-foreground">Max 2MB. JPG, PNG, WEBP.</p>
                    </FormItem>
                 )}
               />

              {/* Other Profile Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
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
                   <Input id="class" value={user.class || "N/A"} disabled />
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
      </Card>

       <Separator />

      {/* Account Settings (Password) - Still shows warning but allows change */}
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
           <CardDescription className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="h-4 w-4" />
             Use a strong, unique password.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <p className="text-sm text-muted-foreground">
             Manage your account password here.
           </p>
           {/* TODO: Implement password change form/modal */}
        </CardContent>
        <CardFooter>
          <Button disabled>Change Password (Coming Soon)</Button>
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
                Send emails about test results and platform updates.
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
```

</content>
  </change>
  <change>
    <file>src/components/layout/header.tsx</file>
    <description>Update header to display user avatar if available, falling back to initials.</description>
    <content><![CDATA['use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Settings, LogOut, HelpCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context'; // Use our AuthContext
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

export function AppHeader() {
  const { user, loading, logout } = useAuth(); // Get user, loading, and local logout
  const router = useRouter();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout(); // Call the local logout function from context
       toast({
         title: "Logged Out",
         description: "You have been successfully logged out.",
       });
      // Redirect handled by AuthContext
    } catch (error: any) {
      console.error("Logout failed:", error);
      toast({
        variant: "destructive",
        title: "Logout Failed",
        description: error.message || "Could not log out. Please try again.",
      });
    } finally {
       setIsLoggingOut(false);
    }
  };

  // Get first letter of display name or email for fallback
  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) return name.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return <User className="h-4 w-4"/>; // Return User icon component
  }

  // Construct avatar URL if available
  const avatarSrc = user?.avatarUrl ? `/avatars/${user.avatarUrl}` : undefined;
  const avatarKey = user?.avatarUrl || user?.email || user?.id; // Key for Vercel Avatars or fallback

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4">
      <SidebarTrigger className="sm:hidden" />
      <div className="flex-1">
        {/* Optionally add page title or breadcrumbs here */}
      </div>
      {loading ? (
         <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="overflow-hidden rounded-full">
              <Avatar className="h-full w-full"> {/* Ensure Avatar fills Button */}
                <AvatarImage src={avatarSrc} alt={user.name || user.email || 'User Avatar'} />
                <AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user.name || user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/help">
                <HelpCircle className="mr-2 h-4 w-4" />
                Support
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut}>
              {isLoggingOut ? (
                 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
               ) : (
                 <LogOut className="mr-2 h-4 w-4" />
              )}
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button asChild variant="outline">
          <Link href="/auth/login">Login / Sign Up</Link>
        </Button>
      )}
    </header>
  );
}
