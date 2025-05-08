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
import { CalendarIcon, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { useToast } from '@/hooks/use-toast';
import { type UserProfile, userModels, academicStatuses, type AcademicStatus } from '@/types';
import { updateUserInJson, findUserByEmailInternal } from '@/actions/user-actions'; // Import necessary actions
import { Badge } from '@/components/ui/badge';

// Define the allowed admin email pattern and primary admin email
const adminEmailPattern = /^[a-zA-Z0-9._%+-]+-admin@edunexus\.com$/;
const primaryAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@edunexus.com';

// Helper function to determine role based on email
const getUserRole = (email: string | null): 'Admin' | 'User' => {
    if (!email) return 'User';
    return email === primaryAdminEmail || adminEmailPattern.test(email) ? 'Admin' : 'User';
};

// Schema for editing user profile, including email and role-based validation
const editUserSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  phone: z.string()
           .min(10, { message: "Please enter a valid 10-digit phone number." })
           .max(10, { message: "Phone number must be 10 digits." })
           .regex(/^\d{10}$/, { message: "Please enter a valid 10-digit phone number." }),
  class: z.enum(academicStatuses).nullable().optional(), // Allow null or value
  model: z.enum(userModels, { required_error: "Please select a user model." }),
  expiry_date: z.date().nullable().optional(),
}).refine(data => data.model === 'free' || (data.model !== 'free' && data.expiry_date), {
  message: "Expiry date is required for paid models.",
  path: ["expiry_date"],
});

// Define separate types for form values and the user prop for clarity
type EditUserFormValues = z.infer<typeof editUserSchema>;
type UserProfileWithRole = UserProfile & { role?: 'Admin' | 'User' };

interface EditUserDialogProps {
  user: UserProfileWithRole; // Accept user with optional role
  isOpen: boolean;
  onClose: () => void;
  onUserUpdate: (updatedUser: UserProfileWithRole) => void; // Pass back user with role
}

