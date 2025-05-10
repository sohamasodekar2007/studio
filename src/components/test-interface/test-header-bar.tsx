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
  user: ContextUser; // Keep user for potential future use (e.g., display name)
  // Fullscreen toggle props removed as it might be distracting or handled by browser
}

export default function TestHeaderBar({
  testName,
  timeLeft,
  user,
}: TestHeaderBarProps) {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <header className="flex items-center justify-between p-3 border-b bg-card shadow-sm sticky top-0 z-10">
      <div className="flex items-center">
        <h1 className="text-sm md:text-base font-semibold truncate">{testName}</h1>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <div className="flex items-center gap-1 text-primary font-medium bg-primary/10 px-2 py-1 rounded-md text-sm">
          <Clock className="h-4 w-4" />
          <span>{formatTime(timeLeft)}</span>
        </div>
        {/* Submit button is generally placed in the QuestionPalette or at the end of the test */}
      </div>
    </header>
  );
}
