// src/app/auth/telegram/callback/loading.tsx
import { Loader2 } from 'lucide-react';

export default function TelegramCallbackLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground">Verifying Telegram login...</p>
    </div>
  );
}
