
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
import { CalendarIcon, Loader2 } from "lucide-react";
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

  const onSubmit = async (data: ChangePlanFormValues) => {
    setIsLoading(true);

    // Primary admin's model should always be 'combo' and have a long expiry
    if (isPrimaryAdminAccount) {
         toast({
            variant: 'destructive',
            title: 'Update Failed',
            description: 'Cannot change the subscription model or expiry date for the primary admin account.',
         });
         setIsLoading(false);
         return;
    }


    try {
       // Format expiry_date to ISO string or null BEFORE updating
       const expiryDateString = data.model === 'free' ? null : (data.expiry_date ? data.expiry_date.toISOString() : null);
       // Prepare the data payload specifically for the update action
       // Only include fields that are changing (model, expiry_date)
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Change Plan for {user.email}</DialogTitle>
          <DialogDescription>
            Select the user's subscription model and set an expiry date if applicable.
            The primary admin plan cannot be changed.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* User Model Select */}
            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subscription Model</FormLabel>
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
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
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
