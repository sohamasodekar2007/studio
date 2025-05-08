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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; // Added Table imports
import { Skeleton } from '@/components/ui/skeleton'; // Added Skeleton import
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"; // Added AlertDialog imports
import Link from 'next/link'; // Added Link import
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"; // Added DropdownMenu imports
import { MoreHorizontal, PlusCircle, Search, Trash2 } from "lucide-react"; // Added more icons


// Define the allowed admin email pattern and primary admin email
const adminEmailPattern = /^[a-zA-Z0-9._%+-]+-admin@edunexus\.com$/;
const primaryAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@edunexus.com';

// Helper function to determine role based on email
const getUserRole = (email: string | null): 'Admin' | 'User' => {
    if (!email) return 'User';
    return email === primaryAdminEmail || adminEmailPattern.test(email) ? 'Admin' : 'User';
};

// Schema for editing user profile, including email and role-based validation
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

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      name: user.name || '',
      email: user.email || '', // Add email
      phone: user.phone || '',
      class: user.class || null, // Add class
      model: user.model || 'free',
      expiry_date: user.expiry_date && isValid(parseISO(user.expiry_date)) ? parseISO(user.expiry_date) : null,
    },
  });

  // Watch the selected model for conditional rendering
  const currentModel = form.watch("model");

  // Effect to reset form when user prop changes (e.g., opening dialog for different user)
  useEffect(() => {
      if (user) {
          form.reset({
             name: user.name || '',
             email: user.email || '',
             phone: user.phone || '',
             class: user.class || null,
             model: isPrimaryAdminAccount ? 'combo' : (user.model || 'free'), // Ensure admin model is combo
             expiry_date: isPrimaryAdminAccount ? new Date('2099-12-31T00:00:00.000Z') : (user.expiry_date && isValid(parseISO(user.expiry_date)) ? parseISO(user.expiry_date) : null),
          });
      }
  }, [user, form, isPrimaryAdminAccount]);


  const onSubmit = async (data: EditUserFormValues) => {
    setIsLoading(true);
    try {
        // --- Email & Role Validation ---
        const newEmail = data.email.trim().toLowerCase();
        const originalEmail = user.email?.trim().toLowerCase();
        const newRole = getUserRole(newEmail);
        const originalRole = getUserRole(originalEmail);

        // 1. Prevent changing the primary admin's email
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

        // 3. Validate Role change based on email format
         if (newRole === 'Admin' && newEmail !== primaryAdminEmail && !adminEmailPattern.test(newEmail)) {
              form.setError("email", { message: "To assign Admin role, email must end with '-admin@edunexus.com' or be the primary admin email." });
              throw new Error("Invalid email format for Admin role.");
         }
         if (newRole === 'User' && (newEmail === primaryAdminEmail || adminEmailPattern.test(newEmail))) {
              form.setError("email", { message: "This email format is reserved for Admin roles." });
              throw new Error("Cannot assign a User role to an admin email format.");
         }

         // 4. Ensure model/expiry constraints based on role
         let finalModel = data.model;
         let finalExpiryDate = data.expiry_date;

         if (newRole === 'Admin') {
             finalModel = 'combo'; // Admins always get combo
             finalExpiryDate = new Date('2099-12-31T00:00:00.000Z'); // Admins get long expiry
         } else if (finalModel === 'free') {
             finalExpiryDate = null; // Free users have null expiry
         } else if (!finalExpiryDate) {
              // This case should be caught by zod refine, but double check
             form.setError("expiry_date", { message: "Expiry date is required for paid models." });
             throw new Error("Expiry date missing for paid plan.");
         }

       // Format expiry_date to ISO string or null BEFORE updating
       const expiryDateString = finalExpiryDate ? finalExpiryDate.toISOString() : null;

       // Prepare the data payload specifically for the update action
       const updatedDataPayload: Partial<Omit<UserProfile, 'id' | 'createdAt' | 'password' | 'referral' | 'avatarUrl'>> = {
         name: data.name,
         email: newEmail, // Update email
         phone: data.phone,
         class: data.class,
         model: finalModel,
         expiry_date: expiryDateString,
       };

       // Save the *entire* updated UserProfile object via Server Action
       const result = await updateUserInJson(user.id, updatedDataPayload);

       if (!result.success || !result.user) { // Check if the updated user is returned
         throw new Error(result.message || 'Failed to update user.');
       }

       toast({
         title: 'User Updated',
         description: `${newEmail}'s details have been successfully updated. Role is now ${newRole}.`,
       });

       // Pass back the updated user data with the correct role derived from email
       onUserUpdate({ ...result.user, role: newRole });
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg"> {/* Increased width */}
        <DialogHeader>
          <DialogTitle>Edit User: {user.email}</DialogTitle>
          <DialogDescription>
            Update the user's details, plan, and email (which determines their role).
          </DialogDescription>
           {isPrimaryAdminAccount && (
                <Badge variant="destructive" className="w-fit text-xs mt-2">Primary Admin (Email/Plan Locked)</Badge>
           )}
           {!isPrimaryAdminAccount && getUserRole(user.email) === 'Admin' && (
               <Badge variant="secondary" className="w-fit text-xs mt-2">Standard Admin</Badge>
           )}
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name *</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address *</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} disabled={isLoading || isPrimaryAdminAccount} />
                  </FormControl>
                  <FormMessage />
                  {!isPrimaryAdminAccount && <p className="text-xs text-muted-foreground pt-1">Change email format to 'name-admin@...' to grant Admin role, or remove suffix to revoke.</p>}
                   {isPrimaryAdminAccount && <p className="text-xs text-muted-foreground pt-1">Primary admin email cannot be changed.</p>}
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number *</FormLabel>
                  <FormControl>
                    <Input type="tel" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="class"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Academic Status</FormLabel>
                   <Select
                         onValueChange={(value) => field.onChange(value === '_none_' ? null : value)}
                         value={field.value === null ? '_none_' : field.value ?? '_none_'} // Use placeholder value
                         disabled={isLoading}
                       >
                     <FormControl>
                       <SelectTrigger>
                         <SelectValue placeholder="Select status (Optional)" />
                       </SelectTrigger>
                     </FormControl>
                     <SelectContent>
                       <SelectItem value="_none_">-- None --</SelectItem>
                       {academicStatuses.map((status) => (
                         <SelectItem key={status} value={status}>
                           {status}
                         </SelectItem>
                       ))}
                     </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* User Model Select */}
            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subscription Model *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isLoading || isPrimaryAdminAccount || getUserRole(user.email) === 'Admin'} // Disable for ANY admin account
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {userModels.map((model) => (
                        <SelectItem key={model} value={model} className="capitalize">
                          {model.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                   {getUserRole(user.email) === 'Admin' && <p className="text-xs text-muted-foreground pt-1">Admin accounts automatically have 'Combo' plan.</p>}
                </FormItem>
              )}
            />

             {/* Expiry Date Picker (Conditional and Disabled for Admins) */}
             {currentModel !== 'free' && (
                     <FormField
                         control={form.control}
                         name="expiry_date"
                         render={({ field }) => (
                             <FormItem className="flex flex-col">
                             <FormLabel>Expiry Date {currentModel !== 'free' && !isPrimaryAdminAccount && getUserRole(user.email) !== 'Admin' ? '*' : ''}</FormLabel> {/* Required asterisk logic */}
                             <Popover>
                                 <PopoverTrigger asChild>
                                 <FormControl>
                                     <Button
                                     variant={"outline"}
                                     className={cn(
                                         "w-full pl-3 text-left font-normal",
                                         !field.value && "text-muted-foreground"
                                     )}
                                     disabled={isLoading || isPrimaryAdminAccount || getUserRole(user.email) === 'Admin'} // Disable if loading or Admin
                                     >
                                     {field.value ? (
                                         format(field.value, "PPP") // Format date nicely
                                     ) : (
                                         <span>Pick expiry date</span>
                                     )}
                                     <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                     </Button>
                                 </FormControl>
                                 </PopoverTrigger>
                                 <PopoverContent className="w-auto p-0" align="start">
                                 <Calendar
                                     mode="single"
                                     selected={field.value ?? undefined} // Pass undefined if null
                                     onSelect={field.onChange}
                                     disabled={(date) =>
                                         date < new Date(new Date().setHours(0, 0, 0, 0)) || isLoading || isPrimaryAdminAccount || getUserRole(user.email) === 'Admin'
                                     }
                                     initialFocus
                                 />
                                 </PopoverContent>
                             </Popover>
                             <FormMessage />
                             {getUserRole(user.email) === 'Admin' && <p className="text-xs text-muted-foreground pt-1">Admin expiry date is fixed.</p>}
                             </FormItem>
                         )}
                     />
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