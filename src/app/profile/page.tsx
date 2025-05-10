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
import { Settings, ArrowLeft, DollarSign, CalendarCheck2, Target, HelpCircle, CheckCircle, Activity, ChevronRight, Trophy, Check, User, Clock, BarChart2, ListChecks, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { getUserPoints, type UserPoints } from '@/actions/points-actions';
import { getAllTestReportsForUser } from '@/actions/test-report-actions';
import type { TestResultSummary } from '@/types';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';


const getDayOfWeek = (dateIndex: number): string => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days[dateIndex % 7];
}

const getDateOfMonth = (dateIndex: number): number => {
   // Simple example: assumes the week starts on the 5th of the month
   // This should be replaced with actual date logic if needed
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
        } else if (!authLoading) {
            setIsLoadingPoints(false);
        }
    }, [user?.id, authLoading]);

    // Fetch Recent Test History (e.g., last 3)
    useEffect(() => {
        if (user?.id) {
            setIsLoadingHistory(true);
            getAllTestReportsForUser(user.id)
                .then(history => setRecentTests(history.slice(0, 3))) // Get last 3 attempts
                .catch(err => console.error("Failed to load test history:", err))
                .finally(() => setIsLoadingHistory(false));
        } else if (!authLoading) {
            setIsLoadingHistory(false);
        }
    }, [user?.id, authLoading]);


    if (authLoading) {
        return (
            <div className="space-y-6 max-w-4xl mx-auto animate-pulse">
                <div className="flex justify-between items-center mb-6">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                </div>
                <Card><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
                <Skeleton className="h-6 w-1/3 my-4" />
                <Card><CardContent className="p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
                <Card><CardContent className="p-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
            </div>
        );
    }

    if (!user) {
        router.push('/auth/login?redirect=/profile');
        return null; 
    }

    const targetYearDisplay = user.targetYear || 'N/A';
    const totalPoints = userPoints?.totalPoints ?? 0;

    const weeklyStats = {
        questionsSolved: recentTests.reduce((acc, test) => acc + (test.attempted || 0), 0),
        correctQuestions: recentTests.reduce((acc, test) => acc + (test.correct || 0), 0),
        accuracy: recentTests.length > 0 ? parseFloat((recentTests.reduce((acc, test) => acc + (test.percentage || 0), 0) / recentTests.length).toFixed(1)) : 0,
        challengesTaken: recentTests.length || 0,
    };
    const dailyGoalProgress = Math.min(5, weeklyStats.questionsSolved); // Example: cap at 5 or actual daily tracking
    const dailyGoalTotal = 10; 

    const getInitials = (name?: string | null) => {
        if (name) {
            const names = name.split(' ');
            if (names.length > 1) {
                return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
            }
            return name.substring(0, 2).toUpperCase();
        }
        return <User className="h-4 w-4"/>;
    };

    return (
        <div className="space-y-6 md:space-y-8 max-w-4xl mx-auto">
             <div className="flex justify-between items-center mb-2 sm:mb-4">
                 <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-muted-foreground hover:text-primary">
                    <ArrowLeft className="h-5 w-5" />
                 </Button>
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">My Profile</h1>
                 <Link href="/settings" passHref>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                        <Settings className="h-5 w-5" />
                    </Button>
                 </Link>
             </div>

            <Card className="shadow-lg border-border/50">
                <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-center gap-4">
                    <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-2 border-primary">
                        <AvatarImage src={user.avatarUrl ? `/avatars/${user.avatarUrl}` : `https://avatar.vercel.sh/${user.email}.png?size=128`} alt={user.name || 'User Avatar'} />
                        <AvatarFallback className="text-2xl bg-muted">{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-grow text-center sm:text-left">
                        <p className="font-semibold text-xl sm:text-2xl">{user.name || 'User Name'}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1 justify-center sm:justify-start">
                            <span>Class: <Badge variant="outline" className="font-medium">{user.class || 'N/A'}</Badge></span>
                            <span>Target: <Badge variant="outline" className="font-medium">{targetYearDisplay}</Badge></span>
                            <span>Plan: <Badge variant="secondary" className="capitalize font-medium">{user.model || 'N/A'}</Badge></span>
                        </div>
                    </div>
                    <div className="text-center pt-3 sm:pt-0 sm:pl-4 border-t sm:border-t-0 sm:border-l border-dashed w-full sm:w-auto">
                         <Trophy className="h-10 w-10 text-yellow-500 mx-auto mb-1"/>
                         <p className="text-2xl font-bold">{isLoadingPoints ? <Skeleton className="h-7 w-16 mx-auto"/> : totalPoints}</p>
                         <p className="text-xs text-muted-foreground">Total Points</p>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <Link href="/progress" className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors shadow-sm">
                     <div className="flex items-center gap-3">
                        <ListChecks className="h-5 w-5 text-primary"/>
                        <span className="font-medium">My Test History</span>
                     </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground"/>
                 </Link>
                 <Link href="/leaderboard" className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors shadow-sm">
                     <div className="flex items-center gap-3">
                        <Trophy className="h-5 w-5 text-primary"/>
                        <span className="font-medium">View Leaderboard</span>
                     </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground"/>
                 </Link>
            </div>

            <h2 className="text-lg font-semibold pt-2">My Learning Activity</h2>
            <Card className="shadow-md">
                 <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base font-medium flex items-center gap-2"><Target className="h-4 w-4 text-red-500"/> My Daily Goal</CardTitle>
                    {/* <Button variant="outline" size="sm" className="text-xs">Edit Goal</Button> */}
                 </CardHeader>
                 <CardContent>
                     <Progress value={(dailyGoalProgress / dailyGoalTotal) * 100} className="h-2.5 mb-1 rounded-full" />
                     <p className="text-xs text-muted-foreground text-right">{dailyGoalProgress}/{dailyGoalTotal} Questions Solved Today</p>
                 </CardContent>
            </Card>

             <Card className="shadow-md">
                 <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium">This Week's Snapshot</CardTitle>
                 </CardHeader>
                 <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                     <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-900/20">
                        <HelpCircle className="h-5 w-5 text-blue-600 mx-auto mb-1"/>
                        <p className="text-lg font-bold">{weeklyStats.questionsSolved}</p>
                        <p className="text-xs text-muted-foreground uppercase">Questions</p>
                    </div>
                     <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-900/20">
                        <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1"/>
                        <p className="text-lg font-bold">{weeklyStats.correctQuestions}</p>
                        <p className="text-xs text-muted-foreground uppercase">Correct</p>
                    </div>
                     <div className="p-3 rounded-lg border bg-yellow-50 dark:bg-yellow-900/20">
                        <BarChart2 className="h-5 w-5 text-yellow-600 mx-auto mb-1"/>
                        <p className="text-lg font-bold">{weeklyStats.accuracy}%</p>
                        <p className="text-xs text-muted-foreground uppercase">Accuracy</p>
                    </div>
                     <div className="p-3 rounded-lg border bg-red-50 dark:bg-red-900/20">
                        <Activity className="h-5 w-5 text-red-600 mx-auto mb-1"/>
                        <p className="text-lg font-bold">{weeklyStats.challengesTaken}</p>
                        <p className="text-xs text-muted-foreground uppercase">Tests Taken</p>
                    </div>
                 </CardContent>
            </Card>

            <Card className="shadow-md">
                 <CardHeader>
                    <CardTitle className="text-base font-medium">Recent Tests</CardTitle>
                     <CardDescription className="text-xs">Your latest test performance.</CardDescription>
                 </CardHeader>
                 <CardContent>
                     {isLoadingHistory ? (
                        <Skeleton className="h-24 w-full"/>
                     ) : recentTests.length > 0 ? (
                        <ul className="space-y-3">
                             {recentTests.map((test) => (
                                <li key={test.attemptTimestamp} className="flex flex-col sm:flex-row sm:items-center sm:justify-between border p-3 rounded-lg hover:shadow-sm transition-shadow">
                                   <div className="flex-grow mb-2 sm:mb-0">
                                      <p className="text-sm font-semibold text-primary truncate max-w-xs sm:max-w-sm md:max-w-md">{test.testName || `Test: ${test.testCode}`}</p>
                                      <p className="text-xs text-muted-foreground">
                                         Score: <span className="font-medium">{test.score ?? 'N/A'} / {test.totalMarks ?? test.totalQuestions ?? 'N/A'}</span> ({test.percentage?.toFixed(1) ?? 'N/A'}%)
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3 inline mr-1"/> {test.submittedAt ? new Date(test.submittedAt).toLocaleDateString() : 'N/A'}
                                      </p>
                                   </div>
                                   <Link href={`/chapterwise-test-results/${test.testCode}?userId=${user.id}&attemptTimestamp=${test.attemptTimestamp}`} passHref>
                                      <Button variant="outline" size="sm" className="text-xs w-full sm:w-auto">View Details <ExternalLink className="h-3 w-3 ml-1.5"/></Button>
                                   </Link>
                                </li>
                            ))}
                         </ul>
                     ) : (
                         <p className="text-sm text-muted-foreground text-center py-6">No recent tests found. Time to take a test!</p>
                     )}
                 </CardContent>
                 {recentTests.length > 0 && (
                     <CardFooter className="border-t pt-4">
                         <Link href="/progress" passHref className="w-full">
                            <Button variant="default" className="w-full">View All Test History</Button>
                         </Link>
                     </CardFooter>
                 )}
            </Card>
        </div>
    );
}
