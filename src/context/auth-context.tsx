// src/context/auth-context.tsx
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { UserProfile, UserModel, AcademicStatus } from '@/types'; // Use our UserProfile type
import { Skeleton } from '@/components/ui/skeleton';
import { findUserByCredentials, findUserByEmail } from '@/actions/auth-actions'; // Import actions to find user locally
import { saveUserToJson, addUserToJson } from '@/actions/user-actions'; // Import actions to save/add user
import { useRouter } from 'next/navigation'; // Import useRouter for redirection
import { v4 as uuidv4 } from 'uuid'; // Import UUID generator

// Define simulated User type based on UserProfile, omitting sensitive/unused fields for context
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
  signUpLocally: (userData: Omit<UserProfile, 'id' | 'createdAt'>, password?: string) => Promise<void>; // Signature remains the same
  signInWithGoogleLocally: () => Promise<void>; // Add simulated Google sign-in
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  initializationError: null,
  login: async () => { console.warn('Login function not implemented'); },
  logout: async () => { console.warn('Logout function not implemented'); },
  signUpLocally: async () => { console.warn('signUpLocally function not implemented'); },
  signInWithGoogleLocally: async () => { console.warn('signInWithGoogleLocally function not implemented'); }, // Add default impl
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
        setUser({
            id: String(parsedUserProfile.id),
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
      localStorage.removeItem('simulatedPassword');
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
      const foundUserProfile = await findUserByCredentials(email, password);

      if (foundUserProfile) {
        const loggedInUser: SimulatedUser = {
          id: String(foundUserProfile.id),
          email: foundUserProfile.email,
          displayName: foundUserProfile.name,
          phone: foundUserProfile.phone,
          className: foundUserProfile.class,
          model: foundUserProfile.model,
          expiry_date: foundUserProfile.expiry_date,
        };
        setUser(loggedInUser);
        // Store full profile *excluding* password in local storage
        const { password: _, ...profileToStore } = foundUserProfile;
        localStorage.setItem('loggedInUser', JSON.stringify(profileToStore));
        // Store password separately only for simulation - INSECURE
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

      } else {
        throw new Error('Login failed: Invalid email or password for local authentication.');
      }
    } catch (error: any) {
      console.error("Simulated login failed:", error);
      setLocalError(error.message || 'Login failed.');
      setUser(null);
      localStorage.removeItem('loggedInUser');
      localStorage.removeItem('simulatedPassword');
      throw error;
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
      localStorage.removeItem('simulatedPassword');
      console.log("User logged out (simulated).");
       router.push('/auth/login');
    } catch (error: any) {
      console.error("Simulated logout failed:", error);
      setLocalError(error.message || 'Logout failed.');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Simulated Sign Up (OTP verification happens in the component)
   const signUpLocally = async (userData: Omit<UserProfile, 'id' | 'createdAt' | 'password' | 'model' | 'expiry_date' | 'referral'> & { class: AcademicStatus | null; phone: string | null }, password?: string) => {
    setLoading(true);
    setLocalError(null);
    try {
       if (!userData.email || !password) {
         throw new Error("Email and password are required for signup.");
       }

       const existingUser = await findUserByEmail(userData.email);
       if (existingUser) {
            throw new Error("An account with this email already exists.");
       }

      const userId = uuidv4();
      const newUserProfile: UserProfile = {
        id: userId,
        email: userData.email,
        password: password,
        name: userData.name || null,
        phone: userData.phone || null,
        referral: "",
        class: userData.class || null,
        model: 'free',
        expiry_date: null,
        createdAt: new Date().toISOString(),
      };

      // Use addUserToJson which internally handles existing email checks again
      const saveResult = await addUserToJson(newUserProfile);

      if (!saveResult.success) {
        throw new Error(saveResult.message || "Could not save user details locally.");
      }

      console.log(`User data for ${userData.email} saved to users.json`);

      // Automatically log in the new user
      await login(newUserProfile.email, newUserProfile.password); // Will set context and local storage

      console.log(`User ${userData.email} signed up and logged in (simulated).`);

      // Redirection handled by the login function called above

    } catch (error: any) {
      console.error("Simulated local signup failed:", error);
      setLocalError(error.message || 'Local signup failed.');
      setUser(null);
      localStorage.removeItem('loggedInUser');
      localStorage.removeItem('simulatedPassword');
      throw error;
    } finally {
      setLoading(false);
    }
  };

   // Simulated Sign In with Google
   const signInWithGoogleLocally = async () => {
        setLoading(true);
        setLocalError(null);
        const googleEmail = 'google.user@example.com'; // Predefined email
        const googleName = 'Google User';
        const simulatedPassword = 'googlePassword123'; // Use a dummy password for local credential check

        try {
            let userProfile = await findUserByEmail(googleEmail);

            if (!userProfile) {
                console.log("Simulated Google user not found, creating...");
                const newUserProfile: UserProfile = {
                    id: uuidv4(),
                    email: googleEmail,
                    name: googleName,
                    password: simulatedPassword, // Store dummy password
                    phone: '1234567890', // Placeholder
                    referral: "",
                    class: '12th Class', // Example class
                    model: 'free',
                    expiry_date: null,
                    createdAt: new Date().toISOString(),
                };
                const addResult = await addUserToJson(newUserProfile);
                if (!addResult.success) {
                     throw new Error(addResult.message || "Could not create simulated Google user.");
                }
                userProfile = newUserProfile; // Use the newly created profile
                console.log("Simulated Google user created.");
             } else {
                 // Ensure the existing Google user has the dummy password for login simulation
                 if (userProfile.password !== simulatedPassword) {
                     console.warn(`Updating dummy password for simulated Google user ${googleEmail}`);
                     userProfile.password = simulatedPassword;
                     await saveUserToJson(userProfile);
                 }
             }

            // Now attempt to log in using the (potentially created) user's details
            await login(googleEmail, simulatedPassword);
            console.log("Simulated Google Sign-in successful.");
             // Redirect handled within login

        } catch (error: any) {
            console.error("Simulated Google Sign-in failed:", error);
            setLocalError(error.message || 'Google Sign-in simulation failed.');
            setUser(null);
            localStorage.removeItem('loggedInUser');
            localStorage.removeItem('simulatedPassword');
            throw error; // Re-throw for the component
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

    // Error State UI (Only shown if NOT on an auth page)
  if (localError && typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
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
    <AuthContext.Provider value={{ user, loading, initializationError: localError, login, logout, signUpLocally, signInWithGoogleLocally }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
