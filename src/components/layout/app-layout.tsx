// src/components/layout/app-layout.tsx
'use client'; // AppLayout needs to be a client component to use SidebarProvider context

import type { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './sidebar';
import { AppHeader } from './header';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen bg-background">
        <AppSidebar />
        <div
          className={cn(
            "flex flex-col flex-1 transition-[margin-left] duration-300 ease-in-out",
            "sm:ml-[var(--sidebar-width)]",
            "peer-data-[state=collapsed]:sm:ml-[var(--sidebar-width-icon)]"
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
