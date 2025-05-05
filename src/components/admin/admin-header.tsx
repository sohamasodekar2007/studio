'use client';

import Link from 'next/link';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Home, Users, BookOpen, Settings, PanelLeft, Search, ShieldCheck, LogOut, User } from 'lucide-react'; // Added icons
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from '@/context/auth-context'; // Use main auth context for now
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useState } from 'react';

// Define navigation items for the mobile admin sidebar
const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: Home },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/tests', label: 'Tests', icon: BookOpen },
  // Add more as needed
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminHeader() {
  const { user, loading } = useAuth(); // Assuming admin uses the same auth state for now
  const router = useRouter();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
      toast({ title: "Logged Out", description: "Admin session ended." });
      router.push('/auth/login'); // Redirect to main login
    } catch (error: any) {
      console.error("Admin Logout failed:", error);
      toast({ variant: "destructive", title: "Logout Failed", description: error.message });
    } finally {
       setIsLoggingOut(false);
    }
  };

  // Placeholder initials logic
  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) return name.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return 'A'; // Admin fallback
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4 sm:ml-14">
      {/* Mobile Sidebar Trigger */}
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="sm:hidden">
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs">
          <nav className="grid gap-6 text-lg font-medium">
             <Link
                href="/admin"
                className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base"
              >
                <ShieldCheck className="h-5 w-5 transition-all group-hover:scale-110" />
                <span className="sr-only">ExamPrep Admin</span>
            </Link>
            {adminNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

       {/* Optional: Breadcrumbs or Page Title could go here */}
       {/* <div className="hidden sm:block"> ... Breadcrumbs ... </div> */}

      <div className="relative ml-auto flex-1 md:grow-0">
        {/* Optional: Global Search */}
        {/* <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search..."
          className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
        /> */}
      </div>

      {/* Admin User Dropdown */}
       {user && ( // Show only if admin user is logged in
         <DropdownMenu>
           <DropdownMenuTrigger asChild>
             <Button
               variant="outline"
               size="icon"
               className="overflow-hidden rounded-full"
             >
               <Avatar className="h-8 w-8">
                  <AvatarImage src={user.photoURL || undefined} alt="Admin Avatar" />
                  <AvatarFallback>{getInitials(user.displayName, user.email)}</AvatarFallback>
              </Avatar>
             </Button>
           </DropdownMenuTrigger>
           <DropdownMenuContent align="end">
             <DropdownMenuLabel>{user.displayName || user.email} (Admin)</DropdownMenuLabel>
             <DropdownMenuSeparator />
             <DropdownMenuItem asChild>
               <Link href="/settings"> {/* Link to main user settings */}
                 <User className="mr-2 h-4 w-4" />
                 My Profile
               </Link>
             </DropdownMenuItem>
             <DropdownMenuItem asChild>
                <Link href="/admin/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Admin Settings
                </Link>
             </DropdownMenuItem>
             <DropdownMenuSeparator />
             <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut}>
               <LogOut className="mr-2 h-4 w-4" />
               Logout
             </DropdownMenuItem>
           </DropdownMenuContent>
         </DropdownMenu>
       )}
    </header>
  );
}
