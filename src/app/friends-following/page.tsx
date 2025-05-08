'use client';

import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Search, UserCheck, Loader2, AlertCircle, ArrowLeft, MinusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { readUsers } from '@/actions/user-actions';
import { getFollowData, unfollowUser } from '@/actions/follow-actions';
import { useAuth } from '@/context/auth-context';
import type { UserProfile, UserFollows } from '@/types';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
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

export default function FollowingPage() {
  const { user, loading: authLoading } = useAuth();
  const [followingProfiles, setFollowingProfiles] = useState<Omit<UserProfile, 'password'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({}); // Track loading state per user ID
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !user.id) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const [allUsersData, followData] = await Promise.all([
          readUsers(),
          getFollowData(user.id),
        ]);

        const followingIds = followData?.following || [];
        const profiles = allUsersData.filter(u => followingIds.includes(u.id));
        setFollowingProfiles(profiles);

      } catch (error) {
        console.error("Failed to load following list:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load the list of users you follow." });
      } finally {
        setIsLoading(false);
      }
    };
     if (!authLoading) {
       fetchData();
     }
  }, [user, authLoading, toast]);

  const filteredFollowing = useMemo(() => {
    return followingProfiles.filter(u =>
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [followingProfiles, searchTerm]);

  const handleUnfollow = async (targetUserId: string, targetUserName: string | null) => {
    if (!user?.id) return;
    if (actionLoading[targetUserId]) return;

    setActionLoading(prev => ({ ...prev, [targetUserId]: true }));

    try {
       // Optimistic UI Update
       const originalList = [...followingProfiles];
       setFollowingProfiles(prev => prev.filter(p => p.id !== targetUserId));

      const result = await unfollowUser(user.id, targetUserId);

      if (!result.success) {
        // Revert optimistic update
        setFollowingProfiles(originalList);
        toast({ variant: "destructive", title: "Unfollow Failed", description: result.message || "Could not unfollow user." });
      } else {
        toast({ title: "Unfollowed", description: `You are no longer following ${targetUserName || 'user'}.` });
        // Optimistic update successful, no need to refetch unless necessary
      }
    } catch (error: any) {
      // Revert optimistic update on error
      setFollowingProfiles(prev => {
          const userExists = prev.find(u => u.id === targetUserId);
          if (!userExists) {
              const originalUser = allUsers.find(u => u.id === targetUserId);
              if (originalUser) return [...prev, originalUser];
          }
          return prev;
      });
      toast({ variant: "destructive", title: "Unfollow Failed", description: error.message || "Could not unfollow user." });
    } finally {
      setActionLoading(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  const getInitials = (name?: string | null, email?: string | null) => {
      if (name) return name.charAt(0).toUpperCase();
      if (email) return email.charAt(0).toUpperCase();
      return '?';
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
      <div className="mb-4">
          <Link href="/find-friends" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Back to Find Friends
          </Link>
        </div>
      <h1 className="text-3xl font-bold tracking-tight text-center">Following</h1>
      <p className="text-muted-foreground text-center">Users you are currently following.</p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search following..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Following ({followingProfiles.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || authLoading ? (
             <div className="space-y-4">
               <Skeleton className="h-16 w-full" />
               <Skeleton className="h-16 w-full" />
               <Skeleton className="h-16 w-full" />
             </div>
           ) : filteredFollowing.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
                {searchTerm ? 'No users found matching your search.' : 'You are not following anyone yet.'}
            </p>
           ) : (
            <ul className="space-y-4">
              {filteredFollowing.map((followedUser) => (
                <li key={followedUser.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/30 transition-colors">
                   <div className="flex items-center gap-3">
                     <Avatar className="h-10 w-10">
                       <AvatarImage src={followedUser.avatarUrl ? `/avatars/${followedUser.avatarUrl}` : `https://avatar.vercel.sh/${followedUser.email || followedUser.id}.png`} alt={followedUser.name || 'User'} />
                       <AvatarFallback>{getInitials(followedUser.name, followedUser.email)}</AvatarFallback>
                     </Avatar>
                     <div>
                       <p className="font-medium text-sm">{followedUser.name || 'Anonymous User'}</p>
                       <p className="text-xs text-muted-foreground">{followedUser.email}</p>
                     </div>
                   </div>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={actionLoading[followedUser.id]}
                                className="text-destructive border-destructive hover:bg-destructive/10"
                            >
                                {actionLoading[followedUser.id] ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <><MinusCircle className="mr-1.5 h-4 w-4" /> Unfollow</>
                                )}
                            </Button>
                         </AlertDialogTrigger>
                         <AlertDialogContent>
                             <AlertDialogHeader>
                                 <AlertDialogTitle>Unfollow {followedUser.name || 'User'}?</AlertDialogTitle>
                                 <AlertDialogDescription>
                                     Are you sure you want to stop following {followedUser.name || followedUser.email}?
                                 </AlertDialogDescription>
                             </AlertDialogHeader>
                             <AlertDialogFooter>
                                 <AlertDialogCancel>Cancel</AlertDialogCancel>
                                 <AlertDialogAction
                                     onClick={() => handleUnfollow(followedUser.id, followedUser.name)}
                                     className="bg-destructive hover:bg-destructive/90"
                                     disabled={actionLoading[followedUser.id]}
                                  >
                                     {actionLoading[followedUser.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Unfollow'}
                                 </AlertDialogAction>
                             </AlertDialogFooter>
                         </AlertDialogContent>
                     </AlertDialog>
                </li>
              ))}
            </ul>
           )}
        </CardContent>
      </Card>
    </div>
  );
}
