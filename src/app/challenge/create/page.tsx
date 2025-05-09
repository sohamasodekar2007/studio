// src/app/challenge/create/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Users, Swords, Settings, Loader2, PlusCircle } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import type { UserProfile, DifficultyLevel, ExamOption } from '@/types';
import { difficultyLevels, exams } from '@/types';
import { getSubjects, getLessonsForSubject } from '@/actions/question-bank-query-actions';
import { getFollowData } from '@/actions/follow-actions';
import { createChallenge } from '@/actions/challenge-actions';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { readUsers } from '@/actions/user-actions';

const challengeCreationSchema = z.object({
  subject: z.string().min(1, "Subject is required."),
  lesson: z.string().min(1, "Lesson is required."),
  numQuestions: z.number().min(1, "Minimum 1 question.").max(50, "Maximum 50 questions."), // Changed min from 5 to 1
  difficulty: z.enum([...difficultyLevels, "all"], { required_error: "Difficulty is required."}).default("all"),
  examFilter: z.enum([...exams, "all"], { required_error: "Exam filter is required."}).default("all"),
  challengedUserIds: z.array(z.string()).min(1, "Challenge at least one friend.").max(10, "Cannot challenge more than 10 friends."),
});

type ChallengeCreationFormValues = z.infer<typeof challengeCreationSchema>;

export default function CreateChallengePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [lessons, setLessons] = useState<string[]>([]);
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);

  const form = useForm<ChallengeCreationFormValues>({
    resolver: zodResolver(challengeCreationSchema),
    defaultValues: {
      subject: '',
      lesson: '',
      numQuestions: 10, // Default can remain 10 or change to 1
      difficulty: 'all',
      examFilter: 'all',
      challengedUserIds: [],
    },
  });

  const selectedSubject = form.watch('subject');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login?redirect=/challenge/create');
      return;
    }
    if (user) {
      setIsLoadingInitialData(true);
      Promise.all([
        getSubjects(),
        getFollowData(user.id).then(data => data.following),
      ]).then(async ([subs, followingIds]) => {
        setSubjects(subs);
        if (followingIds.length > 0) {
          const allUsers = await readUsers();
          const followedProfiles = allUsers.filter(u => followingIds.includes(u.id) && u.role !== 'Admin');
          setFollowing(followedProfiles);
        }
      }).catch(err => {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load initial data.' });
      }).finally(() => {
        setIsLoadingInitialData(false);
      });
    }
  }, [user, authLoading, router, toast]);

  useEffect(() => {
    if (selectedSubject) {
      getLessonsForSubject(selectedSubject).then(setLessons).catch(() => setLessons([]));
      form.setValue('lesson', '');
    } else {
      setLessons([]);
    }
  }, [selectedSubject, form]);

  const onSubmit = async (data: ChallengeCreationFormValues) => {
    if (!user?.id || !user.name) {
        toast({ variant: 'destructive', title: 'Error', description: 'User not properly loaded.' });
        return;
    }
    setIsLoading(true);
    try {
      const challengeDetails = {
        subject: data.subject,
        lesson: data.lesson,
        numQuestions: data.numQuestions,
        difficulty: data.difficulty as DifficultyLevel | 'all',
        examFilter: data.examFilter as ExamOption | 'all',
      };
      const result = await createChallenge(user.id, user.name, challengeDetails, data.challengedUserIds);
      if (result.success && result.challengeCode) {
        toast({ title: 'Challenge Created!', description: `Challenge code: ${result.challengeCode}. Your friends have been notified.` });
        router.push(`/challenge/lobby/${result.challengeCode}`);
      } else {
        throw new Error(result.message || 'Failed to create challenge.');
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Creation Failed', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (name?: string | null) => name ? name.charAt(0).toUpperCase() : 'U';

  if (isLoadingInitialData) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-2xl space-y-6">
        <Skeleton className="h-8 w-1/2" /> <Skeleton className="h-6 w-3/4" />
        <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-20 w-full" /></CardContent><CardFooter><Skeleton className="h-10 w-24" /></CardFooter></Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl space-y-6">
      <div className="text-center">
        <Swords className="h-12 w-12 text-primary mx-auto mb-2" />
        <h1 className="text-3xl font-bold tracking-tight">Create Challenge Test</h1>
        <p className="text-muted-foreground">Set up a test and challenge your friends!</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5 text-primary" /> Test Configuration</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="subject" render={({ field }) => (<FormItem><FormLabel>Subject *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger></FormControl><SelectContent>{subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="lesson" render={({ field }) => (<FormItem><FormLabel>Lesson *</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!selectedSubject || lessons.length === 0}><FormControl><SelectTrigger><SelectValue placeholder={!selectedSubject ? "Select Subject First" : "Select Lesson"} /></SelectTrigger></FormControl><SelectContent>{lessons.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField
                control={form.control}
                name="numQuestions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Questions (1-50) *</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value, 10))}
                      value={field.value?.toString()}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select count (1-50)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.from({ length: 50 }, (_, i) => i + 1).map(num => (
                          <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="difficulty" render={({ field }) => (<FormItem><FormLabel>Difficulty *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Difficulty" /></SelectTrigger></FormControl><SelectContent><SelectItem value="all">All Difficulties</SelectItem>{difficultyLevels.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="examFilter" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>Exam Specific Questions (Optional)</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Any Exam or Specific" /></SelectTrigger></FormControl><SelectContent><SelectItem value="all">Any Exam</SelectItem>{exams.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Challenge Friends</CardTitle>
              <CardDescription>Select up to 10 friends you are following.</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="challengedUserIds"
                render={({ field }) => (
                  <FormItem>
                    {following.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">You are not following anyone yet. <Link href="/find-friends" className="text-primary underline">Find friends</Link> to challenge.</p>
                    ) : (
                      <ScrollArea className="h-48 border rounded-md p-3">
                        <div className="space-y-2">
                          {following.map((friend) => (
                            <FormItem key={friend.id} className="flex flex-row items-center space-x-3 space-y-0 p-2 rounded hover:bg-muted/50">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(friend.id)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...(field.value || []), friend.id])
                                      : field.onChange(field.value?.filter((value) => value !== friend.id));
                                  }}
                                  disabled={(field.value?.length ?? 0) >= 10 && !field.value?.includes(friend.id)}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal flex items-center gap-2 cursor-pointer flex-grow">
                                <Avatar className="h-6 w-6"><AvatarImage src={friend.avatarUrl ? `/avatars/${friend.avatarUrl}` : `https://avatar.vercel.sh/${friend.email || friend.id}.png`} /><AvatarFallback>{getInitials(friend.name)}</AvatarFallback></Avatar>
                                <span className="truncate">{friend.name || friend.email}</span>
                              </FormLabel>
                            </FormItem>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isLoading || (following.length === 0 && (form.getValues().challengedUserIds?.length ?? 0) === 0)}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                Create &amp; Send Challenge
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}

