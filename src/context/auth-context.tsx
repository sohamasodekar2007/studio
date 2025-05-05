// src/context/auth-context.tsx
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';
// Remove Firebase imports
// import { onAuthStateChanged, type User } from 'firebase/auth';
// import { auth, firebaseInitializationError } from '@/lib/firebase'; // Import auth AND the error status
import type { UserProfile } from '@/types'; // Use our UserProfile type
import { Skeleton } from '@/components/ui/skeleton';
import { findUserByCredentials } from '@/actions/auth-actions'; // Import action to find user locally

// Define simulated User type based on UserProfile
// This mimics the Firebase User type shape minimally for compatibility
type SimulatedUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  // Add other fields if needed by components expecting a Firebase User-like object
  photoURL?: string | null; // Example
} | null;

interface AuthContextProps {
  user: SimulatedUser; // Use simulated user type
  loading: boolean;
  // Keep initializationError conceptually, though it won't be Firebase specific
  initializationError: string | null;
  // Add login/logout functions for local simulation
  login: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  signUpLocally: (userData: UserProfile) => Promise<void>; // Added for local signup simulation
}

// Provide default no-op functions for login/logout
const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  initializationError: null, // Start with no error
  login: async () => { console.warn('Login function not implemented'); },
  logout: async () => { console.warn('Logout function not implemented'); },
  signUpLocally: async () => { console.warn('signUpLocally function not implemented'); },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SimulatedUser>(null);
  const [loading, setLoading] = useState(true);
  // Use a simple local error state if needed, not tied to Firebase init
  const [localError, setLocalError] = useState<string | null>(null);

  // Effect to load user state from local storage on mount (client-side only)
  useEffect(() => {
    setLoading(true);
    try {
      const storedUser = localStorage.getItem('loggedInUser');
      if (storedUser) {
        const parsedUser: UserProfile = JSON.parse(storedUser);
        // Convert UserProfile to SimulatedUser shape
        setUser({
            uid: parsedUser.uid,
            email: parsedUser.email,
            displayName: parsedUser.name,
            // photoURL: parsedUser.photoURL, // Example if needed
        });
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error reading user from local storage:', error);
      setUser(null); // Clear user if error during parsing
      localStorage.removeItem('loggedInUser'); // Clean up potentially corrupted data
    } finally {
      setLoading(false);
      setLocalError(null); // Clear any previous local errors
    }
  }, []); // Runs only once on mount


  // Simulated Login Function
  const login = async (email: string, password?: string) => {
    setLoading(true);
    setLocalError(null);
    try {
        // Use the server action to find the user in users.json
        const foundUser = await findUserByCredentials(email, password);

        if (foundUser) {
            // Convert UserProfile to SimulatedUser shape
            const loggedInUser: SimulatedUser = {
                uid: foundUser.uid,
                email: foundUser.email,
                displayName: foundUser.name,
                 // photoURL: foundUser.photoURL, // Example if needed
            };
            setUser(loggedInUser);
            localStorage.setItem('loggedInUser', JSON.stringify(foundUser)); // Store UserProfile
             console.log(`User ${email} logged in (simulated).`);
        } else {
            throw new Error('Invalid email or password (simulated).');
        }
    } catch (error: any) {
        console.error("Simulated login failed:", error);
        setLocalError(error.message || 'Login failed.');
        setUser(null);
        localStorage.removeItem('loggedInUser');
    } finally {
        setLoading(false);
    }
  };

  // Simulated Logout Function
  const logout = async () => {
    setLoading(true);
    setLocalError(null);
    try {
        setUser(null);
        localStorage.removeItem('loggedInUser');
         console.log("User logged out (simulated).");
    } catch (error: any) {
        console.error("Simulated logout failed:", error);
        setLocalError(error.message || 'Logout failed.');
    } finally {
        setLoading(false);
    }
  };

  // Simulated Sign Up (only updates context and local storage)
  // Assumes the user data has already been saved to users.json via the server action
   const signUpLocally = async (userData: UserProfile) => {
    setLoading(true);
    setLocalError(null);
    try {
      if (!userData) {
          throw new Error("User data is missing for local signup simulation.");
      }
      // Convert UserProfile to SimulatedUser shape
       const newUser: SimulatedUser = {
            uid: userData.uid,
            email: userData.email,
            displayName: userData.name,
            // photoURL: userData.photoURL, // Example if needed
       };
      setUser(newUser);
      localStorage.setItem('loggedInUser', JSON.stringify(userData)); // Store UserProfile
      console.log(`User ${userData.email} signed up and logged in (simulated).`);
    } catch (error: any) {
        console.error("Simulated local signup failed:", error);
        setLocalError(error.message || 'Local signup failed.');
        setUser(null);
        localStorage.removeItem('loggedInUser');
    } finally {
        setLoading(false);
    }
  };


  // Show a simple loading state
  if (loading) {
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

  // Display a local error message if needed
  if (localError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-destructive/10 text-destructive-foreground p-6">
         <div className="max-w-md text-center bg-destructive text-white p-6 rounded-lg shadow-lg">
           <h2 className="text-2xl font-bold mb-2">Application Error</h2>
           <p className="text-sm">{localError}</p>
           {/* Optionally add a refresh button or further guidance */}
         </div>
      </div>
    );
  }


  return (
    <AuthContext.Provider value={{ user, loading, initializationError: localError, login, logout, signUpLocally }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
