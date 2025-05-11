// src/context/auth-context.tsx
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { UserProfile, UserModel, AcademicStatus as UserAcademicStatus, ContextUser } from '@/types';
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
// Use local storage actions
import {
    readUsersWithPasswordsInternal,
    saveUserToJson, // For direct UserProfile object saving
    readUsers,
    getUserById,
    addUserToJson, // For creating new users via signup form
    updateUserInJson, 
    deleteUserFromJson, 
    updateUserPasswordInJson, 
    updateUserRole, // Ensure updateUserRole is imported
    findUserByEmailInternal,
    findUserByReferralCode,
} from '@/actions/user-actions'; 
import { sendWelcomeEmail } from '@/actions/otp-actions'; // For welcome email simulation
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { firebaseInitializationError as localError } from '@/lib/firebase'; // Import only the error message


interface AuthContextProps {
  user: ContextUser;
  loading: boolean;
  initializationError: string | null;
  login: (email: string, password?: string) => Promise<void>;
  logout: (message?: string) => Promise<void>;
  signUp: (
    email: string,
    password?: string,
    displayName?: string,
    phoneNumber?: string | null,
    academicStatus?: UserAcademicStatus | null,
    targetYear?: string | null,
    referralCodeUsed?: string | null
  ) => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUserData: (updatedUser: Omit<UserProfile, 'password'>) => void;
  setUser: React.Dispatch<React.SetStateAction<ContextUser>>; 
  setLoading: React.Dispatch<React.SetStateAction<boolean>>; 
  mapUserProfileToContextUser: (userProfile: Omit<UserProfile, 'password'> | null) => ContextUser; 

}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  initializationError: null,
  login: async () => { console.warn('Auth: Login not implemented'); },
  logout: async () => { console.warn('Auth: Logout not implemented'); },
  signUp: async () => { console.warn('Auth: SignUp not implemented'); },
  refreshUser: async () => { console.warn('Auth: RefreshUser not implemented'); },
  updateUserData: () => { console.warn('Auth: updateUserData not implemented'); },
  setUser: () => {},
  setLoading: () => {},
  mapUserProfileToContextUser: () => null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ContextUser>(null);
  const [loading, setLoading] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(localError);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const mapUserProfileToContextUser = useCallback((userProfile: Omit<UserProfile, 'password'> | null): ContextUser => {
      if (!userProfile) return null;
      return {
          id: userProfile.id,
          email: userProfile.email,
          name: userProfile.name,
          phone: userProfile.phone,
          avatarUrl: userProfile.avatarUrl,
          class: userProfile.class,
          model: userProfile.model,
          role: userProfile.role,
          expiry_date: userProfile.expiry_date,
          createdAt: userProfile.createdAt,
          targetYear: userProfile.targetYear,
          telegramId: userProfile.telegramId,
          telegramUsername: userProfile.telegramUsername,
          totalPoints: userProfile.totalPoints,
          referralCode: userProfile.referralCode,
          referralStats: userProfile.referralStats,
      };
  }, []);

  const logoutCallback = useCallback(async (message?: string) => {
     if (!isMounted) return;
    setLoading(true);
    setUser(null);
    localStorage.removeItem('loggedInUser');
    if (message) {
        toast({ title: "Logged Out", description: message });
    } else {
        toast({ title: "Logged Out", description: "You have been successfully logged out." });
    }
    // Clear any sensitive local data if needed, e.g., specific test session data
    // For example, if using test-specific keys:
    // Object.keys(localStorage).forEach(key => {
    //   if (key.startsWith('test-session-')) {
    //     localStorage.removeItem(key);
    //   }
    // });
    router.push('/auth/login');
    setLoading(false);
  }, [router, toast, isMounted]);


  useEffect(() => {
    if (!isMounted) return;

    const checkUserSession = async () => {
        setLoading(true);
        try {
            // Attempt to initialize user data store (e.g., create users.json if not exists)
            await readUsersWithPasswordsInternal(); // This ensures users.json and admin exist

            const storedUserJson = localStorage.getItem('loggedInUser');
            if (!storedUserJson) {
                console.log("AuthProvider: No user found in localStorage.");
                setUser(null);
                setLoading(false);
                return;
            }

            const storedUser: Omit<UserProfile, 'password'> = JSON.parse(storedUserJson);

            // Basic validation of stored user data
            if (!storedUser || !storedUser.id || !storedUser.email) {
                 console.warn("AuthProvider: Invalid user data in localStorage. Logging out.");
                 await logoutCallback("Invalid session data. Please log in again.");
                 setLoading(false);
                 return;
            }

            // Fetch the LATEST user profile from the backend (users.json)
             console.log(`AuthProvider: Fetching latest profile for user ID: ${storedUser.id}`);
             const latestProfile = await getUserById(storedUser.id); // getUserById returns Omit<UserProfile, 'password'>

             if (!latestProfile) {
                  console.warn(`AuthProvider: User ID ${storedUser.id} not found in backend. Logging out.`);
                  await logoutCallback("Your account could not be found. Please log in again.");
                  setLoading(false);
                  return;
             }

            // Compare critical fields (e.g., role, plan) for changes
            const profileChangedCritically = storedUser.model !== latestProfile.model ||
                                   storedUser.role !== latestProfile.role ||
                                   (storedUser.expiry_date || null) !== (latestProfile.expiry_date || null);


            if (profileChangedCritically) {
                  console.log("AuthProvider: Critical profile change detected. Forcing re-login.");
                  await logoutCallback("Your account details have been updated. Please log in again for changes to take effect.");
                  setLoading(false);
                  return;
            }
             const updatedContextUser = mapUserProfileToContextUser(latestProfile);
             setUser(updatedContextUser);
             localStorage.setItem('loggedInUser', JSON.stringify(latestProfile)); // Update localStorage with fresh data
             console.log(`AuthProvider: Session loaded for ${latestProfile.email}.`);

        } catch (e: any) {
             console.error("AuthProvider: Error during session check:", e);
             setInitializationError(`Failed to verify session: ${e.message}. Ensure users.json is accessible and valid.`);
             // Don't auto-logout on general file read errors, only on specific validation failures above.
             // If users.json doesn't exist, readUsersWithPasswordsInternal creates it.
             // If it's malformed, that's a more critical issue handled by the general error boundary.
        } finally {
            setLoading(false);
        }
    };
    checkUserSession();
  }, [isMounted, mapUserProfileToContextUser, logoutCallback]); // Added logoutCallback to dependency array


  const refreshUser = useCallback(async () => {
    if (!user || !user.id) return; // Ensure user context exists
    if (!isMounted) return; // Ensure component is mounted

    setLoading(true);
    try {
      const updatedProfile = await getUserById(user.id);
       if (updatedProfile) {
         const contextUser = mapUserProfileToContextUser(updatedProfile);
         setUser(contextUser);
         localStorage.setItem('loggedInUser', JSON.stringify(updatedProfile));
         toast({ title: 'Profile Synced', description: 'Your profile data has been refreshed.' });
       } else {
         // User might have been deleted from backend, log them out
         await logoutCallback("Your account could not be found.");
       }
    } catch (e) {
      console.error("RefreshUser failed:", e);
      toast({ variant: 'destructive', title: 'Sync Error', description: 'Could not refresh user data.' });
    } finally {
       setLoading(false);
    }
  }, [user, toast, isMounted, mapUserProfileToContextUser, logoutCallback]);


 const login = useCallback(async (email: string, password?: string) => {
    if (!isMounted) {
        console.warn("Login attempt before component mount.");
        return;
    }
    if (!password) {
        toast({ variant: 'destructive', title: 'Login Failed', description: 'Password is required.' });
        throw new Error('Password is required.');
    }
    setLoading(true);
    try {
        // Server action findUserByEmailInternal fetches the user with password hash
        const foundUserWithHash = await findUserByEmailInternal(email);

        if (foundUserWithHash && foundUserWithHash.password) {
             const passwordMatch = await bcrypt.compare(password, foundUserWithHash.password);
             if (passwordMatch) {
                const { password: _removedPassword, ...userToStore } = foundUserWithHash;
                const contextUser = mapUserProfileToContextUser(userToStore);
                setUser(contextUser);
                localStorage.setItem('loggedInUser', JSON.stringify(userToStore));

                const isAdmin = contextUser?.role === 'Admin';
                const redirectPath = isAdmin ? '/admin' : '/'; // Redirect admin to admin dashboard
                router.push(redirectPath);
                toast({ title: "Login Successful", description: `Welcome back, ${contextUser?.name || contextUser?.email}!` });
             } else {
                 // Password did not match
                 console.warn(`AuthProvider: Login failed for ${email}. Password mismatch.`);
                 throw new Error('Login failed: Invalid email or password.');
             }
        } else {
            // User not found or has no password hash stored
             console.warn(`AuthProvider: Login failed for ${email}. User not found or password not set.`);
            throw new Error('Login failed: Invalid email or password.');
        }
    } catch (error: any) {
      console.error("Login failed:", error); // Log the actual error object
      toast({ variant: 'destructive', title: 'Login Failed', description: error.message });
      throw error; // Re-throw to be caught by the form
    } finally {
      setLoading(false);
    }
  }, [router, toast, isMounted, mapUserProfileToContextUser]);


  const signUp = useCallback(async (
    email: string,
    password?: string,
    displayName?: string,
    phoneNumber?: string | null,
    academicStatus?: UserAcademicStatus | null,
    targetYear?: string | null,
    referralCodeUsed?: string | null
  ) => {
     if (!isMounted) return;
    if (!password) {
        toast({ variant: 'destructive', title: 'Signup Failed', description: 'Password is required.' });
        throw new Error('Password is required.');
    }
    setLoading(true);
    try {
      // addUserToJson now handles checking for existing email and hashing password
      const newUserProfileData: Omit<UserProfile, 'id' | 'createdAt' | 'avatarUrl' | 'referralCode' | 'referralStats' | 'totalPoints' | 'telegramId' | 'telegramUsername'> & { password: string; referredByCode?: string | null } = {
        email: email,
        password: password, // Pass plain text password to addUserToJson
        name: displayName || null,
        phone: phoneNumber || null,
        class: academicStatus || null,
        model: 'free', // New users default to 'free'
        role: 'User', // New users default to 'User'
        expiry_date: null, // Free users don't have expiry
        targetYear: targetYear || null,
        referredByCode: referralCodeUsed || null,
      };

       const saveResult = await addUserToJson(newUserProfileData);

       if (!saveResult.success || !saveResult.user) {
         // If addUserToJson returns an error message, use it. Otherwise, generic message.
         throw new Error(saveResult.message || 'Could not create user profile.');
       }

      // If signup is successful, send welcome email and log in the new user
      if (saveResult.user.email) { // Ensure email exists before trying to send
          await sendWelcomeEmail(saveResult.user.email, saveResult.user.name);
      }

       // Log in the new user
       const contextUser = mapUserProfileToContextUser(saveResult.user);
       setUser(contextUser);
        if (contextUser) { // Check if contextUser is not null
            localStorage.setItem('loggedInUser', JSON.stringify(saveResult.user)); // Store the user without password
        }

      toast({ title: "Account Created!", description: `Welcome to EduNexus! You are now logged in.` });
      router.push('/'); // Redirect to dashboard or a welcome page
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Sign Up Failed', description: error.message });
      throw error; // Re-throw to be caught by the form
    } finally {
      setLoading(false);
    }
  }, [router, toast, isMounted, mapUserProfileToContextUser]);


  useEffect(() => {
    if (loading || !isMounted) return; // Don't run navigation logic if auth state is loading or component not mounted

    const isAuthPage = pathname.startsWith('/auth');
    const isAdminRoute = pathname.startsWith('/admin');
    // Define public routes that don't require authentication
    const publicRoutes = [
        '/', '/help', '/terms', '/privacy', '/tests', '/dpp', '/pyq-dpps', '/take-test',
        '/chapterwise-test', '/chapterwise-test-results', '/chapterwise-test-review',
        '/challenge-test', '/challenge-test-result', '/challenge-test-review', '/packages',
        // Add other public base paths like /notebooks, /leaderboard etc.
        // Note: Dynamic child routes like /tests/[testCode] are covered by checking startsWith('/tests')
    ];

     // Check if the current pathname starts with any of the public base routes or is exactly '/'
     const isPublicRoute = publicRoutes.some(route => {
         if (pathname.startsWith(route + '/') && route !== '/') return true; // For nested public routes
         return pathname === route;
     });

    if (user) {
      // User is logged in
      const isAdmin = user.role === 'Admin';
      if (isAuthPage) {
        // If on an auth page (login/signup) and logged in, redirect
        router.push(isAdmin ? '/admin' : '/');
      } else if (isAdminRoute && !isAdmin) {
        // If trying to access admin route as non-admin, redirect to home
        toast({ variant: "destructive", title: "Access Denied", description: "You do not have permission to access the admin panel." });
        router.push('/');
      }
    } else { 
      // User is not logged in
      if (!isAuthPage && !isPublicRoute) {
        // If not on an auth page AND not on a public route, redirect to login
        // Preserve the intended path for redirection after login
        const redirectQuery = pathname ? `?redirect=${encodeURIComponent(pathname)}` : '';
        router.push(`/auth/login${redirectQuery}`);
      }
    }
  }, [user, loading, pathname, router, isMounted, toast]);

  const updateUserData = (updatedUser: Omit<UserProfile, 'password'>) => {
    // This function is called when user data changes (e.g., from Settings page)
    // It updates the context and localStorage
    if (user && user.id === updatedUser.id) { // Ensure it's the same user
        const contextUser = mapUserProfileToContextUser(updatedUser);
        setUser(contextUser);
        localStorage.setItem('loggedInUser', JSON.stringify(updatedUser));
    }
  }

   // Global loading state or initialization error display
   // This should only show if critical initialization failed or during initial load.
   // Individual page skeletons are preferred for normal loading states.
   if (loading && isMounted && !pathname.startsWith('/auth') && !user) { // Show loading only if not on auth pages and user isn't loaded yet
     return (
       <div className="flex items-center justify-center min-h-screen bg-background">
         <div className="space-y-4 w-full max-w-md p-4">
           {/* Simplified Skeleton */}
           <Skeleton className="h-10 w-3/4 mx-auto" />
           <Skeleton className="h-6 w-1/2 mx-auto" />
           <Skeleton className="h-40 w-full" />
         </div>
       </div>
     );
   }

   if (initializationError && !loading && !pathname.startsWith('/auth')) { // Avoid showing this on auth pages
     return (
       <div className="flex items-center justify-center min-h-screen bg-destructive/10 text-destructive-foreground p-6">
         <Alert variant="destructive">
           <AlertTriangle className="h-4 w-4" />
           <AlertTitle>Application Initialization Error</AlertTitle>
           <AlertDescription>
             {initializationError}
             <p className="mt-2 text-xs">Please ensure your browser supports local storage and try clearing your cache or contact support.</p>
             </AlertDescription>
         </Alert>
       </div>
     );
   }

  return (
    <AuthContext.Provider value={{ user, loading, initializationError, login, logout: logoutCallback, signUp, refreshUser, updateUserData, setUser, setLoading, mapUserProfileToContextUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
