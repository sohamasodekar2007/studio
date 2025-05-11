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
    saveUserToJson, 
    readUsers,
    getUserById,
    addUserToJson, 
    updateUserInJson, 
    deleteUserFromJson, 
    updateUserPasswordInJson, 
    updateUserRole, 
    findUserByEmailInternal, 
    findUserByReferralCode,
    findUserByTelegramIdInternal,
} from '@/actions/user-actions'; 

import { sendWelcomeEmail } from '@/actions/otp-actions'; // For welcome email simulation
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from 'lucide-react';
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
    targetYear?: string | null,
    referralCodeUsed?: string | null
  ) => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUserData: (updatedUser: Omit<UserProfile, 'password'>) => void; // To update context user from other parts of app
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
      // Ensure all fields expected by ContextUser are present
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
    setLoading(true);
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('loggedInUser');
    }
    if (message) {
        toast({ title: "Logged Out", description: message, duration: 5000 });
    } else {
        toast({ title: "Logged Out", description: "You have been successfully logged out." });
    }
    router.push(redirectPath);
    setLoading(false);
  }, [router, toast, isMounted]);


  useEffect(() => {
    if (!isMounted) return;

    const checkUserSession = async () => {
        setLoading(true);
        setInitializationError(null);
        console.log("AuthProvider: Starting session check...");
        try {
            // Ensure users.json is initialized/validated first by attempting a read.
            // This helps catch critical file system issues early.
            console.log("AuthProvider: Attempting to initialize user data store...");
            await readUsersWithPasswordsInternal(); 
            console.log("AuthProvider: User data store initialized/validated.");

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
              setLoading(false);
              return;
            }


            if (!storedUser || !storedUser.id || !storedUser.email) {
                 console.warn("AuthProvider: Stored user data is invalid. Logging out.");
                 await logoutCallback("Invalid session data. Please log in again.");
                 setLoading(false);
                 return;
            }
            
            console.log(`AuthProvider: Fetching latest profile for user ID: ${storedUser.id}`);
             const latestProfile = await getUserById(storedUser.id); 

             if (!latestProfile) {
                  console.warn(`AuthProvider: User ID ${storedUser.id} not found in backend. Logging out.`);
                  await logoutCallback("Your account could not be found. Please log in again.");
                  setLoading(false);
                  return;
             }
             console.log("AuthProvider: Latest profile fetched:", latestProfile.email, "Role:", latestProfile.role, "Model:", latestProfile.model);

            const profileChangedCritically = 
                storedUser.model !== latestProfile.model ||
                storedUser.role !== latestProfile.role ||
                (storedUser.expiry_date || null) !== (latestProfile.expiry_date || null);

            if (profileChangedCritically) {
                  console.warn("AuthProvider: Critical profile change detected (model, role, or expiry). Forcing re-login.");
                  await logoutCallback("Your account details have been updated. Please log in again for changes to take effect.");
                  setLoading(false);
                  return;
            }
             const updatedContextUser = mapUserProfileToContextUser(latestProfile);
             setUser(updatedContextUser);
             if (typeof window !== 'undefined') {
                localStorage.setItem('loggedInUser', JSON.stringify(latestProfile));
             }
             console.log("AuthProvider: Session validated and user set.", updatedContextUser?.email);

        } catch (e: any) {
             console.error("AuthProvider: Critical error during session check/initialization:", e);
             setInitializationError(`Critical error initializing user data: ${e.message}. Ensure 'users.json' exists and is accessible or try clearing browser data.`);
             // Potentially logout or prevent app usage if this is truly critical
        } finally {
            setLoading(false);
            console.log("AuthProvider: Session check complete. Loading set to false.");
        }
    };
    if (!initializationError) { 
        checkUserSession();
    } else {
      setLoading(false); // Ensure loading stops if there's an init error
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, mapUserProfileToContextUser, logoutCallback]); // Removed initializationError from deps to prevent re-check loops on this error


  const refreshUser = useCallback(async () => {
    if (!user || !user.id || !isMounted) return;
    if (initializationError) {
        toast({ variant: 'destructive', title: 'System Error', description: 'Cannot refresh user data due to an initialization error.' });
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
         await logoutCallback("Your account could not be found.");
       }
    } catch (e: any) {
      console.error("RefreshUser failed:", e);
      toast({ variant: 'destructive', title: 'Sync Error', description: 'Could not refresh user data.' });
    } finally {
       setLoading(false);
    }
  }, [user, toast, isMounted, mapUserProfileToContextUser, logoutCallback, initializationError]);


 const login = useCallback(async (email: string, passwordInput?: string) => {
    if (!isMounted) {
        console.warn("Login attempt before component mount.");
        throw new Error("Component not mounted.");
    }
    if (initializationError) {
        toast({ variant: 'destructive', title: 'System Error', description: initializationError, duration: 7000 });
        throw new Error(initializationError);
    }
    if (!passwordInput) {
        toast({ variant: 'destructive', title: 'Login Failed', description: 'Password is required.' });
        throw new Error('Password is required.');
    }
    setLoading(true);
    try {
        const foundUserWithHash = await findUserByEmailInternal(email);

        if (foundUserWithHash && foundUserWithHash.password) {
             const passwordMatch = await bcrypt.compare(passwordInput, foundUserWithHash.password);
             if (passwordMatch) {
                const { password, ...userToStore } = foundUserWithHash;
                const contextUser = mapUserProfileToContextUser(userToStore);
                setUser(contextUser);
                if (typeof window !== 'undefined') {
                    localStorage.setItem('loggedInUser', JSON.stringify(userToStore));
                }

                const isAdmin = contextUser?.role === 'Admin';
                const redirectPath = isAdmin ? '/admin' : '/';
                router.push(redirectPath);
                toast({ title: "Login Successful", description: `Welcome back, ${contextUser?.name || contextUser?.email}!` });
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
      throw error; 
    } finally {
      setLoading(false);
    }
  }, [router, toast, isMounted, mapUserProfileToContextUser, initializationError]);


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
    if (initializationError) {
        toast({ variant: 'destructive', title: 'System Error', description: initializationError, duration: 7000 });
        throw new Error(initializationError);
    }
    if (!password) {
        toast({ variant: 'destructive', title: 'Signup Failed', description: 'Password is required.' });
        throw new Error('Password is required.');
    }
    setLoading(true);
    try {
      const newUserProfileData: Omit<UserProfile, 'id' | 'createdAt' | 'avatarUrl' | 'referralCode' | 'referralStats' | 'totalPoints' | 'telegramId' | 'telegramUsername'> & { password: string; referredByCode?: string | null } = {
        email: email,
        password: password, 
        name: displayName || null,
        phone: phoneNumber || null,
        class: academicStatus || null,
        model: 'free', 
        role: 'User', 
        expiry_date: null, 
        targetYear: targetYear || null,
        referredByCode: referralCodeUsed || null,
      };

       const saveResult = await addUserToJson(newUserProfileData);

       if (!saveResult.success || !saveResult.user) {
         throw new Error(saveResult.message || 'Could not create user profile.');
       }
       if (saveResult.user.email) {
          await sendWelcomeEmail(saveResult.user.email, saveResult.user.name);
      }
       const contextUser = mapUserProfileToContextUser(saveResult.user);
       setUser(contextUser);
        if (contextUser && typeof window !== 'undefined') { 
            localStorage.setItem('loggedInUser', JSON.stringify(saveResult.user));
        }

      toast({ title: "Account Created!", description: `Welcome to EduNexus! You are now logged in.` });
      router.push('/'); 
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Sign Up Failed', description: error.message });
      throw error; 
    } finally {
      setLoading(false);
    }
  }, [router, toast, isMounted, mapUserProfileToContextUser, initializationError]);


  useEffect(() => {
    if (!isMounted || initializationError) return;
    if (loading) return; // Wait until initial loading/session check is complete


    const isAuthPage = pathname.startsWith('/auth');
    const isAdminRoute = pathname.startsWith('/admin');
    const publicExactRoutes = ['/', '/help', '/terms', '/privacy', '/packages'];
    const publicPrefixRoutes = ['/tests', '/dpp', '/pyq-dpps', '/take-test', '/chapterwise-test', '/chapterwise-test-results', '/chapterwise-test-review', '/challenge-test', '/challenge-test-result', '/challenge-test-review'];
    const isTestInterfaceRoute = pathname.startsWith('/test-interface') || pathname.startsWith('/chapterwise-test');

    const isPublicRoute = publicExactRoutes.includes(pathname) || 
                          publicPrefixRoutes.some(route => pathname.startsWith(route + '/') || pathname === route) ||
                          isTestInterfaceRoute;


    if (user) {
      const isAdmin = user.role === 'Admin';
      if (isAuthPage) {
        console.log("User is on auth page, redirecting...", isAdmin ? '/admin' : '/');
        router.push(isAdmin ? '/admin' : '/');
      } else if (isAdminRoute && !isAdmin) {
        console.log("User is not admin but on admin route, redirecting to /");
        toast({ variant: "destructive", title: "Access Denied", description: "You do not have permission to access the admin panel." });
        router.push('/');
      }
    } else { // No user
      if (!isAuthPage && !isPublicRoute) {
        console.log("User not logged in and not on public/auth page, redirecting to login. Current pathname:", pathname);
        const redirectQuery = pathname && pathname !== '/' ? `?redirect=${encodeURIComponent(pathname)}` : '';
        router.push(`/auth/login${redirectQuery}`);
      }
    }
  }, [user, loading, pathname, router, isMounted, toast, initializationError]);

  const updateUserData = (updatedUser: Omit<UserProfile, 'password'>) => {
    // This function is called when user data is updated elsewhere (e.g., settings page)
    // to ensure the context and localStorage are in sync immediately for the current user.
    if (user && user.id === updatedUser.id && isMounted) { 
        const contextUser = mapUserProfileToContextUser(updatedUser);
        setUser(contextUser);
        if (typeof window !== 'undefined') {
            localStorage.setItem('loggedInUser', JSON.stringify(updatedUser));
        }
    }
  };

   // Enhanced Loading and Error UI
   if (!isMounted) {
    // Minimal loader for very initial phase, or nothing to avoid flash
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
   }

   if (loading) { // loading is true during session check
     return (
       <div className="flex items-center justify-center min-h-screen bg-background">
         <div className="space-y-4 w-full max-w-md p-4 text-center">
           <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
           <p className="text-muted-foreground">Loading EduNexus...</p>
         </div>
       </div>
     );
   }

   if (initializationError && !pathname.startsWith('/auth')) {
     return (
       <div className="flex flex-col items-center justify-center min-h-screen bg-destructive/10 text-destructive-foreground p-6">
         <Alert variant="destructive" className="max-w-lg">
           <AlertTriangle className="h-5 w-5" />
           <AlertTitle className="font-semibold">Application Initialization Error</AlertTitle>
           <AlertDescription className="text-sm">
             {initializationError}
             <p className="mt-2 text-xs">Please ensure your browser settings allow local storage and try clearing your browser's cache or site data. If the issue persists, contact support.</p>
            </AlertDescription>
         </Alert>
         <Button onClick={() => router.push('/auth/login')} className="mt-6">Go to Login</Button>
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

