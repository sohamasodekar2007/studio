'use client';

import Link from 'next/link';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Home, Users, BookOpen, Settings, PanelLeft, Search, ShieldCheck, LogOut, User, Loader2 } from 'lucide-react'; // Added Loader2
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from '@/context/auth-context'; // Use main auth context
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
// Remove Firebase imports
// import { signOut } from 'firebase/auth';
// import { auth } from '@/lib/firebase';
import { useState } from 'react';

// Define navigation items for the mobile admin sidebar
const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: Home },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/tests', label: 'Tests', icon: BookOpen },
  { href: '/admin/payments', label: 'Payments', icon: 'DollarSign' }, // Keep as string if icon missing temporarily
  { href: '/admin/analytics', label: 'Analytics', icon: 'BarChart3' }, // Keep as string if icon missing temporarily
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminHeader() {
  const { user, loading, logout } = useAuth(); // Use logout from context
  const router = useRouter();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout(); // Call the simulated logout from context
      toast({ title: "Logged Out", description: "Admin session ended." });
       // AuthProvider might handle redirect, or do it manually if needed:
       // router.push('/auth/login');
    } catch (error: any) {
      console.error("Admin Logout failed (simulated):", error);
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

  // Helper to render icons safely
    const renderIcon = (icon: React.ElementType | string) => {
    if (typeof icon === 'string') {
        // Handle potential missing icons gracefully (e.g., return a default or null)
        console.warn(`Icon "${icon}" might be missing.`);
         switch(icon) {
             case 'DollarSign': return <DollarSign className="h-5 w-5" />;
             case 'BarChart3': return <BarChart3 className="h-5 w-5" />;
             // Add other cases or a default
             default: return <ShieldCheck className="h-5 w-5" />; // Default placeholder
         }
    }
    const IconComponent = icon;
    return <IconComponent className="h-5 w-5" />;
    };


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
                 {renderIcon(item.icon)}
                {item.label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

       <div className="relative ml-auto flex-1 md:grow-0">
        {/* Optional: Global Search */}
       </div>

      {/* Admin User Dropdown */}
       {loading ? (
           <Loader2 className="h-6 w-6 animate-spin text-muted-foreground ml-auto" />
       ) : user && ( // Show only if admin user is logged in
         <DropdownMenu>
           <DropdownMenuTrigger asChild>
             <Button
               variant="outline"
               size="icon"
               className="overflow-hidden rounded-full"
             >
               <Avatar className="h-8 w-8">
                   {/* Use placeholder avatar */}
                  <AvatarImage src={`https://avatar.vercel.sh/${user.email || user.uid}.png`} alt="Admin Avatar" />
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
               {isLoggingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <LogOut className="mr-2 h-4 w-4" />}
               Logout
             </DropdownMenuItem>
           </DropdownMenuContent>
         </DropdownMenu>
       )}
    </header>
  );
}
