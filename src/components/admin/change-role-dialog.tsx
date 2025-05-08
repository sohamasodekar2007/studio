'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
// Input removed as it's not used for select/date
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar"; // Import Calendar
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // Import Popover
import { cn } from "@/lib/utils";
import { CalendarIcon, Loader2, ShieldCheck } from "lucide-react"; // Added ShieldCheck
import { format } from "date-fns";
import { useToast } from '@/hooks/use-toast';
import { type UserProfile, userModels, type UserModel } from '@/types';
import { updateUserInJson } from '@/actions/user-actions';

// Schema for changing user model and expiry date
const changePlanSchema = z.object({
  model: z.enum(userModels, { required_error: "Please select a user model." }),
  expiry_date: z.date().nullable().optional(), // Allow null or date
}).refine(data => data.model === 'free' || (data.model !== 'free' && data.expiry_date), {
  message: "Expiry date is required for paid models.",
  path: ["expiry_date"],
});

type ChangePlanFormValues = z.infer<typeof changePlanSchema>;

interface ChangeRoleDialogProps {
  user: UserProfile; // This contains the role derived from email
  isOpen: boolean;
  onClose: () => void;
  onUserUpdate: (updatedUser: UserProfile) => void; // Callback to update user list
}

export default function ChangeRoleDialog({ user, isOpen, onClose, onUserUpdate }: ChangeRoleDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Determine if the user IS an admin based on the role passed from the parent
  const isCurrentAdmin = user.role === 'Admin';
  const primaryAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@edunexus.com';

  const form = useForm<ChangePlanFormValues>({
    resolver: zodResolver(changePlanSchema),
    defaultValues: {
      // If the user is currently an admin, default to 'combo' and long expiry, otherwise use their actual data
      model: isCurrentAdmin ? 'combo' : (user.model || 'free'),
      expiry_date: isCurrentAdmin ? new Date('2099-12-31T00:00:00.000Z') : (user.expiry_date ? new Date(user.expiry_date) : null),
    },
  });

  const currentModel = form.watch("model"); // Watch model field for conditional rendering

  // Function to handle the main form submission (Update Plan button)
  const handlePlanUpdateSubmit = async (data: ChangePlanFormValues) => {
    setIsLoading(true);

    if (isCurrentAdmin) {
        toast({
            variant: 'destructive',
            title: 'Update Denied',
            description: `Cannot change plan for an admin account (${user.email}). Manage admin status via role assignment.`,
        });
        setIsLoading(false);
        return;
    }

    try {
       // Format expiry_date to ISO string or null BEFORE updating
       const expiryDateString = data.model === 'free' ? null : (data.expiry_date ? data.expiry_date.toISOString() : null);
       if (data.model === 'free') data.expiry_date = null;

       // Prepare the data payload specifically for the update action
       const updatedDataPayload: Partial<Omit<UserProfile, 'id' | 'createdAt' | 'email' | 'password' | 'name' | 'phone' | 'referral' | 'class' | 'role'>> = {
         model: data.model,
         expiry_date: expiryDateString,
       };

       const result = await updateUserInJson(user.id, updatedDataPayload);

       if (!result.success || !result.user) { // Check if the updated user is returned
         throw new Error(result.message || 'Failed to update user plan.');
       }

       toast({
         title: 'User Plan Updated',
         description: `${user.email}'s plan has been updated to ${data.model}.`,
       });

       // Add the original role back for the callback, as updateUserInJson doesn't return it
        const updatedUserWithRole = { ...result.user, role: user.role };
       onUserUpdate(updatedUserWithRole);
       onClose(); // Close dialog

    } catch (error: any) {
      console.error('Failed to update user plan:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Could not update user plan.',
      });
    } finally {
      setIsLoading(false);
    }
  };

   // Function to handle the "Make Admin Equivalent" button click
   const handleMakeAdmin = async () => {
        if (user.email === primaryAdminEmail) {
             toast({ variant: 'info', title: 'Already Primary Admin', description: 'This is the primary admin account.' });
             return;
        }
         if (isCurrentAdmin) {
             toast({ variant: 'info', title: 'Already Admin', description: `${user.email} already has admin privileges.` });
             return;
         }

         setIsLoading(true);
         // Set form values for admin-equivalent plan
         const farFutureDate = new Date('2099-12-31T00:00:00.000Z');
         const adminPlanValues: Partial<Omit<UserProfile, 'id' | 'createdAt' | 'email' | 'password' | 'name' | 'phone' | 'referral' | 'class' | 'role'>> = {
             model: 'combo',
             expiry_date: farFutureDate.toISOString(),
         };

         try {
             const result = await updateUserInJson(user.id, adminPlanValues);
             if (!result.success || !result.user) {
                throw new Error(result.message || 'Failed to grant admin privileges.');
             }
             toast({
                title: 'Admin Privileges Granted',
                description: `${user.email} now has admin-equivalent access (Combo Plan).`,
             });
             // Update parent state with new role for display
              onUserUpdate({ ...result.user, role: 'Admin' });
             onClose(); // Close dialog
         } catch (error: any) {
              console.error('Failed to make user admin:', error);
             toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: error.message || 'Could not grant admin privileges.',
             });
         } finally {
              setIsLoading(false);
         }
   };

   // Function to handle removing admin privileges
   const handleRemoveAdmin = async () => {
       if (user.email === primaryAdminEmail) {
           toast({ variant: 'destructive', title: 'Action Denied', description: 'Cannot remove privileges from the primary admin.' });
           return;
       }
        if (!isCurrentAdmin) {
            toast({ variant: 'info', title: 'Not an Admin', description: `${user.email} does not currently have admin privileges.` });
            return;
        }

       setIsLoading(true);
        // Reset to 'free' model and null expiry
       const userPlanValues: Partial<Omit<UserProfile, 'id' | 'createdAt' | 'email' | 'password' | 'name' | 'phone' | 'referral' | 'class' | 'role'>> = {
           model: 'free',
           expiry_date: null,
       };

       try {
           const result = await updateUserInJson(user.id, userPlanValues);
           if (!result.success || !result.user) {
              throw new Error(result.message || 'Failed to remove admin privileges.');
           }
           toast({
              title: 'Admin Privileges Removed',
              description: `${user.email}'s plan has been reset to 'Free'.`,
           });
            // Update parent state with new role for display
            onUserUpdate({ ...result.user, role: 'User' });
           onClose(); // Close dialog
       } catch (error: any) {
            console.error('Failed to remove admin privileges:', error);
           toast({
              variant: 'destructive',
              title: 'Update Failed',
              description: error.message || 'Could not remove admin privileges.',
           });
       } finally {
            setIsLoading(false);
       }
   };


  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Manage User: {user.email}</DialogTitle>
          <DialogDescription>
            Adjust the user's subscription plan or admin status. Admin accounts always have the 'Combo' plan.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          {/* We use handleSubmit with the specific handler */}
          <form onSubmit={form.handleSubmit(handlePlanUpdateSubmit)} className="space-y-4 py-4">
             {/* Display Current Role */}
            <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
                <span className="text-sm font-medium">Current Role:</span>
                 <Badge variant={isCurrentAdmin ? "destructive" : "secondary"}>{user.role}</Badge>
            </div>

            {/* User Model Select (Disabled for Admins) */}
            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subscription Model {isCurrentAdmin ? '' : '*'}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isLoading || isCurrentAdmin} // Disable if loading or if the user is an Admin
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
                  {isCurrentAdmin && <p className="text-xs text-muted-foreground">Admin accounts must have 'Combo' plan.</p>}
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
                    <FormLabel>Expiry Date {currentModel !== 'free' && !isCurrentAdmin ? '*' : ''}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                             disabled={isLoading || isCurrentAdmin} // Disable if loading or Admin
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
                            date < new Date(new Date().setHours(0, 0, 0, 0)) || isLoading || isCurrentAdmin // Disable past dates and for admin
                           }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                    {isCurrentAdmin && <p className="text-xs text-muted-foreground">Admin expiry cannot be changed here.</p>}
                  </FormItem>
                )}
              />
            )}

            {/* Divider */}
             <div className="pt-4 border-t">
                 <p className="text-sm font-medium mb-2">Admin Actions</p>
                 {user.email !== primaryAdminEmail ? (
                     <div className="flex flex-col sm:flex-row gap-2">
                         {!isCurrentAdmin ? (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleMakeAdmin}
                                disabled={isLoading}
                                size="sm"
                            >
                                <ShieldCheck className="mr-2 h-4 w-4" /> Grant Admin Privileges
                            </Button>
                         ) : (
                             <Button
                                type="button"
                                variant="destructive"
                                onClick={handleRemoveAdmin}
                                disabled={isLoading}
                                size="sm"
                            >
                                <ShieldCheck className="mr-2 h-4 w-4" /> Remove Admin Privileges
                            </Button>
                         )}
                     </div>
                  ) : (
                     <p className="text-xs text-muted-foreground">Primary admin privileges cannot be modified.</p>
                  )}
             </div>


            <DialogFooter className="pt-6 flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center w-full">
                 {/* Button to update Plan (only if not admin) */}
                 <Button type="submit" disabled={isLoading || isCurrentAdmin}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update Plan
                </Button>
                <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>Cancel</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
