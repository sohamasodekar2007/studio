// src/components/admin/add-user-dialog.tsx
'use client';

import { useState, useEffect } from 'react'; // Added useEffect
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
import { addUserToJson } from '@/actions/user-actions'; 
import { v4 as uuidv4 } from 'uuid';


const userRoles = ['User', 'Admin'] as const;
type UserRole = typeof userRoles[number];

const adminEmailPattern = /^[a-zA-Z0-9._%+-]+-admin@edunexus\.com$/;
const primaryAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@edunexus.com'; 

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 6 }, (_, i) => (currentYear + i).toString());

const addUserSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  phone: z.string().min(10, { message: "Please enter a valid 10-digit phone number." }).max(10, { message: "Phone number must be 10 digits." }).regex(/^\d{10}$/, { message: "Please enter a valid 10-digit phone number." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  confirmPassword: z.string(),
  role: z.enum(userRoles, { required_error: "Please select a role." }), 
  class: z.enum(academicStatuses).nullable().optional(), 
  model: z.enum(userModels),
  expiry_date: z.date().nullable().optional(),
  targetYear: z.string().optional().nullable(), 
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine(data => data.model === 'free' || (data.model !== 'free' && data.expiry_date), {
  message: "Expiry date is required for paid models.",
  path: ["expiry_date"],
}).refine(data => {
    if (data.role === 'Admin') {
      return data.email.toLowerCase() === primaryAdminEmail.toLowerCase() || adminEmailPattern.test(data.email.toLowerCase());
    }
    return true; 
}, {
    message: `Admin role requires email to be '${primaryAdminEmail}' or match 'username-admin@edunexus.com'.`,
    path: ["email"], 
}).refine(data => {
    if (data.role === 'User') {
        return data.email.toLowerCase() !== primaryAdminEmail.toLowerCase() && !adminEmailPattern.test(data.email.toLowerCase());
    }
    return true;
}, {
    message: `This email format is reserved for Admin roles.`,
    path: ["email"], 
});


type AddUserFormValues = z.infer<typeof addUserSchema>;
type DisplayUserProfile = Omit<UserProfile, 'password'>; // For callback

interface AddUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUserAdded: (newUser: DisplayUserProfile) => void; 
}

export default function AddUserDialog({ isOpen, onClose, onUserAdded }: AddUserDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [effectiveRole, setEffectiveRole] = useState<UserRole>('User');

  const form = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      role: 'User', 
      class: null,
      model: 'free',
      expiry_date: null,
      targetYear: null, 
    },
  });
  
  const selectedRole = form.watch("role");
  const selectedModel = form.watch("model");
  const emailValue = form.watch("email");

  useEffect(() => {
    // Auto-adjust role based on email pattern if not Admin
    if (selectedRole !== 'Admin') {
        const derivedRole = (emailValue.toLowerCase() === primaryAdminEmail.toLowerCase() || adminEmailPattern.test(emailValue.toLowerCase())) ? 'Admin' : 'User';
        if (derivedRole === 'Admin' && selectedRole === 'User') {
           // This can cause an infinite loop if not careful.
           // The Zod schema should catch this.
           // If schema allows 'User' role for admin-pattern emails, this is fine.
           // But schema now prevents User role for admin-pattern emails, so this block might not be needed.
        }
        setEffectiveRole(derivedRole); // Store the derived role
    } else {
        setEffectiveRole('Admin'); // If Admin selected, stick to it
    }
  }, [emailValue, selectedRole]);


  const onSubmit = async (data: AddUserFormValues) => {
    setIsLoading(true);
    console.log("AddUserDialog: Submitting data:", data);
    try {
      
      const finalRole = data.role; // The role from the form is now validated by Zod

      let finalModel = data.model;
      let finalExpiryDate = data.expiry_date;

      if (finalRole === 'Admin') {
        finalModel = 'combo';
        finalExpiryDate = new Date('2099-12-31T00:00:00.000Z');
      } else if (data.model === 'free') {
        finalExpiryDate = null;
      }

      const newUserProfileForAction: Omit<UserProfile, 'id' | 'createdAt' | 'avatarUrl' | 'referralCode' | 'referralStats' | 'totalPoints' | 'telegramId' | 'telegramUsername'> & { password: string } = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password,
        class: data.class,
        model: finalModel,
        expiry_date: finalExpiryDate ? finalExpiryDate.toISOString() : null,
        role: finalRole,
        targetYear: data.targetYear || null,
      };

      console.log("AddUserDialog: Prepared data for action:", newUserProfileForAction);
      const result = await addUserToJson(newUserProfileForAction);

      if (!result.success || !result.user) {
        console.error("AddUserDialog: addUserToJson failed:", result.message);
        throw new Error(result.message || 'Failed to add new user.');
      }

      toast({
        title: 'User Added Successfully',
        description: `User ${result.user.email} has been created with role ${result.user.role}.`,
      });
      
      onUserAdded(result.user); 
      form.reset();
      onClose(); 

    } catch (error: any) {
      console.error('AddUserDialog: Failed to add user:', error);
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user account. Select the role and fill in the details.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>User Role *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {userRoles.map((roleOption) => (
                        <SelectItem key={roleOption} value={roleOption}>
                          {roleOption}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Full Name *</FormLabel><FormControl><Input {...field} placeholder="John Doe" disabled={isLoading} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email Address *</FormLabel><FormControl><Input type="email" {...field} placeholder="user@example.com or name-admin@edunexus.com" disabled={isLoading} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Phone Number *</FormLabel><FormControl><Input type="tel" {...field} placeholder="9876543210" disabled={isLoading} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Password *</FormLabel><FormControl><Input type="password" {...field} disabled={isLoading} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="confirmPassword" render={({ field }) => ( <FormItem><FormLabel>Confirm Password *</FormLabel><FormControl><Input type="password" {...field} disabled={isLoading} /></FormControl><FormMessage /></FormItem> )} />

            {selectedRole === 'User' && (
             <>
                <FormField control={form.control} name="class" render={({ field }) => ( <FormItem><FormLabel>Academic Status</FormLabel><Select onValueChange={(value) => field.onChange(value === '_none_' ? null : value as AcademicStatus | null)} value={field.value === null ? '_none_' : field.value ?? '_none_'} disabled={isLoading} ><FormControl><SelectTrigger><SelectValue placeholder="Select status (Optional)" /></SelectTrigger></FormControl><SelectContent><SelectItem value="_none_">-- None --</SelectItem>{academicStatuses.map((status) => ( <SelectItem key={status} value={status}>{status}</SelectItem> ))}</SelectContent></Select><FormMessage /></FormItem> )}/>
                 <FormField control={form.control} name="targetYear" render={({ field }) => ( <FormItem><FormLabel>Target Year</FormLabel><Select onValueChange={(value) => field.onChange(value === '_none_' ? null : value)} value={field.value === null ? '_none_' : field.value ?? '_none_'} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Select target year (Optional)" /></SelectTrigger></FormControl><SelectContent><SelectItem value="_none_">-- None --</SelectItem>{yearOptions.map((year) => ( <SelectItem key={year} value={year}>{year}</SelectItem> ))}</SelectContent></Select><FormMessage /></FormItem> )}/>
                 <FormField control={form.control} name="model" render={({ field }) => ( <FormItem><FormLabel>Subscription Model *</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isLoading}><FormControl><SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger></FormControl><SelectContent>{userModels.map((model) => ( <SelectItem key={model} value={model} className="capitalize">{model.replace('_', ' ')}</SelectItem> ))}</SelectContent></Select><FormMessage /></FormItem> )}/>
                 {selectedModel !== 'free' && (
                     <FormField control={form.control} name="expiry_date" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Expiry Date {selectedModel !== 'free' ? '*' : ''}</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground" )} disabled={isLoading}><CalendarIcon className="ml-auto h-4 w-4 opacity-50" />{field.value ? ( format(field.value, "PPP") ) : ( <span>Pick an expiry date</span> )}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0)) || isLoading } initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )}/>
                 )}
            </>
            )}
            {selectedRole === 'Admin' && (
                <div className="sm:col-span-2 text-sm text-muted-foreground p-3 border rounded-md bg-secondary/20">
                    Admin accounts are automatically assigned the 'Combo' plan with maximum expiry.
                </div>
            )}

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

