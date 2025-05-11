// src/components/admin/admin-header.tsx
'use client';

import Link from 'next/link';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Home, Users, BookOpen, Settings, PanelLeft, Search, ShieldCheck, LogOut, User, Loader2, Banknote, BarChart3, ClipboardList, FileText, PlusCircle, Edit, List, Globe, PieChart, Gift, ShoppingBag, Package } from 'lucide-react'; 
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from '@/context/auth-context';
import { useRouter, usePathname } from 'next/navigation'; // Import usePathname
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils'; // Import cn utility

// Define navigation items for the mobile admin sidebar
const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: Home },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/tests/manage', label: 'Manage Tests', icon: List },
  { href: '/admin/tests/create', label: 'Create Test', icon: PlusCircle },
  { href: '/admin/questions', label: 'Add Question', icon: ClipboardList },
  { href: '/admin/questions/edit', label: 'Edit Questions', icon: Edit },
  { href: '/admin/notes', label: 'Short Notes', icon: FileText },
  { href: '/admin/payments', label: 'Payments', icon: Banknote },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/reports', label: 'Reports', icon: PieChart },
  { href: '/admin/referrals', label: 'Referrals', icon: Gift },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminHeader() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname(); // For active state in mobile
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
    if (email) return email?.charAt(0).toUpperCase();
    return 'A'; // Admin fallback
  }

  const isAdmin = user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  // Helper for isActive for mobile (since it's not using SidebarMenuButton's internal logic)
  const isActiveMobile = (href: string) => {
      if (href === '/admin' || href === '/') { // Exact match for admin dashboard and main website home
        return pathname === href;
      }
      // For other routes, check if pathname starts with href to highlight parent sections
      return pathname.startsWith(href);
  };


  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4">
      {/* Mobile Sidebar Trigger */}
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="sm:hidden">
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs w-[280px] bg-sidebar text-sidebar-foreground"> {/* Match desktop sidebar width */}
          <nav className="grid gap-2 text-sm font-medium p-4"> {/* Adjusted gap and font-size */}
             <Link
                href="/admin"
                className="group flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-primary text-lg font-semibold text-primary-foreground md:text-base mb-4"
              >
                 <Image
                    src="/EduNexus-logo-white.jpg" 
                    alt="EduNexus Admin Logo"
                    width={24} 
                    height={24}
                    className="h-6 w-6 transition-all group-hover:scale-110"
                    unoptimized
                 />
                <span className="sr-only">EduNexus Admin</span>
            </Link>
            {adminNavItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      isActiveMobile(item.href)
                        ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm" // Active styles
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground" // Inactive styles
                    )}
                  >
                    <IconComponent className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
            })}
             {/* Link to main website from mobile sidebar footer */}
             <div className="mt-auto pt-4 border-t border-sidebar-border">
                 <Link
                    href="/"
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      isActiveMobile('/')
                        ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
                    )}
                  >
                    <Globe className="h-5 w-5" />
                    Main Website
                  </Link>
             </div>
          </nav>
        </SheetContent>
      </Sheet>

       <div className="relative ml-auto flex-1 md:grow-0">
        {/* Optional: Global Search */}
       </div>

      {/* Admin User Dropdown */}
       {loading ? (
           <Loader2 className="h-6 w-6 animate-spin text-muted-foreground ml-auto" />
       ) : isAdmin ? ( 
         <DropdownMenu>
           <DropdownMenuTrigger asChild>
             <Button
               variant="outline"
               size="icon"
               className="overflow-hidden rounded-full"
             >
               <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatarUrl ? `/avatars/${user.avatarUrl}` : `https://avatar.vercel.sh/${user.email || user.id}.png`} alt="Admin Avatar" />
                  <AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback>
              </Avatar>
             </Button>
           </DropdownMenuTrigger>
           <DropdownMenuContent align="end">
             <DropdownMenuLabel>{user.name || user.email} (Admin)</DropdownMenuLabel>
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
       ) : null }
    </header>
  );
}
