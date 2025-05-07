// src/context/auth-context.tsx
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { UserProfile, UserModel, AcademicStatus as UserAcademicStatus } from '@/types';
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
// Use local storage actions
import { saveUserToJson, readUsers, getUserById } from '@/actions/user-actions';
import { findUserByEmail } from '@/actions/auth-actions'; // Corrected import
import { sendWelcomeEmail, generateOtp, verifyOtp } from '@/actions/otp-actions'; // Import OTP actions
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid'; // Ensure UUID is imported

// ContextUser type adapted for local auth
export type ContextUser = {
  id: string; // User ID from users.json
  email: string | null;
  displayName: string | null;
  // photoURL?: string | null; // No photoURL in local auth
  // Fields from UserProfile that are useful in context
  phone: string | null;
  className: UserAcademicStatus | null; // Renamed from academicStatus to className
  model: UserModel;
  expiry_date: string | null; // ISO string from UserProfile
} | null;


interface AuthContextProps {
  user: ContextUser;
  loading: boolean;
  initializationError: string | null; // Keep for potential local storage issues
  login: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  signUp: (
    email: string,
    password?: string,
    displayName?: string,
    phoneNumber?: string | null, // Make phone optional
    academicStatus?: UserAcademicStatus | null // Make academicStatus optional
  ) => Promise<void>; // Renamed from signUpWithEmailAndPassword
  refreshUser: () => Promise<void>; // To re-fetch UserProfile data
  // Add OTP functions to context if needed by components, or keep them separate actions
  sendOtpAction: (email: string) => Promise<{ success: boolean; message: string }>;
  verifyOtpAction: (email: string, otp: string) => Promise<{ success: boolean; message: string }>;
}

