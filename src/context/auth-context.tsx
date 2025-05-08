// src/context/auth-context.tsx
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { UserProfile, UserModel, AcademicStatus as UserAcademicStatus, ContextUser } from '@/types';
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
// Use local storage actions
import {
    findUserByEmailInternal, // Use this internal function to get hash for login
    saveUserToJson,
    readUsers,
    getUserById,
    addUserToJson,
    updateUserInJson,
    deleteUserFromJson,
    updateUserPasswordInJson,
    updateUserRole, // Ensure updateUserRole is imported
} from '@/actions/user-actions';
import { sendWelcomeEmail } from '@/actions/otp-actions'; // For welcome email simulation
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs'; // Ensure bcryptjs is imported

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
  // Add updateUserData function
  updateUserData: (updatedUser: Omit<UserProfile, 'password'>) => void;
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  initializationError: null, // No default error for local storage
  login: async () => { console.warn('Auth not initialized or login function not implemented'); },
  logout: async () => { console.warn('Auth not initialized or logout function not implemented'); },
  signUp: async () => { console.warn('Auth not initialized or signUp function not implemented'); },
  refreshUser: async () => { console.warn('Auth not initialized or refreshUser function not implemented'); },
  updateUserData: () => { console.warn('Auth not initialized or updateUserData function not implemented'); },
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
  // Also verifies if the user's plan/role has changed since last login
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
            // Parse user data *without* password from local storage
             const storedUser: Omit<UserProfile, 'password'> = JSON.parse(storedUserJson);


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

            // Compare local storage user plan/role with the latest backend data
             const profileChanged = storedUser.model !== latestProfile.model ||
                                   storedUser.expiry_date !== latestProfile.expiry_date ||
                                   storedUser.role !== latestProfile.role; // Check role change

            if (profileChanged) {
                 console.warn(`AuthProvider: User plan or role mismatch detected for ${storedUser.email}. Logging out.`);
                  await logout("Your account details have been updated. Please log in again."); // Logout with specific message
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
      // Ensure all necessary fields are mapped, including the role
      return {
          id: userProfile.id,
          email: userProfile.email,
          name: userProfile.name,
          phone: userProfile.phone,
          avatarUrl: userProfile.avatarUrl, // Map avatarUrl
          class: userProfile.class,
          model: userProfile.model,
          role: userProfile.role, // Map the role
          expiry_date: userProfile.expiry_date,
          createdAt: userProfile.createdAt, // Keep createdAt if needed
      };
  }


  const refreshUser = useCallback(async () => {
    if (!user || !user.id) return; // Only refresh if a user is already logged in
    console.log(`AuthProvider: Refreshing user data for ${user.email}`);
    setLoading(true);
    try {
      const updatedProfile = await getUserById(user.id); // Fetch latest data (without password)
       if (updatedProfile) {
         const contextUser = mapUserProfileToContextUser(updatedProfile);
         setUser(contextUser);
         // Update local storage with the refreshed profile (without password)
         localStorage.setItem('loggedInUser', JSON.stringify(updatedProfile));
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
        // Use the correct action to find user by email including password hash
        const foundUser = await findUserByEmailInternal(email);

        if (foundUser && foundUser.password) {
            // Compare the provided password with the stored hash
             const passwordMatch = await bcrypt.compare(password, foundUser.password);

             if (passwordMatch) {
                console.log(`AuthProvider: Login successful for ${email}`);
                const { password: _, ...userWithoutPassword } = foundUser; // Destructure to remove password hash
                const contextUser = mapUserProfileToContextUser(userWithoutPassword);
                setUser(contextUser);
                // Store user data (excluding password) in local storage
                if (contextUser) {
                    localStorage.setItem('loggedInUser', JSON.stringify(userWithoutPassword));
                }

                // Redirect logic
                const isAdmin = contextUser?.role === 'Admin'; // Check the role field
                const redirectPath = isAdmin ? '/admin' : '/';
                 console.log(`AuthProvider: Redirecting to ${redirectPath}`);
                router.push(redirectPath);
                toast({ title: "Login Successful", description: `Welcome back, ${contextUser?.name || contextUser?.email}!` });
             } else {
                // Password mismatch
                 console.warn(`AuthProvider: Login failed for ${email}. Invalid password.`);
                 throw new Error('Login failed: Invalid email or password.');
             }
        } else {
            // User not found or has no password hash stored
             console.warn(`AuthProvider: Login failed for ${email}. User not found or password not set.`);
            throw new Error('Login failed: Invalid email or password.');
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
    toast({ title: "Logged Out", description: message || "You have been successfully logged out." });
    router.push('/auth/login');
    setLoading(false);
  }, [router, toast, isMounted]);

  // Adjusted signUp function for local storage with hashed passwords
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
        const existingUser = await findUserByEmailInternal(email); // Use internal fetch

        if (existingUser) {
             console.warn(`AuthProvider: Signup attempt failed - email ${email} already exists.`);
            throw new Error('Signup failed: Email already exists.');
        }


      // Create UserProfile for local JSON storage
      // Pass plain text password to addUserToJson, it will handle hashing
      const newUserProfileData: Omit<UserProfile, 'id' | 'createdAt' | 'avatarUrl' | 'referral'> & { password: string } = { // Adjust type
        email: email,
        password: password, // Pass plain text
        name: displayName || null,
        phone: phoneNumber || null,
        class: academicStatus || null,
        model: 'free', // Default to 'free'
        role: 'User', // Default to 'User' role
        expiry_date: null, // Free model has no expiry
      };


       console.log(`AuthProvider: Attempting to add new user: ${email}`);
      // Save to users.json using the server action (which now handles hashing)
       const saveResult = await addUserToJson(newUserProfileData);
       if (!saveResult.success || !saveResult.user) { // Check if user object is returned
         console.error("CRITICAL: Failed to save new user profile to local JSON:", saveResult.message);
         throw new Error(saveResult.message || 'Could not create user profile.');
       }
        console.log(`AuthProvider: User ${email} added successfully.`);

      // Send welcome email simulation
      if (saveResult.user.email) {
          await sendWelcomeEmail(saveResult.user.email);
      }

      // Automatically log in the user after successful signup using the returned user data
       const contextUser = mapUserProfileToContextUser(saveResult.user); // Map the returned user (without password)
       setUser(contextUser);
        if (contextUser) {
            localStorage.setItem('loggedInUser', JSON.stringify(saveResult.user)); // Store user without password
        }
        console.log(`AuthProvider: User ${email} automatically logged in after signup.`);

      toast({ title: "Account Created!", description: `Welcome to EduNexus! You are now logged in.` }); // Updated brand name
      router.push('/'); // Redirect to dashboard after signup

    } catch (error: any) {
      console.error("Local signup failed:", error);
      toast({ variant: 'destructive', title: 'Sign Up Failed', description: error.message });
      throw error; // Re-throw for signup page to handle
    } finally {
      setLoading(false);
    }
  }, [router, toast, isMounted]);


  // Route protection logic
  useEffect(() => {
    if (loading || !isMounted) return; // Don't run protection until initial check is done

    const isAuthPage = pathname.startsWith('/auth');
    const isAdminRoute = pathname.startsWith('/admin');
    // Define public routes explicitly
     const publicRoutes = [
        '/',
        '/help',
        '/terms',
        '/privacy',
        '/tests', // Allow browsing tests
        '/dpp', // Allow browsing DPP list
     ];
    // Check if the current path matches any public route or specific pattern
     const isPublicRoute = publicRoutes.some(route => {
         if (route.includes('[')) { // Basic check for dynamic route patterns
             const staticPart = route.split('[')[0];
             return pathname.startsWith(staticPart) && pathname !== staticPart; // Match sub-paths but not the index
         }
         // Handle dynamic routes that should be public (like viewing a specific test)
         if (pathname.startsWith('/tests/') && pathname.split('/').length === 3 && route === '/tests') return true;
         if (pathname.startsWith('/dpp/') && pathname.split('/').length > 2 && route === '/dpp') return true; // Allow /dpp/subject/lesson
         return pathname === route;
     });

    console.log("AuthProvider Route Protection:", { pathname, isAuthPage, isAdminRoute, isPublicRoute, userExists: !!user, userRole: user?.role });

    if (user) { // User is considered logged in (based on verified local state)
      const isAdmin = user.role === 'Admin'; // Check the role from the user state

      if (isAuthPage) {
        router.push(isAdmin ? '/admin' : '/'); // Redirect away from auth pages if logged in
      } else if (isAdminRoute && !isAdmin) {
        router.push('/'); // Redirect non-admins from admin routes
        toast({ variant: "destructive", title: "Access Denied", description: "You do not have permission to access the admin panel." });
      }
    } else { // User is not logged in
      if (!isAuthPage && !isPublicRoute) {
        console.log(`AuthProvider: Access denied to ${pathname}. Redirecting to login.`);
        const redirectQuery = pathname ? `?redirect=${pathname}` : '';
        router.push(`/auth/login${redirectQuery}`);
      }
    }
  }, [user, loading, pathname, router, isMounted, toast]);


  // Function to update user context state locally (e.g., after profile update)
  const updateUserData = (updatedUser: Omit<UserProfile, 'password'>) => {
    if (user && user.id === updatedUser.id) {
        console.log("AuthProvider: Updating local user context state...");
        const contextUser = mapUserProfileToContextUser(updatedUser);
        setUser(contextUser);
         // Also update local storage
        localStorage.setItem('loggedInUser', JSON.stringify(updatedUser));
    }
  }


  // --- UI Loading State ---
   // Show skeleton only during the initial loading phase AND if not on an auth page
   // AND if the component is mounted (to prevent SSR flash)
   if (loading && isMounted && !pathname.startsWith('/auth') && !user) { // Add !user check
     return (
       <div className="flex items-center justify-center min-h-screen bg-background">
         {/* Use Loader2 for a cleaner loading indicator */}
          <div className="space-y-4 w-full max-w-md p-4">
           {/* Simplified Skeleton */}
           <Skeleton className="h-10 w-3/4 mx-auto" />
           <Skeleton className="h-6 w-1/2 mx-auto" />
           <Skeleton className="h-40 w-full" />
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
    <AuthContext.Provider value={{ user, loading, initializationError, login, logout, signUp, refreshUser, updateUserData }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
