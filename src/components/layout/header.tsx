// src/components/layout/header.tsx
'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Settings, LogOut, HelpCircle, Loader2, Trophy, Bell, X, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import type { ChallengeInvite } from '@/types';
import { Badge } from '@/components/ui/badge'; 

// Helper function to request notification permission
const requestNotificationPermission = async () => {
  if (typeof window !== 'undefined' && !("Notification" in window)) {
    console.log("This browser does not support desktop notification");
    return false;
  } else if (typeof window !== 'undefined' && Notification.permission === "granted") {
    return true;
  } else if (typeof window !== 'undefined' && Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  return false;
};

// Helper function to display a browser notification
const showBrowserNotification = (title: string, options?: NotificationOptions) => {
  if (typeof window !== 'undefined' && Notification.permission === "granted") {
    new Notification(title, options);
  }
};


export function AppHeader() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<ChallengeInvite[]>([]);
  const [showNotificationDot, setShowNotificationDot] = useState(false);
  const [hasNotificationPermission, setHasNotificationPermission] = useState(false);
  const [actualPendingInvitesCount, setActualPendingInvitesCount] = useState(0); // For badge display

  const fetchPendingInvites = useCallback(async () => {
    if (user?.id && typeof window !== 'undefined') {
      try {
        // This is a simulation. In a real app, you'd fetch from a backend.
        const invitesJson = localStorage.getItem(`userChallengeInvites_${user.id}`);
        if (invitesJson) {
          const allInvites: ChallengeInvite[] = JSON.parse(invitesJson);
          const newPending = allInvites.filter(inv => inv.status === 'pending' && inv.expiresAt > Date.now());
          
          const lastSeenInvitesCount = parseInt(localStorage.getItem(`lastSeenInvitesCount_${user.id}_header`) || '0', 10);
          const newUnseenInvites = newPending.length > lastSeenInvitesCount;

          if (newUnseenInvites && newPending.length > 0 && hasNotificationPermission) {
            const newInviteCount = newPending.length - lastSeenInvitesCount;
             if (newInviteCount > 0) { // Only show if there are genuinely new invites
                showBrowserNotification("New Challenge Invite!", { 
                    body: `You have ${newInviteCount} new challenge invite${newInviteCount > 1 ? 's' : ''}.`,
                    icon: '/EduNexus-logo-black.jpg' // Using EduNexus logo
                });
                toast({
                  title: "New Challenge Invite!",
                  description: `You have ${newInviteCount} new challenge invite${newInviteCount > 1 ? 's' : ''}. Check the bell icon.`,
                  action: (
                    <Button variant="outline" size="sm" asChild onClick={() => router.push('/challenges/invites')}>
                      <Link href="/challenges/invites">View</Link>
                    </Button>
                  )
                });
            }
          }
          setPendingInvites(newPending);
          setActualPendingInvitesCount(newPending.length); // Update count for badge
          // Show dot if there are new invites that haven't been seen by opening the dropdown
          setShowNotificationDot(newPending.length > 0 && newPending.length > lastSeenInvitesCount);
        } else {
            setPendingInvites([]);
            setActualPendingInvitesCount(0);
            setShowNotificationDot(false);
        }
      } catch (error) {
        console.error("Error fetching simulated pending invites:", error);
        setPendingInvites([]);
        setActualPendingInvitesCount(0);
        setShowNotificationDot(false);
      }
    }
  }, [user?.id, toast, router, hasNotificationPermission]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        requestNotificationPermission().then(permissionGranted => {
            setHasNotificationPermission(permissionGranted);
            if (user?.id && permissionGranted) { // Fetch immediately if permission granted
                fetchPendingInvites();
            }
        });
        
        if (user?.id) {
          // Initial fetch
          fetchPendingInvites();
          // Simulate polling for new invites
          const intervalId = setInterval(fetchPendingInvites, 15000); // Check every 15 seconds
          return () => clearInterval(intervalId);
        }
    }
  }, [user?.id, fetchPendingInvites]);


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

  const avatarSrc = user?.avatarUrl ? `/avatars/${user.avatarUrl}` : (user?.email ? `https://avatar.vercel.sh/${user.email}.png` : undefined);
  const avatarKey = user?.avatarUrl || user?.email || user?.id;

  const handleBellClick = () => {
    if (user?.id) {
      // When bell dropdown is opened, mark current pending invites as "seen" for the dot purpose
      localStorage.setItem(`lastSeenInvitesCount_${user.id}_header`, pendingInvites.length.toString());
      setShowNotificationDot(false); // Hide dot immediately as user is viewing them
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4">
      <SidebarTrigger className="sm:hidden" />
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
        {/* Optional: Global Search or Breadcrumbs */}
      </div>

      {loading ? (
         <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : user ? (
        <div className="flex items-center gap-2 md:gap-3">
          {/* Upgrade Button */}
          {user.model !== 'combo' && (
            <Button asChild variant="outline" className="border-primary text-primary hover:bg-primary/10 hover:text-primary h-8 px-2.5 text-xs rounded-md">
              <Link href="/packages">
                <Sparkles className="mr-1 h-3 w-3" />
                Upgrade
              </Link>
            </Button>
          )}

          {/* Notification Bell */}
          <DropdownMenu onOpenChange={(open) => { if (open) handleBellClick(); }}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full">
                <Bell className="h-5 w-5" />
                {showNotificationDot && actualPendingInvitesCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                  </span>
                )}
                <span className="sr-only">Notifications</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
              <DropdownMenuLabel className="flex justify-between items-center">
                Challenge Invites
                {actualPendingInvitesCount > 0 && <Badge variant="destructive">{actualPendingInvitesCount}</Badge>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {pendingInvites.length === 0 ? (
                <DropdownMenuItem disabled className="text-sm text-muted-foreground text-center py-4">
                  No new challenge invites
                </DropdownMenuItem>
              ) : (
                pendingInvites.map(invite => (
                  <DropdownMenuItem key={invite.challengeCode} asChild className="cursor-pointer">
                    <Link href={`/challenges/invites`} className="block p-2 hover:bg-muted/50 rounded-md">
                      <p className="text-sm font-medium">New Challenge Invite!</p>
                      <p className="text-xs text-muted-foreground">
                        From: {invite.creatorName || 'A friend'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Test: {invite.testName}
                      </p>
                    </Link>
                  </DropdownMenuItem>
                ))
              )}
               <DropdownMenuSeparator />
               <DropdownMenuItem asChild>
                <Link href="/challenges/invites" className="justify-center text-primary text-sm py-2">
                    View All Invites
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Profile Dropdown */}
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
        </div>
      ) : (
        <Button asChild variant="outline" size="sm">
          <Link href="/auth/login">Login / Sign Up</Link>
        </Button>
      )}
    </header>
  );
}