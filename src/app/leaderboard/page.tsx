// src/app/leaderboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Award, Trophy, User } from 'lucide-react';
import type { UserProfile } from '@/types';
import type { UserPoints } from '@/actions/points-actions';
import { getAllUserPoints } from '@/actions/points-actions'; // Action to get all points
import { readUsers } from '@/actions/user-actions'; // Action to get user details

interface LeaderboardEntry extends UserPoints {
    rank: number;
    userProfile?: Omit<UserProfile, 'password'> | null; // Add user profile details
}

export default function LeaderboardPage() {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Fetch all points and all user profiles concurrently
                const [allPoints, allUsers] = await Promise.all([
                    getAllUserPoints(),
                    readUsers() // Fetches users without passwords
                ]);

                // Create a map of userId to userProfile for easy lookup
                const userMap = new Map<string, Omit<UserProfile, 'password'>>(
                    allUsers.map(u => [u.id, u])
                );

                // Sort points descending
                const sortedPoints = allPoints.sort((a, b) => b.totalPoints - a.totalPoints);

                // Combine points with user profile data and assign rank
                const rankedData = sortedPoints.map((pointsEntry, index) => ({
                    ...pointsEntry,
                    rank: index + 1,
                    userProfile: userMap.get(pointsEntry.userId) || null, // Get profile from map
                }));

                setLeaderboard(rankedData);

            } catch (err: any) {
                console.error("Failed to load leaderboard data:", err);
                setError("Could not load the leaderboard. Please try again later.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchLeaderboard();
    }, []);

    const getInitials = (name?: string | null, email?: string | null) => {
        if (name) return name.charAt(0).toUpperCase();
        if (email) return email.charAt(0).toUpperCase();
        return <User className="h-4 w-4"/>;
    }


    return (
        <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
            <div className="text-center">
                <Trophy className="h-12 w-12 text-yellow-500 mx-auto mb-2" />
                <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
                <p className="text-muted-foreground">See how you rank against other students based on points earned!</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Top Students</CardTitle>
                    <CardDescription>Ranking based on total points accumulated from tests and DPPs.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : error ? (
                         <div className="text-center py-10 text-destructive flex flex-col items-center gap-2">
                            <AlertTriangle className="h-8 w-8"/>
                            <p>{error}</p>
                         </div>
                    ) : leaderboard.length === 0 ? (
                         <div className="text-center py-10 text-muted-foreground">
                             No ranking data available yet. Start taking tests!
                         </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[60px] text-center">Rank</TableHead>
                                    <TableHead>User</TableHead>
                                    <TableHead className="text-right">Total Points</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {leaderboard.map((entry) => {
                                    const avatarSrc = entry.userProfile?.avatarUrl ? `/avatars/${entry.userProfile.avatarUrl}` : `https://avatar.vercel.sh/${entry.userProfile?.email || entry.userId}.png`;
                                    return (
                                        <TableRow key={entry.userId}>
                                            <TableCell className="font-medium text-center">
                                                {entry.rank === 1 && <Award className="h-4 w-4 inline text-yellow-500 mr-1" />}
                                                {entry.rank === 2 && <Award className="h-4 w-4 inline text-gray-400 mr-1" />}
                                                {entry.rank === 3 && <Award className="h-4 w-4 inline text-orange-400 mr-1" />}
                                                {entry.rank}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={avatarSrc} alt={entry.userProfile?.name || 'User'} />
                                                        <AvatarFallback>{getInitials(entry.userProfile?.name, entry.userProfile?.email)}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-medium text-sm truncate">{entry.userProfile?.name || 'Anonymous User'}</p>
                                                        <p className="text-xs text-muted-foreground truncate">{entry.userProfile?.email || 'No Email'}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-semibold text-lg">{entry.totalPoints}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
