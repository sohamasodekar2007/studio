// src/context/auth-context.tsx
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, firebaseInitializationError } from '@/lib/firebase'; // Use real auth instance
import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider, // Import Google Provider
  type User as FirebaseUser, // Alias Firebase User type
} from "firebase/auth";
import type { UserProfile, UserModel, AcademicStatus } from '@/types'; // Use our UserProfile type
import { Skeleton } from '@/components/ui/skeleton';
import { findUserByCredentials, findUserByEmail } from '@/actions/auth-actions'; // Import actions to find user locally
import { saveUserToJson, addUserToJson, getUserById } from '@/actions/user-actions'; // Import actions to save/add user
import { useRouter, usePathname } from 'next/navigation'; // Import useRouter for redirection
import { v4 as uuidv4 } from 'uuid'; // Import UUID generator
import { useToast } from '@/hooks/use-toast';

// Update SimulatedUser to include photoURL and use Firebase User ID
type ContextUser = {
  id: string; // Firebase UID is a string
  email: string | null;
  displayName: string | null;
  photoURL?: string | null; // Add photoURL for Google Sign-in
  phone: string | null;
  className: AcademicStatus | null; // Changed from class to className to avoid keyword conflict
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
  signInWithGoogle: () => Promise<void>; // Rename to reflect real Google Sign-in
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  initializationError: firebaseInitializationError, // Pass error from firebase module
  login: async () => { console.warn('Login function not implemented'); },
  logout: async () => { console.warn('Logout function not implemented'); },
  signUpLocally: async () => { console.warn('signUpLocally function not implemented'); },
  signInWithGoogle: async () => { console.warn('signInWithGoogle function not implemented'); },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ContextUser>(null);
  const [loading, setLoading] = useState(true); // Auth loading state
  const [isMounted, setIsMounted] = useState(false); // Client mount state
  const [localError, setLocalError] = useState<string | null>(firebaseInitializationError); // Use error from init
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    setIsMounted(true); // Set mounted state after initial render on client
  }, []);

  // Effect to listen for Firebase auth state changes
  useEffect(() => {
    if (!auth) {
      setLoading(false); // Stop loading if Firebase Auth isn't initialized
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      setLoading(true); // Start loading when auth state might change
      if (firebaseUser) {
        try {
          // User is signed in via Firebase (Email/Pass or Google)
          console.log("Firebase Auth State Changed: User found", firebaseUser.uid, firebaseUser.email);

          // Attempt to find/sync with local JSON profile using Firebase UID
          let profile = await getUserById(firebaseUser.uid);

          if (!profile && firebaseUser.email) {
             // Try finding by email (maybe user signed up locally first, then Google)
             console.log("User not found by UID, trying email lookup:", firebaseUser.email);
             profile = await findUserByEmail(firebaseUser.email);

             if (profile && profile.id !== firebaseUser.uid) {
                 console.warn(`User found by email (${firebaseUser.email}) but UID mismatch. This case needs handling (e.g., link accounts or prompt user). For now, treating as new user.`);
                 profile = null; // Reset profile to force creation with correct UID
             }
          }

          if (!profile) {
            // If still not found, create a new local profile entry for this Firebase user
            console.log("No local profile found for Firebase UID:", firebaseUser.uid, ". Creating local profile...");
            const newUserProfile: UserProfile = {
              id: firebaseUser.uid, // Use Firebase UID as the primary ID
              email: firebaseUser.email,
              password: undefined, // No password for Google/Firebase users in JSON
              name: firebaseUser.displayName || `User_${firebaseUser.uid.substring(0, 5)}`, // Use Google name or generate one
              phone: firebaseUser.phoneNumber || null, // Use Google phone if available
              referral: "",
              class: null, // Default class (can be set later in settings)
              model: 'free', // Default model
              expiry_date: null, // Default expiry
              createdAt: new Date().toISOString(),
            };
            const addResult = await addUserToJson(newUserProfile);
            if (!addResult.success) {
                throw new Error(addResult.message || "Failed to create local profile for Firebase user.");
            }
            profile = newUserProfile; // Use the newly created profile
            console.log("Local profile created for Firebase user:", firebaseUser.uid);
          } else {
            // Sync: Optionally update local profile name/photo from Firebase if needed
            // (Could add logic here if desired)
            console.log("Found existing local profile for Firebase user:", profile.id);
          }

          // Set the context user state
          const contextUser: ContextUser = {
            id: profile.id,
            email: profile.email,
            displayName: profile.name,
            photoURL: firebaseUser.photoURL, // Add photoURL from Firebase
            phone: profile.phone,
            className: profile.class,
            model: profile.model,
            expiry_date: profile.expiry_date,
          };
          setUser(contextUser);
           // --- REDIRECT LOGIC (On Auth State Change) ---
           const isAdmin = profile.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
           console.log(`User: ${profile.email}, Is Admin: ${isAdmin}, Current Path: ${pathname}`);
            if (isAdmin && !pathname.startsWith('/admin')) {
                console.log('Redirecting admin to /admin');
                router.push('/admin');
            } else if (!isAdmin && pathname.startsWith('/admin')) {
                console.log('Redirecting non-admin from /admin to /');
                router.push('/');
            } else if (pathname.startsWith('/auth')) {
                 // If user is logged in and on an auth page, redirect based on role
                console.log(`User logged in on auth page (${pathname}), redirecting...`);
                 router.push(isAdmin ? '/admin' : '/');
            }
            // No else needed, stay on current page if already appropriate


        } catch (error: any) {
          console.error("Error fetching/creating local user profile:", error);
          toast({ variant: 'destructive', title: 'Profile Sync Error', description: error.message });
          await signOut(auth); // Log out Firebase user if profile sync fails
          setUser(null);
        }
      } else {
        // User is signed out
        console.log("Firebase Auth State Changed: No user");
        setUser(null);
         // If logged out, redirect from protected routes
         if (isMounted && (pathname.startsWith('/admin') || pathname === '/settings' || pathname === '/progress' || pathname.startsWith('/chapterwise-test') || pathname.startsWith('/take-test'))) {
             console.log(`User logged out on protected page (${pathname}), redirecting to login.`);
             router.push('/auth/login');
         }
      }
      setLoading(false); // Stop loading after processing auth state change
    });

    return () => unsubscribe(); // Cleanup listener on unmount
  }, [router, toast, pathname, isMounted]); // Add isMounted dependency

  // Login Function (using Simulated Local JSON)
  const login = async (email: string, password?: string) => {
     if (!password) {
         toast({ variant: "destructive", title: "Login Error", description: "Password is required for local login." });
         return;
     }
    setLoading(true);
    setLocalError(null);
    try {
      const foundUser = await findUserByCredentials(email, password); // Use the action

      if (foundUser) {
         const contextUser: ContextUser = {
            id: String(foundUser.id), // Ensure ID is string
            email: foundUser.email,
            displayName: foundUser.name,
            photoURL: null, // No photoURL for local users
            phone: foundUser.phone,
            className: foundUser.class,
            model: foundUser.model,
            expiry_date: foundUser.expiry_date,
        };
        setUser(contextUser);
        // Store necessary user info and simulated password in local storage for session persistence
        localStorage.setItem('loggedInUser', JSON.stringify(contextUser));
        localStorage.setItem('simulatedPassword', password); // WARNING: INSECURE

        toast({ title: "Login Successful", description: `Welcome back, ${foundUser.name || foundUser.email}!` });

         // Redirect after setting user state
        const isAdmin = contextUser.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        console.log(`Logged in: ${contextUser.email}, Is Admin: ${isAdmin}`);
        router.push(isAdmin ? '/admin' : '/'); // Redirect based on role

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
      throw error; // Re-throw for component handling
    } finally {
      setLoading(false);
    }
  };


  // Logout Function (Local Simulation)
  const logout = async () => {
    setLoading(true);
    setLocalError(null);
    try {
       // Simulate logout by clearing local state and storage
       setUser(null);
       localStorage.removeItem('loggedInUser');
       localStorage.removeItem('simulatedPassword');
       console.log("Simulated Logout successful.");
       toast({ title: "Logged Out", description: "You have been successfully logged out." });
       // Redirect immediately after clearing state
       router.push('/auth/login');
    } catch (error: any) {
      console.error("Simulated logout failed:", error);
      setLocalError(error.message || 'Logout failed.');
      throw error; // Re-throw for component handling if needed
    } finally {
      setLoading(false);
    }
  };

  // Sign Up Function (Local JSON Only)
  const signUpLocally = async (userData: Omit<UserProfile, 'id' | 'createdAt' | 'password' | 'model' | 'expiry_date' | 'referral'> & { class: AcademicStatus | null; phone: string | null }, password?: string) => {
    if (!userData.email || !password) {
      throw new Error("Email and password are required for signup.");
    }
    setLoading(true);
    setLocalError(null);
    try {
      // 1. Check if email already exists
      const existingUser = await findUserByEmail(userData.email);
      if (existingUser) {
        throw new Error("Email address is already registered.");
      }

      // 2. Create user profile object
       const newUserProfile: UserProfile = {
          id: uuidv4(), // Generate UUID for local user
          email: userData.email,
          password: password, // Store plain text password (INSECURE!)
          name: userData.name || null,
          phone: userData.phone || null,
          referral: "", // Default empty referral
          class: userData.class || null,
          model: 'free', // Default to free model
          expiry_date: null, // Default to null expiry
          createdAt: new Date().toISOString(),
       };

      // 3. Save user to JSON file
      const addResult = await addUserToJson(newUserProfile);
      if (!addResult.success) {
        throw new Error(addResult.message || "Could not save user profile locally.");
      }

      console.log(`Local user created: ${userData.email}`);
      toast({ title: "Account Created", description: "Welcome! Please log in." });
      // Redirect to login after successful local signup
      router.push('/auth/login');

    } catch (error: any) {
      console.error("Local signup failed:", error);
      let message = "Signup failed. Please try again.";
      if (error.message === "Email address is already registered.") {
        message = error.message;
      }
      setLocalError(message);
      setUser(null);
      throw new Error(message); // Re-throw for component handling
    } finally {
      setLoading(false);
    }
  };

 // Sign In with Google (using Firebase, includes local profile sync)
  const signInWithGoogle = async () => {
    if (!auth) throw new Error("Firebase Auth not initialized.");
    setLoading(true);
    setLocalError(null);
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        // onAuthStateChanged will handle profile sync and redirection
        console.log("Firebase Google Sign-In successful for:", result.user.email);
        toast({ title: "Google Sign-In Successful", description: "Welcome!" });
    } catch (error: any) {
        console.error("Firebase Google Sign-in failed:", error);
        let message = "Google Sign-In failed. Please try again.";
        if (error.code === 'auth/popup-closed-by-user') {
            message = "Google Sign-In cancelled.";
        } else if (error.code === 'auth/account-exists-with-different-credential') {
            message = "An account already exists with this email address using a different sign-in method.";
        } else if (error.code === 'auth/popup-blocked') {
            message = "Google Sign-In popup was blocked by the browser. Please allow popups for this site.";
        }
        setLocalError(message);
        setUser(null); // Ensure user is null on error
        throw new Error(message); // Re-throw for component handling
    } finally {
        setLoading(false);
    }
};

  // --- Conditional Rendering Logic ---

  if (!isMounted) {
     // Render consistent loading skeleton on server and initial client render
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

  // Show loading indicator *after* mount if auth state is still loading
  if (loading) {
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

  // Error State UI (Only shown if NOT on an auth page, *after* mount)
  if (localError && !pathname.startsWith('/auth')) {
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

  // Render children if mounted, not loading, and no critical error
  return (
    <AuthContext.Provider value={{ user, loading, initializationError: localError, login, logout, signUpLocally, signInWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);


