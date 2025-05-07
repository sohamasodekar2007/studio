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
import { AlertTriangle, User } from 'lucide-react'; // Added User icon

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

  // --- Load User from localStorage on Mount ---
  const loadUserFromLocalStorage = useCallback(() => {
    // Ensure this runs only on the client
    if (typeof window === 'undefined') return false;
    const storedUserJson = localStorage.getItem('loggedInUser');
    if (storedUserJson) {
      try {
        const storedUser: ContextUser = JSON.parse(storedUserJson);
        if (storedUser && storedUser.id && storedUser.email) { // Basic validation
            setUser(storedUser);
            console.log("Loaded user from local storage:", storedUser?.email);
            return true; // Indicate user was loaded
        } else {
            console.warn("Invalid user data found in local storage. Clearing.");
            localStorage.removeItem('loggedInUser');
        }
      } catch (e) {
        console.error("Failed to parse user from local storage", e);
        localStorage.removeItem('loggedInUser');
      }
    }
    console.log("No valid user found in local storage.");
    return false; // Indicate user was not loaded
  }, []);

  // --- Run on mount ---
  useEffect(() => {
    setIsMounted(true);
    loadUserFromLocalStorage();
    setLoading(false); // Finished initial check/loading
  }, [loadUserFromLocalStorage]); // Runs only once on mount


  // --- Function to refresh user data ---
  const refreshUser = useCallback(async () => {
    // Fetch latest user data from backend (users.json via action) and update context + localStorage
    const currentUserId = user?.id;
    if (!currentUserId) return;

    console.log("Refreshing user data for ID:", currentUserId);
    setLoading(true);
    try {
      const profile = await getUserById(currentUserId); // Fetch latest data by ID
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
        // Store the refreshed user data persistently in localStorage
        localStorage.setItem('loggedInUser', JSON.stringify(contextUser));
        console.log("User data refreshed and updated in context/localStorage.");
      } else {
        console.warn(`User ID ${currentUserId} not found during refresh. Logging out.`);
        // Clear local state and storage if user is gone from backend
        setUser(null);
        localStorage.removeItem('loggedInUser');
        router.push('/auth/login');
      }
    } catch (error) {
      console.error("Error refreshing user data:", error);
      toast({variant: "destructive", title:"Refresh Error", description: "Could not sync profile."})
    } finally {
      setLoading(false);
    }
  }, [user?.id, router, toast]); // Include toast


  // --- Login Function ---
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
      const userProfile = await findUserByEmail(email); // Fetches full profile including password field

      if (userProfile && userProfile.password === password) {
        console.log("Local Login successful for:", userProfile.email);

        const contextUser: ContextUser = {
          id: String(userProfile.id), // Ensure ID is string
          email: userProfile.email,
          displayName: userProfile.name,
          photoURL: null, // Placeholder
          phone: userProfile.phone,
          className: userProfile.class,
          model: userProfile.model,
          expiry_date: userProfile.expiry_date,
        };
        setUser(contextUser);
        // Persist logged-in user data in localStorage
        localStorage.setItem('loggedInUser', JSON.stringify(contextUser));

        const isAdmin = userProfile.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        const redirectPath = isAdmin ? '/admin' : '/';
        console.log(`Redirecting ${isAdmin ? 'admin' : 'user'} to ${redirectPath}`);
        router.push(redirectPath);
        toast({ title: "Login Successful", description: `Welcome back, ${userProfile.name || userProfile.email}!` });

      } else {
        throw new Error('Login failed: Invalid email or password for local authentication.');
      }
    } catch (error: any) {
      console.error("Local login failed:", error);
      const message = error.message || "Login failed. Please check your email and password.";
      setLocalError(message);
      toast({ variant: 'destructive', title: 'Login Failed', description: message });
      setUser(null);
      localStorage.removeItem('loggedInUser'); // Clear potentially invalid user data
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  // --- Logout Function ---
  const logout = useCallback(async () => {
    setLoading(true);
    setLocalError(null);
    try {
      setUser(null);
      // Remove user data from localStorage on logout
      localStorage.removeItem('loggedInUser');
      console.log("Local Logout successful. User data cleared from localStorage.");

      toast({ title: "Logged Out", description: "You have been successfully logged out." });
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

  // --- Sign Up Function ---
   const signUpLocally = useCallback(async (userData: Omit<UserProfile, 'id' | 'createdAt' | 'password' | 'model' | 'expiry_date' | 'referral'> & { class: AcademicStatus | null; phone: string | null }, password?: string) => {
     // Validate essential inputs
    if (!userData.email || !password) {
        toast({ variant: 'destructive', title: 'Signup Failed', description: 'Email and password are required.' });
        throw new Error("Email and password required");
    }
    if (!userData.name) {
         toast({ variant: 'destructive', title: 'Signup Failed', description: 'Name is required.' });
         throw new Error("Name required");
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

        // Prepare new user profile for saving to users.json
        const newUserProfile: UserProfile = {
            id: uuidv4(), // Generate UUID for new user
            email: userData.email,
            password: password, // Storing plain text - INSECURE, use hashing in production
            name: userData.name,
            phone: userData.phone,
            referral: "",
            class: userData.class,
            model: 'free', // Default to free model
            expiry_date: null,
            createdAt: new Date().toISOString(),
        };

        const addResult = await addUserToJson(newUserProfile); // Save to users.json via action
        if (!addResult.success) {
            throw new Error(addResult.message || "Could not save user profile locally.");
        }

        console.log(`Local user profile created for: ${newUserProfile.email}`);
        toast({ title: "Account Created", description: "Welcome! Please log in." });

        router.push('/auth/login'); // Redirect to login after successful signup

    } catch (error: any) {
        console.error("Local signup failed:", error);
        let message = "Signup failed. Please try again.";
        if (error.message === "Email address is already registered.") {
            message = error.message;
        }
        toast({ variant: 'destructive', title: 'Signup Failed', description: message });
        setLocalError(message);
        setUser(null); // Ensure no partial user state
        throw new Error(message);
    } finally {
        setLoading(false);
    }
}, [toast, router]);

   // --- Redirect logic ---
   useEffect(() => {
     // Ensure this runs only on the client after mount
     if (!isMounted) return;

     if (!loading) {
       const isLoggedIn = !!user;
       const isAdmin = user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
       const isAuthPage = pathname.startsWith('/auth');
       const isAdminPage = pathname.startsWith('/admin');
       // Define public routes that don't require login
       const publicRoutes = ['/', '/help', '/terms', '/privacy', '/tests'];
       // Consider a route public if it's in the list OR starts with /tests/ (detail page)
       const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith('/tests/');
       const isProtectedRoute = !isAuthPage && !isAdminPage && !isPublicRoute; // Protected routes are non-auth, non-admin, non-public

       // 1. Redirect non-admins from admin pages
       if (isLoggedIn && !isAdmin && isAdminPage) {
         console.log('Redirecting non-admin from /admin to /');
         router.push('/');
       }
       // 2. Redirect logged-out users from protected pages
       else if (!isLoggedIn && isProtectedRoute) {
         console.log(`User logged out on protected page (${pathname}), redirecting to login.`);
          router.push(`/auth/login?redirect=${pathname}`);
       }
       // 3. Redirect logged-in users from auth pages
       else if (isLoggedIn && isAuthPage) {
         console.log(`User logged in on auth page (${pathname}), redirecting...`);
         router.push(isAdmin ? '/admin' : '/');
       }
     }
   }, [user, loading, isMounted, pathname, router]);


  // --- Loading State ---
  // Show skeleton only during initial client-side mount/hydration if loading is true
  // Avoid showing skeleton on server or if loading is false
  if (loading && isMounted && !pathname.startsWith('/auth')) {
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

  // --- Global Error State ---
   if (localError && !loading) {
       // This indicates a persistent setup error (e.g., file system access)
       // Render a clear error message for the developer
       return (
           <div className="min-h-screen flex items-center justify-center p-4">
               <Alert variant="destructive" className="max-w-lg">
                   <AlertTriangle className="h-4 w-4" />
                   <AlertTitle>Application Initialization Error</AlertTitle>
                   <AlertDescription>
                       {localError}
                       <br /><br />
                       This might be due to issues reading/writing local data files (e.g., `users.json`).
                       Please check file permissions and ensure the application setup is correct. See README.md for setup instructions.
                       {/* <Button onClick={() => window.location.reload()} className="mt-4" size="sm">Reload Page</Button> */}
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

