// src/context/auth-context.tsx
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { UserProfile, UserModel, AcademicStatus as UserAcademicStatus, ContextUser } from '@/types';
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
// Use local storage actions
import {
    internalReadUsersWithPasswords, // Use the internal function to get hash
    saveUserToJson, // General purpose save/update, ensures hashing
    readUsers,      // For general listing (no passwords)
    getUserById,    // To fetch a single user's profile (no password)
    addUserToJson,  // Specific for adding new users, handles hashing
    updateUserInJson, // For updating existing user profiles (excluding password)
    deleteUserFromJson,
    updateUserPasswordInJson,
    updateUserRole, // Ensure updateUserRole is imported
    findUserByEmailInternal, // Use this for login check (gets password hash)
    findUserByReferralCode,
    findUserByTelegramIdInternal,
} from '@/actions/user-actions';

import { sendWelcomeEmail } from '@/actions/otp-actions'; // For welcome email simulation
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from 'lucide-react';
import bcrypt from 'bcryptjs';
import { Button } from '@/components/ui/button';


interface AuthContextProps {
  user: ContextUser;
  loading: boolean;
  initializationError: string | null;
  login: (email: string, password?: string) => Promise<void>;
  logout: (message?: string, redirectPath?: string) => Promise<void>;
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
  updateUserData: (updatedUser: Omit<UserProfile, 'password'>) => void; // For profile page updates
  setUser: React.Dispatch<React.SetStateAction<ContextUser>>; // Exposed for Telegram login
  setLoading: React.Dispatch<React.SetStateAction<boolean>>; // Exposed for Telegram login
  mapUserProfileToContextUser: (userProfile: Omit<UserProfile, 'password'> | null) => ContextUser; // Exposed for Telegram login
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
          totalPoints: userProfile.totalPoints,
          referralCode: userProfile.referralCode,
          referralStats: userProfile.referralStats,
      };
  }, []);

  const logoutCallback = useCallback(async (message?: string, redirectPath: string = '/auth/login') => {
    if (!isMounted) return;
    setLoading(true); // Indicate loading during logout process

    setUser(null);
    // Do not reset initializationError here, as it might be a persistent issue.
    // setInitializationError(null); 
    if (typeof window !== 'undefined') {
      localStorage.removeItem('loggedInUser');
    }
    if (message) {
        toast({ title: "Logged Out", description: message, duration: 5000 });
    } else {
        toast({ title: "Logged Out", description: "You have been successfully logged out." });
    }
    router.push(redirectPath); // Redirect happens after state updates and toast
    setLoading(false); // Reset loading state
  }, [router, toast, isMounted, setLoading, setUser]); // Ensure all deps are listed


  useEffect(() => {
    if (!isMounted) return;

    const checkUserSession = async () => {
        setLoading(true);
        setInitializationError(null); // Reset error at the start of each check
        console.log("AuthProvider: Starting session check...");
        try {
            console.log("AuthProvider: Attempting to initialize user data store (call internalReadUsersWithPasswords)...");
            await internalReadUsersWithPasswords(); // This function can throw if critical dir creation fails
            console.log("AuthProvider: User data store initialized/validated successfully.");

            let storedUserJson: string | null = null;
            if (typeof window !== 'undefined') {
              storedUserJson = localStorage.getItem('loggedInUser');
            }
            
            if (!storedUserJson) {
                console.log("AuthProvider: No user session found in localStorage.");
                setUser(null);
                setLoading(false);
                return;
            }
            console.log("AuthProvider: User session found in localStorage.");

            let storedUser: Omit<UserProfile, 'password'>;
            try {
              storedUser = JSON.parse(storedUserJson);
            } catch (parseError) {
              console.error("AuthProvider: Failed to parse stored user JSON. Logging out.", parseError);
              await logoutCallback("Session data corrupted. Please log in again.");
              return; // Exit after logout
            }

            if (!storedUser || !storedUser.id || !storedUser.email) {
                 console.warn("AuthProvider: Stored user data is invalid. Logging out.");
                 await logoutCallback("Invalid session data. Please log in again.");
                 return; // Exit after logout
            }
            
            console.log(`AuthProvider: Fetching latest profile for user ID: ${storedUser.id}`);
            const latestProfile = await getUserById(storedUser.id); // Returns Omit<UserProfile, 'password'> or null

            if (!latestProfile) {
                  console.warn(`AuthProvider: User ID ${storedUser.id} not found in backend. Logging out.`);
                  await logoutCallback("Your account could not be found. Please log in again.");
                  return; // Exit after logout
            }
            console.log("AuthProvider: Latest profile fetched:", latestProfile.email, "Role:", latestProfile.role, "Model:", latestProfile.model);

            // Compare relevant fields that, if changed, might require re-login or session refresh logic
            const profileChangedCritically =
                storedUser.model !== latestProfile.model ||
                storedUser.role !== latestProfile.role ||
                (storedUser.expiry_date || null) !== (latestProfile.expiry_date || null);

            if (profileChangedCritically) {
                  console.warn("AuthProvider: Critical profile change detected (model, role, or expiry). Forcing re-login.");
                  await logoutCallback("Your account details have been updated. Please log in again for changes to take effect.");
                  return; // Exit after logout
            }

            const updatedContextUser = mapUserProfileToContextUser(latestProfile);
            setUser(updatedContextUser);
            if (typeof window !== 'undefined') {
                localStorage.setItem('loggedInUser', JSON.stringify(latestProfile)); // Store the latest fetched profile
            }
            console.log("AuthProvider: Session validated and user set.", updatedContextUser?.email);

        } catch (e: any) { // This catch is for errors from internalReadUsersWithPasswords or other async ops
             console.error("AuthProvider: Critical error during user data store initialization or session check:", e);
             setInitializationError(`Authentication system failed to initialize: ${e.message}. Please check server logs or contact support.`);
        } finally {
            setLoading(false);
            console.log("AuthProvider: Session check complete. Loading set to false.");
        }
    };
    
    // Run session check if component is mounted.
    // The rendering logic will handle `initializationError` display.
    checkUserSession();

  }, [isMounted, logoutCallback, mapUserProfileToContextUser, setInitializationError]);


  const refreshUser = useCallback(async () => {
    if (!user || !user.id || !isMounted) return;
    // If there's a persistent initialization error, refreshing might not be meaningful
    if (initializationError) {
        toast({ variant: 'destructive', title: 'System Error', description: 'Cannot refresh user data due to an initialization error. Please try reloading the page.' });
        return;
    }

    setLoading(true);
    try {
      const updatedProfile = await getUserById(user.id);
       if (updatedProfile) {
         const contextUser = mapUserProfileToContextUser(updatedProfile);
         setUser(contextUser);
         if (typeof window !== 'undefined') {
            localStorage.setItem('loggedInUser', JSON.stringify(updatedProfile));
         }
         toast({ title: 'Profile Synced', description: 'Your profile data has been refreshed.' });
       } else {
         // User not found in backend, critical issue, force logout
         await logoutCallback("Your account could not be found. You have been logged out.");
       }
    } catch (e: any) {
      console.error("RefreshUser failed:", e);
      toast({ variant: 'destructive', title: 'Sync Error', description: 'Could not refresh user data.' });
    } finally {
       setLoading(false);
    }
  }, [user, toast, isMounted, mapUserProfileToContextUser, logoutCallback, initializationError, setLoading, setUser]);


 const login = useCallback(async (email: string, passwordInput?: string) => {
    if (!isMounted) {
        console.warn("Login attempt before component mount.");
        throw new Error("Component not mounted.");
    }
    if (initializationError) { // Check for persistent initialization error
        toast({ variant: 'destructive', title: 'System Error', description: initializationError, duration: 7000 });
        throw new Error(initializationError);
    }
    if (!passwordInput) {
        toast({ variant: 'destructive', title: 'Login Failed', description: 'Password is required.' });
        throw new Error('Password is required.');
    }

    setLoading(true);
    try {
        const foundUserWithHash = await findUserByEmailInternal(email); // This now correctly gets the user with hashed password

        if (foundUserWithHash && foundUserWithHash.password) {
             const passwordMatch = await bcrypt.compare(passwordInput, foundUserWithHash.password);
             if (passwordMatch) {
                const { password, ...userToStore } = foundUserWithHash; // Exclude password hash from storing in context/localStorage
                const contextUser = mapUserProfileToContextUser(userToStore);
                setUser(contextUser);
                if (typeof window !== 'undefined') {
                    localStorage.setItem('loggedInUser', JSON.stringify(userToStore)); // Store profile without password
                }

                const isAdmin = contextUser?.role === 'Admin';
                const redirectPath = isAdmin ? '/admin' : '/';
                toast({ title: "Login Successful", description: `Welcome back, ${contextUser?.name || contextUser?.email}!` });
                setLoading(false); // Set loading to false before router.push
                router.push(redirectPath); // Redirect after successful login
                return; 
             } else {
                 console.warn(`AuthProvider: Password mismatch for ${email}.`);
                 throw new Error('Login failed: Invalid email or password.');
             }
        } else {
            console.warn(`AuthProvider: User not found or password not set for ${email}.`);
            throw new Error('Login failed: Invalid email or password.');
        }
    } catch (error: any) {
      console.error("Login failed:", error);
      toast({ variant: 'destructive', title: 'Login Failed', description: error.message });
      setLoading(false);
      throw error; // Re-throw for the login page to catch if needed
    }
  }, [router, toast, isMounted, mapUserProfileToContextUser, initializationError, setLoading, setUser]); // Added setLoading, setUser


  const signUp = useCallback(async (
    email: string,
    password?: string,
    displayName?: string,
    phoneNumber?: string | null,
    academicStatus?: UserAcademicStatus | null,
    targetYear?: string | null,
    referralCodeUsed?: string | null
  ) => {
     if (!isMounted) {
       console.warn("Signup attempt before component mount.");
       throw new Error("Component not mounted.");
     }
    if (initializationError) { // Check for persistent initialization error
        toast({ variant: 'destructive', title: 'System Error', description: `Signup failed: ${initializationError}`, duration: 7000 });
        throw new Error(initializationError);
    }
    if (!password) {
        toast({ variant: 'destructive', title: 'Signup Failed', description: 'Password is required.' });
        throw new Error('Password is required.');
    }
    setLoading(true);
    try {
      // Structure matches what addUserToJson expects (it will hash the password)
      const newUserProfileData: Omit<UserProfile, 'id' | 'createdAt' | 'avatarUrl' | 'referralCode' | 'referralStats' | 'totalPoints' | 'telegramId' | 'telegramUsername'> & { password: string; referredByCode?: string | null } = {
        email: email,
        password: password, // Send plain password, addUserToJson will hash it
        name: displayName || null,
        phone: phoneNumber || null,
        class: academicStatus || null,
        model: 'free', // Default model
        role: 'User',  // Default role
        expiry_date: null, // For free model
        targetYear: targetYear || null,
        referredByCode: referralCodeUsed || null,
      };

       const saveResult = await addUserToJson(newUserProfileData);

       if (!saveResult.success || !saveResult.user) {
         // saveResult.user will be Omit<UserProfile, 'password'>
         throw new Error(saveResult.message || 'Could not create user profile.');
       }
       
       // Send welcome email
       if (saveResult.user.email) { // Ensure email exists before sending
          await sendWelcomeEmail(saveResult.user.email, saveResult.user.name);
      }

       // Set user in context and localStorage
       const contextUser = mapUserProfileToContextUser(saveResult.user);
       setUser(contextUser);
        if (contextUser && typeof window !== 'undefined') { // Check contextUser before stringifying
            localStorage.setItem('loggedInUser', JSON.stringify(saveResult.user)); // Store profile from addUserToJson
        }

      toast({ title: "Account Created!", description: `Welcome to EduNexus! You are now logged in.` });
      setLoading(false); // Set loading false before redirect
      router.push('/'); // Redirect to dashboard after successful signup
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Sign Up Failed', description: error.message });
      setLoading(false);
      throw error; // Re-throw for the signup page to catch
    }
  }, [router, toast, isMounted, mapUserProfileToContextUser, initializationError, setLoading, setUser]); // Added setLoading, setUser


  useEffect(() => {
    if (!isMounted || loading || initializationError) return;


    const isAuthPage = pathname.startsWith('/auth');
    const isAdminRoute = pathname.startsWith('/admin');
    // Simplified public route check, adjust as needed
    const publicExactRoutes = ['/', '/help', '/terms', '/privacy', '/packages', '/referrals']; 
    const publicPrefixRoutes = ['/tests', '/dpp', '/pyq-dpps', '/take-test', '/chapterwise-test', '/chapterwise-test-results', '/chapterwise-test-review', '/challenge-test', '/challenge-test-result', '/challenge-test-review', '/challenge', '/find-friends', '/friends-followers', '/friends-following', '/friends-compare', '/leaderboard', '/profile', '/notebooks'];
    const isTestInterfaceRoute = pathname.startsWith('/test-interface') || pathname.startsWith('/chapterwise-test') || pathname.startsWith('/challenge-test');

    const isPublicRoute = publicExactRoutes.includes(pathname) ||
                          publicPrefixRoutes.some(route => pathname.startsWith(route + '/') || pathname === route) ||
                          isTestInterfaceRoute;


    if (user) {
      const isAdmin = user.role === 'Admin';
      if (isAuthPage) {
        console.log("AuthProvider: User is logged in and on auth page, redirecting...", isAdmin ? '/admin' : '/');
        router.push(isAdmin ? '/admin' : '/');
      } else if (isAdminRoute && !isAdmin) {
        console.log("AuthProvider: User is not admin but on admin route, redirecting to /");
        toast({ variant: "destructive", title: "Access Denied", description: "You do not have permission to access the admin panel." });
        router.push('/');
      }
    } else { // No user
      if (!isAuthPage && !isPublicRoute) {
        console.log("AuthProvider: User not logged in and not on public/auth page, redirecting to login. Current pathname:", pathname);
        const redirectQuery = pathname && pathname !== '/' ? `?redirect=${encodeURIComponent(pathname)}` : '';
        router.push(`/auth/login${redirectQuery}`);
      }
    }
  }, [user, loading, pathname, router, isMounted, toast, initializationError]);

  const updateUserData = (updatedUser: Omit<UserProfile, 'password'>) => {
    if (user && user.id === updatedUser.id && isMounted) {
        // User is an Omit<UserProfile, 'password'> so it's safe for context
        const contextUser = mapUserProfileToContextUser(updatedUser);
        setUser(contextUser);
        if (typeof window !== 'undefined') {
            localStorage.setItem('loggedInUser', JSON.stringify(updatedUser)); // updatedUser is already Omit<UserProfile, 'password'>
        }
    }
  };

   // Render loading state or error state if initialization is problematic
   if (!isMounted || (loading && !pathname.startsWith('/auth'))) { // Show general loading for non-auth pages if still loading
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="space-y-4 w-full max-w-md p-4 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading EduNexus...</p>
        </div>
      </div>
    );
   }

   // If there's an initializationError and we are NOT on an auth page, show a blocking error UI.
   // Auth pages will handle displaying the `initializationError` via their own checks.
   if (initializationError && !pathname.startsWith('/auth')) {
     return (
       <div className="flex flex-col items-center justify-center min-h-screen bg-destructive/10 text-destructive-foreground p-6">
         <Alert variant="destructive" className="max-w-lg">
           <AlertTriangle className="h-5 w-5" />
           <AlertTitle className="font-semibold">Application Initialization Error</AlertTitle>
           <AlertDescription className="text-sm">
             {initializationError}
             <p className="mt-2 text-xs">Please ensure required setup is complete. Clearing browser data or restarting the server might help. If the issue persists, contact support.</p>
            </AlertDescription>
         </Alert>
         <Button onClick={() => {
             if(typeof window !== 'undefined') localStorage.removeItem('loggedInUser');
             window.location.href = '/auth/login'; // Force reload to login
         }} className="mt-6">Go to Login</Button>
       </div>
     );
   }
   // Otherwise (no error, or error on auth page which handles it), render children

  return (
    <AuthContext.Provider value={{ user, loading, initializationError, login, logout: logoutCallback, signUp, refreshUser, updateUserData, setUser, setLoading, mapUserProfileToContextUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
