// src/components/admin/edit-user-dialog.tsx
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon, Loader2, ShieldCheck, AlertTriangle, Phone, Edit, KeyRound, UserCheck, User } from "lucide-react"; // Added missing icons
import { format, isValid, parseISO } from "date-fns";
import { useToast } from '@/hooks/use-toast';
import { type UserProfile, userModels, academicStatuses, type AcademicStatus } from '@/types';
import { updateUserInJson, findUserByEmailInternal } from '@/actions/user-actions'; // Import necessary actions
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; // Added Avatar imports

// Define the allowed admin email pattern and primary admin email
const primaryAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@edunexus.com';

// Generate year options for target year
const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 6 }, (_, i) => (currentYear + i).toString());


// Schema for editing user profile, including email
// Validation for email format related to role is handled in the server action (`updateUserInJson`)
const editUserSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  phone: z.string()
           .min(10, { message: "Please enter a valid 10-digit phone number." })
           .max(10, { message: "Phone number must be 10 digits." })
           .regex(/^\d{10}$/, { message: "Please enter a valid 10-digit phone number." }),
  class: z.enum(academicStatuses).nullable().optional(), // Allow null or value
  model: z.enum(userModels, { required_error: "Please select a user model." }),
  expiry_date: z.date().nullable().optional(),
  targetYear: z.string().optional().nullable(), // Added targetYear
}).refine(data => data.model === 'free' || (data.model !== 'free' && data.expiry_date), {
  message: "Expiry date is required for paid models.",
  path: ["expiry_date"],
});

// Define separate types for form values and the user prop for clarity
type EditUserFormValues = z.infer<typeof editUserSchema>;
type UserProfileWithRole = UserProfile & { role?: 'Admin' | 'User' };

interface EditUserDialogProps {
  user: UserProfileWithRole; // Accept user with optional role
  isOpen: boolean;
  onClose: () => void;
  onUserUpdate: (updatedUser: UserProfileWithRole) => void; // Pass back user with role
}

