
'use client';

import { useState } from 'react';
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
import { CalendarIcon, Loader2, ShieldCheck } from "lucide-react"; // Added ShieldCheck
import { format } from "date-fns";
import { useToast } from '@/hooks/use-toast';
import type { UserProfile,  UserModel } from '@/types';
import { updateUserInJson } from '@/actions/user-actions';
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox for admin role

// Schema for editing user profile
const editUserSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  phone: z.string()
           .min(10, { message: "Please enter a valid 10-digit phone number." })
           .max(10, { message: "Phone number must be 10 digits." })
           .regex(/^\d{10}$/, { message: "Please enter a valid 10-digit phone number." }),
  model: z.enum(["free", "chapterwise", "full_length", "combo"], { required_error: "Please select a user model." }),
  expiry_date: z.date().nullable().optional(),
  isAdmin: z.boolean().optional(), // Add isAdmin field
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

interface EditUserDialogProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdate: (updatedUser: UserProfile) => void; // Callback to update user list
}

export default function EditUserDialog({ user, isOpen, onClose, onUserUpdate }: EditUserDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Determine if the current user IS the primary admin based on email
  const isPrimaryAdminAccount = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      name: user.name || '',
      phone: user.phone || '',
      model: user.model || 'free',
      expiry_date: user.expiry_date ? new Date(user.expiry_date) : null,
      isAdmin: user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL, // Initialize isAdmin state
    },
    // mode: "onChange",
  });

  const currentModel = form.watch("model"); // Watch model field for conditional rendering

  const onSubmit = async (data: EditUserFormValues) => {
    setIsLoading(true);
    try {
      // Enforce restrictions
        if (isPrimaryAdminAccount && data.model !== 'combo') {
            throw new Error("The primary admin account must have the combo plan.");
        }


      // Format expiry_date to ISO string or null BEFORE updating
       const expiryDateString = data.model === 'free' ? null : (data.expiry_date ? data.expiry_date.toISOString() : null);
       if (data.model === 'free') data.expiry_date = null;

       // Prepare the data payload specifically for the update action
        const updatedData: Partial<Omit<UserProfile, 'id' | 'createdAt' | 'email' | 'password' | 'referral' | 'class'>> = {
            name: data.name,
            phone: data.phone,
            model: data.model,
            expiry_date: expiryDateString,
        };
      // Save the *entire* updated UserProfile object via Server Action
      const result = await updateUserInJson(user.id, updatedData);

      if (!result.success || !result.user) { // Check if the updated user is returned
        throw new Error(result.message || 'Failed to update user.');
      }

      toast({
        title: 'User Updated',
        description: `${user.email}'s details have been successfully updated.`,
      });

      // Use the user data returned from the successful update action
      onUserUpdate(result.user);
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit User: {user.email}</DialogTitle>
          <DialogDescription>
            Update the user's name, phone number, subscription model, and expiry date.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isLoading || isPrimaryAdminAccount} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input type="tel" {...field} disabled={isLoading || isPrimaryAdminAccount} />
                  </FormControl>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading || isPrimaryAdminAccount}>
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
                </FormItem>
              )}
            />

             {/* Expiry Date Picker (Only for Paid User Models) */}
             {currentModel !== 'free' && (
                     <FormField
                         control={form.control}
                         name="expiry_date"
                         render={({ field }) => (
                             <FormItem className="flex flex-col">
                             <FormLabel>Expiry Date *</FormLabel>
                             <Popover>
                                 <PopoverTrigger asChild>
                                 <FormControl>
                                     <Button
                                     variant={"outline"}
                                     className={cn(
                                         "w-full pl-3 text-left font-normal",
                                         !field.value && "text-muted-foreground"
                                     )}
                                     disabled={isLoading || isPrimaryAdminAccount}
                                     >
                                     {field.value ? (
                                         format(field.value, "PPP") // Format date nicely
                                     ) : (
                                         <span>Pick an expiry date</span>
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
                                         date < new Date(new Date().setHours(0, 0, 0, 0)) || isLoading || isPrimaryAdminAccount // Disable past dates and for admin
                                     }
                                     initialFocus
                                 />
                                 </PopoverContent>
                             </Popover>
                             <FormMessage />
                             </FormItem>
                         )}
                     />
                 )}

            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
                 <Button type="submit" disabled={isLoading || isPrimaryAdminAccount}>
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

