
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form'; // Correct import
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input"; // Keep Input for potential future use, though not needed for date/select
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

// Schema for changing user role/model and expiry
const changeRoleSchema = z.object({
  model: z.enum(userModels, { required_error: "Please select a user model." }),
  expiry_date: z.date().nullable().optional(), // Allow null or date
}).refine(data => data.model === 'free' || (data.model !== 'free' && data.expiry_date), {
  message: "Expiry date is required for paid models.",
  path: ["expiry_date"],
});

type ChangeRoleFormValues = z.infer<typeof changeRoleSchema>;

interface ChangeRoleDialogProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdate: (updatedUser: UserProfile) => void; // Callback to update user list
}

export default function ChangeRoleDialog({ user, isOpen, onClose, onUserUpdate }: ChangeRoleDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ChangeRoleFormValues>({
    resolver: zodResolver(changeRoleSchema),
    defaultValues: {
      model: user.model || 'free',
      expiry_date: user.expiry_date ? new Date(user.expiry_date) : null, // Convert string to Date or null
    },
  });

  const onSubmit = async (data: ChangeRoleFormValues) => {
    setIsLoading(true);
    try {
       // Format expiry_date to ISO string or null BEFORE updating
       const expiryDateString = data.model === 'free' ? null : (data.expiry_date ? data.expiry_date.toISOString() : null);

      // Prepare the data payload specifically for the update action
      // Only include fields that are changing (model, expiry_date)
      const updatedDataPayload: Partial<Omit<UserProfile, 'id' | 'createdAt'>> = {
        model: data.model,
        expiry_date: expiryDateString,
      };

      // Call the server action to update the user in users.json
      const result = await updateUserInJson(user.id, updatedDataPayload);

      if (!result.success) {
        throw new Error(result.message || 'Failed to update user role/plan.');
      }

      toast({
        title: 'User Role/Plan Updated',
        description: `${user.email}'s plan has been updated to ${data.model}.`,
      });

      // Construct the fully updated user profile object to pass back to the parent page
      // This ensures the local state in the parent component reflects the saved changes
      const fullyUpdatedUser: UserProfile = {
          ...user, // Start with original user data
          model: data.model, // Apply the new model
          expiry_date: expiryDateString // Apply the new expiry date (string or null)
      };
       onUserUpdate(fullyUpdatedUser); // Call the callback with the updated user object
       // onClose(); // Closing is handled by the parent component via onUserUpdate -> closeDialog

    } catch (error: any) {
      console.error('Failed to update user role/plan:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Could not update user role/plan.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const currentModel = form.watch("model"); // Watch model field for conditional rendering

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Change Role/Plan for {user.email}</DialogTitle>
          <DialogDescription>
            Select the user's subscription model and set an expiry date if applicable.
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
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
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

            {/* Expiry Date Picker (Conditional) */}
            {currentModel !== 'free' && (
                <FormField
                control={form.control}
                name="expiry_date"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>Expiry Date</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant={"outline"}
                            className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                            )}
                            disabled={isLoading}
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
                                date < new Date(new Date().setHours(0, 0, 0, 0)) || isLoading // Disable past dates
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
                <Button type="submit" disabled={isLoading}>
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

