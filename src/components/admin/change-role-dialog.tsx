
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
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdate: (updatedUser: UserProfile) => void; // Callback to update user list
}

export default function ChangeRoleDialog({ user, isOpen, onClose, onUserUpdate }: ChangeRoleDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Determine if the current user IS the primary admin based on email
  const isPrimaryAdminAccount = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  const form = useForm<ChangePlanFormValues>({
    resolver: zodResolver(changePlanSchema),
    defaultValues: {
      model: user.model || 'free',
      expiry_date: user.expiry_date ? new Date(user.expiry_date) : null, // Convert string to Date or null
    },
  });

    const currentModel = form.watch("model"); // Watch model field for conditional rendering

  // Function to handle the main form submission
  const handleFormSubmit = async (data: ChangePlanFormValues) => {
    setIsLoading(true);

    if (isPrimaryAdminAccount) {
         toast({
            variant: 'destructive',
            title: 'Update Denied',
            description: 'The subscription model and expiry date for the primary admin account cannot be changed here.',
         });
         setIsLoading(false);
         return;
    }

    try {
       // Format expiry_date to ISO string or null BEFORE updating
       const expiryDateString = data.model === 'free' ? null : (data.expiry_date ? data.expiry_date.toISOString() : null);

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

       // Use the user data returned from the successful update action
       onUserUpdate(result.user);
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
   const handleMakeAdminEquivalent = async () => {
        if (isPrimaryAdminAccount) {
            toast({ variant: 'warning', title: 'Action Not Needed', description: 'This user is already the primary admin.' });
            return;
        }
        // Set form values for admin-equivalent plan
        const farFutureDate = new Date('2099-12-31T00:00:00.000Z');
        const adminPlanValues: ChangePlanFormValues = {
            model: 'combo',
            expiry_date: farFutureDate,
        };
        // Trigger the main form submission with these values
        await handleFormSubmit(adminPlanValues);
   };


  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]"> {/* Increased width slightly */}
        <DialogHeader>
          <DialogTitle>Change Plan for {user.email}</DialogTitle>
          <DialogDescription>
            Select the user's subscription model and set an expiry date if applicable.
            The primary admin plan cannot be changed.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          {/* We use handleSubmit with the specific handler */}
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6 py-4">
            {/* User Model Select */}
            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subscription Model *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLoading || isPrimaryAdminAccount}>
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
                   {isPrimaryAdminAccount && <p className="text-xs text-muted-foreground">Primary admin must have 'Combo' plan.</p>}
                </FormItem>
              )}
            />

            {/* Expiry Date Picker (Conditional and disabled for admin) */}
            {currentModel !== 'free' && (
              <FormField
                control={form.control}
                name="expiry_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Expiry Date {currentModel !== 'free' ? '*' : ''}</FormLabel>
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
                            date < new Date(new Date().setHours(0, 0, 0, 0)) || isLoading || isPrimaryAdminAccount// Disable past dates and for admin
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                     {isPrimaryAdminAccount && <p className="text-xs text-muted-foreground">Primary admin expiry cannot be changed.</p>}
                  </FormItem>
                )}
              />
            )}

            {/* "Make Admin Equivalent" Button */}
            <Button
                type="button"
                variant="outline"
                onClick={handleMakeAdminEquivalent}
                disabled={isLoading || isPrimaryAdminAccount}
                className="w-full justify-start" // Align left
                size="sm" // Smaller button
            >
                <ShieldCheck className="mr-2 h-4 w-4" /> Make Admin Equivalent (Combo Plan, Long Expiry)
            </Button>

            <DialogFooter className="pt-6 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2"> {/* Adjusted footer layout */}
                <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>Cancel</Button>
                <Button type="submit" disabled={isLoading || isPrimaryAdminAccount}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update Plan
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
