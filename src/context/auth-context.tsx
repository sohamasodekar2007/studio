// src/context/auth-context.tsx
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { UserProfile, UserModel, AcademicStatus } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { findUserByEmail } from '@/actions/auth-actions';
import { saveUserToJson, addUserToJson, getUserById } from '@/actions/user-actions'; // Import user actions
import { useRouter, usePathname } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

// Define the shape of the user object within the context
type ContextUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null; // Kept for potential future avatar use
  phone: string | null;
  className: AcademicStatus | null; // Renamed from 'class'
  model: UserModel;
  expiry_date: string | null;
} | null;

interface AuthContextProps {
  user: ContextUser;
  loading: boolean;
  initializationError: string | null; // Keep for potential local init issues
  login: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  signUpLocally: (userData: Omit<UserProfile, 'id' | 'createdAt' | 'password' | 'model' | 'expiry_date' | 'referral'> & { class: AcademicStatus | null; phone: string | null }, password?: string) => Promise<void>;
  // Remove signInWithGoogle
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  initializationError: null, // No Firebase init error anymore
  login: async () => { console.warn('Auth not initialized or login function not implemented'); },
  logout: async () => { console.warn('Auth not initialized or logout function not implemented'); },
  signUpLocally: async () => { console.warn('Auth not initialized or signUpLocally function not implemented'); },
  // Remove signInWithGoogle
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ContextUser>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null); // For local auth/data issues
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    setIsMounted(true);
    // Check local storage on mount to see if a user was previously logged in
    const storedUserJson = localStorage.getItem('loggedInUser');
    if (storedUserJson) {
        try {
            const storedUser: ContextUser = JSON.parse(storedUserJson);
            setUser(storedUser);
            console.log("Loaded user from local storage:", storedUser?.email);
        } catch (e) {
            console.error("Failed to parse user from local storage", e);
            localStorage.removeItem('loggedInUser');
        }
    }
     setLoading(false); // Finished initial check/loading
  }, []); // Runs only once on mount


  // Login Function (using local users.json)
  const login = useCallback(async (email: string, password?: string) => {
    setLoading(true);
    setLocalError(null);
    if (!password) {
      const errorMsg = 'Password is required for login.';
      toast({ variant: "destructive", title: "Login Error", description: errorMsg });
      setLoading(false);
      throw new Error(errorMsg);
    }

    try {
      // Use findUserByEmail first to check if email exists
      const userProfile = await findUserByEmail(email);

       // Validate password locally (INSECURE, only for demo)
       // In a real app, NEVER compare plain text passwords. Passwords should be hashed.
       if (userProfile && userProfile.password === password) {
           console.log("Local Login successful for:", userProfile.email);

           const contextUser: ContextUser = {
               id: userProfile.id,
               email: userProfile.email,
               displayName: userProfile.name,
               photoURL: null, // No photo URL in local version
               phone: userProfile.phone,
               className: userProfile.class,
               model: userProfile.model,
               expiry_date: userProfile.expiry_date,
           };
           setUser(contextUser);
           localStorage.setItem('loggedInUser', JSON.stringify(contextUser)); // Store in local storage

            // Redirect logic based on role (deduced from email)
            const isAdmin = userProfile.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
            if (isAdmin) {
                console.log('Redirecting admin to /admin');
                router.push('/admin');
            } else {
                console.log('Redirecting user to /');
                 router.push('/');
            }
           toast({ title: "Login Successful", description: `Welcome back, ${userProfile.name || userProfile.email}!` });
       } else {
           throw new Error('Invalid email or password.');
       }
    } catch (error: any) {
      console.error("Local login failed:", error);
      let message = "Login failed. Please check your email and password.";
      if (error.message === 'Invalid email or password.') {
          message = error.message;
      }
      setLocalError(error.message || message); // Store the error message
      toast({ variant: 'destructive', title: 'Login Failed', description: message }); // Show toast on failure
      setUser(null); // Clear user state
      localStorage.removeItem('loggedInUser');
      throw new Error(message); // Re-throw for component handling
    } finally {
      setLoading(false);
    }
  }, [router, toast]);


  // Logout Function (Local)
  const logout = useCallback(async () => {
    setLoading(true);
    setLocalError(null);
    try {
       // Clear local state and storage
       setUser(null);
       localStorage.removeItem('loggedInUser');
       console.log("Local Logout successful.");

       toast({ title: "Logged Out", description: "You have been successfully logged out." });
       router.push('/auth/login'); // Redirect reliably after logout
    } catch (error: any) {
      console.error("Logout failed:", error);
      setLocalError(error.message || 'Logout failed.');
       toast({ variant: 'destructive', title: 'Logout Failed', description: error.message });
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  // Sign Up Function (Local JSON)
   const signUpLocally = useCallback(async (userData: Omit<UserProfile, 'id' | 'createdAt' | 'password' | 'model' | 'expiry_date' | 'referral'> & { class: AcademicStatus | null; phone: string | null }, password?: string) => {
    if (!userData.email || !password) {
        toast({ variant: 'destructive', title: 'Signup Failed', description: 'Email and password are required.' });
        throw new Error("Email and password required");
    }
     if (!userData.class) {
         toast({ variant: 'destructive', title: 'Signup Failed', description: 'Academic status is required.' });
         throw new Error("Academic status required");
     }
     if (!userData.phone) {
          toast({ variant: 'destructive', title: 'Signup Failed', description: 'Phone number is required.' });
          throw new Error("Phone number required");
      }


    setLoading(true);
    setLocalError(null);
    try {
        // 1. Check if user already exists (redundant if addUserToJson checks, but good practice)
        const existingUser = await findUserByEmail(userData.email);
        if (existingUser) {
            throw new Error("Email address is already registered.");
        }

        // 2. Create local profile
        const newUserProfile: UserProfile = {
            id: uuidv4(), // Generate a unique ID
            email: userData.email,
            password: password, // Store plain text password (INSECURE!)
            name: userData.name || `User_${Date.now().toString().slice(-5)}`,
            phone: userData.phone || null,
            referral: "",
            class: userData.class || null,
            model: 'free', // Default to free model
            expiry_date: null,
            createdAt: new Date().toISOString(),
        };

        // 3. Save local profile to users.json
        const addResult = await addUserToJson(newUserProfile);
        if (!addResult.success) {
            throw new Error(addResult.message || "Could not save user profile locally.");
        }

        console.log(`Local user profile created for: ${newUserProfile.email}`);
        toast({ title: "Account Created", description: "Welcome! Please log in." });

        // Redirect to login page after successful local signup
        router.push('/auth/login');

    } catch (error: any) {
        console.error("Local signup failed:", error);
        let message = "Signup failed. Please try again.";
        if (error.message === "Email address is already registered.") {
            message = error.message;
        }
        toast({ variant: 'destructive', title: 'Signup Failed', description: message });
        setLocalError(message);
        setUser(null); // Ensure user is cleared on error
        throw new Error(message); // Re-throw for component handling
    } finally {
        setLoading(false);
    }
}, [toast, router]);


  // --- Redirect logic after mount ---
   useEffect(() => {
        if (!loading && isMounted) {
            const isLoggedIn = !!user;
            const isAdmin = user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

             // Redirect non-admins from admin routes
            if (isLoggedIn && !isAdmin && pathname.startsWith('/admin')) {
                console.log('Redirecting non-admin from /admin to /');
                router.push('/');
            }
            // Redirect logged-out users from protected routes
            else if (!isLoggedIn && (pathname.startsWith('/admin') || pathname === '/settings' || pathname === '/progress' || pathname.startsWith('/chapterwise-test') || pathname.startsWith('/take-test') || pathname.startsWith('/study-tips') || pathname.startsWith('/doubt-solving'))) {
                console.log(`User logged out on protected page (${pathname}), redirecting to login.`);
                router.push('/auth/login');
            }
            // Redirect logged-in users from auth pages
            else if (isLoggedIn && pathname.startsWith('/auth')) {
                console.log(`User logged in on auth page (${pathname}), redirecting...`);
                 router.push(isAdmin ? '/admin' : '/');
            }
        }
   }, [user, loading, isMounted, pathname, router]);


  // --- Loading State ---
  // Display loading skeleton only on initial load and if not on auth pages
  if (loading && !isMounted) {
     // Initial SSR/Client load skeleton
     return (
         <div className="flex items-center justify-center min-h-screen bg-background">
             <div className="space-y-4 w-full max-w-md p-4">
                 <Skeleton className="h-10 w-3/4 mx-auto" />
                 <Skeleton className="h-6 w-1/2 mx-auto" />
                 <div className="p-4 border rounded-md">
                     <Skeleton className="h-8 w-full mb-2" />
                     <Skeleton className="h-8 w-full mb-2" />
                     <Skeleton className="h-8 w-full" />
                 </div>
             </div>
         </div>
     );
  }

   // Show loading state after mount if auth is still resolving and not on auth pages
    if (loading && isMounted && !pathname.startsWith('/auth')) {
       // Show loading skeleton only for non-auth pages while auth is loading
       return (
           <div className="flex items-center justify-center min-h-screen bg-background">
               <div className="space-y-4 w-full max-w-md p-4">
                    <Skeleton className="h-10 w-3/4 mx-auto" />
                    <Skeleton className="h-6 w-1/2 mx-auto" />
                   <div className="p-4 border rounded-md">
                       <Skeleton className="h-8 w-full mb-2" />
                       <Skeleton className="h-8 w-full mb-2" />
                       <Skeleton className="h-8 w-full" />
                   </div>
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
