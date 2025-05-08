'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";
import { useAuth } from '@/context/auth-context';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function FriendsComparePage() {
    const { user } = useAuth();
    const isPremium = user?.model !== 'free';

    if (!isPremium) {
         return (
            <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6 text-center">
                 <h1 className="text-3xl font-bold tracking-tight">Compare Performance</h1>
                 <Alert variant="default" className="text-left bg-primary/5 border-primary/20 max-w-lg mx-auto">
                   <AlertTriangle className="h-4 w-4 text-primary" />
                   <AlertTitle className="text-primary">Premium Feature</AlertTitle>
                   <AlertDescription>
                     Comparing performance with friends and creating custom comparison tests are premium features. Upgrade your plan to unlock these capabilities.
                   </AlertDescription>
                   {/* Optional: Add an upgrade button */}
                    <Button size="sm" className="mt-4" disabled>Upgrade Plan (Coming Soon)</Button>
                 </Alert>
            </div>
         );
    }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-center">Compare Performance</h1>
      <p className="text-muted-foreground text-center">Compare your stats with friends or create custom challenges.</p>

      <Card className="text-center border-dashed border-amber-500 bg-amber-50 dark:bg-amber-950">
        <CardHeader>
          <div className="mx-auto bg-primary/10 rounded-full p-3 w-fit">
            <Construction className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="mt-4">Under Construction</CardTitle>
          <CardDescription>Friend comparison features are currently under development.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Coming soon: Compare test scores, points, accuracy, and create custom test challenges with your friends!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
