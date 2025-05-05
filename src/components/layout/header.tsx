import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { GraduationCap, User, Settings, LogOut, HelpCircle } from 'lucide-react'; // Added HelpCircle
import Link from 'next/link';

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4">
      <SidebarTrigger className="sm:hidden" />
      {/* Placeholder for Breadcrumbs or Page Title if needed */}
      <div className="flex-1">
        {/* Optionally add page title here */}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="overflow-hidden rounded-full">
            <Avatar>
              <AvatarImage src="https://picsum.photos/40/40" alt="User Avatar" data-ai-hint="user avatar" />
              <AvatarFallback><User /></AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
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
           <DropdownMenuItem asChild>
             {/* Assuming logout redirects to login for now */}
             <Link href="/auth/login">
               <LogOut className="mr-2 h-4 w-4" />
               Logout
             </Link>
           </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