// Default error message for local storage mode
const localStorageError = null; // Assume local storage works unless an error occurs during operations

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  initializationError: localStorageError,
  login: async () => { console.warn('Auth not initialized or login function not implemented'); },
  logout: async () => { console.warn('Auth not initialized or logout function not implemented'); },
  signUp: async () => { console.warn('Auth not initialized or signUp function not implemented'); },
  refreshUser: async () => { console.warn('Auth not initialized or refreshUser function not implemented'); },
   // Provide default implementations for OTP actions
  sendOtpAction: async () => { console.warn('Auth not initialized'); return { success: false, message: 'Auth not ready' }; },
  verifyOtpAction: async () => { console.warn('Auth not initialized'); return { success: false, message: 'Auth not ready' }; },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ContextUser>(null);
  const [loading, setLoading] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(localStorageError);
  const [isMounted, setIsMounted] = useState(false); // Track if component has mounted
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();


  // Set mounted state
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Check local storage for logged-in user on initial load (client-side only)
  useEffect(() => {
    if (!isMounted) return; // Only run after mount

    setLoading(true);
    console.log("AuthProvider: Checking local storage for user...");
    try {
        const storedUserJson = localStorage.getItem('loggedInUser');
        if (storedUserJson) {
            console.log("AuthProvider: Found user in local storage.");
            const storedUser = JSON.parse(storedUserJson);
            // Basic validation of stored data
            if (storedUser && storedUser.id && storedUser.email) {
                 setUser(mapUserProfileToContextUser(storedUser)); // Use mapping function
            } else {
                 console.warn("AuthProvider: Invalid user data in local storage, clearing.");
                 localStorage.removeItem('loggedInUser');
                 setUser(null);
            }
        } else {
            console.log("AuthProvider: No user found in local storage.");
            setUser(null);
        }
    } catch (e) {
         console.error("AuthProvider: Error reading from local storage", e);
         setInitializationError("Failed to access local storage.");
         setUser(null); // Ensure user is null if storage fails
         localStorage.removeItem('loggedInUser'); // Attempt to clear potentially corrupt data
    }
    setLoading(false);
    console.log("AuthProvider: Initial load complete. Loading state:", false);
  }, [isMounted]); // Depend on isMounted


  const mapUserProfileToContextUser = (userProfile: UserProfile | null): ContextUser => {
      if (!userProfile) return null;
      return {
          id: userProfile.id,
          email: userProfile.email,
          displayName: userProfile.name,
          phone: userProfile.phone,
          className: userProfile.class,
          model: userProfile.model,
          expiry_date: userProfile.expiry_date,
      };
  }

  const refreshUser = useCallback(async () => {
    if (!isMounted) return; // Ensure component is mounted
    setLoading(true);
    const currentUserJson = localStorage.getItem('loggedInUser');
    if (currentUserJson) {
        const currentUser: ContextUser = JSON.parse(currentUserJson);
        if (currentUser?.id) {
             try {
                const updatedProfile = await getUserById(currentUser.id); // Fetch latest profile
                const contextUser = mapUserProfileToContextUser(updatedProfile);
                setUser(contextUser);
                if (contextUser) {
                    // Need the full profile to store (including password hash/plain for local)
                    const fullUpdatedProfile = await findUserByEmail(contextUser.email || ''); // Fetch full profile again
                     if (fullUpdatedProfile) {
                         const { password, ...userToStore } = fullUpdatedProfile; // Exclude password before storing
                         localStorage.setItem('loggedInUser', JSON.stringify(userToStore));
                         // Update simulated password if needed (INSECURE)
                         if (fullUpdatedProfile.password) {
                            localStorage.setItem('simulatedPassword', fullUpdatedProfile.password);
                         }
                     } else {
                         localStorage.removeItem('loggedInUser'); // Remove if full profile not found
                     }
                } else {
                     localStorage.removeItem('loggedInUser'); // User might have been deleted
                }
             } catch (e) {
                 console.error("Refresh User: Error fetching updated profile", e);
                 // Keep potentially stale user data or log out? For now, keep stale.
                 // setUser(null); localStorage.removeItem('loggedInUser');
                 toast({variant: 'destructive', title: 'Sync Error', description: 'Could not refresh user data.'});
             }
        } else {
             setUser(null); localStorage.removeItem('loggedInUser');
        }
    } else {
         setUser(null);
    }
    setLoading(false);
  }, [toast, isMounted]);


  const login = useCallback(async (email: string, password?: string) => {
    if (!isMounted) return;
    if (!password) {
        toast({ variant: 'destructive', title: 'Login Failed', description: 'Password is required.' });
        throw new Error('Password is required.');
    }
    setLoading(true);
    try {
      // Find user by email using the server action
      const foundUser = await findUserByEmail(email); // This action reads the full profile including password

      if (foundUser && foundUser.password === password) { // Compare plain text passwords (INSECURE)
        const contextUser = mapUserProfileToContextUser(foundUser);
        setUser(contextUser);
        // Store user data (excluding password) in local storage
        if (contextUser) {
          const { password, ...userToStore } = foundUser; // Destructure to remove password
          localStorage.setItem('loggedInUser', JSON.stringify(userToStore));
          // Store password separately for simulation (INSECURE - remove in real app)
           if (foundUser.password) {
              localStorage.setItem('simulatedPassword', foundUser.password);
            } else {
              localStorage.removeItem('simulatedPassword'); // Remove if no password (e.g., social login)
            }
        }

         // Redirect logic
         const isAdmin = contextUser?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
         const redirectPath = isAdmin ? '/admin' : '/';
         router.push(redirectPath);
         toast({ title: "Login Successful", description: `Welcome back, ${contextUser?.displayName || contextUser?.email}!` });

      } else {
        // Throw a more specific error if user not found or password mismatch
        throw new Error('Login failed: Invalid email or password for local authentication.');
      }
    } catch (error: any) {
      console.error("Simulated login failed:", error);
      toast({ variant: 'destructive', title: 'Login Failed', description: error.message });
      throw error; // Re-throw for login page to handle
    } finally {
      setLoading(false);
    }
  }, [router, toast, isMounted]);

  const logout = useCallback(async () => {
     if (!isMounted) return;
    setLoading(true);
    setUser(null);
    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('simulatedPassword'); // Clear simulated password
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
    router.push('/auth/login');
    setLoading(false);
  }, [router, toast, isMounted]);

  // Adjusted signUp function for local storage
  const signUp = useCallback(async (
    email: string,
    password?: string,
    displayName?: string,
    phoneNumber?: string | null,
    academicStatus?: UserAcademicStatus | null
  ) => {
     if (!isMounted) return;
    if (!password) {
        toast({ variant: 'destructive', title: 'Signup Failed', description: 'Password is required.' });
        throw new Error('Password is required.');
    }

    setLoading(true);
    try {
        // Check if user already exists locally
        const existingUser = await findUserByEmail(email);
        if (existingUser) {
            throw new Error('Signup failed: Email already exists.');
        }

      // Create UserProfile for local JSON storage
      const newUserProfile: UserProfile = {
        id: uuidv4(), // Use UUID for local ID
        email: email,
        password: password, // Store plain text password (INSECURE)
        name: displayName || null,
        phone: phoneNumber || null,
        class: academicStatus || null,
        model: 'free', // Default to 'free'
        expiry_date: null,
        createdAt: new Date().toISOString(),
      };

      // Save to users.json using the server action
       const saveResult = await saveUserToJson(newUserProfile); // Call action to add
       if (!saveResult.success) {
         console.error("CRITICAL: Failed to save new user profile to local JSON:", saveResult.message);
         throw new Error(saveResult.message || 'Could not create user profile.');
       }

      // Send welcome email simulation
      if (newUserProfile.email) {
          await sendWelcomeEmail(newUserProfile.email);
      }

      // Automatically log in the user after successful signup
       const contextUser = mapUserProfileToContextUser(newUserProfile);
       setUser(contextUser);
        if (contextUser) {
            const { password, ...userToStore } = newUserProfile;
            localStorage.setItem('loggedInUser', JSON.stringify(userToStore));
             if (newUserProfile.password) {
               localStorage.setItem('simulatedPassword', newUserProfile.password);
             }
        }

      toast({ title: "Account Created!", description: "Welcome to Study Sphere! You are now logged in." });
      router.push('/'); // Redirect to dashboard after signup

    } catch (error: any) {
      console.error("Local signup failed:", error);
      toast({ variant: 'destructive', title: 'Sign Up Failed', description: error.message });
      throw error; // Re-throw for signup page to handle
    } finally {
      setLoading(false);
    }
  }, [router, toast, isMounted]);

   // OTP Action Wrappers
  const sendOtpAction = useCallback(async (email: string) => {
    try {
      return await generateOtp(email);
    } catch (error: any) {
      console.error("Error in sendOtpAction:", error);
      return { success: false, message: error.message || "Failed to send OTP." };
    }
  }, []);

  const verifyOtpAction = useCallback(async (email: string, otp: string) => {
    try {
      return await verifyOtp(email, otp);
    } catch (error: any) {
      console.error("Error in verifyOtpAction:", error);
      return { success: false, message: error.message || "Failed to verify OTP." };
    }
  }, []);


  // Route protection & user loading logic (adapted for local storage)
  useEffect(() => {
    // Skip protection during initial loading phase or if not mounted
    if (loading || !isMounted) return;

    const isAuthPage = pathname.startsWith('/auth');
    const isAdminRoute = pathname.startsWith('/admin');
     // Expanded public routes to include test-related paths
    const publicRoutes = ['/', '/help', '/terms', '/privacy', '/tests', '/study-tips', '/doubt-solving', '/progress'];
    const isPublicRoute = publicRoutes.includes(pathname) ||
                          pathname.startsWith('/tests/') ||
                          pathname.startsWith('/take-test/') ||
                          pathname.startsWith('/chapterwise-test/') ||
                          pathname.startsWith('/chapterwise-test-results/') ||
                          pathname.startsWith('/chapterwise-test-review/');


    console.log("AuthProvider Route Check:", { pathname, isAuthPage, isAdminRoute, isPublicRoute, userExists: !!user });

    if (user) { // User is logged in (state is set from localStorage or login/signup)
      const isAdmin = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
      console.log("AuthProvider: User logged in.", { isAdmin });

      if (isAuthPage) {
         console.log("AuthProvider: Redirecting logged-in user from auth page.");
         router.push(isAdmin ? '/admin' : '/');
      } else if (isAdminRoute && !isAdmin) {
         console.log("AuthProvider: Redirecting non-admin from admin route.");
         router.push('/');
         toast({ variant: "destructive", title: "Access Denied", description: "You do not have permission to access this page." });
      }
    } else { // User is not logged in
       console.log("AuthProvider: User not logged in.");
      if (!isAuthPage && !isPublicRoute) {
         console.log("AuthProvider: Redirecting unauthenticated user to login.");
         router.push(`/auth/login?redirect=${pathname}`);
      }
    }
    // Removed toast dependency as it might cause loops if toasts trigger re-renders which trigger useEffect
  }, [user, loading, pathname, router, isMounted]);

  // --- UI Loading State ---
   // Show skeleton only during the initial loading phase AND if not on an auth page
   // This prevents flashing the skeleton on auth pages before redirecting
   if (loading && !user && isMounted && !pathname.startsWith('/auth')) {
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


   // UI Error State for Potential Local Storage Issues
   if (initializationError && !loading) {
     return (
       <div className="flex items-center justify-center min-h-screen bg-destructive/10 text-destructive-foreground p-6">
         <Alert variant="destructive">
           <AlertTriangle className="h-4 w-4" />
           <AlertTitle>Application Error</AlertTitle>
           <AlertDescription>
             {initializationError}
             <p className="mt-2 text-xs">There might be an issue with accessing local storage or reading user data. Please try clearing your browser cache or contact support if the problem persists.</p>
             </AlertDescription>
         </Alert>
       </div>
     );
   }


  return (
    <AuthContext.Provider value={{ user, loading, initializationError, login, logout, signUp, refreshUser, sendOtpAction, verifyOtpAction }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
