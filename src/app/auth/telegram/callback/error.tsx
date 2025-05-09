// src/app/auth/telegram/callback/error.tsx
'use client'; 

import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function TelegramCallbackError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-destructive/5">
      <AlertTriangle className="w-16 h-16 text-destructive mb-6" />
      <h2 className="text-2xl font-semibold text-destructive mb-3">Telegram Authentication Failed</h2>
      <p className="text-destructive-foreground/80 mb-2">
        Oops! Something went wrong while trying to log you in with Telegram.
      </p>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        Error: {error.message || "An unknown error occurred."}
      </p>
      <div className="flex gap-4">
        <Button onClick={() => reset()} variant="outline">
          Try Again
        </Button>
        <Button asChild>
          <Link href="/auth/login">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
          </Link>
        </Button>
      </div>
    </div>
  );
}
