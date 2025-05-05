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
import { type UserProfile } from '@/types';
// Import the action to read users from JSON
import { readUsers, deleteUserFromJson } from '@/actions/user-actions'; // Import read and delete actions
import { useToast } from '@/hooks/use-toast';

// Remove client-side mock fetch

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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
  }, []);

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

   // Handle User Deletion
   const handleDeleteUser = async (userId: string | number) => {
       // Optional: Add confirmation dialog here

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
       }
   };


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
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
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
                       <Badge variant={(user as any).role === 'Admin' ? 'destructive' : 'secondary'}>
                         {(user as any).role || 'User'}
                       </Badge>
                     </TableCell>
                      <TableCell className="capitalize">{user.model || 'N/A'}</TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>User Actions</DropdownMenuLabel>
                          {/* TODO: Link Edit User button to an editing form/modal */}
                          <DropdownMenuItem disabled>
                             <Edit className="mr-2 h-4 w-4" /> Edit User
                          </DropdownMenuItem>
                          {/* TODO: Implement Password Reset Functionality */}
                          <DropdownMenuItem disabled>
                             <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                           </DropdownMenuItem>
                           {/* TODO: Implement Role Change Functionality (if needed) */}
                           <DropdownMenuItem disabled>
                             <UserCheck className="mr-2 h-4 w-4" /> Change Role
                           </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={(user as any).role === 'Admin'} // Prevent deleting the admin for safety
                            >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    No users found.
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
    </div>
  );
}
