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
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from '@/hooks/use-toast';
import { type UserProfile, userModels, type UserModel, academicStatuses, type AcademicStatus } from '@/types';
import { addUserToJson } from '@/actions/user-actions'; // Action to add user to JSON
import { v4 as uuidv4 } from 'uuid'; // To generate unique IDs


// Define roles for the dropdown
const userRoles = ['User', 'Admin'] as const;
type UserRole = typeof userRoles[number];

// Schema for adding a new user
const addUserSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  phone: z.string().min(10, { message: "Please enter a valid 10-digit phone number." }).max(10, { message: "Phone number must be 10 digits." }).regex(/^\d{10}$/, { message: "Please enter a valid 10-digit phone number." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  confirmPassword: z.string(),
  role: z.enum(userRoles, { required_error: "Please select a role." }), // Role selection
  class: z.enum(academicStatuses).nullable().optional(), // Allow null or value
  model: z.enum(userModels),
  expiry_date: z.date().nullable().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine(data => data.model === 'free' || (data.model !== 'free' && data.expiry_date), {
  message: "Expiry date is required for paid models.",
  path: ["expiry_date"],
});

type AddUserFormValues = z.infer<typeof addUserSchema>;

interface AddUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUserAdded: (newUser: UserProfile) => void; // Callback to update user list
}

export default function AddUserDialog({ isOpen, onClose, onUserAdded }: AddUserDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      role: 'User', // Default to User
      class: null,
      model: 'free',
      expiry_date: null,
    },
  });

  // Watch the selected role to determine if it's an Admin
  const selectedRole = form.watch("role");
  const selectedModel = form.watch("model");

  const onSubmit = async (data: AddUserFormValues) => {
    setIsLoading(true);
    try {

      // Ensure admin email matches if role is Admin
      if (data.role === 'Admin' && data.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
          throw new Error(`Admin role can only be assigned to the email: ${process.env.NEXT_PUBLIC_ADMIN_EMAIL}`);
      }
       // Ensure user role doesn't use admin email
       if (data.role === 'User' && data.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
          throw new Error(`The email ${process.env.NEXT_PUBLIC_ADMIN_EMAIL} is reserved for the Admin role.`);
       }

      // Format expiry_date to ISO string or null
      const expiryDateString = data.model === 'free' ? null : (data.expiry_date ? data.expiry_date.toISOString() : null);

      // Prepare the UserProfile object
      // The actual UserProfile type expects the hashed password, addUserToJson handles hashing.
      // For the callback, we can omit the password.
      const newUserProfileForCallback: Omit<UserProfile, 'password'> = {
        id: uuidv4(), // Generate a unique ID for the new user
        name: data.name,
        email: data.email,
        phone: data.phone,
        referral: "", // Default referral
        class: data.class,
        model: data.role === 'Admin' ? 'combo' : data.model, // Admins get combo model
        expiry_date: data.role === 'Admin' ? '2099-12-31T00:00:00.000Z' : expiryDateString, // Long expiry for admin
        createdAt: new Date().toISOString(),
        avatarUrl: null, // Add default avatarUrl
      };

      // Use the server action to add the user to users.json (it handles hashing)
      const result = await addUserToJson({
          ...newUserProfileForCallback, // Spread the profile data
          password: data.password, // Pass the plain text password
      });

      if (!result.success || !result.user) { // Check if user object is returned
        throw new Error(result.message || 'Failed to add new user.');
      }

      toast({
        title: 'User Added Successfully',
        description: `User ${data.email} has been created with the role ${data.role}.`,
      });
      // Use the user data returned from the action for the callback
      onUserAdded(result.user);
      form.reset(); // Reset form fields
      onClose(); // Close dialog

    } catch (error: any) {
      console.error('Failed to add user:', error);
      toast({
        variant: 'destructive',
        title: 'Add User Failed',
        description: error.message || 'Could not add the new user.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg"> {/* Increased width slightly */}
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user account. Select the role and fill in the details.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">

            {/* Role Select */}
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>User Role *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {userRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="John Doe" disabled={isLoading} />
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
                    <Input type="email" {...field} placeholder="user@example.com" disabled={isLoading} />
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
                  <FormLabel>Phone Number *</FormLabel>
                  <FormControl>
                    <Input type="tel" {...field} placeholder="9876543210" disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password *</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password *</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Conditional Fields based on Role */}
            {selectedRole === 'User' && (
             <>
                <FormField
                  control={form.control}
                  name="class"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Academic Status</FormLabel>
                      <Select
                         // Convert null to '_none_' for the Select value, handle change
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
                           <SelectItem value="_none_">-- None --</SelectItem> {/* Use a non-empty value */}
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

                 <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subscription Model *</FormLabel>
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

                 {/* Expiry Date Picker (Only for Paid User Models) */}
                 {selectedModel !== 'free' && (
                     <FormField
                         control={form.control}
                         name="expiry_date"
                         render={({ field }) => (
                             <FormItem className="flex flex-col">
                             <FormLabel>Expiry Date {selectedModel !== 'free' ? '*' : ''}</FormLabel>
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
            </>
            )}

            {/* Footer */}
             <DialogFooter className="sm:col-span-2 mt-4">
                <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
                <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add User
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}