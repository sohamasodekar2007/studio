// src/components/layout/app-layout.tsx
'use client'; 

import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './sidebar';
import { AppHeader } from './header';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { getPlatformSettings } from '@/actions/settings-actions';
import MaintenanceModePage from './maintenance-mode-page'; // Import the new page
import { Skeleton } from '@/components/ui/skeleton'; // For loading state
import type { PlatformSettings } from '@/types';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, loading: authLoading } = useAuth();
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const settings = await getPlatformSettings();
        setPlatformSettings(settings);
      } catch (error) {
        console.error("Failed to fetch platform settings:", error);
        // Fallback to default settings if fetching fails
        setPlatformSettings({
            maintenanceModeEnabled: false,
            newRegistrationsOpen: true,
            defaultTestAccess: 'free',
            enableEmailNotifications: true,
            enableInAppNotifications: true,
        });
      } finally {
        setIsLoadingSettings(false);
      }
    }
    fetchSettings();
  }, []);

  if (authLoading || isLoadingSettings) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="space-y-4 w-full max-w-md p-4">
          <Skeleton className="h-10 w-3/4 mx-auto" />
          <Skeleton className="h-6 w-1/2 mx-auto" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }
  
  const isMaintenanceMode = platformSettings?.maintenanceModeEnabled || false;
  const isAdmin = user?.role === 'Admin';

  if (isMaintenanceMode && !isAdmin) {
    return <MaintenanceModePage />;
  }

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
