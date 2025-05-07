// src/context/auth-context.tsx
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { UserProfile, UserModel, AcademicStatus as UserAcademicStatus, ContextUser } from '@/types';
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
// Use local storage actions
import { findUserByEmail, saveUserToJson, readUsers, getUserById, addUserToJson, updateUserInJson, deleteUserFromJson, updateUserPasswordInJson, readUsersWithPasswordsInternal } from '@/actions/user-actions'; // Ensure all are imported
// Removed direct findUserByEmail import from auth-actions
// import { findUserByEmail as findUserByEmailFromAuth } from '@/actions/auth-actions';
import { sendWelcomeEmail } from '@/actions/otp-actions'; // For welcome email simulation
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid'; // Ensure UUID is imported

interface AuthContextProps {
  user: ContextUser;
  loading: boolean;
  initializationError: string | null;
  login: (email: string, password?: string) => Promise<void>;
  logout: (message?: string) => Promise<void>; // Add optional message for logout reason
  signUp: (
    email: string,
    password?: string,
    displayName?: string,
    phoneNumber?: string | null,
    academicStatus?: UserAcademicStatus | null
  ) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  initializationError: null, // No default error for local storage
  login: async () => { console.warn('Auth not initialized or login function not implemented'); },
  logout: async () => { console.warn('Auth not initialized or logout function not implemented'); },
  signUp: async () => { console.warn('Auth not initialized or signUp function not implemented'); },
  refreshUser: async () => { console.warn('Auth not initialized or refreshUser function not implemented'); },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ContextUser>(null);
  const [loading, setLoading] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false); // Track if component has mounted
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();


  // Set mounted state
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Check local storage for logged-in user on initial load (client-side only)
  // Also verifies if the user's plan has changed since last login
  useEffect(() => {
    if (!isMounted) return; // Only run after mount

    const checkUserSession = async () => {
        setLoading(true);
        console.log("AuthProvider: Checking local session...");
        try {
            const storedUserJson = localStorage.getItem('loggedInUser');
            if (!storedUserJson) {
                console.log("AuthProvider: No user found in local storage.");
                setUser(null);
                setLoading(false);
                return;
            }

            console.log("AuthProvider: Found user in local storage.");
            const storedUser: ContextUser = JSON.parse(storedUserJson);

            if (!storedUser || !storedUser.id || !storedUser.email) {
                 console.warn("AuthProvider: Invalid user data in local storage, clearing.");
                 await logout("Invalid session data. Please log in again."); // Logout with message
                 setLoading(false);
                 return;
            }

            // Fetch the LATEST user profile from the backend (users.json)
             console.log(`AuthProvider: Fetching latest profile for user ID: ${storedUser.id}`);
             const latestProfile = await getUserById(storedUser.id); // getUserById returns Omit<UserProfile, 'password'>

             if (!latestProfile) {
                 console.warn(`AuthProvider: User ID ${storedUser.id} not found in backend data. Logging out.`);
                  await logout("Your account could not be found. Please log in again."); // Logout with message
                  setLoading(false);
                  return;
             }

            // Compare local storage user plan with the latest backend data
             const planChanged = storedUser.model !== latestProfile.model ||
                                storedUser.expiry_date !== latestProfile.expiry_date;

            if (planChanged) {
                 console.warn(`AuthProvider: User plan mismatch detected for ${storedUser.email}. Logging out.`);
                  await logout("Your account plan has been updated. Please log in again."); // Logout with specific message
                  setLoading(false);
                  return;
            }

            // If plan hasn't changed and user exists, set the user state (using latest data)
            console.log(`AuthProvider: Session validated for ${latestProfile.email}.`);
            setUser(mapUserProfileToContextUser(latestProfile)); // Use latest data

        } catch (e: any) {
             console.error("AuthProvider: Error during session check", e);
             setInitializationError(`Failed to verify session: ${e.message}`);
             await logout(); // Logout on error
        } finally {
            setLoading(false);
            console.log("AuthProvider: Session check complete. Loading state:", false);
        }
    };

    checkUserSession();
    // Explicitly disable ESLint rule for exhaustive-deps here,
    // as adding `logout` can cause infinite loops if it triggers state changes that re-run this effect.
    // The logic relies on `isMounted` and the presence of `user` state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted]);


  const mapUserProfileToContextUser = (userProfile: Omit<UserProfile, 'password'> | null): ContextUser => {
      if (!userProfile) return null;
      // Ensure all necessary fields are mapped
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
    if (!user || !user.id) return; // Only refresh if a user is already logged in
    console.log(`AuthProvider: Refreshing user data for ${user.email}`);
    setLoading(true);
    try {
      const updatedProfile = await getUserById(user.id); // Fetch latest data
       if (updatedProfile) {
         const contextUser = mapUserProfileToContextUser(updatedProfile);
         setUser(contextUser);
         localStorage.setItem('loggedInUser', JSON.stringify(updatedProfile)); // Update local storage
         console.log("AuthProvider: User data refreshed successfully.");
       } else {
         // User might have been deleted in the backend
         console.warn("AuthProvider: User not found during refresh. Logging out.");
         await logout("Your account could not be found.");
       }
    } catch (e) {
      console.error("Refresh User: Error fetching updated profile", e);
      toast({ variant: 'destructive', title: 'Sync Error', description: 'Could not refresh user data.' });
      // Decide whether to keep stale data or log out on error. Keeping stale for now.
    } finally {
       setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, toast]); // Add `logout`? Be careful of loops.


  const login = useCallback(async (email: string, password?: string) => {
    if (!isMounted) return;
    if (!password) {
        toast({ variant: 'destructive', title: 'Login Failed', description: 'Password is required.' });
        throw new Error('Password is required.');
    }
    setLoading(true);
    try {
        // Fetch the full user profile including password using internal action
        const allUsers = await readUsersWithPasswordsInternal();
        const foundUser = allUsers.find(u => u.email?.toLowerCase() === email.toLowerCase());

        if (foundUser && foundUser.password === password) { // Compare plain text passwords (INSECURE)
            console.log(`AuthProvider: Login successful for ${email}`);
            const contextUser = mapUserProfileToContextUser(foundUser);
            setUser(contextUser);
            // Store user data (excluding password) in local storage
            if (contextUser) {
                const { password: userPassword, ...userToStore } = foundUser; // Destructure to remove password
                localStorage.setItem('loggedInUser', JSON.stringify(userToStore));
                // Store password separately for simulation (INSECURE - remove in real app)
                if (userPassword) {
                    localStorage.setItem('simulatedPassword', userPassword);
                } else {
                    localStorage.removeItem('simulatedPassword'); // Remove if no password
                }
            }

            // Redirect logic
            const isAdmin = contextUser?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
            const redirectPath = isAdmin ? '/admin' : '/';
             console.log(`AuthProvider: Redirecting to ${redirectPath}`);
            router.push(redirectPath);
            toast({ title: "Login Successful", description: `Welcome back, ${contextUser?.displayName || contextUser?.email}!` });

        } else {
             console.warn(`AuthProvider: Login failed for ${email}. Invalid email or password.`);
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

  const logout = useCallback(async (message?: string) => {
     if (!isMounted) return;
    console.log("AuthProvider: Logging out...");
    setLoading(true); // Indicate loading during logout process
    setUser(null);
    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('simulatedPassword'); // Clear simulated password
    toast({ title: "Logged Out", description: message || "You have been successfully logged out." });
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
        // Check if user already exists locally using the internal function
        const allUsers = await readUsersWithPasswordsInternal();
        const existingUser = allUsers.find(u => u.email?.toLowerCase() === email.toLowerCase());

        if (existingUser) {
             console.warn(`AuthProvider: Signup attempt failed - email ${email} already exists.`);
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
        referral: '' // Ensure referral is initialized
      };

       console.log(`AuthProvider: Attempting to add new user: ${email}`);
      // Save to users.json using the server action
       const saveResult = await addUserToJson(newUserProfile); // Call action to add
       if (!saveResult.success || !saveResult.user) { // Check if user object is returned
         console.error("CRITICAL: Failed to save new user profile to local JSON:", saveResult.message);
         throw new Error(saveResult.message || 'Could not create user profile.');
       }
        console.log(`AuthProvider: User ${email} added successfully.`);

      // Send welcome email simulation
      if (newUserProfile.email) {
          await sendWelcomeEmail(newUserProfile.email);
      }

      // Automatically log in the user after successful signup using the returned user data
       const contextUser = mapUserProfileToContextUser(saveResult.user);
       setUser(contextUser);
        if (contextUser) {
            const { password: savedPassword, ...userToStore } = saveResult.user; // Destructure from returned user
            localStorage.setItem('loggedInUser', JSON.stringify(userToStore));
             if (savedPassword) {
               localStorage.setItem('simulatedPassword', savedPassword);
             }
        }
        console.log(`AuthProvider: User ${email} automatically logged in after signup.`);

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


  // Route protection logic (remains largely the same, but relies on checked local storage)
  useEffect(() => {
    if (loading || !isMounted) return; // Don't run protection until initial check is done

    const isAuthPage = pathname.startsWith('/auth');
    const isAdminRoute = pathname.startsWith('/admin');
    const publicRoutes = ['/', '/help', '/terms', '/privacy', '/tests', '/study-tips', '/doubt-solving', '/progress'];
    const isPublicRoute = publicRoutes.includes(pathname) ||
                          pathname.startsWith('/tests/') || // Test details page
                          pathname.startsWith('/take-test/') || // Test start confirmation
                          pathname.startsWith('/chapterwise-test/') || // Test interface
                          pathname.startsWith('/chapterwise-test-results/') || // Results page
                          pathname.startsWith('/chapterwise-test-review/'); // Review page

    console.log("AuthProvider Route Protection:", { pathname, isAuthPage, isAdminRoute, isPublicRoute, userExists: !!user });

    if (user) { // User is considered logged in (based on verified local state)
      const isAdmin = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

      if (isAuthPage) {
        router.push(isAdmin ? '/admin' : '/'); // Redirect away from auth pages if logged in
      } else if (isAdminRoute && !isAdmin) {
        router.push('/'); // Redirect non-admins from admin routes
        toast({ variant: "destructive", title: "Access Denied", description: "You do not have permission." });
      }
    } else { // User is not logged in
      if (!isAuthPage && !isPublicRoute) {
        console.log(`AuthProvider: Access denied to ${pathname}. Redirecting to login.`);
        const redirectQuery = pathname ? `?redirect=${pathname}` : '';
        router.push(`/auth/login${redirectQuery}`);
      }
    }
  }, [user, loading, pathname, router, isMounted, toast]);


  // --- UI Loading State ---
   // Show skeleton only during the initial loading phase AND if not on an auth page
   // AND if the component is mounted (to prevent SSR flash)
   if (loading && isMounted && !pathname.startsWith('/auth')) {
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
    <AuthContext.Provider value={{ user, loading, initializationError, login, logout, signUp, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
