'use client';

import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Search, UserPlus, Check, MinusCircle, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { readUsers } from '@/actions/user-actions';
import { getFollowData, followUser, unfollowUser } from '@/actions/follow-actions';
import { useAuth } from '@/context/auth-context';
import type { UserProfile, UserFollows } from '@/types';
import { useToast } from '@/hooks/use-toast';

export default function FindFriendsPage() {
  const { user, loading: authLoading } = useAuth();
  const [allUsers, setAllUsers] = useState<Omit<UserProfile, 'password'>[]>([]);
  const [followData, setFollowData] = useState<UserFollows | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({}); // Track loading state per user ID
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !user.id) {
        setIsLoading(false);
        return; // Don't fetch if user isn't loaded
      }
      setIsLoading(true);
      try {
        const [usersData, follows] = await Promise.all([
          readUsers(),
          getFollowData(user.id),
        ]);
        // Filter out the current user AND admin users
        setAllUsers(usersData.filter(u => u.id !== user.id && u.role !== 'Admin'));
        setFollowData(follows);
      } catch (error) {
        console.error("Failed to load users or follow data:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load user list." });
      } finally {
        setIsLoading(false);
      }
    };
    if (!authLoading && user) {
      fetchData();
    } else if (!authLoading && !user) {
      setIsLoading(false); // Stop loading if user is not logged in
    }
  }, [user, authLoading, toast]);

  const filteredUsers = useMemo(() => {
    // Start with users already filtered to exclude self and admins
    return allUsers.filter(u =>
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) // Keep email search
    );
  }, [allUsers, searchTerm]);

  const isFollowing = (targetUserId: string) => {
    return !!followData?.following.includes(targetUserId);
  };

  const handleFollowToggle = async (targetUserId: string, targetUserName: string | null) => {
    if (!user?.id) {
        toast({ variant: "destructive", title: "Login Required", description: "Please log in to follow users." });
        return;
    }
    if (actionLoading[targetUserId]) return; // Prevent double clicks

    setActionLoading(prev => ({ ...prev, [targetUserId]: true }));

    const currentlyFollowing = isFollowing(targetUserId);
    const action = currentlyFollowing ? unfollowUser : followUser;
    const actionName = currentlyFollowing ? 'unfollow' : 'follow';
    const successMessage = currentlyFollowing ? `Unfollowed ${targetUserName || 'user'}` : `Started following ${targetUserName || 'user'}`;
    const errorMessage = `Could not ${actionName} user.`;

    try {
      // Optimistic UI Update
      setFollowData(prev => {
        if (!prev) return null;
        const currentFollowing = prev.following || [];
        const updatedFollowing = currentlyFollowing
          ? currentFollowing.filter(id => id !== targetUserId)
          : [...currentFollowing, targetUserId];
        return { ...prev, following: updatedFollowing };
      });

      const result = await action(user.id, targetUserId);

      if (!result.success) {
        // Revert optimistic update on failure
        setFollowData(prev => {
            if (!prev) return null;
            const currentFollowing = prev.following || [];
            // Revert back to original state
            const revertedFollowing = currentlyFollowing
                ? [...currentFollowing, targetUserId]
                : currentFollowing.filter(id => id !== targetUserId);
            return { ...prev, following: revertedFollowing };
         });
        toast({ variant: "destructive", title: `${actionName.charAt(0).toUpperCase() + actionName.slice(1)} Failed`, description: result.message || errorMessage });
      } else {
        toast({ title: "Success", description: successMessage });
        // Refetch data to ensure consistency (optional, depending on optimistic update reliability)
        // const updatedFollows = await getFollowData(user.id);
        // setFollowData(updatedFollows);
      }
    } catch (error: any) {
       // Revert optimistic update on error
       setFollowData(prev => {
            if (!prev) return null;
            const currentFollowing = prev.following || [];
            const revertedFollowing = currentlyFollowing
                ? [...currentFollowing, targetUserId]
                : currentFollowing.filter(id => id !== targetUserId);
            return { ...prev, following: revertedFollowing };
         });
      toast({ variant: "destructive", title: `${actionName.charAt(0).toUpperCase() + actionName.slice(1)} Failed`, description: error.message || errorMessage });
    } finally {
      setActionLoading(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

   const getInitials = (name?: string | null, email?: string | null) => {
        if (name) return name.charAt(0).toUpperCase();
        if (email) return email.charAt(0).toUpperCase(); // Still use email for fallback initial
        return '?';
   }


  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-center">Find Friends</h1>
      <p className="text-muted-foreground text-center">Connect with other students on EduNexus.</p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || authLoading ? (
             <div className="space-y-4">
               <Skeleton className="h-16 w-full" />
               <Skeleton className="h-16 w-full" />
               <Skeleton className="h-16 w-full" />
             </div>
           ) : filteredUsers.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
                {searchTerm ? 'No users found matching your search.' : 'No other users found.'}
            </p>
           ) : (
            <ul className="space-y-4">
              {filteredUsers.map((u) => (
                <li key={u.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/30 transition-colors">
                   <div className="flex items-center gap-3">
                     <Avatar className="h-10 w-10">
                       <AvatarImage src={u.avatarUrl ? `/avatars/${u.avatarUrl}` : `https://avatar.vercel.sh/${u.email || u.id}.png`} alt={u.name || 'User'} />
                       <AvatarFallback>{getInitials(u.name, u.email)}</AvatarFallback>
                     </Avatar>
                     <div>
                       <p className="font-medium text-sm">{u.name || 'Anonymous User'}</p>
                       {/* <p className="text-xs text-muted-foreground">{u.email}</p> Removed email display */}
                       {/* Optionally show class/model if available */}
                       <p className="text-xs text-muted-foreground">{u.class || ''} {u.model ? `(${u.model})` : ''}</p>
                     </div>
                   </div>
                   <Button
                     variant={isFollowing(u.id) ? 'outline' : 'default'}
                     size="sm"
                     onClick={() => handleFollowToggle(u.id, u.name)}
                     disabled={actionLoading[u.id]}
                   >
                     {actionLoading[u.id] ? (
                       <Loader2 className="h-4 w-4 animate-spin" />
                     ) : isFollowing(u.id) ? (
                       <><MinusCircle className="mr-1.5 h-4 w-4" /> Unfollow</>
                     ) : (
                       <><UserPlus className="mr-1.5 h-4 w-4" /> Follow</>
                     )}
                   </Button>
                </li>
              ))}
            </ul>
           )}
        </CardContent>
      </Card>
    </div>
  );
}
