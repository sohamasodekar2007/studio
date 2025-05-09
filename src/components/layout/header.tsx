// src/components/layout/header.tsx
'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Settings, LogOut, HelpCircle, Loader2, Trophy } from 'lucide-react'; // Added Trophy
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import Image from 'next/image'; // Import Image

export function AppHeader() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
       toast({
         title: "Logged Out",
         description: "You have been successfully logged out.",
       });
      // Redirect handled by AuthContext
    } catch (error: any) {
      console.error("Logout failed:", error);
      toast({
        variant: "destructive",
        title: "Logout Failed",
        description: error.message || "Could not log out. Please try again.",
      });
    } finally {
       setIsLoggingOut(false);
    }
  };

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) return name.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return <User className="h-full w-full"/>;
  }

  // Construct avatar URL: use avatarUrl if present, otherwise use Vercel Avatars link
  const avatarSrc = user?.avatarUrl ? `/avatars/${user.avatarUrl}` : (user?.email ? `https://avatar.vercel.sh/${user.email}.png` : undefined);
  const avatarKey = user?.avatarUrl || user?.email || user?.id;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4">
      <SidebarTrigger className="sm:hidden" />
       {/* EduNexus Logo/Name for mobile view, if sidebar is collapsed */}
      <div className="sm:hidden group-data-[state=collapsed]:flex items-center gap-2">
          <Image
              src="/EduNexus-logo-black.jpg"
              alt="EduNexus Logo"
              width={28}
              height={28}
              className="h-7 w-7 dark:hidden"
              unoptimized
          />
          <Image
              src="/EduNexus-logo-white.jpg"
              alt="EduNexus Logo"
              width={28}
              height={28}
              className="h-7 w-7 hidden dark:block"
              unoptimized
          />
          <span className="font-semibold text-lg">EduNexus</span>
      </div>
      <div className="flex-1">
        {/* Optionally add page title or breadcrumbs here */}
      </div>
      {loading ? (
         <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="overflow-hidden rounded-full h-9 w-9">
              <Avatar className="h-full w-full">
                {avatarSrc && <AvatarImage src={avatarSrc} alt={user.name || 'User Avatar'} key={avatarKey} />}
                <AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
                <p className="font-medium truncate">{user.name || user.email}</p>
                <p className="text-xs text-muted-foreground capitalize">{user.role} - {user.model} Plan</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <User className="mr-2 h-4 w-4" />
                My Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/leaderboard">
                <Trophy className="mr-2 h-4 w-4" />
                Leaderboard
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/help">
                <HelpCircle className="mr-2 h-4 w-4" />
                Support
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut} className="text-destructive focus:text-destructive focus:bg-destructive/10">
              {isLoggingOut ? (
                 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
               ) : (
                 <LogOut className="mr-2 h-4 w-4" />
              )}
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button asChild variant="outline" size="sm">
          <Link href="/auth/login">Login / Sign Up</Link>
        </Button>
      )}
    </header>
  );
}