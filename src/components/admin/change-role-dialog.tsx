
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
import { CalendarIcon, Loader2, ShieldCheck, Trash2, UserMinus } from "lucide-react"; // Added UserMinus
import { format } from "date-fns";
import { useToast } from '@/hooks/use-toast';
import { type UserProfile, userModels, type UserModel } from '@/types';
import { updateUserInJson } from '@/actions/user-actions';
import { Badge } from '@/components/ui/badge'; // Import Badge

// Schema for changing user model and expiry date
const changePlanSchema = z.object({
  model: z.enum(userModels, { required_error: "Please select a user model." }),
  expiry_date: z.date().nullable().optional(), // Allow null or date
}).refine(data => data.model === 'free' || (data.model !== 'free' && data.expiry_date), {
  message: "Expiry date is required for paid models.",
  path: ["expiry_date"],
});

type ChangePlanFormValues = z.infer<typeof changePlanSchema>;

// Define the allowed admin email pattern and primary admin email
const adminEmailPattern = /^[a-zA-Z0-9._%+-]+-admin@edunexus\.com$/;
const primaryAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@edunexus.com';

// Helper function to determine role based on email
const getUserRole = (email: string | null): 'Admin' | 'User' => {
    if (!email) return 'User';
    return email === primaryAdminEmail || adminEmailPattern.test(email) ? 'Admin' : 'User';
};

interface ChangeRoleDialogProps {
  user: UserProfile & { role?: 'Admin' | 'User' }; // Expect role from parent
  isOpen: boolean;
  onClose: () => void;
  onUserUpdate: (updatedUser: Omit<UserProfile, 'password'>) => void; // Callback to update user list
}

export default function ChangeRoleDialog({ user, isOpen, onClose, onUserUpdate }: ChangeRoleDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Role is determined by email, not a separate field to change
  const isCurrentAdmin = getUserRole(user.email) === 'Admin';

  const form = useForm<ChangePlanFormValues>({
    resolver: zodResolver(changePlanSchema),
    defaultValues: {
      // Admins always have 'combo' and long expiry, cannot be changed via this form
      model: isCurrentAdmin ? 'combo' : (user.model || 'free'),
      expiry_date: isCurrentAdmin ? new Date('2099-12-31T00:00:00.000Z') : (user.expiry_date ? new Date(user.expiry_date) : null),
    },
  });

  const currentModel = form.watch("model"); // Watch model field for conditional rendering

  // Function to handle the main form submission (Update Plan button)
  const handlePlanUpdateSubmit = async (data: ChangePlanFormValues) => {
    setIsLoading(true);

    // Prevent changing plan for ANY admin account via this form
    if (isCurrentAdmin) {
        toast({
            variant: 'destructive',
            title: 'Update Denied',
            description: `Cannot change plan for an admin account (${user.email}). Admins always have the Combo plan.`,
        });
        setIsLoading(false);
        return;
    }

    try {
       // Format expiry_date to ISO string or null BEFORE updating
       const expiryDateString = data.model === 'free' ? null : (data.expiry_date ? data.expiry_date.toISOString() : null);
       if (data.model === 'free') data.expiry_date = null;

       // Prepare the data payload specifically for the update action
       const updatedDataPayload: Partial<Omit<UserProfile, 'id' | 'createdAt' | 'email' | 'password' | 'name' | 'phone' | 'referral' | 'class'>> = {
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

       onUserUpdate(result.user); // Update parent state
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

   // Note: Role is based on email. To make someone an admin, their email must be changed
   // to the admin format (e.g., user-admin@edunexus.com).
   // To remove admin, their email must be changed away from the admin format.
   // This dialog now only handles Plan/Expiry for non-admin users.

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Manage Plan: {user.email}</DialogTitle>
          <DialogDescription>
             Adjust the user's subscription plan and expiry date. Role is determined by email format.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          {/* We use handleSubmit with the specific handler */}
          <form onSubmit={form.handleSubmit(handlePlanUpdateSubmit)} className="space-y-4 py-4">
             {/* Display Current Role */}
            <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
                <span className="text-sm font-medium">Current Role:</span>
                 <Badge variant={isCurrentAdmin ? "destructive" : "secondary"}>{isCurrentAdmin ? 'Admin' : 'User'}</Badge>
            </div>
             {!isCurrentAdmin && (
                <p className="text-xs text-muted-foreground">To make this user an admin, edit their email to follow the 'name-admin@edunexus.com' pattern.</p>
             )}
             {isCurrentAdmin && user.email !== primaryAdminEmail && (
                 <p className="text-xs text-muted-foreground">To remove admin privileges, edit their email to remove the '-admin' suffix.</p>
             )}
              {isCurrentAdmin && user.email === primaryAdminEmail && (
                 <p className="text-xs text-muted-foreground">Primary admin role cannot be removed.</p>
             )}


            {/* User Model Select (Disabled for Admins) */}
            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subscription Model *</FormLabel>
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

            <DialogFooter className="pt-6">
                <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>Cancel</Button>
                 {/* Only show Update Plan button for non-admins */}
                 {!isCurrentAdmin && (
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Update Plan
                    </Button>
                 )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
