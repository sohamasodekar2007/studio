// src/app/profile/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings, ArrowLeft, DollarSign, CalendarCheck2, Target, HelpCircle, CheckCircle, Activity, ChevronRight, Trophy, Check } from 'lucide-react';
import Link from 'next/link';
import { getUserPoints, type UserPoints } from '@/actions/points-actions'; // Action to get points
import { getAllTestReportsForUser } from '@/actions/test-report-actions';
import type { TestResultSummary } from '@/types';


const getDayOfWeek = (dateIndex: number): string => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days[dateIndex % 7];
}

const getDateOfMonth = (dateIndex: number): number => {
   // Simple example: assumes the week starts on the 5th of the month
   return 5 + dateIndex;
}


export default function ProfilePage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [userPoints, setUserPoints] = useState<UserPoints | null>(null);
    const [isLoadingPoints, setIsLoadingPoints] = useState(true);
    const [recentTests, setRecentTests] = useState<Partial<TestResultSummary>[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);

    // Fetch Points
    useEffect(() => {
        if (user?.id) {
            setIsLoadingPoints(true);
            getUserPoints(user.id)
                .then(data => setUserPoints(data))
                .catch(err => console.error("Failed to load points:", err))
                .finally(() => setIsLoadingPoints(false));
        }
    }, [user?.id]);

    // Fetch Recent Test History (e.g., last 5)
    useEffect(() => {
        if (user?.id) {
            setIsLoadingHistory(true);
            getAllTestReportsForUser(user.id)
                .then(history => setRecentTests(history.slice(0, 5))) // Get last 5 attempts
                .catch(err => console.error("Failed to load test history:", err))
                .finally(() => setIsLoadingHistory(false));
        }
    }, [user?.id]);


    if (authLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-1/4" />
                <Skeleton className="h-6 w-1/2" />
                <Card><CardContent className="p-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
                <Card><CardContent className="p-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
                <Card><CardContent className="p-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
            </div>
        );
    }

    if (!user) {
        router.push('/auth/login?redirect=/profile');
        return null; // Or a loading state while redirecting
    }

    const targetYearDisplay = user.targetYear || 'N/A'; // Display user's target year
    const totalPoints = userPoints?.totalPoints ?? 0;

    // Placeholder data for weekly activity
    const weeklyStats = {
        questionsSolved: 4, // Placeholder
        correctQuestions: 1, // Placeholder
        accuracy: 25, // Placeholder
        challengesTaken: recentTests.length || 0, // Use actual test count if available
    };
     const dailyGoalProgress = 0; // Placeholder
     const dailyGoalTotal = 10; // Placeholder

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
             {/* Header Section */}
             <div className="flex justify-between items-center mb-4">
                 <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                 </Button>
                <h1 className="text-xl font-semibold">My Profile</h1>
                 <Link href="/settings" passHref>
                    <Button variant="ghost" size="icon">
                        <Settings className="h-5 w-5" />
                    </Button>
                 </Link>
             </div>

             {/* User Info Card */}
            <Card>
                <CardContent className="p-4 flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                        <AvatarImage src={user.avatarUrl ? `/avatars/${user.avatarUrl}` : `https://avatar.vercel.sh/${user.email}.png`} alt={user.name || 'User Avatar'} />
                        <AvatarFallback>{user.name ? user.name.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-grow">
                        <p className="font-semibold text-lg">{user.name || 'User Name'}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <p className="text-sm text-muted-foreground">Class: {user.class || 'N/A'}</p>
                        <p className="text-sm text-muted-foreground">Target Year: {targetYearDisplay}</p>
                    </div>
                    {/* Points Display */}
                    <div className="text-center">
                         <Trophy className="h-8 w-8 text-yellow-500 mx-auto mb-1"/>
                         <p className="text-xl font-bold">{isLoadingPoints ? <Skeleton className="h-6 w-12 mx-auto"/> : totalPoints}</p>
                         <p className="text-xs text-muted-foreground">Total Points</p>
                    </div>
                </CardContent>
            </Card>

             {/* Quick Links */}
            <div className="space-y-2">
                 <Link href="#" className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted transition-colors">
                     <div className="flex items-center gap-3">
                        <DollarSign className="h-5 w-5 text-primary"/>
                        <span>View My Purchases</span>
                     </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground"/>
                 </Link>
                 <Link href="#" className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted transition-colors">
                     <div className="flex items-center gap-3">
                        <CalendarCheck2 className="h-5 w-5 text-primary"/>
                        <span>My Exams</span>
                     </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground"/>
                 </Link>
            </div>

            {/* Learning Activity */}
            <h2 className="text-lg font-semibold pt-4">My Learning Activity</h2>

            {/* Daily Goal */}
            <Card>
                 <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base font-medium flex items-center gap-2"><Target className="h-4 w-4 text-red-500"/> My Daily Goal</CardTitle>
                    <Button variant="outline" size="sm">Edit Goal</Button>
                 </CardHeader>
                 <CardContent>
                     <Progress value={(dailyGoalProgress / dailyGoalTotal) * 100} className="h-2 mb-1" />
                     <p className="text-xs text-muted-foreground text-right">{dailyGoalProgress}/{dailyGoalTotal} Qs Solved Today</p>
                 </CardContent>
            </Card>

             {/* Weekly Activity */}
             <Card>
                 <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base font-medium">My Weekly Activity</CardTitle>
                     <Button variant="link" size="sm" className="text-xs">From 5th May - 11th May</Button> {/* Date Range - make dynamic later */}
                 </CardHeader>
                 <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                     <div className="p-3 rounded-lg border bg-muted/30">
                        <HelpCircle className="h-6 w-6 text-blue-500 mx-auto mb-1"/>
                        <p className="text-lg font-bold">{weeklyStats.questionsSolved}</p>
                        <p className="text-xs text-muted-foreground">Question Solved</p>
                    </div>
                     <div className="p-3 rounded-lg border bg-muted/30">
                        <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-1"/>
                        <p className="text-lg font-bold">{weeklyStats.correctQuestions}</p>
                        <p className="text-xs text-muted-foreground">Correct Questions</p>
                    </div>
                     <div className="p-3 rounded-lg border bg-muted/30">
                        <span className="text-lg font-bold">{weeklyStats.accuracy}%</span>
                        <p className="text-xs text-muted-foreground">Accuracy</p>
                    </div>
                     <div className="p-3 rounded-lg border bg-muted/30">
                        <Activity className="h-6 w-6 text-red-500 mx-auto mb-1"/>
                        <p className="text-lg font-bold">{weeklyStats.challengesTaken}</p>
                        <p className="text-xs text-muted-foreground">Tests Taken</p>
                    </div>
                 </CardContent>
                 {/* Weekly Calendar View */}
                 <CardContent className="pt-4">
                    <p className="text-sm font-medium mb-2">Select a date to view activity:</p>
                    <div className="flex justify-between items-center border-t border-b py-2">
                         {Array.from({ length: 7 }).map((_, index) => (
                           <Button key={index} variant="ghost" className="h-auto flex flex-col p-1 text-center">
                              <span className="text-xs text-muted-foreground">{getDayOfWeek(index)}</span>
                              <span className="text-sm font-semibold">{getDateOfMonth(index)}</span>
                              {/* Placeholder for completed goal indicator */}
                              {index < 3 && <Check className="h-3 w-3 text-green-500 mt-1"/>}
                           </Button>
                        ))}
                    </div>
                     <div className="text-right mt-2">
                         <Button variant="link" size="sm" className="text-xs">Reset to default</Button>
                    </div>
                 </CardContent>
            </Card>

            {/* Attempted Challenges (Tests) */}
            <Card>
                 <CardHeader>
                    <CardTitle className="text-base font-medium">Attempted Tests</CardTitle>
                     <CardDescription>Your most recent test attempts.</CardDescription>
                 </CardHeader>
                 <CardContent>
                     {isLoadingHistory ? (
                        <Skeleton className="h-16 w-full"/>
                     ) : recentTests.length > 0 ? (
                        <ul className="space-y-3">
                             {recentTests.map((test) => (
                                <li key={test.attemptTimestamp} className="flex items-center justify-between border p-3 rounded-md">
                                   <div>
                                      <p className="text-sm font-medium">{test.testName || `Test: ${test.testCode}`}</p>
                                      <p className="text-xs text-muted-foreground">
                                         Score: {test.score ?? 'N/A'} / {test.totalMarks ?? test.totalQuestions ?? 'N/A'} | Points: {test.pointsEarned ?? 0}
                                      </p>
                                   </div>
                                   <Link href={`/chapterwise-test-results/${test.testCode}?userId=${user.id}&attemptTimestamp=${test.attemptTimestamp}`} passHref>
                                      <Button variant="outline" size="sm">View Details</Button>
                                   </Link>
                                </li>
                            ))}
                         </ul>
                     ) : (
                         <p className="text-sm text-muted-foreground text-center py-4">No recent tests found.</p>
                     )}
                 </CardContent>
                 <CardFooter>
                     <Link href="/progress" passHref>
                        <Button variant="link" className="w-full">View All Test History</Button>
                     </Link>
                 </CardFooter>
            </Card>
        </div>
    );
}