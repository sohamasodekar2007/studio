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

  const getInitials = (name?: string | null) => {
    if (name) return name.charAt(0).toUpperCase();
    if (user?.email) return user.email.charAt(0).toUpperCase();
    return <User className="h-4 w-4"/>;
  };

  const avatarSrc = user?.avatarUrl ? `/avatars/${user.avatarUrl}` : (user?.email ? `https://avatar.vercel.sh/${user.email}.png` : undefined);
  const avatarKey = user?.avatarUrl || user?.email || user?.id;


  return (
    <header className="flex items-center justify-between p-3 border-b bg-card shadow-sm sticky top-0 z-10">
      <div className="flex items-center gap-2">
         <Avatar className="h-7 w-7">
             {avatarSrc && <AvatarImage src={avatarSrc} alt={user?.name || 'User Avatar'} key={avatarKey} />}
             <AvatarFallback className="text-xs">{getInitials(user?.name)}</AvatarFallback>
         </Avatar>
        <h1 className="text-sm md:text-base font-semibold truncate max-w-[150px] sm:max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl">{testName}</h1>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <div className="flex items-center gap-1 text-primary font-medium bg-primary/10 px-2 py-1 rounded-md text-sm">
          <Clock className="h-4 w-4" />
          <span>{formatTime(timeLeft)}</span>
        </div>
        {/* Fullscreen button removed */}
      </div>
    </header>
  );
}
