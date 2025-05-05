'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Placeholder user data type
interface UserData {
  id: string;
  name: string | null;
  email: string | null;
  academicStatus: string | null; // Added
  createdAt: Date | null; // Consider fetching this from Firebase Auth metadata
  status: 'active' | 'inactive'; // Example status
}

// Mock data fetching function - replace with actual Firestore/Auth query
async function fetchUsers(): Promise<UserData[]> {
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate loading
  // In a real app, fetch from Firebase Auth listUsers or Firestore
  return [
    { id: 'user1', name: 'Alice Smith', email: 'alice@example.com', academicStatus: '12th Class', createdAt: new Date(2023, 10, 1), status: 'active' },
    { id: 'user2', name: 'Bob Johnson', email: 'bob@example.com', academicStatus: 'Dropper', createdAt: new Date(2023, 9, 15), status: 'active' },
    { id: 'user3', name: 'Charlie Brown', email: 'charlie@example.com', academicStatus: '11th Class', createdAt: new Date(2024, 0, 5), status: 'inactive' },
    { id: 'user4', name: null, email: 'dave@sample.net', academicStatus: '12th Class', createdAt: new Date(2024, 1, 20), status: 'active' },
    { id: 'user5', name: 'Eve Williams', email: 'eve@mail.org', academicStatus: 'Dropper', createdAt: new Date(2024, 2, 10), status: 'active' },
  ];
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUsers().then(data => {
      setUsers(data);
      setIsLoading(false);
    });
  }, []);

  const filteredUsers = users.filter(user =>
    (user.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
         <div>
            <h1 className="text-3xl font-bold tracking-tight">Manage Users</h1>
            <p className="text-muted-foreground">View and manage platform users.</p>
         </div>
         <Button disabled> {/* TODO: Implement Add User functionality */}
           <PlusCircle className="mr-2 h-4 w-4" /> Add User (Manual)
         </Button>
      </div>

      <Card>
        <CardHeader>
           <div className="flex items-center gap-2">
             <Search className="h-4 w-4 text-muted-foreground" />
             <Input
               placeholder="Search by name or email..."
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
                <TableHead>Academic Status</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name || 'N/A'}</TableCell>
                    <TableCell>{user.email || 'N/A'}</TableCell>
                     <TableCell>{user.academicStatus || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant={user.status === 'active' ? 'default' : 'outline'}
                        className={user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.createdAt ? user.createdAt.toLocaleDateString() : 'N/A'}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem disabled>View Details</DropdownMenuItem>
                          <DropdownMenuItem disabled>Edit User</DropdownMenuItem>
                           <DropdownMenuItem disabled className="text-destructive">
                             {user.status === 'active' ? 'Deactivate' : 'Activate'} User
                           </DropdownMenuItem>
                          <DropdownMenuItem disabled className="text-destructive">Delete User</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter>
          {/* Optional: Add pagination controls */}
          <div className="text-xs text-muted-foreground">
            Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> users
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
