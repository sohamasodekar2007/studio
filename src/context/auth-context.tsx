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

// Re-import Firebase specific types if needed elsewhere, but remove Firebase logic here
// import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
// import { getAuth, onAuthStateChanged, type User as FirebaseUser, type Auth } from "firebase/auth";
// import { auth as firebaseAuth, firebaseInitializationError } from '@/lib/firebase'; // Import initialized auth and error

// Define the shape of the user object within the context
export type ContextUser = {
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
  initializationError: string | null;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  signUpLocally: (userData: Omit<UserProfile, 'id' | 'createdAt' | 'password' | 'model' | 'expiry_date' | 'referral'> & { class: AcademicStatus | null; phone: string | null }, password?: string) => Promise<void>;
  refreshUser: () => Promise<void>; // Function to refresh user data
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  initializationError: null,
  login: async () => { console.warn('Auth not initialized or login function not implemented'); },
  logout: async () => { console.warn('Auth not initialized or logout function not implemented'); },
  signUpLocally: async () => { console.warn('Auth not initialized or signUpLocally function not implemented'); },
  refreshUser: async () => { console.warn('Auth not initialized or refreshUser function not implemented'); }
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ContextUser>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const loadUserFromLocalStorage = useCallback(() => {
    const storedUserJson = localStorage.getItem('loggedInUser');
    if (storedUserJson) {
      try {
        const storedUser: ContextUser = JSON.parse(storedUserJson);
        setUser(storedUser);
        console.log("Loaded user from local storage:", storedUser?.email);
        return true; // Indicate user was loaded
      } catch (e) {
        console.error("Failed to parse user from local storage", e);
        localStorage.removeItem('loggedInUser');
      }
    }
    return false; // Indicate user was not loaded
  }, []);


  useEffect(() => {
    setIsMounted(true);
    loadUserFromLocalStorage();
    setLoading(false); // Finished initial check/loading
  }, [loadUserFromLocalStorage]); // Runs only once on mount

  // Function to manually refresh user data from the source (users.json via action)
  const refreshUser = useCallback(async () => {
    const currentUserId = user?.id;
    if (!currentUserId) return; // No user to refresh

    console.log("Refreshing user data for ID:", currentUserId);
    setLoading(true); // Indicate loading during refresh
    try {
      const profile = await getUserById(currentUserId); // Fetch latest data
      if (profile) {
        const contextUser: ContextUser = {
            id: profile.id,
            email: profile.email,
            displayName: profile.name,
            photoURL: null,
            phone: profile.phone,
            className: profile.class,
            model: profile.model,
            expiry_date: profile.expiry_date,
        };
        setUser(contextUser);
        localStorage.setItem('loggedInUser', JSON.stringify(contextUser)); // Update local storage
        console.log("User data refreshed and updated in context/localStorage.");
      } else {
        console.warn(`User ID ${currentUserId} not found during refresh. Logging out.`);
        // If user doesn't exist anymore (e.g., deleted), log them out
        setUser(null);
        localStorage.removeItem('loggedInUser');
        router.push('/auth/login');
      }
    } catch (error) {
      console.error("Error refreshing user data:", error);
      // Optionally show a toast, but avoid logging out unless necessary
    } finally {
      setLoading(false);
    }
  }, [user?.id, router]);


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
      const userProfile = await findUserByEmail(email); // Fetches user profile including password field

      if (userProfile && userProfile.password === password) { // Direct comparison (INSECURE)
        console.log("Local Login successful for:", userProfile.email);

        const contextUser: ContextUser = {
          id: userProfile.id,
          email: userProfile.email,
          displayName: userProfile.name,
          photoURL: null,
          phone: userProfile.phone,
          className: userProfile.class,
          model: userProfile.model,
          expiry_date: userProfile.expiry_date,
        };
        setUser(contextUser);
        localStorage.setItem('loggedInUser', JSON.stringify(contextUser)); // Store in local storage

        const isAdmin = userProfile.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        const redirectPath = isAdmin ? '/admin' : '/';
        console.log(`Redirecting ${isAdmin ? 'admin' : 'user'} to ${redirectPath}`);
        router.push(redirectPath);
        toast({ title: "Login Successful", description: `Welcome back, ${userProfile.name || userProfile.email}!` });

      } else {
        throw new Error('Invalid email or password.'); // More specific error
      }
    } catch (error: any) {
      console.error("Local login failed:", error);
      let message = "Login failed. Please check your email and password.";
      if (error.message === 'Invalid email or password.') {
        message = error.message;
      }
      setLocalError(message);
      toast({ variant: 'destructive', title: 'Login Failed', description: message });
      setUser(null);
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
      setUser(null);
      localStorage.removeItem('loggedInUser');
      console.log("Local Logout successful.");

      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      // Add a small delay before redirecting to allow state update to potentially propagate
      setTimeout(() => {
         router.push('/auth/login');
      }, 100);

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
        const existingUser = await findUserByEmail(userData.email);
        if (existingUser) {
            throw new Error("Email address is already registered.");
        }

        const newUserProfile: UserProfile = {
            id: uuidv4(),
            email: userData.email,
            password: password, // INSECURE
            name: userData.name || `User_${Date.now().toString().slice(-5)}`,
            phone: userData.phone || null,
            referral: "",
            class: userData.class || null,
            model: 'free',
            expiry_date: null,
            createdAt: new Date().toISOString(),
        };

        const addResult = await addUserToJson(newUserProfile);
        if (!addResult.success) {
            throw new Error(addResult.message || "Could not save user profile locally.");
        }

        console.log(`Local user profile created for: ${newUserProfile.email}`);
        toast({ title: "Account Created", description: "Welcome! Please log in." });

        router.push('/auth/login');

    } catch (error: any) {
        console.error("Local signup failed:", error);
        let message = "Signup failed. Please try again.";
        if (error.message === "Email address is already registered.") {
            message = error.message;
        }
        toast({ variant: 'destructive', title: 'Signup Failed', description: message });
        setLocalError(message);
        setUser(null);
        throw new Error(message);
    } finally {
        setLoading(false);
    }
}, [toast, router]);

   // --- Redirect logic after mount ---
   useEffect(() => {
     if (!loading && isMounted) {
       const isLoggedIn = !!user;
       const isAdmin = user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
       const isAuthPage = pathname.startsWith('/auth');
       const isAdminPage = pathname.startsWith('/admin');
       const isProtectedRoute = !isAuthPage && !['/', '/help', '/terms', '/privacy', '/tests'].includes(pathname) && !pathname.startsWith('/tests/'); // Define protected routes more granularly if needed

       // Redirect non-admins from admin routes
       if (isLoggedIn && !isAdmin && isAdminPage) {
         console.log('Redirecting non-admin from /admin to /');
         router.push('/');
       }
       // Redirect logged-out users from protected routes (excluding admin pages already covered)
       else if (!isLoggedIn && isProtectedRoute) {
         console.log(`User logged out on protected page (${pathname}), redirecting to login.`);
          router.push(`/auth/login?redirect=${pathname}`); // Add redirect query param
       }
       // Redirect logged-in users from auth pages
       else if (isLoggedIn && isAuthPage) {
         console.log(`User logged in on auth page (${pathname}), redirecting...`);
         router.push(isAdmin ? '/admin' : '/');
       }
     }
   }, [user, loading, isMounted, pathname, router]);


  // --- Loading State ---
  // Display loading skeleton only on initial client load OR if auth is still resolving and not on auth pages
   if ((loading && !isMounted) || (loading && isMounted && !pathname.startsWith('/auth'))) {
     return (
       <div className="flex items-center justify-center min-h-screen bg-background">
         <div className="space-y-4 w-full max-w-md p-4">
           {/* Simplified Skeleton */}
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

   // Display global error if local setup fails (e.g., file access)
   if (localError && !loading) {
       return (
           <div className="min-h-screen flex items-center justify-center p-4">
               <Alert variant="destructive" className="max-w-lg">
                   <AlertTriangle className="h-4 w-4" />
                   <AlertTitle>Application Initialization Error</AlertTitle>
                   <AlertDescription>
                       {localError}
                       <br /><br />
                       Please ensure your setup is correct. Check the browser console and README for more details.
                       <Button onClick={() => window.location.reload()} className="mt-4" size="sm">Reload Page</Button>
                   </AlertDescription>
               </Alert>
           </div>
       );
   }


  return (
    <AuthContext.Provider value={{ user, loading, initializationError: localError, login, logout, signUpLocally, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
