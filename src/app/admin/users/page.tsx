'use client';

import { useState, useEffect, useMemo } from 'react';
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
import ChangeRoleDialog from '@/components/admin/change-role-dialog';
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


export default function AdminUsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false); // State for delete confirmation

  // State for managing dialogs
  const [dialogState, setDialogState] = useState<{
    type: 'edit' | 'reset' | 'role' | null;
    user: UserProfile | null;
  }>({ type: null, user: null });

  const fetchAllUsers = () => {
     setIsLoading(true);
     readUsers()
      .then(data => {
        // Assign a default role for display if missing (adjust based on actual logic)
        const usersWithRoles = data.map(u => ({
            ...u,
            // Example: Assign 'Admin' role based on email, 'User' otherwise
            role: u.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL ? 'Admin' : 'User'
        }));
        setUsers(usersWithRoles as UserProfile[]); // Cast back if needed, or update UserProfile type
      })
      .catch(error => {
        console.error("Failed to fetch users:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load users." });
        setUsers([]); // Set to empty on error
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  useEffect(() => {
    fetchAllUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only fetch on initial mount

  const filteredUsers = useMemo(() => {
    return users.filter(user =>
        (user.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (user.phone?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (user.model?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || // Search by model
        ((user as any).role?.toLowerCase() || '').includes(searchTerm.toLowerCase()) // Search by role (adjust type if needed)
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
           const result = await deleteUserFromJson(userId);
           if (!result.success) {
               setUsers(originalUsers); // Revert
               toast({ variant: "destructive", title: "Delete Failed", description: result.message });
           } else {
               toast({ title: "User Deleted", description: "User has been successfully removed." });
               // No need to re-fetch, optimistic update succeeded
           }
       } catch (error) {
           console.error("Failed to delete user:", error);
           setUsers(originalUsers); // Revert
           toast({ variant: "destructive", title: "Error", description: "Could not delete user." });
       } finally {
           setIsDeleting(false); // Reset deletion state
       }
   };

   // Function to handle updates from dialogs
   const handleUserUpdate = (updatedUser: UserProfile) => {
     // Re-assign role based on email after potential update
     const role = updatedUser.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL ? 'Admin' : 'User';
     setUsers(prevUsers =>
       prevUsers.map(u => (u.id === updatedUser.id ? { ...u, ...updatedUser, role } : u))
     );
     closeDialog();
   };

   // Dialog handlers
   const openEditDialog = (user: UserProfile) => setDialogState({ type: 'edit', user });
   const openResetDialog = (user: UserProfile) => setDialogState({ type: 'reset', user });
   const openRoleDialog = (user: UserProfile) => setDialogState({ type: 'role', user });
   const closeDialog = () => setDialogState({ type: null, user: null });


  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
         <div>
            <h1 className="text-3xl font-bold tracking-tight">Manage Users</h1>
            <p className="text-muted-foreground">View, create, edit, or delete platform users.</p>
         </div>
         {/* TODO: Link Add User button to a creation form/modal */}
         <Button disabled>
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
                 const isCurrentUserAdmin = (user as any).role === 'Admin';
                  return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name || 'N/A'}</TableCell>
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
                       <Badge variant={isCurrentUserAdmin ? 'destructive' : 'secondary'}>
                         {(user as any).role || 'User'}
                       </Badge>
                     </TableCell>
                      <TableCell className="capitalize">{user.model || 'N/A'}</TableCell>
                       <TableCell>{formatDate(user.expiry_date)}</TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost" disabled={isCurrentUserAdmin}>
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>User Actions</DropdownMenuLabel>
                           {/* Enable buttons and add onClick handlers */}
                          <DropdownMenuItem onClick={() => openEditDialog(user)} disabled={isCurrentUserAdmin}>
                             <Edit className="mr-2 h-4 w-4" /> Edit User
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openResetDialog(user)} disabled={isCurrentUserAdmin}>
                             <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => openRoleDialog(user)} disabled={isCurrentUserAdmin}>
                             <UserCheck className="mr-2 h-4 w-4" /> Change Role/Plan
                           </DropdownMenuItem>
                          <DropdownMenuSeparator />
                           {/* Delete Confirmation Dialog Trigger */}
                           <AlertDialog>
                             <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="w-full justify-start px-2 py-1.5 text-sm text-destructive focus:text-destructive focus:bg-destructive/10 hover:bg-destructive/10 hover:text-destructive"
                                  disabled={isCurrentUserAdmin || isDeleting} // Disable if admin or already deleting
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
                  <TableCell colSpan={8} className="h-24 text-center">
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
          onUserUpdate={handleUserUpdate}
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
      {dialogState.type === 'role' && dialogState.user && (
        <ChangeRoleDialog
          user={dialogState.user}
          isOpen={dialogState.type === 'role'}
          onClose={closeDialog}
          onUserUpdate={handleUserUpdate} // Role/Plan change also updates user data
        />
      )}

    </div>
  );
}
