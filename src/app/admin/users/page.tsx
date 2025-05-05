'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Search, Phone } from "lucide-react"; // Added Phone icon
import { Skeleton } from "@/components/ui/skeleton";
import { type UserProfile } from '@/types'; // Import UserProfile type
import fs from 'fs/promises'; // Import fs for reading local file (Server-Side)
import path from 'path';

// --- Data Fetching (Server-Side Recommended, Client-Side Example for users.json) ---
// IMPORTANT: Fetching directly from users.json on the client is NOT secure or scalable.
// This is a demonstration based on the previous request.
// In a real app, fetch from Firestore/Auth on the server-side or via a secure API endpoint.
async function fetchUsersFromClientJson(): Promise<UserProfile[]> {
   console.warn(
    'WARNING: Fetching user data from users.json on the client is insecure and not recommended for production.'
  );
  try {
     // This approach won't work directly on the client due to fs access limitations.
     // We'll simulate it by fetching from a temporary API route or using mock data.
     // For this example, let's return mock data matching UserProfile.
     console.log("Simulating fetch from users.json on client...");
     await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate loading

     // Example mock data based on UserProfile
     return [
      { uid: 'user1', name: 'Alice Smith', email: 'alice@example.com', phoneNumber: '9876543210', academicStatus: '12th Class', createdAt: new Date(2023, 10, 1).toISOString(), status: 'active' },
      { uid: 'user2', name: 'Bob Johnson', email: 'bob@example.com', phoneNumber: '9123456789', academicStatus: 'Dropper', createdAt: new Date(2023, 9, 15).toISOString(), status: 'active' },
      { uid: 'user3', name: 'Charlie Brown', email: 'charlie@example.com', phoneNumber: '9988776655', academicStatus: '11th Class', createdAt: new Date(2024, 0, 5).toISOString(), status: 'inactive' },
      { uid: 'user4', name: null, email: 'dave@sample.net', phoneNumber: null, academicStatus: '12th Class', createdAt: new Date(2024, 1, 20).toISOString(), status: 'active' },
      { uid: 'user5', name: 'Eve Williams', email: 'eve@mail.org', phoneNumber: '9654321098', academicStatus: 'Dropper', createdAt: new Date(2024, 2, 10).toISOString(), status: 'active' },
     ] as any; // Cast to any to bypass status field temporarily

  } catch (error) {
    console.error("Error fetching users (simulated client-side):", error);
    return [];
  }
}


export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Using the insecure client-side fetch for demonstration
    fetchUsersFromClientJson().then(data => {
      setUsers(data);
      setIsLoading(false);
    });
  }, []);

  const filteredUsers = users.filter(user =>
    (user.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (user.phoneNumber?.toLowerCase() || '').includes(searchTerm.toLowerCase()) // Search by phone
  );

   // Helper to safely format date
  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Invalid Date';
    }
  };


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
               placeholder="Search by name, email, or phone..." // Updated placeholder
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
                <TableHead>Phone Number</TableHead> {/* Added Phone Column */}
                <TableHead>Academic Status</TableHead>
                {/* <TableHead>Status</TableHead> */} {/* Temporarily hiding Status if not in UserProfile */}
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
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell> {/* Skeleton for Phone */}
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    {/* <TableCell><Skeleton className="h-5 w-16" /></TableCell> */}
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <TableRow key={user.uid}>
                    <TableCell className="font-medium">{user.name || 'N/A'}</TableCell>
                    <TableCell>{user.email || 'N/A'}</TableCell>
                    <TableCell>
                      {user.phoneNumber ? (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground"/>
                          {user.phoneNumber}
                        </span>
                      ) : (
                        'N/A'
                      )}
                    </TableCell> {/* Display Phone */}
                     <TableCell>{user.academicStatus || 'N/A'}</TableCell>
                   {/*  <TableCell>
                      <Badge variant={user.status === 'active' ? 'default' : 'outline'}
                        className={user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {user.status}
                      </Badge>
                    </TableCell> */}
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
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
                          {/* Deactivate/Activate might need status field */}
                          {/* <DropdownMenuItem disabled className="text-destructive">
                             {user.status === 'active' ? 'Deactivate' : 'Activate'} User
                           </DropdownMenuItem> */}
                          <DropdownMenuItem disabled className="text-destructive">Delete User</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center"> {/* Adjusted colSpan */}
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
