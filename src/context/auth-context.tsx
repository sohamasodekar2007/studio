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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Import Alert components
import { AlertTriangle } from 'lucide-react'; // Import Icon

type ContextUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  phone: string | null;
  className: AcademicStatus | null; // Renamed from 'class' to avoid keyword clash
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
              console.warn(`User found by email (${firebaseUser.email}) but UID mismatch. Creating new profile for Firebase UID ${firebaseUser.uid}.`);
              profile = null; // Force creation with Firebase UID
            }
          }

          if (!profile) {
            console.log("No local profile found for Firebase UID:", firebaseUser.uid, ". Creating local profile...");
            const newUserProfile: UserProfile = {
              id: firebaseUser.uid, // Use Firebase UID as the primary ID
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
             let needsUpdate = false;
             const updates: Partial<UserProfile> = {};
             if ((!profile.name || profile.name?.startsWith("User_")) && firebaseUser.displayName && profile.name !== firebaseUser.displayName) {
                updates.name = firebaseUser.displayName;
                needsUpdate = true;
             }
              if (!profile.id || profile.id !== firebaseUser.uid) {
                 console.warn(`Local profile ID (${profile.id}) does not match Firebase UID (${firebaseUser.uid}). Updating local ID.`);
                 updates.id = firebaseUser.uid; // Update local ID to match Firebase UID
                 needsUpdate = true;
              }
             // Add more sync logic if needed (e.g., photoURL, phone)

             if (needsUpdate) {
                 console.log("Syncing local profile with Firebase data updates:", updates);
                 // Ensure we pass the correct ID for the update
                 await saveUserToJson({ ...profile, ...updates, id: firebaseUser.uid });
                 profile = { ...profile, ...updates, id: firebaseUser.uid }; // Update profile in memory with correct ID
             } else {
                 console.log("Found existing local profile for Firebase user:", profile.id);
             }
          }

          const contextUser: ContextUser = {
            id: profile.id, // Ensure this is the Firebase UID
            email: profile.email,
            displayName: profile.name,
            photoURL: firebaseUser.photoURL,
            phone: profile.phone,
            className: profile.class,
            model: profile.model,
            expiry_date: profile.expiry_date,
          };
          setUser(contextUser);
          localStorage.setItem('loggedInUser', JSON.stringify(contextUser)); // Store full context user

          // REDIRECT LOGIC
          const isAdmin = profile.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
          console.log(`User: ${profile.email}, Is Admin: ${isAdmin}, Current Path: ${pathname}`);
          if (isAdmin && !pathname.startsWith('/admin') && pathname !== '/') { // Allow admin on root page
            console.log('Redirecting admin to /admin');
            router.push('/admin');
          } else if (!isAdmin && pathname.startsWith('/admin')) {
            console.log('Redirecting non-admin from /admin to /');
             router.push('/');
          } else if (pathname.startsWith('/auth')) {
             console.log(`User logged in on auth page (${pathname}), redirecting...`);
              // Redirect admin to admin dashboard, others to main dashboard
             router.push(isAdmin ? '/admin' : '/');
          }

        } catch (error: any) {
          console.error("Error during onAuthStateChanged profile sync:", error);
          toast({ variant: 'destructive', title: 'Profile Sync Error', description: error.message });
          if (auth) await signOut(auth); // Ensure auth exists before calling signOut
          setUser(null);
          localStorage.removeItem('loggedInUser');
          localStorage.removeItem('simulatedPassword');
        }
      } else {
        // User is signed out
        console.log("Firebase Auth State Changed: No user");
        setUser(null);
        // Clear local storage related to user session
        localStorage.removeItem('loggedInUser');
        localStorage.removeItem('simulatedPassword'); // Remove insecure password storage

        // Redirect from protected routes if logged out (only after mount)
        if (isMounted && (pathname.startsWith('/admin') || pathname === '/settings' || pathname === '/progress' || pathname.startsWith('/chapterwise-test') || pathname.startsWith('/take-test'))) {
          console.log(`User logged out on protected page (${pathname}), redirecting to login.`);
          router.push('/auth/login');
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, toast, pathname, isMounted, localError]); // Added localError


  // Login Function (using Firebase Email/Password)
  const login = useCallback(async (email: string, password?: string) => {
     // Check for initialization error first
     if (localError || !auth) {
        const errorMsg = "Login failed: Firebase Authentication is not properly configured. Check console & .env file.";
        console.error(errorMsg, localError);
        toast({ variant: 'destructive', title: 'Configuration Error', description: "Firebase Auth not ready.", duration: 7000 });
        throw new Error(errorMsg);
     }
    if (!password) {
        toast({ variant: "destructive", title: "Login Error", description: "Password is required." });
        throw new Error("Password required");
    }
    setLoading(true);
    setLocalError(null); // Reset local error state on new attempt
    try {
       const userCredential = await signInWithEmailAndPassword(auth, email, password);
       const firebaseUser = userCredential.user;
       console.log("Firebase Email/Password Login successful for:", firebaseUser.email);
       // onAuthStateChanged will handle profile loading, state update, and redirection
       // Toast for success will be shown by onAuthStateChanged's profile sync logic
       localStorage.setItem('simulatedPassword', password); // WARNING: INSECURE - Storing for local fallback/re-login simulation if needed

    } catch (error: any) {
      console.error("Firebase Login failed:", error);
      let message = "Login failed. Please check your email and password.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
          message = "Invalid email or password.";
      } else if (error.code === 'auth/invalid-email') {
           message = "Please enter a valid email address.";
      } else if (error.code === 'auth/too-many-requests') {
          message = "Access to this account has been temporarily disabled due to many failed login attempts. You can immediately restore it by resetting your password or you can try again later.";
      }
      setLocalError(error.message || message); // Store the error message
      toast({ variant: 'destructive', title: 'Login Failed', description: message }); // Show toast on failure
      setUser(null); // Clear user state
      localStorage.removeItem('loggedInUser');
      localStorage.removeItem('simulatedPassword');
      throw new Error(message); // Re-throw for component handling
    } finally {
      setLoading(false);
    }
  }, [router, toast, localError]); // Added localError to dependency


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
       router.push('/auth/login'); // Redirect reliably after logout
    } catch (error: any) {
      console.error("Logout failed:", error);
      setLocalError(error.message || 'Logout failed.');
       toast({ variant: 'destructive', title: 'Logout Failed', description: error.message });
      // Don't throw here, as logout should ideally always succeed locally
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  // Sign Up Function (Local JSON + Firebase)
   const signUpLocally = useCallback(async (userData, password) => {
    if (!userData.email || !password) {
        toast({ variant: 'destructive', title: 'Signup Failed', description: 'Email and password are required.' });
        throw new Error("Email and password required");
    }
    if (localError || !auth) { // Check init error and auth instance
        const errorMsg = "Signup failed: Firebase Authentication is not properly configured. Check console & .env file.";
        console.error(errorMsg, localError);
        toast({ variant: 'destructive', title: 'Configuration Error', description: "Firebase Auth not ready.", duration: 7000 });
        throw new Error(errorMsg);
    }

    setLoading(true);
    setLocalError(null); // Reset local error
    try {
        // 1. Check if email exists locally first (optional, Firebase check is primary)
        // const existingLocalUser = await findUserByEmail(userData.email);
        // if (existingLocalUser) {
        //     throw new Error("Email address is already registered locally.");
        // }

        // 2. Create user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, userData.email, password);
        const firebaseUser = userCredential.user;
        console.log(`Firebase user created: ${firebaseUser.uid} for ${firebaseUser.email}`);

        // 3. Create local profile using Firebase UID
        const newUserProfile: UserProfile = {
            id: firebaseUser.uid, // Use Firebase UID
            email: userData.email,
            password: undefined, // Don't store plain password locally
            name: userData.name || `User_${firebaseUser.uid.substring(0, 5)}`,
            phone: userData.phone || null,
            referral: "",
            class: userData.class || null,
            model: 'free',
            expiry_date: null,
            createdAt: new Date().toISOString(),
        };

        // 4. Save local profile to users.json
        const addResult = await addUserToJson(newUserProfile);
        if (!addResult.success) {
            // Potentially attempt to delete Firebase user if local save fails? Or log inconsistency.
            console.error("Firebase user created, but failed to save local profile:", firebaseUser.uid);
            throw new Error(addResult.message || "Could not save user profile locally after Firebase signup.");
        }

        console.log(`Local user profile created for UID: ${firebaseUser.uid}`);
        toast({ title: "Account Created", description: "Welcome! You are now logged in." });
        // onAuthStateChanged will handle setting user state and redirection

    } catch (error: any) {
        console.error("Signup failed:", error);
        let message = "Signup failed. Please try again.";
        if (error.code === 'auth/email-already-in-use') {
            message = "This email address is already registered."; // Simpler message
        } else if (error.code === 'auth/weak-password') {
            message = "Password is too weak. Please choose a stronger password.";
        } else if (error.code === 'auth/invalid-email') {
             message = "Please enter a valid email address.";
        }
        // else if (error.message === "Email address is already registered locally.") {
        //     message = error.message; // Use the specific local error
        // }
        toast({ variant: 'destructive', title: 'Signup Failed', description: message });
        setLocalError(message);
        setUser(null); // Ensure user is cleared on error
        throw new Error(message); // Re-throw for component handling
    } finally {
        setLoading(false);
    }
}, [toast, localError]); // Added localError


 // Sign In with Google (using Firebase, includes local profile sync)
 const signInWithGoogle = useCallback(async () => {
    if (localError || !auth) { // Check init error
        const errorMsg = "Google Sign-In failed: Firebase Authentication is not properly configured. Check console & .env file.";
        console.error(errorMsg, localError);
        toast({ variant: 'destructive', title: 'Configuration Error', description: "Firebase Auth not ready.", duration: 7000 });
        throw new Error(errorMsg);
    }
    setLoading(true);
    setLocalError(null); // Reset local error
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        console.log("Firebase Google Sign-In successful for:", result.user.email);
        // onAuthStateChanged handles profile sync and redirection
        // Toast can be handled there upon successful profile load
    } catch (error: any) {
        console.error("Firebase Google Sign-in failed:", error);
        let message = "Google Sign-In failed. Please try again.";
        // Handle specific Google Auth errors
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
}, [toast, localError]); // Added localError

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
            <div className="flex min-h-screen items-center justify-center p-4 bg-background">
                <Alert variant="destructive" className="max-w-lg">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Application Initialization Error</AlertTitle>
                    <AlertDescription>
                        {localError}
                        <p className="mt-2 text-xs">
                            Please ensure your Firebase project is correctly set up (including enabled Authentication methods) and the configuration in your <code>.env</code> file matches your Firebase project settings. Restart the server after fixing the <code>.env</code> file. Check the browser console and README for more details.
                        </p>
                         <button
                            onClick={() => window.location.reload()}
                            className="mt-4 text-sm underline"
                        >
                            Reload Page
                        </button>
                    </AlertDescription>
                </Alert>
            </div>
       );
   }

   // Show loading state after mount if auth is still resolving and no init error
   // Don't show loading skeleton on auth pages after mount, show the actual page
    if (loading && isMounted && !localError && !pathname.startsWith('/auth')) {
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
    <AuthContext.Provider value={{ user, loading, initializationError: localError, login, logout, signUpLocally, signInWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