export default function EditUserDialog({ user, isOpen, onClose, onUserUpdate }: EditUserDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Determine if the current user IS the primary admin based on email
  const isPrimaryAdminAccount = user.email === primaryAdminEmail;
  // Determine the user's *current* role from the passed prop or default to User
  const currentUserRole = user.role || 'User';

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      name: user.name || '',
      email: user.email || '', // Add email
      phone: user.phone || '',
      class: user.class || null, // Add class
      model: currentUserRole === 'Admin' ? 'combo' : (user.model || 'free'), // Admins have combo
      expiry_date: currentUserRole === 'Admin' ? new Date('2099-12-31T00:00:00.000Z') : (user.expiry_date && isValid(parseISO(user.expiry_date)) ? parseISO(user.expiry_date) : null),
      targetYear: user.targetYear || null, // Set targetYear
    },
  });

  // Watch the selected model for conditional rendering
  const currentModel = form.watch("model");

  // Effect to reset form when user prop changes (e.g., opening dialog for different user)
  useEffect(() => {
      if (user) {
          const effectiveRole = user.role || 'User'; // Use stored role or default
          form.reset({
             name: user.name || '',
             email: user.email || '',
             phone: user.phone || '',
             class: user.class || null,
             model: effectiveRole === 'Admin' ? 'combo' : (user.model || 'free'), // Enforce combo for admins
             expiry_date: effectiveRole === 'Admin' ? new Date('2099-12-31T00:00:00.000Z') : (user.expiry_date && isValid(parseISO(user.expiry_date)) ? parseISO(user.expiry_date) : null),
             targetYear: user.targetYear || null,
          });
      }
  }, [user, form]);


  const onSubmit = async (data: EditUserFormValues) => {
    setIsLoading(true);
    try {
        // --- Email Validation ---
        const newEmail = data.email.trim().toLowerCase();
        const originalEmail = user.email?.trim().toLowerCase();

        // 1. Prevent changing primary admin's email
        if (isPrimaryAdminAccount && newEmail !== originalEmail) {
             throw new Error("Cannot change the email of the primary admin account.");
        }

        // 2. Check if the new email is already taken (only if email changed)
        if (newEmail !== originalEmail) {
            const existingUser = await findUserByEmailInternal(newEmail);
            if (existingUser && existingUser.id !== user.id) {
                 form.setError("email", { message: "This email address is already in use." });
                 throw new Error("Email address already in use.");
            }
        }

         // 3. Ensure model/expiry constraints based on the *EXISTING* user role
         const userRole = user.role || 'User'; // Use the role passed in props
         let finalModel = data.model;
         let finalExpiryDate = data.expiry_date;

         if (userRole === 'Admin') {
             finalModel = 'combo'; // Admins always get combo
             finalExpiryDate = new Date('2099-12-31T00:00:00.000Z'); // Admins get long expiry
         } else if (finalModel === 'free') {
             finalExpiryDate = null; // Free users have null expiry
         } else if (!finalExpiryDate) {
              form.setError("expiry_date", { message: "Expiry date is required for paid models." });
             throw new Error("Expiry date missing for paid plan.");
         }


       // Format expiry_date to ISO string or null BEFORE updating
       const expiryDateString = finalExpiryDate ? finalExpiryDate.toISOString() : null;

       // Prepare the data payload specifically for the update action
       // IMPORTANT: Do NOT include 'role' here. Role changes happen via `updateUserRole`.
       const updatedDataPayload: Partial<Omit<UserProfile, 'id' | 'createdAt' | 'password' | 'referral' | 'avatarUrl' | 'role'>> = {
         name: data.name,
         email: newEmail, // Update email
         phone: data.phone,
         class: data.class,
         model: finalModel, // Pass the validated model
         expiry_date: expiryDateString, // Pass the validated expiry
         targetYear: data.targetYear || null, // Pass targetYear
       };

       // Save the updated UserProfile data via Server Action
       const result = await updateUserInJson(user.id, updatedDataPayload);

       if (!result.success || !result.user) { // Check if the updated user is returned
         throw new Error(result.message || 'Failed to update user.');
       }

       toast({
         title: 'User Updated',
         description: `${newEmail}'s details have been successfully updated.`,
       });

       // Pass back the updated user data (including the PRESERVED role)
       onUserUpdate({ ...result.user, role: userRole }); // Pass original role back
       onClose(); // Close dialog

    } catch (error: any) {
      console.error('Failed to update user:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Could not update user details.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) return name.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return <User className="h-4 w-4"/>;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg"> {/* Increased width */}
        <DialogHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-10 w-10">
                <AvatarImage src={user.avatarUrl ? `/avatars/${user.avatarUrl}` : `https://avatar.vercel.sh/${user.email}.png`} alt={user.name || 'User Avatar'} />
                <AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback>
            </Avatar>
            <div>
                <DialogTitle>Edit User: {user.email}</DialogTitle>
                <DialogDescription>
                    Update the user's details and plan. Role changes are handled separately.
                </DialogDescription>
            </div>
            <Badge variant={user.role === 'Admin' ? 'destructive' : 'secondary'} className="ml-auto text-xs">
                 {user.role || 'User'} {/* Display current role */}
            </Badge>
          </div>
           {isPrimaryAdminAccount && (
                <Badge variant="destructive" className="w-fit text-xs mt-2">Primary Admin (Email/Plan/Role Locked)</Badge>
           )}
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">

            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Full Name *</FormLabel><FormControl><Input {...field} disabled={isLoading} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email Address *</FormLabel><FormControl><Input type="email" {...field} disabled={isLoading || isPrimaryAdminAccount} /></FormControl><FormMessage /> {isPrimaryAdminAccount && <p className="text-xs text-muted-foreground pt-1">Primary admin email cannot be changed.</p>} </FormItem> )} />
            <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Phone Number *</FormLabel><FormControl><Input type="tel" {...field} disabled={isLoading} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="class" render={({ field }) => ( <FormItem><FormLabel>Academic Status</FormLabel><Select onValueChange={(value) => field.onChange(value === '_none_' ? null : value as AcademicStatus | null)} value={field.value === null ? '_none_' : field.value ?? '_none_'} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Select status (Optional)" /></SelectTrigger></FormControl><SelectContent><SelectItem value="_none_">-- None --</SelectItem>{academicStatuses.map((status) => (<SelectItem key={status} value={status}>{status}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
            
            <FormField
              control={form.control}
              name="targetYear"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Year</FormLabel>
                  <Select onValueChange={(value) => field.onChange(value === '_none_' ? null : value)} value={field.value === null ? '_none_' : field.value ?? '_none_'} disabled={isLoading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select target year (Optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                       <SelectItem value="_none_">-- None --</SelectItem>
                      {yearOptions.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />


            {/* User Model Select - Disabled for Admins */}
            <FormField control={form.control} name="model" render={({ field }) => ( <FormItem><FormLabel>Subscription Model *</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isLoading || currentUserRole === 'Admin'}><FormControl><SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger></FormControl><SelectContent>{userModels.map((model) => (<SelectItem key={model} value={model} className="capitalize">{model.replace('_', ' ')}</SelectItem>))}</SelectContent></Select><FormMessage /> {currentUserRole === 'Admin' && <p className="text-xs text-muted-foreground pt-1">Admin accounts automatically have 'Combo' plan.</p>}</FormItem>)}/>

            {/* Expiry Date Picker (Conditional and Disabled for Admins) */}
            {currentModel !== 'free' && (
                 <FormField control={form.control} name="expiry_date" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Expiry Date {currentModel !== 'free' && currentUserRole !== 'Admin' ? '*' : ''}</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={isLoading || currentUserRole === 'Admin'}><CalendarIcon className="ml-auto h-4 w-4 opacity-50" />{field.value ? format(field.value, "PPP") : <span>Pick expiry date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0)) || isLoading || currentUserRole === 'Admin'} initialFocus /></PopoverContent></Popover><FormMessage /> {currentUserRole === 'Admin' && <p className="text-xs text-muted-foreground pt-1">Admin expiry date is fixed.</p>}</FormItem>)}/>
            )}

            <DialogFooter className="sm:col-span-2 mt-4">
                <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
                 <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}