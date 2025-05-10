// src/components/test-interface/test-header-bar.tsx
'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Clock, User, Maximize, Minimize, AlertTriangle } from 'lucide-react';
import type { ContextUser } from '@/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface TestHeaderBarProps {
  testName: string;
  timeLeft: number;
  user: ContextUser;
  onFullScreenToggle: () => void;
  isFullScreen: boolean;
  onSubmitTest?: () => void; // Optional submit test function
  isSubmitting?: boolean; // Optional submitting state
}

export default function TestHeaderBar({
  testName,
  timeLeft,
  user,
  onFullScreenToggle,
  isFullScreen,
  onSubmitTest,
  isSubmitting
}: TestHeaderBarProps) {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) return name.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return <User className="h-full w-full"/>;
  };

  return (
    <header className="flex items-center justify-between p-3 border-b bg-card shadow-sm sticky top-0 z-10">
      <div className="flex items-center">
        {/* Displaying only test name, paper number removed as it's not standard */}
        <h1 className="text-sm md:text-base font-semibold truncate">{testName}</h1>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <div className="flex items-center gap-2 text-sm">
            <Avatar className="h-6 w-6 md:h-7 md:w-7 border">
                <AvatarImage src={user?.avatarUrl ? `/avatars/${user.avatarUrl}` : (user?.email ? `https://avatar.vercel.sh/${user.email}.png` : undefined)} alt={user?.name || 'User'} />
                <AvatarFallback className="text-xs">{getInitials(user?.name, user?.email)}</AvatarFallback>
            </Avatar>
            <span className="text-xs md:text-sm text-muted-foreground hidden sm:inline">{user?.name || 'Student'}</span>
        </div>
        
        <div className="flex items-center gap-1 text-primary font-medium bg-primary/10 px-2 py-1 rounded-md text-sm">
          <Clock className="h-4 w-4" />
          <span>{formatTime(timeLeft)}</span>
        </div>

        <Button variant="ghost" size="icon" onClick={onFullScreenToggle} className="h-8 w-8 text-muted-foreground hover:text-primary">
          {isFullScreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          <span className="sr-only">{isFullScreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}</span>
        </Button>
        
        {onSubmitTest && (
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="h-8 px-3 text-xs" disabled={isSubmitting}>Submit Test</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Submission</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to submit the test? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={onSubmitTest} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
                            Yes, Submit
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}
      </div>
    </header>
  );
}
