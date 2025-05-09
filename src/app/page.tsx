// src/app/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ClipboardList, LineChart, ListChecks, Wand2, MessageSquare, Activity, ArrowRight,
  Sparkles, Trophy, Users, BarChartBig, UserCircle, Percent, Target, BrainCircuit, BookOpen, NotebookIcon, Flame
} from "lucide-react";
import Link from "next/link";
import Image from 'next/image';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import type { TestResultSummary, UserProfile } from '@/types';
import { getAllTestReportsForUser } from '@/actions/test-report-actions';
import { getUserPoints, type UserPoints, getAllUserPoints } from '@/actions/points-actions';
import { readUsers } from '@/actions/user-actions';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Bar, BarChart, Pie, PieChart, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';

const chartConfig = {
  score: { label: "Score", color: "hsl(var(--chart-1))" },
  accuracy: { label: "Accuracy", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

interface LeaderboardEntry extends UserPoints {
    rank: number;
    userProfile?: Omit<UserProfile, 'password'> | null;
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [performanceStats, setPerformanceStats] = useState({
    testsTaken: 0,
    averageScorePercent: 0,
    highestScorePercent: 0,
    dppsCompleted: 0, // Placeholder
    questionsPracticed: 0, // Placeholder
  });
  const [userPointsData, setUserPointsData] = useState<UserPoints | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | string>('N/A');
  const [totalRankedUsers, setTotalRankedUsers] = useState(0);
  const [recentHistory, setRecentHistory] = useState<Partial<TestResultSummary>[]>([]);
  const [scoreTrendData, setScoreTrendData] = useState<Array<{ name: string; score: number | null }>>([]);


  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true);

  const totalLoading = authLoading || isLoadingStats || isLoadingLeaderboard;

  // Fetch performance stats and recent history
  useEffect(() => {
    if (user && user.id) {
      setIsLoadingStats(true);
      Promise.all([
        getAllTestReportsForUser(user.id),
        getUserPoints(user.id)
      ]).then(([history, pointsData]) => {
        const validAttempts = history.filter(h => typeof h.score === 'number' && typeof h.totalMarks === 'number' && h.totalMarks > 0);
        const testsTakenCount = history.length;
        let totalPercentageSum = 0;
        let highestScorePercent = 0;

        const trendData = validAttempts.slice(0, 5).reverse().map((attempt, index) => {
           const percentage = (attempt.score! / attempt.totalMarks!) * 100;
           totalPercentageSum += percentage;
           if (percentage > highestScorePercent) {
             highestScorePercent = percentage;
           }
           return { name: `Test ${index + 1}`, score: parseFloat(percentage.toFixed(1)) };
        });
        setScoreTrendData(trendData);

        const averageScorePercent = validAttempts.length > 0 ? (totalPercentageSum / validAttempts.length) : 0;

        setPerformanceStats({
          testsTaken: testsTakenCount,
          averageScorePercent: parseFloat(averageScorePercent.toFixed(1)),
          highestScorePercent: parseFloat(highestScorePercent.toFixed(1)),
          dppsCompleted: 25, // Placeholder
          questionsPracticed: 350, // Placeholder
        });
        setUserPointsData(pointsData);
        setRecentHistory(history.slice(0, 3));
      }).catch(error => {
        console.error("Error fetching dashboard data:", error);
        // Set default/error states
      }).finally(() => {
        setIsLoadingStats(false);
      });
    } else if (!authLoading) {
      // Reset if no user
      setIsLoadingStats(false);
      setPerformanceStats({ testsTaken: 0, averageScorePercent: 0, highestScorePercent: 0, dppsCompleted: 0, questionsPracticed: 0 });
      setUserPointsData(null);
      setRecentHistory([]);
      setScoreTrendData([]);
    }
  }, [user, authLoading]);

  // Fetch leaderboard data
   useEffect(() => {
    if (user || !authLoading) { // Fetch leaderboard even for non-logged in, but rank will be N/A
        setIsLoadingLeaderboard(true);
        Promise.all([
            getAllUserPoints(),
            readUsers()
        ]).then(([allPoints, allUsersData]) => {
            const userMap = new Map<string, Omit<UserProfile, 'password'>>(
                allUsersData.map(u => [u.id, u])
            );
            const rankedData = allPoints
                .filter(pointsEntry => userMap.get(pointsEntry.userId)?.role !== 'Admin')
                .sort((a, b) => b.totalPoints - a.totalPoints)
                .map((pointsEntry, index) => ({
                    ...pointsEntry,
                    rank: index + 1,
                    userProfile: userMap.get(pointsEntry.userId) || null,
                }));
            setLeaderboard(rankedData.slice(0, 3)); // Top 3 for snapshot
            setTotalRankedUsers(rankedData.length);

            if (user && user.id) {
                const currentUserRanking = rankedData.find(entry => entry.userId === user.id);
                setUserRank(currentUserRanking?.rank ?? 'N/A');
            } else {
                setUserRank('N/A');
            }
        }).catch(error => {
            console.error("Error fetching leaderboard data:", error);
        }).finally(() => {
            setIsLoadingLeaderboard(false);
        });
    }
   }, [user, authLoading]);


  const getInitials = (name?: string | null) => name ? name.charAt(0).toUpperCase() : <UserCircle className="h-4 w-4"/>;

  const StatCard = ({ title, value, icon: Icon, unit = "", isLoading = false }: { title: string, value: string | number, icon: React.ElementType, unit?: string, isLoading?: boolean }) => (
    <Card className="p-4 shadow-sm hover:shadow-md transition-shadow bg-card/80 backdrop-blur-sm">
      {isLoading ? <Skeleton className="h-16 w-full" /> : (
        <>
          <div className="flex items-center justify-between mb-1">
            <CardDescription className="text-xs uppercase tracking-wider">{title}</CardDescription>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">{value}{unit}</CardTitle>
        </>
      )}
    </Card>
  );

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          {totalLoading && !user ? (
             <>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-5 w-64" />
            </>
          ) : (
          <>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Hello, {user?.name ? user.name.split(' ')[0] : 'Guest'}! 👋
            </h1>
            <p className="text-muted-foreground">
              {user ? "Let's conquer those exams!" : "Log in to track your progress and access all features."}
            </p>
          </>
          )}
        </div>
        {user && (
            <Badge variant="outline" className="text-xs sm:text-sm py-1 px-2.5">
                Plan: <span className="font-semibold capitalize ml-1">{user.model}</span>
            </Badge>
        )}
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Performance Stats Cards */}
        <StatCard title="Tests Taken" value={performanceStats.testsTaken} icon={ListChecks} isLoading={isLoadingStats} />
        <StatCard title="Avg. Score" value={performanceStats.averageScorePercent} unit="%" icon={Percent} isLoading={isLoadingStats} />
        <StatCard title="Highest Score" value={performanceStats.highestScorePercent} unit="%" icon={Target} isLoading={isLoadingStats} />
        <StatCard title="Total Points" value={userPointsData?.totalPoints ?? (user ? 0 : 'N/A')} icon={Sparkles} isLoading={isLoadingStats} />

        {/* Quick Actions Card (Large on mobile, spans 2 on md, 2 on lg) */}
        <Card className="md:col-span-2 lg:col-span-2 shadow-lg border border-border/50 hover:border-primary/30 transition-all duration-300">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2"><Flame className="text-primary"/>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button variant="default" className="w-full justify-start text-sm py-3 h-auto" asChild>
              <Link href="/tests"><ListChecks className="mr-2 h-4 w-4" /> Test Series</Link>
            </Button>
            <Button variant="outline" className="w-full justify-start text-sm py-3 h-auto" asChild>
              <Link href="/dpp"><ClipboardList className="mr-2 h-4 w-4" /> Daily Practice</Link>
            </Button>
            <Button variant="outline" className="w-full justify-start text-sm py-3 h-auto" asChild>
              <Link href="/progress"><Activity className="mr-2 h-4 w-4" /> My Progress</Link>
            </Button>
            <Button variant="outline" className="w-full justify-start text-sm py-3 h-auto" asChild>
              <Link href="/notebooks"><NotebookIcon className="mr-2 h-4 w-4" /> My Notebooks</Link>
            </Button>
          </CardContent>
        </Card>

        {/* AI Tools Card (Large on mobile, spans 2 on md, 2 on lg) */}
         <Card className="md:col-span-2 lg:col-span-2 shadow-lg border border-border/50 hover:border-primary/30 transition-all duration-300 bg-gradient-to-br from-background via-accent/5 to-background">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2"><BrainCircuit className="text-accent"/>AI Powered Tools</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button variant="secondary" className="w-full justify-start text-sm py-3 h-auto bg-accent/10 hover:bg-accent/20 border border-accent/20" asChild>
              <Link href="/study-tips"><Wand2 className="mr-2 h-4 w-4" /> AI Study Tips</Link>
            </Button>
            <Button variant="secondary" className="w-full justify-start text-sm py-3 h-auto bg-accent/10 hover:bg-accent/20 border border-accent/20" asChild>
              <Link href="/doubt-solving"><MessageSquare className="mr-2 h-4 w-4" /> Ask EduNexus AI</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Score Trend Chart (spans 2 on lg) */}
        <Card className="lg:col-span-2 shadow-md">
           <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2"><LineChart className="text-primary"/>Your Score Trend (Last 5 Tests)</CardTitle>
                <CardDescription className="text-xs">Percentage score over recent attempts.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoadingStats ? <Skeleton className="h-48 w-full" /> : scoreTrendData.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[200px] w-full">
                        <BarChart accessibilityLayer data={scoreTrendData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3"/>
                            <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} fontSize={10} />
                            <YAxis domain={[0, 100]} unit="%" tickLine={false} tickMargin={10} axisLine={false} fontSize={10}/>
                            <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false}/>
                            <Bar dataKey="score" fill="var(--color-score)" radius={5} barSize={25}>
                               {scoreTrendData.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={entry.score && entry.score >= 75 ? "hsl(var(--chart-2))" : entry.score && entry.score >=50 ? "hsl(var(--chart-1))" : "hsl(var(--chart-5))"} />
                               ))}
                            </Bar>
                        </BarChart>
                    </ChartContainer>
                ) : <p className="text-sm text-muted-foreground text-center py-10">No test data yet to show trend.</p>}
            </CardContent>
        </Card>

         {/* Leaderboard Snapshot Card (spans 2 on lg) */}
        <Card className="lg:col-span-2 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2"><Trophy className="text-yellow-500"/>Leaderboard Snapshot</CardTitle>
                <Link href="/leaderboard" className="text-xs text-primary hover:underline">View Full</Link>
            </CardHeader>
            <CardContent>
                {isLoadingLeaderboard ? <Skeleton className="h-40 w-full" /> : (
                    <div className="space-y-3">
                        {user && (
                            <div className="flex items-center justify-between p-2 bg-primary/10 rounded-md">
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                        <AvatarImage src={user.avatarUrl ? `/avatars/${user.avatarUrl}` : `https://avatar.vercel.sh/${user.email}.png`} />
                                        <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm font-medium">Your Rank</span>
                                </div>
                                <span className="text-sm font-semibold">{userRank}/{totalRankedUsers}</span>
                            </div>
                        )}
                        <Separator />
                        <ul className="space-y-1.5 text-xs">
                            {leaderboard.map((entry, index) => (
                                <li key={entry.userId} className="flex items-center justify-between py-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium w-5 text-center">{entry.rank}.</span>
                                        <Avatar className="h-5 w-5">
                                          <AvatarImage src={entry.userProfile?.avatarUrl ? `/avatars/${entry.userProfile.avatarUrl}` : `https://avatar.vercel.sh/${entry.userId}.png`} />
                                          <AvatarFallback>{getInitials(entry.userProfile?.name)}</AvatarFallback>
                                        </Avatar>
                                        <span className="truncate max-w-[100px] sm:max-w-[120px]">{entry.userProfile?.name || 'Anonymous'}</span>
                                    </div>
                                    <span className="font-semibold text-muted-foreground">{entry.totalPoints} pts</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </CardContent>
        </Card>

         {/* Recent Activity Card (spans full on mobile, 2 on md, 4 on lg) */}
        <Card className="md:col-span-2 lg:col-span-4 shadow-sm">
            <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2"><Activity className="text-green-500"/>Recent Test Activity</CardTitle>
                <CardDescription className="text-xs">Your latest test attempts.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoadingStats ? <Skeleton className="h-32 w-full" /> : recentHistory.length > 0 ? (
                    <ul className="space-y-3">
                        {recentHistory.map((attempt) => (
                            <li key={attempt.attemptTimestamp} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2.5 border rounded-md hover:bg-muted/50 transition-colors">
                                <div>
                                    <p className="text-sm font-medium truncate max-w-[200px] sm:max-w-xs md:max-w-md">{attempt.testName || `Test: ${attempt.testCode}`}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Score: <span className="font-semibold">{attempt.score?.toFixed(0) ?? 'N/A'} / {attempt.totalMarks ?? attempt.totalQuestions ?? 'N/A'}</span> ({attempt.percentage?.toFixed(1) ?? 'N/A'}%)
                                    </p>
                                </div>
                                <Link href={`/chapterwise-test-results/${attempt.testCode}?userId=${user?.id}&attemptTimestamp=${attempt.attemptTimestamp}`} className="mt-2 sm:mt-0">
                                    <Button variant="ghost" size="sm" className="text-xs h-7">View Details <ArrowRight className="ml-1 h-3 w-3"/></Button>
                                </Link>
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-sm text-muted-foreground text-center py-6">No recent test activity to show.</p>}
            </CardContent>
        </Card>

      </div> {/* End Main Grid */}
    </div>
  );
}

    