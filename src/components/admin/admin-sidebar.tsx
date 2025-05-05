'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, BookOpen, Settings, BarChart3, DollarSign, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Define navigation items for the admin sidebar
const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: Home },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/tests', label: 'Tests', icon: BookOpen },
  { href: '/admin/payments', label: 'Payments', icon: DollarSign }, // Example for paid features
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 }, // Example
  { href: '/admin/settings', label: 'Settings', icon: Settings }, // Platform settings
];

export function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || (href !== '/admin' && pathname.startsWith(href));

  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
      <TooltipProvider>
        <nav className="flex flex-col items-center gap-4 px-2 py-4">
           <Link
              href="/admin"
              className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
            >
                <ShieldCheck className="h-4 w-4 transition-all group-hover:scale-110" />
                <span className="sr-only">ExamPrep Admin</span>
           </Link>

          {adminNavItems.map((item) => (
             <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                    <Link
                        href={item.href}
                        className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8',
                        isActive(item.href) ? 'bg-accent text-accent-foreground' : ''
                        )}
                    >
                        <item.icon className="h-5 w-5" />
                        <span className="sr-only">{item.label}</span>
                    </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          ))}
        </nav>
        {/* Optional: Add settings/logout at the bottom */}
        {/* <nav className="mt-auto flex flex-col items-center gap-4 px-2 py-4">
           <Tooltip>
                <TooltipTrigger asChild>
                    <Link
                        href="/admin/settings"
                         className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8',
                         isActive('/admin/settings') ? 'bg-accent text-accent-foreground' : ''
                        )}
                    >
                        <Settings className="h-5 w-5" />
                        <span className="sr-only">Settings</span>
                    </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>
        </nav> */}
      </TooltipProvider>
    </aside>
  );
}
