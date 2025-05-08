'use client';

import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Search, UserCheck, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { readUsers } from '@/actions/user-actions';
import { getFollowData } from '@/actions/follow-actions';
import { useAuth } from '@/context/auth-context';
import type { UserProfile, UserFollows } from '@/types';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function FollowersPage() {
  const { user, loading: authLoading } = useAuth();
  const [followersProfiles, setFollowersProfiles] = useState<Omit<UserProfile, 'password'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
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

        const followerIds = followData?.followers || [];
        // Filter profiles AND exclude admins
        const profiles = allUsersData.filter(u => followerIds.includes(u.id) && u.role !== 'Admin');
        setFollowersProfiles(profiles);

      } catch (error) {
        console.error("Failed to load followers:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load your followers list." });
      } finally {
        setIsLoading(false);
      }
    };
     if (!authLoading && user) {
       fetchData();
     } else if (!authLoading && !user){
         setIsLoading(false); // Stop loading if no user
     }
  }, [user, authLoading, toast]);

  const filteredFollowers = useMemo(() => {
    // Already filtered for non-admins in useEffect
    return followersProfiles.filter(u =>
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [followersProfiles, searchTerm]);

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
      <h1 className="text-3xl font-bold tracking-tight text-center">Followers</h1>
      <p className="text-muted-foreground text-center">Users who are following you.</p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search followers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Followers ({followersProfiles.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || authLoading ? (
             <div className="space-y-4">
               <Skeleton className="h-16 w-full" />
               <Skeleton className="h-16 w-full" />
               <Skeleton className="h-16 w-full" />
             </div>
           ) : filteredFollowers.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
                {searchTerm ? 'No followers found matching your search.' : 'You don\'t have any followers yet.'}
            </p>
           ) : (
            <ul className="space-y-4">
              {filteredFollowers.map((follower) => (
                <li key={follower.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/30 transition-colors">
                   <div className="flex items-center gap-3">
                     <Avatar className="h-10 w-10">
                       <AvatarImage src={follower.avatarUrl ? `/avatars/${follower.avatarUrl}` : `https://avatar.vercel.sh/${follower.email || follower.id}.png`} alt={follower.name || 'User'} />
                       <AvatarFallback>{getInitials(follower.name, follower.email)}</AvatarFallback>
                     </Avatar>
                     <div>
                       <p className="font-medium text-sm">{follower.name || 'Anonymous User'}</p>
                       <p className="text-xs text-muted-foreground">{follower.email}</p>
                       <p className="text-xs text-muted-foreground">{follower.class || ''} {follower.model ? `(${follower.model})` : ''}</p>
                     </div>
                   </div>
                   {/* Optionally add a button to view their profile or history later */}
                   {/* <Button variant="outline" size="sm">View Profile</Button> */}
                </li>
              ))}
            </ul>
           )}
        </CardContent>
      </Card>
    </div>
  );
}
