// src/context/auth-context.tsx
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, firebaseInitializationError } from '@/lib/firebase'; // Use potentially null auth instance
import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  type User as FirebaseUser,
} from "firebase/auth";
import type { UserProfile, UserModel, AcademicStatus } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { findUserByCredentials, findUserByEmail } from '@/actions/auth-actions';
import { saveUserToJson, addUserToJson, getUserById } from '@/actions/user-actions';
import { useRouter, usePathname } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';

type ContextUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  phone: string | null;
  className: AcademicStatus | null;
  model: UserModel;
  expiry_date: string | null;
} | null;

interface AuthContextProps {
  user: ContextUser;
  loading: boolean;
  initializationError: string | null; // Expose initialization error
  login: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  signUpLocally: (userData: Omit<UserProfile, 'id' | 'createdAt' | 'password' | 'model' | 'expiry_date' | 'referral'> & { class: AcademicStatus | null; phone: string | null }, password?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  initializationError: firebaseInitializationError, // Use error from init
  login: async () => { console.warn('Auth not initialized or login function not implemented'); },
  logout: async () => { console.warn('Auth not initialized or logout function not implemented'); },
  signUpLocally: async () => { console.warn('Auth not initialized or signUpLocally function not implemented'); },
  signInWithGoogle: async () => { console.warn('Auth not initialized or signInWithGoogle function not implemented'); },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ContextUser>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  // Use the initialization error directly from the firebase module
  const [localError, setLocalError] = useState<string | null>(firebaseInitializationError);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // If Firebase initialization failed critically, don't attach listener
    if (localError || !auth) {
        console.error("Skipping Firebase Auth listener due to initialization error:", localError);
        setLoading(false); // Stop loading as auth won't work
        return; // Exit early
    }

    // If auth is available, attach the listener
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      setLoading(true);
      if (firebaseUser) {
        try {
          console.log("Firebase Auth State Changed: User found", firebaseUser.uid, firebaseUser.email);
          let profile = await getUserById(firebaseUser.uid);

          if (!profile && firebaseUser.email) {
            console.log("User not found by UID, trying email lookup:", firebaseUser.email);
            profile = await findUserByEmail(firebaseUser.email);
            if (profile && profile.id !== firebaseUser.uid) {
              console.warn(`User found by email (${firebaseUser.email}) but UID mismatch. Linking not implemented, creating new profile for Firebase UID.`);
              profile = null; // Force creation with Firebase UID
            }
          }

          if (!profile) {
            console.log("No local profile found for Firebase UID:", firebaseUser.uid, ". Creating local profile...");
            const newUserProfile: UserProfile = {
              id: firebaseUser.uid,
              email: firebaseUser.email,
              password: undefined,
              name: firebaseUser.displayName || `User_${firebaseUser.uid.substring(0, 5)}`,
              phone: firebaseUser.phoneNumber || null,
              referral: "",
              class: null,
              model: 'free',
              expiry_date: null,
              createdAt: new Date().toISOString(),
            };
            const addResult = await addUserToJson(newUserProfile);
            if (!addResult.success) {
              throw new Error(addResult.message || "Failed to create local profile for Firebase user.");
            }
            profile = newUserProfile;
            console.log("Local profile created for Firebase user:", firebaseUser.uid);
          } else {
             // Sync: Optionally update local profile name/photo from Firebase if needed
             // Example: Check if local name is generic and Firebase name exists
             let needsUpdate = false;
             const updates: Partial<UserProfile> = {};
             if (profile.name?.startsWith("User_") && firebaseUser.displayName && profile.name !== firebaseUser.displayName) {
                updates.name = firebaseUser.displayName;
                needsUpdate = true;
             }
             // Add more sync logic if needed (e.g., photoURL, phone)

             if (needsUpdate) {
                 console.log("Syncing local profile with Firebase data updates:", updates);
                 await saveUserToJson({ ...profile, ...updates });
                 profile = { ...profile, ...updates }; // Update profile in memory
             } else {
                 console.log("Found existing local profile for Firebase user:", profile.id);
             }
          }

          const contextUser: ContextUser = {
            id: profile.id,
            email: profile.email,
            displayName: profile.name,
            photoURL: firebaseUser.photoURL,
            phone: profile.phone,
            className: profile.class,
            model: profile.model,
            expiry_date: profile.expiry_date,
          };
          setUser(contextUser);

          // REDIRECT LOGIC
          const isAdmin = profile.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
          console.log(`User: ${profile.email}, Is Admin: ${isAdmin}, Current Path: ${pathname}`);
          if (isAdmin && !pathname.startsWith('/admin')) {
            console.log('Redirecting admin to /admin');
            router.push('/admin');
          } else if (!isAdmin && pathname.startsWith('/admin')) {
            console.log('Redirecting non-admin from /admin to /');
            router.push('/');
          } else if (pathname.startsWith('/auth')) {
             console.log(`User logged in on auth page (${pathname}), redirecting...`);
             router.push(isAdmin ? '/admin' : '/');
          }

        } catch (error: any) {
          console.error("Error during onAuthStateChanged profile sync:", error);
          toast({ variant: 'destructive', title: 'Profile Sync Error', description: error.message });
          if (auth) await signOut(auth); // Ensure auth exists before calling signOut
          setUser(null);
        }
      } else {
        // User is signed out
        console.log("Firebase Auth State Changed: No user");
        setUser(null);
        // Clear local storage related to simulated login if it exists
        localStorage.removeItem('loggedInUser');
        localStorage.removeItem('simulatedPassword');

        // Redirect from protected routes if logged out (only after mount)
        if (isMounted && (pathname.startsWith('/admin') || pathname === '/settings' || pathname === '/progress' || pathname.startsWith('/chapterwise-test') || pathname.startsWith('/take-test'))) {
          console.log(`User logged out on protected page (${pathname}), redirecting to login.`);
          router.push('/auth/login');
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, toast, pathname, isMounted]); // Keep dependencies

  // Login Function (using Simulated Local JSON)
  const login = useCallback(async (email: string, password?: string) => {
    if (!password) {
        toast({ variant: "destructive", title: "Login Error", description: "Password is required for local login." });
        throw new Error("Password required");
    }
    setLoading(true);
    setLocalError(null);
    try {
      const foundUser = await findUserByCredentials(email, password);

      if (foundUser) {
         const contextUser: ContextUser = {
            id: String(foundUser.id),
            email: foundUser.email,
            displayName: foundUser.name,
            photoURL: null,
            phone: foundUser.phone,
            className: foundUser.class,
            model: foundUser.model,
            expiry_date: foundUser.expiry_date,
        };
        setUser(contextUser);
        localStorage.setItem('loggedInUser', JSON.stringify(contextUser));
        localStorage.setItem('simulatedPassword', password); // WARNING: INSECURE

        toast({ title: "Login Successful", description: `Welcome back, ${foundUser.name || foundUser.email}!` });

        const isAdmin = contextUser.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        console.log(`Logged in: ${contextUser.email}, Is Admin: ${isAdmin}`);
        router.push(isAdmin ? '/admin' : '/');

      } else {
        throw new Error('Login failed: Invalid email or password for local authentication.');
      }
    } catch (error: any) {
      console.error("Simulated login failed:", error);
      setLocalError(error.message || 'Login failed.');
      setUser(null);
      localStorage.removeItem('loggedInUser');
      localStorage.removeItem('simulatedPassword');
       toast({ variant: 'destructive', title: 'Login Failed', description: error.message }); // Show toast on failure
      throw error; // Re-throw for component handling
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  // Logout Function (Local Simulation + Firebase signout)
  const logout = useCallback(async () => {
    setLoading(true);
    setLocalError(null);
    try {
       // Clear local state first
       setUser(null);
       localStorage.removeItem('loggedInUser');
       localStorage.removeItem('simulatedPassword');

       // Also sign out from Firebase if auth is available
       if (auth) {
           await signOut(auth);
           console.log("Firebase Logout successful.");
       } else {
           console.log("Simulated Logout (Firebase auth not available).");
       }

       toast({ title: "Logged Out", description: "You have been successfully logged out." });
       router.push('/auth/login');
    } catch (error: any) {
      console.error("Logout failed:", error);
      setLocalError(error.message || 'Logout failed.');
       toast({ variant: 'destructive', title: 'Logout Failed', description: error.message });
      // Don't throw here, as logout should ideally always succeed locally
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  // Sign Up Function (Local JSON Only)
  const signUpLocally = useCallback(async (userData, password) => {
    if (!userData.email || !password) {
      throw new Error("Email and password are required for signup.");
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
          password: password, // INSECURE!
          name: userData.name || null,
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

      console.log(`Local user created: ${userData.email}`);
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
  }, [router, toast]);

 // Sign In with Google (using Firebase, includes local profile sync)
 const signInWithGoogle = useCallback(async () => {
    // Check if auth is initialized *before* attempting sign-in
    if (!auth) {
        const errorMsg = "Google Sign-In failed: Firebase Authentication is not properly configured or failed to initialize. Please check your Firebase setup and .env configuration.";
        console.error(errorMsg);
        toast({ variant: 'destructive', title: 'Configuration Error', description: "Firebase Auth not ready. Check console & config.", duration: 7000 });
        setLocalError(errorMsg);
        throw new Error(errorMsg); // Throw to prevent further execution
    }
    setLoading(true);
    setLocalError(null); // Clear previous errors before attempting
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        // onAuthStateChanged will handle profile sync and redirection after this succeeds
        console.log("Firebase Google Sign-In successful via signInWithGoogle for:", result.user.email);
        // Toast handled by onAuthStateChanged success logic potentially
    } catch (error: any) {
        console.error("Firebase Google Sign-in failed:", error);
        let message = "Google Sign-In failed. Please try again.";
        if (error.code === 'auth/popup-closed-by-user') {
            message = "Google Sign-In cancelled.";
        } else if (error.code === 'auth/account-exists-with-different-credential') {
            message = "An account already exists with this email address using a different sign-in method.";
        } else if (error.code === 'auth/popup-blocked') {
            message = "Google Sign-In popup was blocked by the browser. Please allow popups for this site.";
        } else if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-already-opened') {
            message = 'Only one sign-in popup can be open at a time.';
        } else if (error.code === 'auth/network-request-failed') {
             message = 'Network error during Google Sign-In. Please check your connection.';
        }
        toast({ variant: 'destructive', title: 'Google Sign-In Failed', description: message });
        setLocalError(message);
        setUser(null);
        throw new Error(message);
    } finally {
        setLoading(false);
    }
}, [toast]); // Add toast as dependency

  // --- Loading and Error States ---
  if (!isMounted) {
     // Consistent skeleton for SSR/initial client render
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

   // Show critical initialization error prominently IF NOT on an auth page
   if (localError && isMounted && !pathname.startsWith('/auth')) {
       return (
           <div className="flex items-center justify-center min-h-screen bg-destructive/10 text-destructive-foreground p-6">
               <div className="max-w-md text-center bg-destructive text-white p-6 rounded-lg shadow-lg">
                   <h2 className="text-2xl font-bold mb-2">Application Initialization Error</h2>
                   <p className="text-sm mb-4">{localError}</p>
                   <p className="text-xs mb-4">Please ensure your Firebase project is correctly set up in the Firebase Console (including enabled Authentication methods) and the configuration in your <code>.env</code> file matches your Firebase project settings. Check the browser console for more details.</p>
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

   // Show loading state after mount if auth is still resolving and no init error
   // Don't show loading skeleton on auth pages after mount, show the actual page
   if (loading && !localError && !pathname.startsWith('/auth')) {
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
    <AuthContext.Provider value={{ user, loading, initializationError: localError, login, logout, signUpLocally, signInWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
