// src/components/layout/maintenance-mode-page.tsx
'use client';

import { ServerCrash } from 'lucide-react';
import Image from 'next/image';

export default function MaintenanceModePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-center p-4">
      <Image
        src="/EduNexus-logo-black.jpg" 
        alt="EduNexus Logo"
        width={80}
        height={80}
        className="h-20 w-20 mb-6 dark:hidden"
        unoptimized
      />
      <Image
        src="/EduNexus-logo-white.jpg"
        alt="EduNexus Logo"
        width={80}
        height={80}
        className="h-20 w-20 mb-6 hidden dark:block"
        unoptimized
      />
      <ServerCrash className="w-16 h-16 text-primary mb-6" />
      <h1 className="text-3xl font-bold text-foreground mb-3">Under Maintenance</h1>
      <p className="text-muted-foreground max-w-md">
        EduNexus is currently undergoing scheduled maintenance to improve your learning experience.
        We'll be back online shortly. Thank you for your patience!
      </p>
      {/* You can add an estimated downtime or a link to a status page if you have one */}
      {/* <p className="text-sm text-muted-foreground mt-4">Estimated completion: Approximately 1 hour.</p> */}
    </div>
  );
}
