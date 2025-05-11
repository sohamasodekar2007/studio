// src/components/admin/edit-user-dialog.tsx
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
import { CalendarIcon, Loader2, ShieldCheck, AlertTriangle, Phone, Edit, KeyRound, User } from "lucide-react"; 
import { format, isValid, parseISO } from "date-fns";
import { useToast } from '@/hooks/use-toast';
import { type UserProfile, userModels, academicStatuses, type AcademicStatus, type UserModel } from '@/types';
import { updateUserInJson, findUserByEmailInternal } from '@/actions/user-actions';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const primaryAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@edunexus.com';
const adminEmailPattern = /^[a-zA-Z0-9._%+-]+-admin@edunexus\.com$/;


const getCurrentAndFutureYears = (count = 5) => { 
  const currentYear = new Date().getFullYear();
  return Array.from({ length: count }, (_, i) => (currentYear + i).toString());
};


const editUserSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  phone: z.string().optional(), 
  class: z.enum(academicStatuses).nullable().optional(),
  model: z.enum(userModels, { required_error: "Please select a user model." }),
  expiry_date: z.date().nullable().optional(),
  targetYear: z.string({required_error: "Target year is required."}).min(4, "Target year is required.").nullable(),
}).refine(data => data.model === 'free' || (data.model !== 'free' && data.expiry_date), {
  message: "Expiry date is required for paid models.",
  path: ["expiry_date"],
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

// Adjusted to accept Omit<UserProfile, 'password'> as per the state in AdminUsersPage
interface EditUserDialogProps {
  user: Omit<UserProfile, 'password'>;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdate: (updatedUser: Omit<UserProfile, 'password'>) => void;
}

export default function EditUserDialog({ user, isOpen, onClose, onUserUpdate }: EditUserDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [yearOptions, setYearOptions] = useState<string[]>([]);

  useEffect(() => {
    setYearOptions(getCurrentAndFutureYears());
  }, []);

  const isPrimaryAdminAccount = user.email?.toLowerCase() === primaryAdminEmail.toLowerCase();
  const currentUserRole = user.role || 'User'; // Default to 'User' if role is undefined

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {}, 
  });

  const currentModel = form.watch("model");

  useEffect(() => {
      if (user && isOpen) { 
          const effectiveRole = user.role || 'User';
          form.reset({
             name: user.name || '',
             email: user.email || '',
             phone: user.phone || '', 
             class: user.class || null,
             model: effectiveRole === 'Admin' ? 'combo' : (user.model || 'free'),
             expiry_date: effectiveRole === 'Admin' ? new Date('2099-12-31T00:00:00.000Z') : (user.expiry_date && isValid(parseISO(user.expiry_date)) ? parseISO(user.expiry_date) : null),
             targetYear: user.targetYear || null,
          });
      }
  }, [user, isOpen, form]);


  const onSubmit = async (data: EditUserFormValues) => {
    setIsLoading(true);
    try {
        const newEmail = data.email.trim().toLowerCase();
        const originalEmail = user.email?.trim().toLowerCase();

        if (isPrimaryAdminAccount && newEmail !== originalEmail) {
             throw new Error("Cannot change the email of the primary admin account.");
        }

        if (newEmail !== originalEmail) {
            const existingUserByNewEmail = await findUserByEmailInternal(newEmail);
            if (existingUserByNewEmail && existingUserByNewEmail.id !== user.id) {
                 form.setError("email", { message: "This email address is already in use." });
                 throw new Error("Email address already in use.");
            }
        }

         const userRoleToMaintain = user.role || 'User'; // Keep the existing role, don't change it here
         let finalModel = data.model;
         let finalExpiryDate = data.expiry_date;

         if (userRoleToMaintain === 'Admin') { // If the user IS an Admin, enforce admin plan settings
             finalModel = 'combo';
             finalExpiryDate = new Date('2099-12-31T00:00:00.000Z');
         } else if (finalModel === 'free') { // If user is not admin and model is free
             finalExpiryDate = null;
         } else if (!finalExpiryDate) { // For non-admin, paid plans require expiry
              form.setError("expiry_date", { message: "Expiry date is required for paid models." });
             throw new Error("Expiry date missing for paid plan.");
         }

       const expiryDateString = finalExpiryDate ? finalExpiryDate.toISOString() : null;
       
       // Prepare payload for update. Only include fields that can be edited in this dialog.
       // user-actions.ts should handle hashing if password were changed here (it's not).
       const updatedDataPayload: Partial<Omit<UserProfile, 'id' | 'createdAt' | 'password' | 'role' | 'referralCode' | 'referralStats' | 'totalPoints' | 'telegramId' | 'telegramUsername' | 'avatarUrl'>> & {email?: string} = {
         name: data.name,
         // phone: data.phone, // Phone editing is disabled
         class: data.class,
         model: finalModel,
         expiry_date: expiryDateString,
         targetYear: data.targetYear || null,
       };

       if (newEmail !== originalEmail && !isPrimaryAdminAccount) {
         updatedDataPayload.email = newEmail;
       }


       const result = await updateUserInJson(user.id, updatedDataPayload);

       if (!result.success || !result.user) {
         throw new Error(result.message || 'Failed to update user.');
       }

       toast({
         title: 'User Updated',
         description: `${result.user.email}'s details have been successfully updated.`,
       });

       onUserUpdate({ ...result.user, role: userRoleToMaintain }); // Pass back the user with the original role
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

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) return name.charAt(0).toUpperCase();
    if (email) return email?.charAt(0).toUpperCase(); // Optional chaining for email
    return <User className="h-4 w-4"/>;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-10 w-10"><AvatarImage src={user.avatarUrl ? `/avatars/${user.avatarUrl}` : (user.email ? `https://avatar.vercel.sh/${user.email}.png` : undefined)} alt={user.name || 'User Avatar'} /><AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback></Avatar>
            <div><DialogTitle>Edit User: {user.email}</DialogTitle><DialogDescription>Update details and plan. Role changes via 'Change Role'.</DialogDescription></div>
            <Badge variant={currentUserRole === 'Admin' ? 'destructive' : 'secondary'} className="ml-auto text-xs">{currentUserRole}</Badge>
          </div>
           {isPrimaryAdminAccount && (<Badge variant="destructive" className="w-fit text-xs mt-2">Primary Admin (Limited Edit)</Badge>)}
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Full Name *</FormLabel><FormControl><Input {...field} disabled={isLoading} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email Address *</FormLabel><FormControl><Input type="email" {...field} disabled={isLoading || isPrimaryAdminAccount} /></FormControl><FormMessage /> {isPrimaryAdminAccount && <p className="text-xs text-muted-foreground pt-1">Primary admin email cannot be changed.</p>} </FormItem> )} />
            <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input type="tel" {...field} disabled={true} /></FormControl><FormMessage /><p className="text-xs text-muted-foreground pt-1">Phone number cannot be edited here.</p></FormItem> )} />
            
            <FormField control={form.control} name="class" render={({ field }) => ( 
              <FormItem>
                <FormLabel>Academic Status *</FormLabel>
                <Select 
                  onValueChange={(value) => field.onChange(value === '_none_' ? null : value as AcademicStatus | null)} 
                  value={field.value === null ? '_none_' : field.value ?? '_none_'} 
                  disabled={isLoading}
                >
                  <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="_none_">-- Not Set --</SelectItem>
                    {academicStatuses.map((status) => (<SelectItem key={status} value={status}>{status}</SelectItem>))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}/>
            <FormField control={form.control} name="targetYear" render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Exam Year *</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(value === '_none_' ? null : value)} 
                    value={field.value === null ? '_none_' : field.value ?? '_none_'}
                    disabled={isLoading}
                  >
                    <FormControl><SelectTrigger><SelectValue placeholder="Select target year" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="_none_">-- Not Set --</SelectItem>
                      {yearOptions.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
            )} />

            <FormField control={form.control} name="model" render={({ field }) => ( <FormItem><FormLabel>Subscription Model *</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isLoading || currentUserRole === 'Admin'}><FormControl><SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger></FormControl><SelectContent>{userModels.map((model) => (<SelectItem key={model} value={model} className="capitalize">{model.replace('_', ' ')}</SelectItem>))}</SelectContent></Select><FormMessage /> {currentUserRole === 'Admin' && <p className="text-xs text-muted-foreground pt-1">Admin accounts automatically have 'Combo' plan.</p>}</FormItem>)}/>
            
            {(currentModel !== 'free' && currentUserRole !== 'Admin') && (
                 <FormField control={form.control} name="expiry_date" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Expiry Date *</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={isLoading || currentUserRole === 'Admin'}><CalendarIcon className="ml-auto h-4 w-4 opacity-50" />{field.value ? format(field.value, "PPP") : <span>Pick expiry date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0)) || isLoading || currentUserRole === 'Admin'} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)}/>
            )}
            {currentUserRole === 'Admin' && currentModel !== 'free' && ( 
                <FormItem className="flex flex-col"><FormLabel>Expiry Date</FormLabel><Input value={format(new Date('2099-12-31T00:00:00.000Z'), "PPP")} disabled /><p className="text-xs text-muted-foreground pt-1">Admin expiry date is fixed.</p></FormItem>
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

