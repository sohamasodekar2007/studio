
import type { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './sidebar';
import { AppHeader } from './header';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    // Wrap the entire layout structure with SidebarProvider
    <SidebarProvider defaultOpen>
       <div className="flex min-h-screen"> {/* Main flex container */}
        <AppSidebar />
        <div className="flex flex-col flex-1"> {/* Content area flex container */}
          <AppHeader />
          <main className="flex-1 p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
       </div>
    </SidebarProvider>
  );
}

