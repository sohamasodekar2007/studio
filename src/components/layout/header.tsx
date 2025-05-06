
'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Settings, LogOut, HelpCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context'; // Use our AuthContext
// Remove Firebase imports
// import { auth } from '@/lib/firebase';
// import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

export function AppHeader() {
  const { user, loading, logout } = useAuth(); // Get user, loading, and simulated logout
  const router = useRouter();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout(); // Call the simulated logout function from context
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
      // No need to manually push to login, AuthProvider might handle redirect or UI update
       // If AuthProvider doesn't redirect, uncomment the line below:
       // router.push('/auth/login');
    } catch (error: any) {
      console.error("Logout failed (simulated):", error);
      toast({
        variant: "destructive",
        title: "Logout Failed",
        description: error.message || "Could not log out. Please try again.",
      });
    } finally {
       setIsLoggingOut(false);
    }
  };

  // Get first letter of display name or email for fallback
  const getInitials = (name: string | null | undefined, email: string | null | undefined) => {
    if (name) {
      return name.charAt(0).toUpperCase();
    }
    if (email) {
      return email.charAt(0).toUpperCase();
    }
    return <User />; // Default icon if no name/email
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4">
      <SidebarTrigger className="sm:hidden" />
      <div className="flex-1">
        {/* Optionally add page title or breadcrumbs here */}
      </div>
      {loading ? (
         <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="overflow-hidden rounded-full">
              <Avatar>
                 {/* Use a placeholder avatar for local auth */}
                <AvatarImage src={`https://avatar.vercel.sh/${user.email || user.id}.png`} alt={user.displayName || user.email || 'User Avatar'} />
                <AvatarFallback>{getInitials(user.displayName, user.email)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user.displayName || user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
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
            <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut}>
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
        <Button asChild variant="outline">
          <Link href="/auth/login">Login / Sign Up</Link>
        </Button>
      )}
    </header>
  );
}
