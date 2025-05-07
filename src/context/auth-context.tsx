// src/context/auth-context.tsx
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { UserProfile, UserModel, AcademicStatus } from '@/types'; // Use our UserProfile type
import { Skeleton } from '@/components/ui/skeleton';
import { findUserByCredentials, findUserByEmail } from '@/actions/auth-actions'; // Import actions to find user locally
import { saveUserToJson } from '@/actions/user-actions'; // Import action to save user
import { useRouter } from 'next/navigation'; // Import useRouter for redirection
import { v4 as uuidv4 } from 'uuid'; // Import UUID generator

// Define simulated User type based on UserProfile, omitting sensitive/unused fields for context
// This provides components with necessary display/logic info without exposing password.
type SimulatedUser = {
  id: string; // User ID is now always a string (UUID or existing string ID)
  email: string | null;
  displayName: string | null;
  phone: string | null;
  className: AcademicStatus | null; // Changed from academicStatus
  model: UserModel;
  expiry_date: string | null;
} | null;

interface AuthContextProps {
  user: SimulatedUser; // Use updated simulated user type
  loading: boolean;
  initializationError: string | null; // Keep for potential non-Firebase errors
  login: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  signUpLocally: (userData: Omit<UserProfile, 'id' | 'createdAt'>, password?: string) => Promise<void>; // Adapt signature
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  initializationError: null,
  login: async () => { console.warn('Login function not implemented'); },
  logout: async () => { console.warn('Logout function not implemented'); },
  signUpLocally: async () => { console.warn('signUpLocally function not implemented'); },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SimulatedUser>(null);
  const [loading, setLoading] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);
  const router = useRouter(); // Initialize useRouter

  // Effect to load user state from local storage on mount (client-side only)
  useEffect(() => {
    setLoading(true);
    try {
      const storedUserJson = localStorage.getItem('loggedInUser');
      if (storedUserJson) {
        const parsedUserProfile: UserProfile = JSON.parse(storedUserJson);
        // Convert UserProfile to SimulatedUser shape for the context
        setUser({
            id: String(parsedUserProfile.id), // Ensure ID is a string
            email: parsedUserProfile.email,
            displayName: parsedUserProfile.name,
            phone: parsedUserProfile.phone,
            className: parsedUserProfile.class,
            model: parsedUserProfile.model,
            expiry_date: parsedUserProfile.expiry_date,
        });
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error reading user from local storage:', error);
      setUser(null);
      localStorage.removeItem('loggedInUser');
      localStorage.removeItem('simulatedPassword'); // Also clear potentially stored password
    } finally {
      setLoading(false);
      setLocalError(null);
    }
  }, []);

  // Simulated Login Function using Server Action
  const login = async (email: string, password?: string) => {
    setLoading(true);
    setLocalError(null);
    try {
      // Use the server action to find the user in users.json AND check password
      const foundUserProfile = await findUserByCredentials(email, password);

      if (foundUserProfile) {
        // Convert UserProfile to SimulatedUser shape for the context
        const loggedInUser: SimulatedUser = {
          id: String(foundUserProfile.id), // Ensure ID is a string
          email: foundUserProfile.email,
          displayName: foundUserProfile.name,
          phone: foundUserProfile.phone,
          className: foundUserProfile.class,
          model: foundUserProfile.model,
          expiry_date: foundUserProfile.expiry_date,
        };
        setUser(loggedInUser);
        // Store the *full* UserProfile (excluding potentially sensitive parts if needed)
        localStorage.setItem('loggedInUser', JSON.stringify(foundUserProfile));
        // Store password in local storage only for the simulation flow - INSECURE
        if (password) {
            localStorage.setItem('simulatedPassword', password);
        }
        console.log(`User ${email} logged in (simulated).`);

        // --- REDIRECT LOGIC ---
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        if (foundUserProfile.email && adminEmail && foundUserProfile.email.toLowerCase() === adminEmail.toLowerCase()) {
          console.log('Admin user detected, redirecting to /admin');
          router.push('/admin'); // Redirect to admin dashboard
        } else {
          console.log('Regular user detected, redirecting to /');
          router.push('/'); // Redirect regular users to home dashboard
        }
        // --- END REDIRECT LOGIC ---

      } else {
        // Throw a more specific error if user not found or password mismatch
        throw new Error('Login failed: Invalid email or password for local authentication.');
      }
    } catch (error: any) {
      console.error("Simulated login failed:", error);
      setLocalError(error.message || 'Login failed.');
      setUser(null);
      localStorage.removeItem('loggedInUser');
      localStorage.removeItem('simulatedPassword');
      throw error; // Re-throw error so login page can catch it
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
      localStorage.removeItem('simulatedPassword'); // Clear simulated password on logout
      console.log("User logged out (simulated).");
       // Redirect to login page after logout
       router.push('/auth/login');
    } catch (error: any) {
      console.error("Simulated logout failed:", error);
      setLocalError(error.message || 'Logout failed.');
      throw error; // Re-throw error if needed
    } finally {
      setLoading(false);
    }
  };

  // Simulated Sign Up (now takes form data, saves via action, then updates context)
   const signUpLocally = async (userData: Omit<UserProfile, 'id' | 'createdAt' | 'password' | 'model' | 'expiry_date' | 'referral'> & { class: AcademicStatus | null; phone: string | null }, password?: string) => {
    setLoading(true);
    setLocalError(null);
    try {
       if (!userData.email || !password) {
         throw new Error("Email and password are required for signup.");
       }

       // Check if user already exists (optional, good practice)
       const existingUser = await findUserByEmail(userData.email);
       if (existingUser) {
            throw new Error("An account with this email already exists.");
       }

      // Generate a unique UUID for the new user
      const userId = uuidv4();

      // Prepare the full UserProfile object to be saved
      const newUserProfile: UserProfile = {
        id: userId, // Use UUID
        email: userData.email,
        password: password, // Include the password to be stored in JSON
        name: userData.name || null,
        phone: userData.phone || null,
        referral: "", // Default referral
        class: userData.class || null,
        model: 'free', // Default model for new signups
        expiry_date: null, // Default expiry date
        createdAt: new Date().toISOString(), // Add creation timestamp
      };


      // Save the user data (including plain text password) via the Server Action
      const saveResult = await saveUserToJson(newUserProfile);

      if (!saveResult.success) {
        throw new Error(saveResult.message || "Could not save user details locally.");
      }

       console.log(`User data for ${userData.email} saved to users.json`);

      // Update context state with the new user (SimulatedUser shape)
      const newUserContextState: SimulatedUser = {
        id: newUserProfile.id, // This will be the UUID string
        email: newUserProfile.email,
        displayName: newUserProfile.name,
        phone: newUserProfile.phone,
        className: newUserProfile.class,
        model: newUserProfile.model,
        expiry_date: newUserProfile.expiry_date,
      };
      setUser(newUserContextState);
      // Store the full profile (excluding password for slightly better security theater)
      const { password: _, ...profileToStore } = newUserProfile;
      localStorage.setItem('loggedInUser', JSON.stringify(profileToStore));
        // Store password in local storage only for the simulation flow - INSECURE
      if (password) {
          localStorage.setItem('simulatedPassword', password);
      }

      console.log(`User ${userData.email} signed up and logged in (simulated).`);

      // Redirect after signup
       router.push('/'); // Redirect to home dashboard after signup

    } catch (error: any) {
      console.error("Simulated local signup failed:", error);
      setLocalError(error.message || 'Local signup failed.');
      setUser(null); // Clear user state on failure
      localStorage.removeItem('loggedInUser'); // Clear local storage on failure
       localStorage.removeItem('simulatedPassword');
      throw error; // Re-throw error for the signup page
    } finally {
      setLoading(false);
    }
  };

  // Loading State UI
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="space-y-4 w-full max-w-md p-4">
          <Skeleton className="h-14 w-full" />
          <div className="flex gap-4">
            <Skeleton className="h-[calc(100vh-7rem)] w-16 hidden sm:block" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

    // Error State UI
  if (localError && !window.location.pathname.startsWith('/auth')) { // Only show error if not on auth pages
    return (
      <div className="flex items-center justify-center min-h-screen bg-destructive/10 text-destructive-foreground p-6">
         <div className="max-w-md text-center bg-destructive text-white p-6 rounded-lg shadow-lg">
           <h2 className="text-2xl font-bold mb-2">Application Error</h2>
           <p className="text-sm">{localError}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-white text-destructive rounded hover:bg-gray-200"
            >
              Reload Page
            </button>
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

