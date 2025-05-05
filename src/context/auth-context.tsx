// src/context/auth-context.tsx
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, firebaseInitializationError } from '@/lib/firebase'; // Import auth AND the error status
import { Skeleton } from '@/components/ui/skeleton'; // For loading state
import { AlertTriangle } from 'lucide-react'; // For error icon

interface AuthContextProps {
  user: User | null;
  loading: boolean;
  initializationError: string | null; // Expose initialization error
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  initializationError: firebaseInitializationError, // Initialize with error from firebase.ts
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Use the error status imported from firebase.ts
  const [initError, setInitError] = useState<string | null>(firebaseInitializationError);

  useEffect(() => {
    // If there was an initialization error, don't attempt to set up listener
    if (initError) {
      setLoading(false);
      return;
    }

    // Ensure auth instance exists (double check, although initError should cover this)
    if (!auth) {
        const errorMsg = "Firebase Auth instance is unexpectedly null. Initialization might have failed silently.";
        console.error(errorMsg);
        setInitError(errorMsg);
        setLoading(false);
        return;
    }

    // Set up the auth state listener ONLY if initialization was successful
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      setInitError(null); // Clear error if listener works
    }, (error) => {
        console.error("Error in onAuthStateChanged listener:", error);
        const errorMsg = `Error setting up Firebase Authentication listener: ${error.message}`;
        setInitError(errorMsg);
        setUser(null);
        setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [initError]); // Re-run effect if initError changes (though it shouldn't change after initial load)

  // Show a simple loading state while checking auth status or waiting for initialization
  if (loading && !initError) { // Only show skeleton if no error yet
     return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="space-y-4 w-full max-w-sm p-4">
           {/* Simulate App Layout Loading */}
          <Skeleton className="h-14 w-full" /> {/* Header */}
           <div className="flex gap-4">
              <Skeleton className="h-[calc(100vh-7rem)] w-16 hidden sm:block" /> {/* Sidebar */}
              <div className="flex-1 space-y-4">
                 <Skeleton className="h-10 w-1/2" /> {/* Page Title */}
                 <Skeleton className="h-40 w-full" /> {/* Content Card */}
                 <Skeleton className="h-40 w-full" /> {/* Content Card */}
              </div>
           </div>
        </div>
      </div>
    );
  }

  // Display a prominent, persistent error message if Firebase initialization failed
   if (initError) {
     return (
       <div className="flex items-center justify-center min-h-screen bg-destructive/10 text-destructive-foreground p-6">
          <div className="max-w-md text-center bg-destructive text-white p-6 rounded-lg shadow-lg">
             <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-white" />
             <h2 className="text-2xl font-bold mb-2">Firebase Configuration Error</h2>
             <p className="text-sm mb-4">The application could not connect to Firebase. Authentication and other Firebase features are unavailable.</p>
             <p className="text-xs font-mono bg-black/20 p-2 rounded text-left mb-4 overflow-auto max-h-40">
                {initError}
             </p>
             <p className="text-xs">
                This usually means the Firebase configuration variables (<code>NEXT_PUBLIC_FIREBASE_...</code>) in your <code>.env</code> file are missing, incorrect, or the API key is invalid.
             </p>
             <p className="text-xs mt-2">
                Please carefully review the <code>README.md</code> setup instructions and ensure all required values from your Firebase project settings are correctly copied into your <code>.env</code> file. You may need to restart the development server after updating the <code>.env</code> file.
             </p>
          </div>
       </div>
     );
   }


  return (
    // Provide the error state through context as well, though it's primarily handled above
    <AuthContext.Provider value={{ user, loading, initializationError: initError }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
