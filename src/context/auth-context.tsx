// src/context/auth-context.tsx
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase'; // Import auth, which might be null
import { Skeleton } from '@/components/ui/skeleton'; // For loading state

interface AuthContextProps {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Check if auth instance exists before subscribing
    if (!auth) {
        console.error("Firebase Auth instance is not available. Check Firebase configuration in .env and src/lib/firebase.ts");
        setAuthError("Firebase configuration is missing or invalid. Authentication unavailable.");
        setLoading(false);
        return; // Stop execution if auth is null
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      setAuthError(null); // Clear any previous error on successful listener setup
    }, (error) => {
        // Handle errors during listener setup itself (less common)
        console.error("Error in onAuthStateChanged listener:", error);
        setAuthError("Error connecting to Firebase Authentication.");
        setUser(null);
        setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []); // Empty dependency array ensures this runs once on mount

  // Show a simple loading state while checking auth status
  if (loading) {
     // Simple full-page loading indicator
     return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="space-y-4 w-full max-w-sm p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-10 w-full mt-4" />
        </div>
      </div>
    );
  }

  // Optionally display a persistent error if auth failed to initialize
   if (authError) {
     return (
       <div className="flex items-center justify-center min-h-screen bg-destructive/10 text-destructive p-4 text-center">
          <div>
             <h2 className="text-xl font-semibold mb-2">Authentication Error</h2>
             <p>{authError}</p>
             <p className="mt-2 text-sm text-muted-foreground">Please check the console and ensure your Firebase environment variables are correctly set in the <code>.env</code> file.</p>
          </div>
       </div>
     );
   }


  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
