// src/app/profile/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings, ArrowLeft, DollarSign, CalendarCheck2, Target, HelpCircle, CheckCircle, Activity, ChevronRight, Trophy, Check, User, Clock, BarChart2, ListChecks, ExternalLink, Sparkles, Users, NotebookIcon, Flame, ClipboardCheck } from 'lucide-react';
import Link from 'next/link';
import { getUserPoints, type UserPoints } from '@/actions/points-actions';
import { getAllTestReportsForUser } from '@/actions/test-report-actions';
import { getDppProgressForDateRange } from '@/actions/dpp-progress-actions';
import type { TestResultSummary, DppAttempt, UserDppLessonProgress } from '@/types';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

const DAILY_DPP_GOAL = 10; // Example: 10 questions per day

export default function ProfilePage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [userPoints, setUserPoints] = useState<UserPoints | null>(null);
    const [isLoadingPoints, setIsLoadingPoints] = useState(true);
    const [recentTests, setRecentTests] = useState<Partial<TestResultSummary>[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);

    const [dailyGoalProgress, setDailyGoalProgress] = useState(0);
    const [weeklySnapshot, setWeeklySnapshot] = useState({
        questionsSolved: 0,
        correctQuestions: 0,
        accuracy: 0,
        dppSetsAttempted: 0,
    });
    const [isLoadingDppStats, setIsLoadingDppStats] = useState(true);


    const fetchDppStats = useCallback(async () => {
        if (!user?.id) return;
        setIsLoadingDppStats(true);

        try {
            // Today's stats for daily goal
            const today = new Date();
            const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
            const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString();
            const todayProgressData = await getDppProgressForDateRange(user.id, todayStart, todayEnd);
            
            let solvedToday = 0;
            todayProgressData.forEach(lesson => {
                Object.values(lesson.questionAttempts).forEach(attempts => {
                    if (attempts.length > 0) solvedToday++; // Count each question with at least one attempt today
                });
            });
            setDailyGoalProgress(solvedToday);
            if (solvedToday >= DAILY_DPP_GOAL) {
                toast({
                    title: "🎉 Daily Goal Achieved! 🎉",
                    description: `Great job! You've completed your daily goal of ${DAILY_DPP_GOAL} DPP questions. Keep it up!`,
                    duration: 6000,
                });
            }

            // This week's stats for snapshot
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)); // Monday as start of week
            weekStart.setHours(0,0,0,0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23,59,59,999);

            const weeklyProgressData = await getDppProgressForDateRange(user.id, weekStart.toISOString(), weekEnd.toISOString());
            
            let weeklySolved = 0;
            let weeklyCorrect = 0;
            const lessonsAttemptedThisWeek = new Set<string>();

            weeklyProgressData.forEach(lesson => {
                lessonsAttemptedThisWeek.add(`${lesson.subject}-${lesson.lesson}`);
                Object.values(lesson.questionAttempts).forEach(attempts => {
                    if (attempts.length > 0) { // Consider any attempt within the week
                        weeklySolved++;
                        // Use the latest attempt in the range for correctness for simplicity
                        const latestAttemptInRange = attempts.sort((a,b) => b.timestamp - a.timestamp)[0];
                        if (latestAttemptInRange.isCorrect) {
                            weeklyCorrect++;
                        }
                    }
                });
            });
            
            setWeeklySnapshot({
                questionsSolved: weeklySolved,
                correctQuestions: weeklyCorrect,
                accuracy: weeklySolved > 0 ? parseFloat(((weeklyCorrect / weeklySolved) * 100).toFixed(1)) : 0,
                dppSetsAttempted: lessonsAttemptedThisWeek.size,
            });

        } catch (err) {
            console.error("Failed to load DPP stats:", err);
            toast({ variant: "destructive", title: "DPP Stats Error", description: "Could not load your DPP activity." });
        } finally {
            setIsLoadingDppStats(false);
        }
    }, [user?.id, toast]);


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

    useEffect(() => {
        if (user?.id) {
            setIsLoadingHistory(true);
            getAllTestReportsForUser(user.id)
                .then(history => setRecentTests(history.slice(0, 3)))
                .catch(err => console.error("Failed to load test history:", err))
                .finally(() => setIsLoadingHistory(false));
            fetchDppStats(); // Fetch DPP stats after user is loaded
        } else if (!authLoading) {
            setIsLoadingHistory(false);
            setIsLoadingDppStats(false);
        }
    }, [user?.id, authLoading, fetchDppStats]);


    if (authLoading || (user && (isLoadingPoints || isLoadingHistory || isLoadingDppStats))) {
        return (
            <div className="space-y-6 md:space-y-8 max-w-4xl mx-auto animate-pulse p-4">
                <div className="flex justify-between items-center mb-2 sm:mb-4">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                </div>
                <Card><CardContent className="p-4 sm:p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
                <Skeleton className="h-6 w-1/3 my-4" />
                <Card><CardContent className="p-4 sm:p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
                <Card><CardContent className="p-4 sm:p-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
            </div>
        );
    }

    if (!user) {
        router.push('/auth/login?redirect=/profile');
        return null; 
    }

    const targetYearDisplay = user.targetYear || 'N/A';
    const totalPoints = userPoints?.totalPoints ?? 0;
    const dailyGoalCompletion = Math.min(dailyGoalProgress, DAILY_DPP_GOAL);
    const dailyGoalPercentage = (dailyGoalCompletion / DAILY_DPP_GOAL) * 100;


    const getInitials = (name?: string | null) => {
        if (name) {
            const names = name.split(' ');
            if (names.length > 1) {
                return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
            }
            return name.substring(0, 2).toUpperCase();
        }
        return <User className="h-full w-full"/>;
    };

    const formatDate = (dateString: string | null | undefined) => {
        if (!dateString) return 'N/A';
        try {
          const date = new Date(dateString);
          if (isNaN(date.getTime())) return 'Invalid Date';
          return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        } catch {
          return 'Invalid Date';
        }
    };

    return (
        <div className="space-y-6 md:space-y-8 max-w-4xl mx-auto p-4 sm:p-0">
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
                         <p className="text-2xl font-bold">{totalPoints}</p>
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
                    <CardTitle className="text-base font-medium flex items-center gap-2"><Target className="h-4 w-4 text-red-500"/> My Daily DPP Goal</CardTitle>
                 </CardHeader>
                 <CardContent>
                    <Progress value={dailyGoalPercentage} className="h-2.5 mb-1 rounded-full" />
                    <p className="text-xs text-muted-foreground text-right">{dailyGoalProgress}/{DAILY_DPP_GOAL} Questions Solved Today (DPP)</p>
                 </CardContent>
            </Card>

             <Card className="shadow-md">
                 <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium">This Week's Snapshot (DPP)</CardTitle>
                 </CardHeader>
                 <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                     <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-900/20">
                        <ClipboardCheck className="h-5 w-5 text-blue-600 mx-auto mb-1"/>
                        <p className="text-lg font-bold">{weeklySnapshot.questionsSolved}</p>
                        <p className="text-xs text-muted-foreground uppercase">Questions</p>
                    </div>
                     <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-900/20">
                        <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1"/>
                        <p className="text-lg font-bold">{weeklySnapshot.correctQuestions}</p>
                        <p className="text-xs text-muted-foreground uppercase">Correct</p>
                    </div>
                     <div className="p-3 rounded-lg border bg-yellow-50 dark:bg-yellow-900/20">
                        <BarChart2 className="h-5 w-5 text-yellow-600 mx-auto mb-1"/>
                        <p className="text-lg font-bold">{weeklySnapshot.accuracy}%</p>
                        <p className="text-xs text-muted-foreground uppercase">Accuracy</p>
                    </div>
                     <div className="p-3 rounded-lg border bg-purple-50 dark:bg-purple-900/20">
                        <Flame className="h-5 w-5 text-purple-600 mx-auto mb-1"/>
                        <p className="text-lg font-bold">{weeklySnapshot.dppSetsAttempted}</p>
                        <p className="text-xs text-muted-foreground uppercase">DPP Sets</p>
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

