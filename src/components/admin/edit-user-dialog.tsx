'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@/types';
import { updateUserInJson } from '@/actions/user-actions';
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox for admin role

// Schema for editing user profile
const editUserSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  phone: z.string()
           .min(10, { message: "Phone number must be 10 digits." })
           .max(10, { message: "Phone number must be 10 digits." })
           .regex(/^\d{10}$/, { message: "Please enter a valid 10-digit phone number." }),
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

  const isCurrentUserAdmin = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      name: user.name || '',
      phone: user.phone || '',
      isAdmin: isCurrentUserAdmin, // Initialize isAdmin state
    },
    // mode: "onChange",
  });

  const onSubmit = async (data: EditUserFormValues) => {
    setIsLoading(true);
    try {
      const updatedData: Partial<Omit<UserProfile, 'id' | 'createdAt' | 'model' | 'expiry_date' | 'password' | 'referral' | 'class' | 'email'>> = { // keep email, password and creation data
        name: data.name,
        phone: data.phone,
      };

      const result = await updateUserInJson(user.id, updatedData);

      if (!result.success) {
        throw new Error(result.message || 'Failed to update user.');
      }

      toast({
        title: 'User Updated',
        description: `${user.email}'s details have been successfully updated.`,
      });

      // Construct the updated user profile object to pass back
      const fullyUpdatedUser: UserProfile = {
          ...user, // Start with original user data
          name: data.name,    // Update name from form
          phone: data.phone, // Update phone from form
      };
      onUserUpdate(fullyUpdatedUser); // Call the callback with the updated user object
      onClose();

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
            Update the user's name and phone number. Click save when you're done.
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
                    <Input {...field} disabled={isLoading} />
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
                    <Input type="tel" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             {/* Admin Role Toggle */}
             {/*<FormField
                control={form.control}
                name="isAdmin"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <FormLabel htmlFor="admin-switch" className="text-base">Make Admin</FormLabel>
                        <FormDescription>
                            Grant this user full administrative privileges.
                        </FormDescription>
                    </div>
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
            />*/}

            <DialogFooter>
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
