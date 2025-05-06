
import type { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './sidebar';
import { AppHeader } from './header';
import { cn } from '@/lib/utils'; // Import cn

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen bg-background"> {/* Use background from theme */}
        <AppSidebar />
        {/* Main content wrapper with margin adjusted by sidebar state */}
        <div
          className={cn(
            "flex flex-col flex-1 transition-[margin-left] duration-300 ease-in-out",
            // Apply margin only on sm+ screens
            // When sidebar is expanded (default state, or data-state=expanded)
            "sm:ml-[var(--sidebar-width)]",
             // When sidebar is collapsed (data-state=collapsed)
            "peer-data-[state=collapsed]:sm:ml-[var(--sidebar-width-icon)]" // Adjust margin when collapsed
          )}
        >
          <AppHeader />
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
