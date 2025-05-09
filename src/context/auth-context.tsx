// src/context/auth-context.tsx
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { UserProfile, UserModel, AcademicStatus as UserAcademicStatus, ContextUser } from '@/types';
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
// Use local storage actions
import {
    readUsersWithPasswordsInternal, // Use the internal function to get hash
    saveUserToJson,
    readUsers,
    getUserById,
    addUserToJson,
    updateUserInJson, // Already imported
    deleteUserFromJson, // Already imported
    updateUserPasswordInJson, // Already imported
    updateUserRole, // Ensure updateUserRole is imported
    findUserByEmailInternal,
} from '@/actions/user-actions';
// Removed direct findUserByEmail import from auth-actions
// import { findUserByEmail as findUserByEmailFromAuth } from '@/actions/auth-actions';
import { sendWelcomeEmail } from '@/actions/otp-actions'; // For welcome email simulation
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

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
    targetYear?: string | null
  ) => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUserData: (updatedUser: Omit<UserProfile, 'password'>) => void;
  setUser: React.Dispatch<React.SetStateAction<ContextUser>>; // Expose setUser for external auth providers
  setLoading: React.Dispatch<React.SetStateAction<boolean>>; // Expose setLoading
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
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ContextUser>(null);
  const [loading, setLoading] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(null);
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
    router.push('/auth/login');
    setLoading(false);
  }, [router, toast, isMounted]);


  useEffect(() => {
    if (!isMounted) return;

    const checkUserSession = async () => {
        setLoading(true);
        console.log("AuthProvider: Checking local session...");
        try {
            // Initialize users.json if needed - this ensures the file and admin user exist
            await readUsersWithPasswordsInternal(); // This will also handle initial admin creation/validation
            console.log("AuthProvider: users.json initialized/validated.");

            const storedUserJson = localStorage.getItem('loggedInUser');
            if (!storedUserJson) {
                console.log("AuthProvider: No user found in local storage.");
                setUser(null);
                setLoading(false);
                return;
            }

            console.log("AuthProvider: User found in local storage, validating...");
            const storedUser: Omit<UserProfile, 'password'> = JSON.parse(storedUserJson);

            if (!storedUser || !storedUser.id || !storedUser.email) {
                 console.warn("AuthProvider: Invalid user data in local storage.");
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
            console.log("AuthProvider: Latest profile fetched:", latestProfile.email, "Role:", latestProfile.role, "Model:", latestProfile.model);


            // Compare critical fields that might force a re-login if changed by an admin
            const profileChangedCritically = storedUser.model !== latestProfile.model ||
                                   storedUser.role !== latestProfile.role ||
                                   // Expiry date comparison needs care if one is null
                                   (storedUser.expiry_date || null) !== (latestProfile.expiry_date || null);


            if (profileChangedCritically) {
                  console.warn("AuthProvider: Critical profile data (role, model, expiry) changed. Forcing re-login.");
                  await logoutCallback("Your account details have been updated. Please log in again for changes to take effect.");
                  setLoading(false);
                  return;
            }

            // If only non-critical data like name or avatar changed, update context without forcing logout
             const updatedContextUser = mapUserProfileToContextUser(latestProfile);
             setUser(updatedContextUser);
             localStorage.setItem('loggedInUser', JSON.stringify(latestProfile)); // Update local storage with latest non-critical info
             console.log(`AuthProvider: Session loaded and validated for ${latestProfile.email}.`);

        } catch (e: any) {
             console.error("AuthProvider: Error during session check:", e);
             setInitializationError(`Failed to verify session: ${e.message}. Ensure users.json is accessible and valid.`);
             await logoutCallback(); // Logout on error
        } finally {
            setLoading(false);
            console.log("AuthProvider: Session check complete.");
        }
    };
    checkUserSession();
  }, [isMounted, mapUserProfileToContextUser, logoutCallback]); // logoutCallback is now a dependency


  const refreshUser = useCallback(async () => {
    if (!user || !user.id) return;
    setLoading(true);
    try {
      const updatedProfile = await getUserById(user.id);
       if (updatedProfile) {
         const contextUser = mapUserProfileToContextUser(updatedProfile);
         setUser(contextUser);
         localStorage.setItem('loggedInUser', JSON.stringify(updatedProfile));
       } else {
         await logoutCallback("Your account could not be found.");
       }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Sync Error', description: 'Could not refresh user data.' });
    } finally {
       setLoading(false);
    }
  }, [user, toast, mapUserProfileToContextUser, logoutCallback]); // Use logoutCallback here


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
    console.log(`AuthProvider: Attempting login for ${email}`);
    try {
        const users = await readUsersWithPasswordsInternal(); // Reads the whole users.json
        const foundUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

        if (foundUser && foundUser.password) {
             const passwordMatch = await bcrypt.compare(password, foundUser.password);
             if (passwordMatch) {
                const { password: _removedPassword, ...userToStore } = foundUser;
                const contextUser = mapUserProfileToContextUser(userToStore);
                setUser(contextUser);
                localStorage.setItem('loggedInUser', JSON.stringify(userToStore));

                const isAdmin = contextUser?.role === 'Admin';
                const redirectPath = isAdmin ? '/admin' : '/';
                console.log(`AuthProvider: Login successful for ${email}. Redirecting to ${redirectPath}.`);
                router.push(redirectPath);
                toast({ title: "Login Successful", description: `Welcome back, ${contextUser?.name || contextUser?.email}!` });
             } else {
                 console.warn(`AuthProvider: Password mismatch for ${email}.`);
                 throw new Error('Login failed: Invalid email or password.');
             }
        } else {
            console.warn(`AuthProvider: User ${email} not found or password not set.`);
            throw new Error('Login failed: Invalid email or password.');
        }
    } catch (error: any) {
      console.error("Login failed in AuthProvider:", error);
      toast({ variant: 'destructive', title: 'Login Failed', description: error.message });
      throw error; // Re-throw for the component to handle if needed
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
    targetYear?: string | null
  ) => {
     if (!isMounted) return;
    if (!password) {
        toast({ variant: 'destructive', title: 'Signup Failed', description: 'Password is required.' });
        throw new Error('Password is required.');
    }
    setLoading(true);
    try {
      const users = await readUsersWithPasswordsInternal();
      const existingUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (existingUser) {
        throw new Error('Signup failed: Email already exists.');
      }
      const newUserProfileData: Omit<UserProfile, 'id' | 'createdAt' | 'avatarUrl' | 'referral' | 'totalPoints' | 'telegramId' | 'telegramUsername'> & { password: string } = {
        email: email,
        password: password,
        name: displayName || null,
        phone: phoneNumber || null,
        class: academicStatus || null,
        model: 'free', // Default to free, admin can change later
        role: 'User', // Default new signups to User
        expiry_date: null,
        targetYear: targetYear || null,
      };
       const saveResult = await addUserToJson(newUserProfileData);

       if (!saveResult.success || !saveResult.user) {
         throw new Error(saveResult.message || 'Could not create user profile.');
       }

      // Send welcome email (simulation)
      if (saveResult.user.email) { // Check if email exists before sending
          await sendWelcomeEmail(saveResult.user.email, saveResult.user.name);
      }

       const contextUser = mapUserProfileToContextUser(saveResult.user);
       setUser(contextUser);
        if (contextUser) { // Check if contextUser is not null
            localStorage.setItem('loggedInUser', JSON.stringify(saveResult.user));
        }

      toast({ title: "Account Created!", description: `Welcome to EduNexus! You are now logged in.` });
      router.push('/');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Sign Up Failed', description: error.message });
      throw error; // Re-throw for component to handle if needed
    } finally {
      setLoading(false);
    }
  }, [router, toast, isMounted, mapUserProfileToContextUser]);


  useEffect(() => {
    if (loading || !isMounted) return; // Don't run navigation logic until auth state is resolved and component is mounted

    const isAuthPage = pathname.startsWith('/auth');
    const isAdminRoute = pathname.startsWith('/admin');
    const publicRoutes = [
        '/', '/help', '/terms', '/privacy', '/tests', '/dpp', '/pyq-dpps',
        '/chapterwise-test', '/chapterwise-test-results', '/chapterwise-test-review',
        '/challenge-test', '/challenge-test-result', '/challenge-test-review'
    ]; // Added test interface related routes as public for now

     const isPublicRoute = publicRoutes.some(route => {
         if (pathname.startsWith(route + '/') && route !== '/') return true; // Handles dynamic segments like /tests/[id]
         return pathname === route;
     });

    if (user) {
      const isAdmin = user.role === 'Admin';
      if (isAuthPage) {
        router.push(isAdmin ? '/admin' : '/');
      } else if (isAdminRoute && !isAdmin) {
        toast({ variant: "destructive", title: "Access Denied", description: "You do not have permission to access the admin panel." });
        router.push('/');
      }
    } else { // No user logged in
      if (!isAuthPage && !isPublicRoute) {
        console.log(`AuthProvider: No user, not auth/public page. Current path: ${pathname}. Redirecting to login.`);
        const redirectQuery = pathname ? `?redirect=${encodeURIComponent(pathname)}` : '';
        router.push(`/auth/login${redirectQuery}`);
      }
    }
  }, [user, loading, pathname, router, isMounted, toast]);

  const updateUserData = (updatedUser: Omit<UserProfile, 'password'>) => {
    if (user && user.id === updatedUser.id) {
        const contextUser = mapUserProfileToContextUser(updatedUser);
        setUser(contextUser);
        localStorage.setItem('loggedInUser', JSON.stringify(updatedUser));
    }
  }

   if (loading && isMounted && !pathname.startsWith('/auth') && !user) {
     return (
       <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="space-y-4 w-full max-w-md p-4">
           <Skeleton className="h-10 w-3/4 mx-auto" />
           <Skeleton className="h-6 w-1/2 mx-auto" />
           <Skeleton className="h-40 w-full" />
         </div>
       </div>
     );
   }

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
    <AuthContext.Provider value={{ user, loading, initializationError, login, logout: logoutCallback, signUp, refreshUser, updateUserData, setUser, setLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
