'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Construction, ArrowLeft, Users, BarChartHorizontal, Loader2, AlertCircle, Trophy, Scale } from "lucide-react";
import { useAuth } from '@/context/auth-context';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getFollowData } from '@/actions/follow-actions';
import { readUsers, getUserById } from '@/actions/user-actions';
import { getAllTestReportsForUser } from '@/actions/test-report-actions';
import { getUserPoints } from '@/actions/points-actions';
import type { UserProfile, UserFollows, TestResultSummary, UserPoints } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

interface ComparisonData {
    userId: string;
    name: string | null;
    avatarUrl?: string | null;
    points: number;
    commonTests: Array<Partial<TestResultSummary> & { friendScore?: number | null }>; // Store user's score and friend's score for common tests
}

export default function FriendsComparePage() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [followingProfiles, setFollowingProfiles] = useState<Omit<UserProfile, 'password'>[]>([]);
    const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
    const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);
    const [currentUserData, setCurrentUserData] = useState<ComparisonData | null>(null);
    const [isComparing, setIsComparing] = useState(false);

    const isPremium = user?.model !== 'free';

    // Fetch following list and their profiles
    useEffect(() => {
        const fetchData = async () => {
            if (!user?.id) {
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
                toast({ variant: "destructive", title: "Error", description: "Could not load your following list." });
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

    const handleFriendSelection = (userId: string, checked: boolean) => {
        setSelectedFriends(prev =>
            checked ? [...prev, userId] : prev.filter(id => id !== userId)
        );
    };

    const handleCompareClick = async () => {
        if (!user?.id || selectedFriends.length === 0) {
            toast({ variant: "destructive", title: "No Friends Selected", description: "Please select at least one friend to compare." });
            return;
        }
        if (!isPremium) {
            toast({ variant: "destructive", title: "Premium Feature", description: "Detailed comparison requires a premium plan." });
            return;
        }

        setIsComparing(true);
        setComparisonData([]);
        setCurrentUserData(null);

        try {
            // Fetch current user's data
            const currentUserPointsPromise = getUserPoints(user.id);
            const currentUserHistoryPromise = getAllTestReportsForUser(user.id);

            // Fetch selected friends' data
            const friendsPointsPromises = selectedFriends.map(id => getUserPoints(id));
            const friendsHistoryPromises = selectedFriends.map(id => getAllTestReportsForUser(id));

            const [currentUserPoints, currentUserHistory, ...friendsData] = await Promise.all([
                 currentUserPointsPromise,
                 currentUserHistoryPromise,
                 ...friendsPointsPromises,
                 ...friendsHistoryPromises
            ]);

             const numFriends = selectedFriends.length;
             const friendsPoints = friendsData.slice(0, numFriends);
             const friendsHistories = friendsData.slice(numFriends);

             // --- Process Current User Data ---
              const currentUserProfile = await getUserById(user.id); // Fetch profile for avatar/name
              setCurrentUserData({
                  userId: user.id,
                  name: currentUserProfile?.name ?? 'You',
                  avatarUrl: currentUserProfile?.avatarUrl,
                  points: currentUserPoints?.totalPoints ?? 0,
                  commonTests: [], // Initialize, will be populated later if needed
              });


             // --- Process Friends' Data & Compare ---
            const friendComparisonResults: ComparisonData[] = [];
             for (let i = 0; i < numFriends; i++) {
                const friendId = selectedFriends[i];
                const friendProfile = followingProfiles.find(f => f.id === friendId); // Get profile from state
                const friendPoints = friendsPoints[i];
                const friendHistory = friendsHistories[i];

                 // Find common tests (basic implementation for now)
                const commonTestCodes = currentUserHistory
                    .map(h => h.testCode)
                    .filter(code => friendHistory.some(fh => fh.testCode === code));

                 // TODO: Implement detailed comparison logic here
                 // For now, just store points and basic info
                 friendComparisonResults.push({
                     userId: friendId,
                     name: friendProfile?.name ?? `User ${friendId.substring(0, 4)}`,
                     avatarUrl: friendProfile?.avatarUrl,
                     points: friendPoints?.totalPoints ?? 0,
                     commonTests: [], // Placeholder for detailed test comparison
                 });
            }

             setComparisonData(friendComparisonResults);


        } catch (error: any) {
             console.error("Comparison failed:", error);
             toast({ variant: "destructive", title: "Comparison Failed", description: error.message || "Could not fetch comparison data." });
        } finally {
            setIsComparing(false);
        }
    };


    const getInitials = (name?: string | null, email?: string | null) => {
        if (name) return name.charAt(0).toUpperCase();
        if (email) return email.charAt(0).toUpperCase();
        return '?';
    }

    if (authLoading || isLoading) {
        return (
            <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
            </div>
        ); // Or a proper loading skeleton
    }

    if (!user) {
        // Redirect handled by AuthContext usually, but good to have a fallback
        return (
             <div className="container mx-auto py-8 px-4 max-w-4xl text-center">
                 <p>Please log in to use this feature.</p>
                 <Button asChild className="mt-4"><Link href="/auth/login?redirect=/friends-compare">Login</Link></Button>
             </div>
         );
    }

    if (!isPremium) {
         return (
            <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6 text-center">
                 <h1 className="text-3xl font-bold tracking-tight">Compare Performance</h1>
                 <Alert variant="default" className="text-left bg-primary/5 border-primary/20 max-w-lg mx-auto">
                   <Scale className="h-4 w-4 text-primary" />
                   <AlertTitle className="text-primary">Premium Feature</AlertTitle>
                   <AlertDescription>
                     Comparing performance with friends requires a premium plan. Upgrade to unlock detailed statistics and challenge features.
                   </AlertDescription>
                    {/* Optional: Add an upgrade button */}
                    <Button size="sm" className="mt-4" disabled>Upgrade Plan (Coming Soon)</Button>
                 </Alert>
            </div>
         );
    }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
       <div className="flex items-center gap-4 mb-4">
          <Link href="/find-friends" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-center flex-grow">Compare Performance</h1>
          <div className="w-8"></div> {/* Spacer */}
        </div>

      <p className="text-muted-foreground text-center">Select friends you follow to compare your performance stats.</p>

       {/* Friend Selection Card */}
      <Card>
        <CardHeader>
            <CardTitle>Select Friends to Compare</CardTitle>
             <CardDescription>Choose up to 5 friends from your following list.</CardDescription>
        </CardHeader>
        <CardContent>
           {followingProfiles.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">You are not following anyone yet. <Link href="/find-friends" className="text-primary underline">Find friends</Link> to compare.</p>
            ) : (
             <ScrollArea className="h-48 border rounded-md p-3">
                 <div className="space-y-2">
                 {followingProfiles.map((friend) => (
                      <div key={friend.id} className="flex items-center space-x-3 p-2 rounded hover:bg-muted/50">
                        <Checkbox
                             id={`friend-${friend.id}`}
                             checked={selectedFriends.includes(friend.id)}
                             onCheckedChange={(checked) => handleFriendSelection(friend.id, !!checked)}
                             disabled={selectedFriends.length >= 5 && !selectedFriends.includes(friend.id)} // Limit selection
                        />
                        <Label htmlFor={`friend-${friend.id}`} className="flex items-center gap-2 text-sm font-normal cursor-pointer flex-grow">
                             <Avatar className="h-6 w-6">
                                <AvatarImage src={friend.avatarUrl ? `/avatars/${friend.avatarUrl}` : `https://avatar.vercel.sh/${friend.email || friend.id}.png`} alt={friend.name || 'User'} />
                                <AvatarFallback>{getInitials(friend.name, friend.email)}</AvatarFallback>
                            </Avatar>
                             <span className="truncate">{friend.name || friend.email}</span>
                         </Label>
                     </div>
                 ))}
                 </div>
             </ScrollArea>
            )}
        </CardContent>
        <CardFooter>
             <Button onClick={handleCompareClick} disabled={selectedFriends.length === 0 || isComparing}>
                 {isComparing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BarChartHorizontal className="mr-2 h-4 w-4" />}
                 Compare Now
             </Button>
         </CardFooter>
      </Card>

       {/* Comparison Results Section */}
        {isComparing && (
             <Card>
                <CardContent className="p-6 flex items-center justify-center text-muted-foreground">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading comparison data...
                </CardContent>
             </Card>
         )}

        {!isComparing && (currentUserData || comparisonData.length > 0) && (
             <Card>
                <CardHeader>
                    <CardTitle>Comparison Results</CardTitle>
                     <CardDescription>Comparing your stats with selected friends.</CardDescription>
                </CardHeader>
                 <CardContent className="space-y-4">
                    {/* Total Points Comparison */}
                    <div className="space-y-2">
                        <h3 className="text-lg font-semibold flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-500"/> Total Points</h3>
                         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                           {currentUserData && (
                                <div className="flex items-center gap-2 p-2 border rounded bg-primary/5">
                                    <Avatar className="h-6 w-6">
                                        <AvatarImage src={currentUserData.avatarUrl ? `/avatars/${currentUserData.avatarUrl}` : `https://avatar.vercel.sh/${user?.email || user?.id}.png`} />
                                        <AvatarFallback>{getInitials(currentUserData.name, user?.email)}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm font-medium flex-grow truncate">{currentUserData.name} (You)</span>
                                    <span className="font-semibold text-primary">{currentUserData.points}</span>
                                </div>
                             )}
                             {comparisonData.map(friendData => (
                                <div key={friendData.userId} className="flex items-center gap-2 p-2 border rounded">
                                     <Avatar className="h-6 w-6">
                                        <AvatarImage src={friendData.avatarUrl ? `/avatars/${friendData.avatarUrl}` : `https://avatar.vercel.sh/${friendData.userId}.png`} />
                                        <AvatarFallback>{getInitials(friendData.name, null)}</AvatarFallback>
                                    </Avatar>
                                     <span className="text-sm font-medium flex-grow truncate">{friendData.name}</span>
                                     <span className="font-semibold">{friendData.points}</span>
                                </div>
                             ))}
                         </div>
                    </div>

                     {/* Common Tests Comparison (Placeholder) */}
                    <div className="space-y-2 pt-4 border-t">
                         <h3 className="text-lg font-semibold flex items-center gap-2"><Scale className="h-5 w-5 text-blue-500"/> Common Tests Performance</h3>
                         <p className="text-sm text-muted-foreground">Detailed comparison of performance on tests taken by everyone selected (Coming Soon).</p>
                         {/* TODO: Add table or list comparing scores/accuracy on common tests */}
                     </div>
                 </CardContent>
             </Card>
        )}

        {/* Placeholder for Challenge Test Creation */}
       <Card className="text-center border-dashed border-amber-500 bg-amber-50 dark:bg-amber-950">
         <CardHeader>
           <div className="mx-auto bg-primary/10 rounded-full p-3 w-fit">
             <Construction className="h-8 w-8 text-primary" />
           </div>
           <CardTitle className="mt-4">Create Challenge Test</CardTitle>
           <CardDescription>Challenge your friends with a custom test!</CardDescription>
         </CardHeader>
         <CardContent>
           <p className="text-muted-foreground mb-4">
             This premium feature allows you to create custom tests (e.g., 20 questions on a specific topic) and invite friends to compete. This feature is currently under development.
           </p>
           <Button disabled>Create Challenge (Coming Soon)</Button>
         </CardContent>
       </Card>
    </div>
  );
}
