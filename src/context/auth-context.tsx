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
    findUserByReferralCode, // Import this new action
} from '@/actions/user-actions'; 
import { sendWelcomeEmail } from '@/actions/otp-actions'; 
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
    targetYear?: string | null,
    referralCodeUsed?: string | null // Added referralCodeUsed
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
          referralCode: userProfile.referralCode, // Ensure referralCode is mapped
          referralStats: userProfile.referralStats, // Ensure referralStats are mapped
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
        try {
            await readUsersWithPasswordsInternal(); 

            const storedUserJson = localStorage.getItem('loggedInUser');
            if (!storedUserJson) {
                setUser(null);
                setLoading(false);
                return;
            }

            const storedUser: Omit<UserProfile, 'password'> = JSON.parse(storedUserJson);

            if (!storedUser || !storedUser.id || !storedUser.email) {
                 await logoutCallback("Invalid session data. Please log in again.");
                 setLoading(false);
                 return;
            }

            const latestProfile = await getUserById(storedUser.id); 

            if (!latestProfile) {
                 await logoutCallback("Your account could not be found. Please log in again.");
                 setLoading(false);
                 return;
            }

            const profileChangedCritically = storedUser.model !== latestProfile.model ||
                                   storedUser.role !== latestProfile.role ||
                                   (storedUser.expiry_date || null) !== (latestProfile.expiry_date || null);


            if (profileChangedCritically) {
                  await logoutCallback("Your account details have been updated. Please log in again for changes to take effect.");
                  setLoading(false);
                  return;
            }
             const updatedContextUser = mapUserProfileToContextUser(latestProfile);
             setUser(updatedContextUser);
             localStorage.setItem('loggedInUser', JSON.stringify(latestProfile)); 

        } catch (e: any) {
             console.error("AuthProvider: Error during session check:", e);
             setInitializationError(`Failed to verify session: ${e.message}. Ensure users.json is accessible and valid.`);
             await logoutCallback("Session validation error. Please try logging in again.");
        } finally {
            setLoading(false);
        }
    };
    checkUserSession();
  }, [isMounted, mapUserProfileToContextUser, logoutCallback]); 


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
  }, [user, toast, mapUserProfileToContextUser, logoutCallback]);


 const login = useCallback(async (email: string, password?: string) => {
    if (!isMounted) {
        return;
    }
    if (!password) {
        toast({ variant: 'destructive', title: 'Login Failed', description: 'Password is required.' });
        throw new Error('Password is required.');
    }
    setLoading(true);
    try {
        const users = await readUsersWithPasswordsInternal();
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
                router.push(redirectPath);
                toast({ title: "Login Successful", description: `Welcome back, ${contextUser?.name || contextUser?.email}!` });
             } else {
                 throw new Error('Login failed: Invalid email or password.');
             }
        } else {
            throw new Error('Login failed: Invalid email or password.');
        }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Login Failed', description: error.message });
      throw error;
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
    referralCodeUsed?: string | null // Added referralCodeUsed
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
        referredByCode: referralCodeUsed || null, // Pass the used referral code
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
        if (contextUser) { 
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
  }, [router, toast, isMounted, mapUserProfileToContextUser]);


  useEffect(() => {
    if (loading || !isMounted) return;

    const isAuthPage = pathname.startsWith('/auth');
    const isAdminRoute = pathname.startsWith('/admin');
    const publicRoutes = [
        '/', '/help', '/terms', '/privacy', '/tests', '/dpp', '/pyq-dpps', '/take-test',
        '/chapterwise-test', '/chapterwise-test-results', '/chapterwise-test-review',
        '/challenge-test', '/challenge-test-result', '/challenge-test-review',
        '/find-friends', '/friends-followers', '/friends-following', '/friends-compare',
        '/notebooks', '/leaderboard', '/profile', // Added profile, notebooks, leaderboard as public access (content shown conditionally)
    ];

     const isPublicRoute = publicRoutes.some(route => {
         if (route !== '/' && pathname.startsWith(route + '/')) return true;
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
    } else { 
      if (!isAuthPage && !isPublicRoute) {
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
    <AuthContext.Provider value={{ user, loading, initializationError, login, logout: logoutCallback, signUp, refreshUser, updateUserData, setUser, setLoading, mapUserProfileToContextUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);