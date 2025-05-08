'use client'; // Make this a client component to fetch client-side data

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, LineChart, ListChecks, Wand2, MessageSquare, Activity, ArrowRight, Sparkles, Trophy } from "lucide-react"; // Added new icons
import Link from "next/link";
import Image from 'next/image';
import { useAuth } from '@/context/auth-context'; // Import useAuth
import { Skeleton } from '@/components/ui/skeleton';
import type { TestSession, TestResultSummary } from '@/types'; // Import necessary types

// Placeholder Data - Replace with dynamic data later
const recentActivity = [
    { id: 1, type: 'test_taken', text: 'Completed Physics Mock Test 1', time: '2h ago' },
    { id: 2, type: 'new_test', text: 'New JEE Advanced Maths Test added', time: '1d ago' },
    { id: 3, type: 'tip_generated', text: 'Generated study tips for Calculus', time: '3d ago' },
];

// Initial performance stats (will be updated by useEffect)
const initialPerformanceStats = {
    testsTaken: 0, // Will be calculated
    averageScore: 65, // Example - Calculation complex for local storage
    highestScore: 85, // Example - Calculation complex for local storage
};

export default function DashboardPage() {
    const { user, loading: authLoading } = useAuth();
    const [performanceStats, setPerformanceStats] = useState(initialPerformanceStats);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);

    useEffect(() => {
        if (typeof window !== 'undefined' && user && user.id) {
            setIsLoadingHistory(true);
            try {
                let testsTakenCount = 0;
                // Iterate through local storage to count relevant test results
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(`testResult-`) && key.includes(`-${user.id}-`)) {
                        testsTakenCount++;
                    }
                }
                setPerformanceStats(prev => ({ ...prev, testsTaken: testsTakenCount }));
            } catch (error) {
                console.error("Error fetching test history count:", error);
            } finally {
                 setIsLoadingHistory(false);
            }
        } else {
             // Reset stats if no user or not in browser
             setPerformanceStats(initialPerformanceStats);
             setIsLoadingHistory(false); // Ensure loading stops if no user
        }
    }, [user]); // Rerun when user state changes

    const totalLoading = authLoading || isLoadingHistory;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        {/* Updated title */}
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Welcome to EduNexus!</h1>
        {/* Updated description */}
        <p className="text-lg text-muted-foreground">Your ultimate platform for MHT-CET, JEE, and NEET preparation.</p>
      </div>

      {/* Quick Access Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-border hover:border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Browse Test Series</CardTitle>
            <ListChecks className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <CardDescription>Explore full syllabus and chapter-wise tests.</CardDescription>
            <Link href="/tests" passHref>
              <Button variant="outline" className="w-full">
                View All Tests <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-border hover:border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">Daily Practice (DPP)</CardTitle>
            <ClipboardList className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <CardDescription>Sharpen skills with daily chapter problems.</CardDescription>
            <Link href="/dpp" passHref>
              <Button variant="outline" className="w-full">
                Start DPP <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-border hover:border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">My Progress</CardTitle>
            <Activity className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <CardDescription>Track your test attempts and performance.</CardDescription>
            <Link href="/progress" passHref>
              <Button variant="outline" className="w-full">
                View History <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-border hover:border-primary/50 bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-purple-900/10 dark:via-background dark:to-blue-900/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">AI Study Tips</CardTitle>
            <Wand2 className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <CardDescription>Get personalized tips for tricky topics.</CardDescription>
            <Link href="/study-tips" passHref>
              <Button variant="secondary" className="w-full bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/50 dark:text-purple-200 dark:hover:bg-purple-800/60 border border-purple-200 dark:border-purple-700">
                 <Sparkles className="mr-2 h-4 w-4"/> Get Tips <ArrowRight className="ml-auto h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-border hover:border-primary/50 bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-blue-900/10 dark:via-background dark:to-green-900/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium">AI Doubt Solving</CardTitle>
            <MessageSquare className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <CardDescription>Instant answers to your academic questions.</CardDescription>
            <Link href="/doubt-solving" passHref>
               <Button variant="secondary" className="w-full bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-200 dark:hover:bg-blue-800/60 border border-blue-200 dark:border-blue-700">
                {/* Updated brand name */}
                <Sparkles className="mr-2 h-4 w-4"/> Ask EduNexus <ArrowRight className="ml-auto h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Placeholder for another feature or promotional card */}
        <Card className="hover:shadow-lg transition-shadow duration-300 ease-in-out border border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center text-center">
           <CardContent className="pt-6">
              <Trophy className="h-10 w-10 text-amber-500 mx-auto mb-3"/>
              <CardTitle className="text-base font-medium mb-1">Leaderboards</CardTitle>
              <CardDescription className="text-sm">See how you rank against others (Coming Soon).</CardDescription>
              <Button variant="ghost" size="sm" disabled className="mt-3 text-xs">View Rankings</Button>
           </CardContent>
        </Card>
      </div>

       {/* Combined Performance & Activity Section */}
       <div className="grid gap-6 lg:grid-cols-5">
           {/* Performance Snapshot */}
           <Card className="lg:col-span-2 hover:shadow-md transition-shadow duration-200">
               <CardHeader>
                   <CardTitle className="flex items-center gap-2">
                       <LineChart className="h-5 w-5 text-orange-600" />
                       Performance Snapshot
                   </CardTitle>
                   <CardDescription>Your overall progress at a glance.</CardDescription>
               </CardHeader>
               <CardContent className="space-y-4">
                   {totalLoading ? (
                       <>
                         <div className="flex justify-between"><Skeleton className="h-5 w-24" /><Skeleton className="h-5 w-8" /></div>
                         <div className="flex justify-between"><Skeleton className="h-5 w-32" /><Skeleton className="h-5 w-12" /></div>
                         <div className="flex justify-between"><Skeleton className="h-5 w-28" /><Skeleton className="h-5 w-12" /></div>
                       </>
                   ) : (
                        <>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Tests Taken:</span>
                                <span className="font-medium">{performanceStats.testsTaken}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Average Score:</span>
                                <span className="font-medium">{performanceStats.averageScore}%</span>
                                <span className="text-xs text-muted-foreground/70">(Example)</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Highest Score:</span>
                                <span className="font-medium">{performanceStats.highestScore}%</span>
                                 <span className="text-xs text-muted-foreground/70">(Example)</span>
                            </div>
                        </>
                   )}
                    <Button variant="link" className="p-0 h-auto text-primary" asChild>
                        <Link href="/progress">View Detailed Progress</Link>
                    </Button>
               </CardContent>
           </Card>

           {/* Recent Activity Feed */}
           <Card className="lg:col-span-3 hover:shadow-md transition-shadow duration-200">
               <CardHeader>
                   <CardTitle>Recent Activity</CardTitle>
                   <CardDescription>Your latest interactions on the platform (Placeholder).</CardDescription>
               </CardHeader>
               <CardContent>
                   <ul className="space-y-4">
                       {recentActivity.map((activity) => (
                           <li key={activity.id} className="flex items-start gap-3">
                               {/* Optional Icon based on type */}
                               <div className="mt-1 flex-shrink-0">
                                   {activity.type === 'test_taken' && <ListChecks className="h-4 w-4 text-blue-500" />}
                                   {activity.type === 'new_test' && <Sparkles className="h-4 w-4 text-amber-500" />}
                                   {activity.type === 'tip_generated' && <Wand2 className="h-4 w-4 text-purple-500" />}
                               </div>
                               <div>
                                   <p className="text-sm font-medium">{activity.text}</p>
                                   <p className="text-xs text-muted-foreground">{activity.time}</p>
                               </div>
                           </li>
                       ))}
                   </ul>
               </CardContent>
           </Card>
       </div>
    </div>
  );
}