export default function EditUserDialog({ user, isOpen, onClose, onUserUpdate }: EditUserDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Determine if the current user IS the primary admin based on email
  const isPrimaryAdminAccount = user.email === primaryAdminEmail;

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      name: user.name || '',
      email: user.email || '', // Add email
      phone: user.phone || '',
      class: user.class || null, // Add class
      model: user.model || 'free',
      expiry_date: user.expiry_date && isValid(parseISO(user.expiry_date)) ? parseISO(user.expiry_date) : null,
    },
  });

  // Watch the selected model for conditional rendering
  const currentModel = form.watch("model");

  // Effect to reset form when user prop changes (e.g., opening dialog for different user)
  useEffect(() => {
      if (user) {
          form.reset({
             name: user.name || '',
             email: user.email || '',
             phone: user.phone || '',
             class: user.class || null,
             model: isPrimaryAdminAccount ? 'combo' : (user.model || 'free'), // Ensure admin model is combo
             expiry_date: isPrimaryAdminAccount ? new Date('2099-12-31T00:00:00.000Z') : (user.expiry_date && isValid(parseISO(user.expiry_date)) ? parseISO(user.expiry_date) : null),
          });
      }
  }, [user, form, isPrimaryAdminAccount]);


  const onSubmit = async (data: EditUserFormValues) => {
    setIsLoading(true);
    try {
        // --- Email & Role Validation ---
        const newEmail = data.email.trim().toLowerCase();
        const originalEmail = user.email?.trim().toLowerCase();
        const newRole = getUserRole(newEmail);
        const originalRole = getUserRole(originalEmail);

        // 1. Prevent changing the primary admin's email
        if (isPrimaryAdminAccount && newEmail !== originalEmail) {
             throw new Error("Cannot change the email of the primary admin account.");
        }

        // 2. Check if the new email is already taken (only if email changed)
        if (newEmail !== originalEmail) {
            const existingUser = await findUserByEmailInternal(newEmail);
            if (existingUser && existingUser.id !== user.id) {
                 form.setError("email", { message: "This email address is already in use." });
                 throw new Error("Email address already in use.");
            }
        }

        // 3. Validate Role change based on email format
         if (newRole === 'Admin' && newEmail !== primaryAdminEmail && !adminEmailPattern.test(newEmail)) {
              form.setError("email", { message: "To assign Admin role, email must end with '-admin@edunexus.com' or be the primary admin email." });
              throw new Error("Invalid email format for Admin role.");
         }
         if (newRole === 'User' && (newEmail === primaryAdminEmail || adminEmailPattern.test(newEmail))) {
              form.setError("email", { message: "This email format is reserved for Admin roles." });
              throw new Error("Cannot assign a User role to an admin email format.");
         }

         // 4. Ensure model/expiry constraints based on role
         let finalModel = data.model;
         let finalExpiryDate = data.expiry_date;

         if (newRole === 'Admin') {
             finalModel = 'combo'; // Admins always get combo
             finalExpiryDate = new Date('2099-12-31T00:00:00.000Z'); // Admins get long expiry
         } else if (finalModel === 'free') {
             finalExpiryDate = null; // Free users have null expiry
         } else if (!finalExpiryDate) {
              // This case should be caught by zod refine, but double check
             form.setError("expiry_date", { message: "Expiry date is required for paid models." });
             throw new Error("Expiry date missing for paid plan.");
         }

       // Format expiry_date to ISO string or null BEFORE updating
       const expiryDateString = finalExpiryDate ? finalExpiryDate.toISOString() : null;

       // Prepare the data payload specifically for the update action
       const updatedDataPayload: Partial<Omit<UserProfile, 'id' | 'createdAt' | 'password' | 'referral' | 'avatarUrl'>> = {
         name: data.name,
         email: newEmail, // Update email
         phone: data.phone,
         class: data.class,
         model: finalModel,
         expiry_date: expiryDateString,
       };

       // Save the *entire* updated UserProfile object via Server Action
       const result = await updateUserInJson(user.id, updatedDataPayload);

       if (!result.success || !result.user) { // Check if the updated user is returned
         throw new Error(result.message || 'Failed to update user.');
       }

       toast({
         title: 'User Updated',
         description: `${newEmail}'s details have been successfully updated. Role is now ${newRole}.`,
       });

       // Pass back the updated user data with the correct role derived from email
       onUserUpdate({ ...result.user, role: newRole });
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
      <DialogContent className="sm:max-w-lg"> {/* Increased width */}
        <DialogHeader>
          <DialogTitle>Edit User: {user.email}</DialogTitle>
          <DialogDescription>
            Update the user's details, plan, and email (which determines their role).
          </DialogDescription>
           {isPrimaryAdminAccount && (
                <Badge variant="destructive" className="w-fit text-xs mt-2">Primary Admin (Email/Plan Locked)</Badge>
           )}
           {!isPrimaryAdminAccount && getUserRole(user.email) === 'Admin' && (
               <Badge variant="secondary" className="w-fit text-xs mt-2">Standard Admin</Badge>
           )}
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name *</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isLoading} />
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
                    <Input type="email" {...field} disabled={isLoading || isPrimaryAdminAccount} />
                  </FormControl>
                  <FormMessage />
                  {!isPrimaryAdminAccount && <p className="text-xs text-muted-foreground pt-1">Change email format to 'name-admin@...' to grant Admin role, or remove suffix to revoke.</p>}
                   {isPrimaryAdminAccount && <p className="text-xs text-muted-foreground pt-1">Primary admin email cannot be changed.</p>}
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
                    <Input type="tel" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="class"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Academic Status</FormLabel>
                   <Select
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
                       <SelectItem value="_none_">-- None --</SelectItem>
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
            {/* User Model Select */}
            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subscription Model *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isLoading || isPrimaryAdminAccount || getUserRole(user.email) === 'Admin'} // Disable for ANY admin account
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
                   {getUserRole(user.email) === 'Admin' && <p className="text-xs text-muted-foreground pt-1">Admin accounts automatically have 'Combo' plan.</p>}
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
                             <FormLabel>Expiry Date {currentModel !== 'free' && !isPrimaryAdminAccount && getUserRole(user.email) !== 'Admin' ? '*' : ''}</FormLabel> {/* Required asterisk logic */}
                             <Popover>
                                 <PopoverTrigger asChild>
                                 <FormControl>
                                     <Button
                                     variant={"outline"}
                                     className={cn(
                                         "w-full pl-3 text-left font-normal",
                                         !field.value && "text-muted-foreground"
                                     )}
                                     disabled={isLoading || isPrimaryAdminAccount || getUserRole(user.email) === 'Admin'} // Disable if loading or Admin
                                     >
                                     {field.value ? (
                                         format(field.value, "PPP") // Format date nicely
                                     ) : (
                                         <span>Pick expiry date</span>
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
                                         date < new Date(new Date().setHours(0, 0, 0, 0)) || isLoading || isPrimaryAdminAccount || getUserRole(user.email) === 'Admin'
                                     }
                                     initialFocus
                                 />
                                 </PopoverContent>
                             </Popover>
                             <FormMessage />
                             {getUserRole(user.email) === 'Admin' && <p className="text-xs text-muted-foreground pt-1">Admin expiry date is fixed.</p>}
                             </FormItem>
                         )}
                     />
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
```

  </change>
  <change>
    <file>src/app/admin/users/page.tsx</file>
    <description>Remove ChangeRoleDialog import and usage, update handleUserUpdate to accept UserProfileWithRole, and change the "Change Plan/Role" button to open the consolidated EditUserDialog.</description>
    <content><![CDATA[
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react'; // Added useCallback
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Search, Phone, Trash2, Edit, KeyRound, UserCheck } from "lucide-react"; // Added Icons
import { Skeleton } from "@/components/ui/skeleton";
import { type UserProfile, type UserModel } from '@/types';
// Import the action to read users from JSON
import { readUsers, deleteUserFromJson, updateUserInJson } from '@/actions/user-actions'; // Import actions (updateUserPasswordInJson is used internally by ResetPasswordDialog)
import { useToast } from '@/hooks/use-toast';
import EditUserDialog from '@/components/admin/edit-user-dialog'; // Import dialog components
import ResetPasswordDialog from '@/components/admin/reset-password-dialog';
// import ChangeRoleDialog from '@/components/admin/change-role-dialog'; // REMOVED ChangeRoleDialog import
import AddUserDialog from '@/components/admin/add-user-dialog'; // Import AddUserDialog
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'; // Added Avatar imports

// Define the allowed admin email pattern and primary admin email
const adminEmailPattern = /^[a-zA-Z0-9._%+-]+-admin@edunexus\.com$/;
const primaryAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@edunexus.com';

// Helper function to determine role based on email
const getUserRole = (email: string | null): 'Admin' | 'User' => {
    if (!email) return 'User';
    return email === primaryAdminEmail || adminEmailPattern.test(email) ? 'Admin' : 'User';
};

// Define combined type for state
type UserProfileWithRole = UserProfile & { role?: 'Admin' | 'User' };


export default function AdminUsersPage() {
  const { toast } = useToast();
  // Ensure UserProfile type includes the optional role for display
  const [users, setUsers] = useState<UserProfileWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false); // State for delete confirmation

  // State for managing dialogs
  const [dialogState, setDialogState] = useState<{
    type: 'edit' | 'reset' | 'add' | null; // Removed 'role' type
    user: UserProfileWithRole | null; // Use combined type
  }>({ type: null, user: null });


  // Updated fetchAllUsers to assign role correctly
  const fetchAllUsers = useCallback(() => {
     setIsLoading(true);
     readUsers() // Fetches users without passwords
      .then(data => {
        // Assign role based on email pattern
        const usersWithRoles = data.map(u => ({
            ...u,
            role: getUserRole(u.email), // Use the helper function
        }));
        setUsers(usersWithRoles);
      })
      .catch(error => {
        console.error("Failed to fetch users:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load users." });
        setUsers([]); // Set to empty on error
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [toast]);


  useEffect(() => {
    fetchAllUsers();
  }, [fetchAllUsers]); // Depend on the memoized fetch function

  const filteredUsers = useMemo(() => {
    return users.filter(user =>
        (user.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (user.phone?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (user.model?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || // Search by model
        (user.role?.toLowerCase() || '').includes(searchTerm.toLowerCase()) // Search by assigned role
    );
  }, [users, searchTerm]);

   // Helper to safely format date
  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      // Attempt to parse if it's a string, otherwise assume it's a Date object
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      // Check if the date is valid after parsing/using
      if (isNaN(date.getTime())) {
          return 'Invalid Date';
      }
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return 'Invalid Date';
    }
  };

   // Handle User Deletion with Confirmation
   const handleDeleteUser = async (userId: string | number) => {
       setIsDeleting(true); // Indicate deletion in progress (optional: disable delete button)
       const originalUsers = [...users];
       // Optimistic update
       setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));

       try {
           const result = await deleteUserFromJson(userId.toString()); // Ensure userId is string
           if (!result.success) {
               setUsers(originalUsers); // Revert
               toast({ variant: "destructive", title: "Delete Failed", description: result.message });
           } else {
               toast({ title: "User Deleted", description: "User has been successfully removed." });
               // No need to re-fetch, optimistic update succeeded
           }
       } catch (error: any) {
           console.error("Failed to delete user:", error);
           setUsers(originalUsers); // Revert
           toast({ variant: "destructive", title: "Error", description: "Could not delete user." });
       } finally {
           setIsDeleting(false); // Reset deletion state
       }
   };

   // Function to handle updates from Edit dialog (handles both profile and potential role change via email)
   const handleUserUpdate = (updatedUser: UserProfileWithRole) => {
        // Role is already determined within the Edit dialog based on the *saved* email
        setUsers(prevUsers =>
            prevUsers.map(u => (u.id === updatedUser.id ? updatedUser : u))
        );
        closeDialog(); // Close the currently open dialog
    };


   // Function to handle adding a user from Add dialog
    const handleUserAdded = (newUser: UserProfileWithRole) => { // Receive user with role
       setUsers(prevUsers => [newUser, ...prevUsers]); // Add new user to the beginning of the list
       closeDialog();
   }

   // Dialog handlers
    const openEditDialog = (user: UserProfileWithRole) => setDialogState({ type: 'edit', user });
    const openResetDialog = (user: UserProfileWithRole) => setDialogState({ type: 'reset', user });
    // Removed openRoleDialog handler
    const openAddDialog = () => setDialogState({ type: 'add', user: null }); // Open Add dialog
    const closeDialog = () => setDialogState({ type: null, user: null });

    const getInitials = (name?: string | null, email?: string | null) => {
        if (name) return name.charAt(0).toUpperCase();
        if (email) return email.charAt(0).toUpperCase();
        return <User className="h-4 w-4"/>;
    }


  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
         <div>
            <h1 className="text-3xl font-bold tracking-tight">Manage Users</h1>
            <p className="text-muted-foreground">View, create, edit, or delete platform users.</p>
         </div>
         {/* Enable Add User button and link to openAddDialog */}
         <Button onClick={openAddDialog}>
           <PlusCircle className="mr-2 h-4 w-4" /> Add New User
         </Button>
      </div>

      <Card>
        <CardHeader>
           <div className="flex items-center gap-2">
             <Search className="h-4 w-4 text-muted-foreground" />
             <Input
               placeholder="Search by name, email, phone, model, role..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="max-w-sm"
             />
           </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                 <TableHead className="w-[50px]">Avatar</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Model</TableHead>
                 <TableHead>Expiry</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={`skeleton-${index}`}>
                     <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => {
                 const isCurrentUserPrimaryAdmin = user.email === primaryAdminEmail;
                 // Construct avatar URL
                  const avatarSrc = user.avatarUrl ? `/avatars/${user.avatarUrl}` : `https://avatar.vercel.sh/${user.email || user.id}.png?size=40`; // Add size parameter

                  return (
                  <TableRow key={user.id}>
                    <TableCell>
                         <Avatar className="h-8 w-8">
                           <AvatarImage src={avatarSrc} alt={user.name || 'User'} />
                           <AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback>
                         </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{user.name || 'N/A'} {isCurrentUserPrimaryAdmin ? '(Primary)' : ''}</TableCell>
                    <TableCell>{user.email || 'N/A'}</TableCell>
                    <TableCell>
                      {user.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground"/>
                          {user.phone}
                        </span>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                     <TableCell>
                       <Badge variant={user.role === 'Admin' ? 'destructive' : 'secondary'}>
                         {user.role || 'User'}
                       </Badge>
                     </TableCell>
                      <TableCell className="capitalize">{user.model || 'N/A'}</TableCell>
                       <TableCell>{formatDate(user.expiry_date)}</TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          {/* Disable actions for the primary admin user */}
                          <Button aria-haspopup="true" size="icon" variant="ghost" disabled={isCurrentUserPrimaryAdmin}>
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>User Actions</DropdownMenuLabel>
                           {/* Enable buttons and add onClick handlers */}
                          <DropdownMenuItem onClick={() => openEditDialog(user)} disabled={isCurrentUserPrimaryAdmin}>
                             <Edit className="mr-2 h-4 w-4" /> Edit User / Plan / Role
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openResetDialog(user)} disabled={isCurrentUserPrimaryAdmin}>
                             <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                           </DropdownMenuItem>
                           {/* REMOVED "Change Plan/Role" MenuItem as it's consolidated into Edit */}
                          <DropdownMenuSeparator />
                           {/* Delete Confirmation Dialog Trigger */}
                           <AlertDialog>
                             <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="w-full justify-start px-2 py-1.5 text-sm text-destructive focus:text-destructive focus:bg-destructive/10 hover:bg-destructive/10 hover:text-destructive"
                                  disabled={isCurrentUserPrimaryAdmin || isDeleting} // Disable if primary admin or already deleting
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete User
                                </Button>
                             </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the user account
                                    for <span className="font-semibold">{user.email}</span> and remove their data.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-destructive hover:bg-destructive/90">
                                      Yes, delete user
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                           </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )})
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center"> {/* Updated colSpan */}
                    No users found matching your criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter>
          <div className="text-xs text-muted-foreground">
            Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> users
          </div>
          {/* Optional: Add pagination controls here */}
        </CardFooter>
      </Card>

       {/* Dialogs */}
      {dialogState.type === 'edit' && dialogState.user && (
        <EditUserDialog
          user={dialogState.user}
          isOpen={dialogState.type === 'edit'}
          onClose={closeDialog}
          onUserUpdate={handleUserUpdate} // Use the callback
        />
      )}
       {dialogState.type === 'reset' && dialogState.user && (
        <ResetPasswordDialog
          user={dialogState.user}
          isOpen={dialogState.type === 'reset'}
          onClose={closeDialog}
          // No onUserUpdate needed for password reset, as it doesn't change displayed data
        />
      )}
      {/* REMOVED ChangeRoleDialog rendering */}
       {/* Add User Dialog */}
       {dialogState.type === 'add' && (
        <AddUserDialog
            isOpen={dialogState.type === 'add'}
            onClose={closeDialog}
            onUserAdded={handleUserAdded} // Pass callback to update list
        />
       )}

    </div>
  );
}
```

  </change>
  <change>
    <file>src/components/admin/change-role-dialog.tsx</file>
    <description>Delete ChangeRoleDialog component as its functionality is merged into EditUserDialog.</description>
    <content><![CDATA[