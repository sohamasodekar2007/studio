'use client';

import Link from 'next/link';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Home, Users, BookOpen, Settings, PanelLeft, Search, ShieldCheck, LogOut, User, Loader2, Banknote, BarChart3, ClipboardList, FileText } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { cn } from '@/lib/utils'; // Import cn utility

// Define navigation items for the mobile admin sidebar
const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: Home },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/tests', label: 'Tests', icon: BookOpen },
  { href: '/admin/questions', label: 'Question Bank', icon: ClipboardList },
  { href: '/admin/notes', label: 'Short Notes', icon: FileText },
  { href: '/admin/payments', label: 'Payments', icon: Banknote },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminHeader() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      toast({ title: "Logged Out", description: "Admin session ended." });
       router.push('/auth/login');
    } catch (error: any) {
      console.error("Admin Logout failed (simulated):", error);
      toast({ variant: "destructive", title: "Logout Failed", description: error.message });
    } finally {
       setIsLoggingOut(false);
    }
  };

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) return name.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return 'A'; // Admin fallback
  }

  const renderIcon = (icon: React.ElementType) => {
        const IconComponent = icon;
        return <IconComponent className="h-5 w-5" />;
    };

  const isAdmin = user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;


  return (
    <header className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4",
         // Adjust margin based on sidebar state on desktop
         "sm:ml-0 peer-data-[state=expanded]:sm:ml-[--sidebar-width] peer-data-[state=collapsed]:sm:ml-[--sidebar-width-icon]"
    )}>
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
                <span className="sr-only">Study Sphere Admin</span>
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
       ) : isAdmin ? ( // Only show if the user is the admin
         <DropdownMenu>
           <DropdownMenuTrigger asChild>
             <Button
               variant="outline"
               size="icon"
               className="overflow-hidden rounded-full"
             >
               <Avatar className="h-8 w-8">
                  <AvatarImage src={`https://avatar.vercel.sh/${user.email || user.id}.png`} alt="Admin Avatar" />
                  <AvatarFallback>{getInitials(user.displayName, user.email)}</AvatarFallback>
              </Avatar>
             </Button>
           </DropdownMenuTrigger>
           <DropdownMenuContent align="end">
             <DropdownMenuLabel>{user.displayName || user.email} (Admin)</DropdownMenuLabel>
             <DropdownMenuSeparator />
             <DropdownMenuItem asChild>
               <Link href="/settings">
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
       ) : null /* Hide dropdown if not admin */}
    </header>
  );
}
