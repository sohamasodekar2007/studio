// src/app/admin/users/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Search, Phone, Trash2, Edit, KeyRound, UserCheck, User, Shield, Loader2 } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import type { UserProfile, UserModel, AcademicStatus } from '@/types';
import { readUsers, deleteUserFromJson, updateUserRole } from '@/actions/user-actions';
import { useToast } from '@/hooks/use-toast';
import EditUserDialog from '@/components/admin/edit-user-dialog';
import ResetPasswordDialog from '@/components/admin/reset-password-dialog';
import AddUserDialog from '@/components/admin/add-user-dialog';
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
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/context/auth-context';

const primaryAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@edunexus.com';
const adminEmailPattern = /^[a-zA-Z0-9._%+-]+-admin@edunexus\.com$/;

type UserProfileWithRole = Omit<UserProfile, 'password'>;


export default function AdminUsersPage() {
  const { toast } = useToast();
  const { user: adminUser, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserProfileWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isChangingRole, setIsChangingRole] = useState<string | null>(null);

  const [dialogState, setDialogState] = useState<{
    type: 'edit' | 'reset' | 'add' | 'changeRole' | null;
    user: UserProfileWithRole | null;
  }>({ type: null, user: null });


  const fetchAllUsers = useCallback(() => {
     setIsLoading(true);
     readUsers()
      .then(data => {
        setUsers(data as UserProfileWithRole[]);
      })
      .catch(error => {
        console.error("Failed to fetch users:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load users." });
        setUsers([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [toast]);


  useEffect(() => {
    fetchAllUsers();
  }, [fetchAllUsers]);

  const filteredUsers = useMemo(() => {
    return users.filter(user =>
        (user.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (user.phone?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (user.model?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (user.role?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (user.class?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (user.targetYear?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return 'Invalid Date'; }
  };

   const handleDeleteUser = async (userId: string) => {
       setIsDeleting(userId);
       try {
           const userToDelete = users.find(u => u.id === userId);
            if (userToDelete?.email === primaryAdminEmail) {
                 toast({ variant: "destructive", title: "Action Denied", description: "Cannot delete the primary admin account." });
                 setIsDeleting(null);
                 return;
            }

           const result = await deleteUserFromJson(userId);
           if (!result.success) {
               toast({ variant: "destructive", title: "Delete Failed", description: result.message });
           } else {
               toast({ title: "User Deleted", description: "User has been successfully removed." });
               setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
           }
       } catch (error: any) {
           console.error("Failed to delete user:", error);
           toast({ variant: "destructive", title: "Error", description: "Could not delete user." });
       } finally {
           setIsDeleting(null);
       }
   };

    const handleRoleChangeSubmit = async (userId: string, newRole: 'Admin' | 'User') => {
        setIsChangingRole(userId);
        try {
             const userToChange = users.find(u => u.id === userId);
             if (userToChange?.email === primaryAdminEmail) {
                 toast({ variant: "destructive", title: "Action Denied", description: "Cannot change the role of the primary admin account." });
                 setIsChangingRole(null);
                 closeDialog();
                 return;
             }
            // Additional validation on email format for role change
            const emailLower = userToChange?.email?.toLowerCase() || '';
            if (newRole === 'Admin' && emailLower !== primaryAdminEmail.toLowerCase() && !adminEmailPattern.test(emailLower)) {
                 toast({ variant: "destructive", title: "Role Change Failed", description: `Cannot promote to Admin. Email '${userToChange?.email}' does not follow admin pattern ('username-admin@edunexus.com' or primary admin).` });
                 setIsChangingRole(null);
                 closeDialog();
                 return;
            }
            if (newRole === 'User' && (emailLower === primaryAdminEmail.toLowerCase() || adminEmailPattern.test(emailLower))) {
                 toast({ variant: "destructive", title: "Role Change Failed", description: `Cannot demote to User. Email format '${userToChange?.email}' is reserved for Admins.`});
                 setIsChangingRole(null);
                 closeDialog();
                 return;
            }

            const result = await updateUserRole(userId, newRole);
            if (result.success && result.user) {
                 toast({ title: "Role Updated", description: `User role changed to ${newRole}.` });
                 setUsers(prevUsers =>
                    prevUsers.map(u => (u.id === userId ? result.user as UserProfileWithRole : u))
                 );
            } else {
                throw new Error(result.message || `Failed to change role to ${newRole}.`);
            }
        } catch (error: any) {
             console.error("Failed to change role:", error);
             toast({ variant: "destructive", title: "Role Change Failed", description: error.message });
        } finally {
            setIsChangingRole(null);
            closeDialog();
        }
    };

   const handleUserUpdate = (updatedUser: UserProfileWithRole) => {
        setUsers(prevUsers =>
            prevUsers.map(u => (u.id === updatedUser.id ? updatedUser : u))
        );
        closeDialog();
    };

   const handleUserAdded = (newUser: UserProfileWithRole) => {
       setUsers(prevUsers => [newUser, ...prevUsers].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
       closeDialog();
   }

   const openEditDialog = (user: UserProfileWithRole) => setDialogState({ type: 'edit', user });
   const openResetDialog = (user: UserProfileWithRole) => setDialogState({ type: 'reset', user });
   const openAddDialog = () => setDialogState({ type: 'add', user: null });
   const openChangeRoleDialog = (user: UserProfileWithRole) => setDialogState({ type: 'changeRole', user });
   const closeDialog = () => setDialogState({ type: null, user: null });

   const getInitials = (name?: string | null, email?: string | null) => {
        if (name) return name.charAt(0).toUpperCase();
        if (email) return email.charAt(0).toUpperCase();
        return <User className="h-4 w-4"/>;
   }

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
         <div><h1 className="text-3xl font-bold tracking-tight">Manage Users</h1><p className="text-muted-foreground">View, create, edit, or delete platform users.</p></div>
         <Button onClick={openAddDialog}><PlusCircle className="mr-2 h-4 w-4" /> Add New User</Button>
      </div>
      <Card>
        <CardHeader><div className="flex items-center gap-2"><Search className="h-4 w-4 text-muted-foreground" /><Input placeholder="Search by name, email, phone, model, role..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm" /></div></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Avatar</TableHead><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Role</TableHead><TableHead>Model</TableHead><TableHead>Academic Status</TableHead><TableHead>Target Year</TableHead><TableHead>Expiry</TableHead><TableHead>Created At</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell><TableCell><Skeleton className="h-5 w-40" /></TableCell><TableCell><Skeleton className="h-5 w-28" /></TableCell><TableCell><Skeleton className="h-5 w-16" /></TableCell><TableCell><Skeleton className="h-5 w-20" /></TableCell><TableCell><Skeleton className="h-5 w-24" /></TableCell><TableCell><Skeleton className="h-5 w-16" /></TableCell><TableCell><Skeleton className="h-5 w-24" /></TableCell><TableCell><Skeleton className="h-5 w-24" /></TableCell><TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => {
                  const isCurrentUserPrimaryAdmin = user.email === primaryAdminEmail;
                  const avatarSrc = user.avatarUrl ? `/avatars/${user.avatarUrl}` : `https://avatar.vercel.sh/${user.email || user.id}.png?size=40`;
                    return (
                    <TableRow key={user.id}>
                      <TableCell><Avatar className="h-8 w-8"><AvatarImage src={avatarSrc} alt={user.name || 'User'} /><AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback></Avatar></TableCell>
                      <TableCell className="font-medium">{user.name || 'N/A'} {isCurrentUserPrimaryAdmin ? '(Primary)' : ''}</TableCell>
                      <TableCell>{user.email || 'N/A'}</TableCell>
                      <TableCell>{user.phone ? (<span className="flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground"/>{user.phone}</span>) : ('N/A')}</TableCell>
                      <TableCell><Badge variant={user.role === 'Admin' ? 'destructive' : 'secondary'}>{user.role}</Badge></TableCell>
                      <TableCell className="capitalize">{user.model || 'N/A'}</TableCell>
                      <TableCell>{user.class || 'N/A'}</TableCell>
                      <TableCell>{user.targetYear || 'N/A'}</TableCell>
                      <TableCell>{formatDate(user.expiry_date)}</TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>User Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openEditDialog(user)}><Edit className="mr-2 h-4 w-4" /> Edit Details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openResetDialog(user)} disabled={isCurrentUserPrimaryAdmin}><KeyRound className="mr-2 h-4 w-4" /> Reset Password</DropdownMenuItem>
                            {!isCurrentUserPrimaryAdmin && (<DropdownMenuItem onClick={() => openChangeRoleDialog(user)} disabled={isChangingRole === user.id}>{isChangingRole === user.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />} Change Role</DropdownMenuItem>)}
                            <DropdownMenuSeparator />
                            <AlertDialog><AlertDialogTrigger asChild>
                                  <Button variant="ghost" className="w-full justify-start px-2 py-1.5 text-sm text-destructive focus:text-destructive focus:bg-destructive/10 hover:bg-destructive/10 hover:text-destructive" disabled={isCurrentUserPrimaryAdmin || !!isDeleting}>{isDeleting === user.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Delete User</Button>
                              </AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the user account for <span className="font-semibold">{user.email}</span> and remove their data.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-destructive hover:bg-destructive/90">Yes, delete user</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )})
                ) : (
                  <TableRow><TableCell colSpan={11} className="h-24 text-center">No users found matching your criteria.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter><div className="text-xs text-muted-foreground">Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> users</div></CardFooter>
      </Card>
      {dialogState.type === 'edit' && dialogState.user && (<EditUserDialog user={dialogState.user} isOpen={dialogState.type === 'edit'} onClose={closeDialog} onUserUpdate={handleUserUpdate}/>)}
      {dialogState.type === 'reset' && dialogState.user && (<ResetPasswordDialog user={dialogState.user} isOpen={dialogState.type === 'reset'} onClose={closeDialog}/>)}
      {dialogState.type === 'add' && (<AddUserDialog isOpen={dialogState.type === 'add'} onClose={closeDialog} onUserAdded={handleUserAdded}/>)}
      {dialogState.type === 'changeRole' && dialogState.user && (<ChangeRoleDialog user={dialogState.user} isOpen={dialogState.type === 'changeRole'} onClose={closeDialog} onRoleChange={handleRoleChangeSubmit} isLoading={isChangingRole === dialogState.user.id} />)}
    </div>
  );
}
