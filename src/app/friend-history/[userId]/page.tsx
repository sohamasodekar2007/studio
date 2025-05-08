'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Construction, ArrowLeft } from "lucide-react";
import { useAuth } from '@/context/auth-context';
import Link from 'next/link';

export default function FriendHistoryPage() {
    const params = useParams();
    const friendUserId = params.userId as string;
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    // TODO: Fetch friend's profile data and check if current user follows them

    if (authLoading) {
        return <div>Loading...</div>; // Or skeleton loader
    }

    if (!user) {
        router.push('/auth/login'); // Redirect if not logged in
        return null;
    }

    // TODO: Add logic to check if the current user is allowed to see this friend's history (e.g., are they following each other?)

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
         <div className="mb-4">
          <Link href="/friends-following" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Back to Following List
          </Link>
        </div>
      <h1 className="text-3xl font-bold tracking-tight text-center">Friend's Test History</h1>
      <p className="text-muted-foreground text-center">Viewing history for user ID: {friendUserId}</p>

      <Card className="text-center border-dashed border-amber-500 bg-amber-50 dark:bg-amber-950">
        <CardHeader>
          <div className="mx-auto bg-primary/10 rounded-full p-3 w-fit">
            <Construction className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="mt-4">Under Construction</CardTitle>
          <CardDescription>Viewing a friend's test history is currently under development.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Soon you'll be able to see your friend's test attempts and performance here (if they allow it).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
