// src/app/admin/users/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Search, Phone, Trash2, Edit, KeyRound, User, ShieldCheck, Loader2, Users as UsersIcon, CalendarDays, ShoppingBag, Target } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import type { UserProfile, UserModel, AcademicStatus, ContextUser } from '@/types'; 
import { readUsers, deleteUserFromJson, updateUserRole } from '@/actions/user-actions';
import { useAuth } from '@/context/auth-context';
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
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import UserListItem from '@/components/admin/user-list-item'; // Import the new component

const primaryAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@edunexus.com';
const adminEmailPattern = /^[a-zA-Z0-9._%+-]+-admin@edunexus\.com$/;

type DisplayUserProfile = Omit<UserProfile, 'password'>;


export default function AdminUsersPage() {
  const { toast } = useToast();
  const { user: adminUser, loading: authLoading, logout: contextLogout } = useAuth();
  const [users, setUsers] = useState<DisplayUserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isChangingRole, setIsChangingRole] = useState<string | null>(null);

  const [dialogState, setDialogState] = useState<{
    type: 'edit' | 'reset' | 'add' | 'changeRole' | null;
    user: DisplayUserProfile | null; 
  }>({ type: null, user: null });


  const fetchAllUsers = useCallback(async () => {
     setIsLoading(true);
     try {
        const data = await readUsers(); 
        setUsers(data);
     } catch (error) {
        console.error("Failed to fetch users:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load users." });
        setUsers([]);
     } finally {
        setIsLoading(false);
     }
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
            if (userToDelete?.email?.toLowerCase() === primaryAdminEmail.toLowerCase()) {
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
             if (!userToChange) {
                toast({ variant: "destructive", title: "Error", description: "User not found." });
                setIsChangingRole(null); 
                return;
             }
             if (userToChange.email?.toLowerCase() === primaryAdminEmail.toLowerCase() && newRole === 'User') {
                 toast({ variant: "destructive", title: "Action Denied", description: "Cannot change the role of the primary admin account." });
                 setIsChangingRole(null);
                 return;
             }
            
            const emailLower = userToChange.email?.toLowerCase() || '';
            if (newRole === 'Admin' && emailLower !== primaryAdminEmail.toLowerCase() && !adminEmailPattern.test(emailLower)) {
                 toast({ variant: "destructive", title: "Role Change Failed", description: `Cannot promote to Admin. Email '${userToChange.email}' does not follow admin pattern ('username-admin@edunexus.com' or be the primary admin).` });
                 setIsChangingRole(null); 
                 return;
            }
             if (newRole === 'User' && adminEmailPattern.test(emailLower) && emailLower !== primaryAdminEmail.toLowerCase()) {
                toast({ variant: "destructive", title: "Role Change Failed", description: "Cannot demote to User. Email format is for Admins. Change email first if intended."});
                setIsChangingRole(null);
                return;
            }

            const result = await updateUserRole(userId, newRole);
            if (result.success && result.user) {
                 toast({ title: "Role Updated", description: `User role changed to ${newRole}.` });
                 const updatedUserWithPassword = result.user as DisplayUserProfile;
                 setUsers(prevUsers =>
                    prevUsers.map(u => (u.id === userId ? updatedUserWithPassword : u))
                 );
                 if (adminUser?.id === userId && newRole === 'User') {
                    await contextLogout("Your role has been changed. Please log in again.");
                 }
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

   const handleUserUpdate = (updatedUser: DisplayUserProfile) => {
        setUsers(prevUsers =>
            prevUsers.map(u => (u.id === updatedUser.id ? updatedUser : u))
        );
        closeDialog();
    };

   const handleUserAdded = (newUser: DisplayUserProfile) => { 
       setUsers(prevUsers => [newUser, ...prevUsers].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
       closeDialog();
   }

   const openEditDialog = (user: DisplayUserProfile) => setDialogState({ type: 'edit', user });
   const openResetDialog = (user: DisplayUserProfile) => setDialogState({ type: 'reset', user });
   const openAddDialog = () => setDialogState({ type: 'add', user: null });
   const openChangeRoleDialog = (user: DisplayUserProfile) => setDialogState({ type: 'changeRole', user });
   const closeDialog = () => setDialogState({ type: null, user: null });

   const getInitials = (name?: string | null, email?: string | null) => {
        if (name) return name.charAt(0).toUpperCase();
        if (email) return email?.charAt(0).toUpperCase();
        return <UserIcon className="h-4 w-4"/>;
   }

  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
         <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Manage Users</h1>
            <p className="text-sm text-muted-foreground">View, create, edit, or delete platform users.</p>
         </div>
         <div className="flex w-full sm:w-auto gap-2">
            <div className="relative flex-grow sm:flex-grow-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search users..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-full sm:max-w-xs" />
            </div>
            <Button onClick={openAddDialog} className="flex-shrink-0">
                <PlusCircle className="mr-2 h-4 w-4" /> Add User
            </Button>
         </div>
      </div>
      
      {/* Mobile/Tablet Card View */}
      <div className="sm:hidden space-y-4">
        {isLoading || authLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
                <Card key={`skel-card-${index}`} className="p-4"><Skeleton className="h-24 w-full" /></Card>
            ))
        ) : filteredUsers.length > 0 ? (
            filteredUsers.map((u) => (
                <UserListItem
                    key={u.id}
                    user={u}
                    isDeleting={isDeleting}
                    isChangingRole={isChangingRole}
                    adminUserEmail={primaryAdminEmail}
                    onEdit={openEditDialog}
                    onResetPassword={openResetDialog}
                    onChangeRole={openChangeRoleDialog}
                    onDelete={handleDeleteUser}
                    getInitials={getInitials}
                    formatDate={formatDate}
                />
            ))
        ) : (
            <Card><CardContent className="p-6 text-center text-muted-foreground">No users found matching your criteria.</CardContent></Card>
        )}
      </div>

      {/* Desktop Table View */}
      <Card className="hidden sm:block">
        <CardHeader>
            <CardTitle>User Accounts</CardTitle>
            <CardDescription>Detailed list of all registered users.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Avatar</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden lg:table-cell">Model</TableHead>
                  <TableHead className="hidden xl:table-cell">Class</TableHead>
                  <TableHead className="hidden xl:table-cell">Target Year</TableHead>
                  <TableHead className="hidden lg:table-cell">Expiry</TableHead>
                  <TableHead className="hidden md:table-cell">Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading || authLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell className="hidden xl:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell className="hidden xl:table-cell"><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((u) => { 
                  const isCurrentUserPrimaryAdmin = u.email?.toLowerCase() === primaryAdminEmail.toLowerCase();
                  const avatarSrc = u.avatarUrl ? `/avatars/${u.avatarUrl}` : (u.email ? `https://avatar.vercel.sh/${u.email}.png?size=40` : undefined);
                    return (
                    <TableRow key={u.id}>
                      <TableCell><Avatar className="h-8 w-8"><AvatarImage src={avatarSrc} alt={u.name || 'User'} /><AvatarFallback>{getInitials(u.name, u.email)}</AvatarFallback></Avatar></TableCell>
                      <TableCell className="font-medium">{u.name || 'N/A'} {isCurrentUserPrimaryAdmin ? <Badge variant="outline" className="ml-1 text-xs border-destructive text-destructive">Primary</Badge> : ''}</TableCell>
                      <TableCell>{u.email || 'N/A'}</TableCell>
                      <TableCell className="hidden md:table-cell">{u.phone || 'N/A'}</TableCell>
                      <TableCell><Badge variant={u.role === 'Admin' ? 'destructive' : 'secondary'} className="text-xs">{u.role}</Badge></TableCell>
                      <TableCell className="capitalize hidden lg:table-cell">{u.model || 'N/A'}</TableCell>
                      <TableCell className="hidden xl:table-cell">{u.class || 'N/A'}</TableCell>
                      <TableCell className="hidden xl:table-cell">{u.targetYear || 'N/A'}</TableCell>
                      <TableCell className="hidden lg:table-cell">{formatDate(u.expiry_date)}</TableCell>
                      <TableCell className="hidden md:table-cell">{formatDate(u.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">User Actions</span></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openEditDialog(u)}><Edit className="mr-2 h-4 w-4" /> Edit Details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openResetDialog(u)} disabled={isCurrentUserPrimaryAdmin}><KeyRound className="mr-2 h-4 w-4" /> Reset Password</DropdownMenuItem>
                            {!isCurrentUserPrimaryAdmin && (<DropdownMenuItem onClick={() => openChangeRoleDialog(u)} disabled={isChangingRole === u.id}>{isChangingRole === u.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />} Change Role</DropdownMenuItem>)}
                            <DropdownMenuSeparator />
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" className="w-full justify-start px-2 py-1.5 text-sm text-destructive focus:text-destructive focus:bg-destructive/10 hover:bg-destructive/10 hover:text-destructive relative flex cursor-default select-none items-center rounded-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50" disabled={isCurrentUserPrimaryAdmin || !!isDeleting}>
                                      {isDeleting === u.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Delete User
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the user account for <span className="font-semibold">{u.email}</span> and remove their data.</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteUser(u.id)} className="bg-destructive hover:bg-destructive/90">Yes, delete user</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
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
