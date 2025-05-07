// src/context/auth-context.tsx
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { UserProfile, UserModel, AcademicStatus } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { findUserByEmail } from '@/actions/auth-actions';
import { saveUserToJson, addUserToJson, getUserById } from '@/actions/user-actions';
import { useRouter, usePathname } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export type ContextUser = {
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
  initializationError: string | null;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  signUpLocally: (userData: Omit<UserProfile, 'id' | 'createdAt' | 'password' | 'model' | 'expiry_date' | 'referral'> & { class: AcademicStatus | null; phone: string | null }, password?: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  initializationError: "Firebase is not configured. Using local storage for authentication and data persistence.",
  login: async () => { console.warn('Auth not initialized or login function not implemented'); },
  logout: async () => { console.warn('Auth not initialized or logout function not implemented'); },
  signUpLocally: async () => { console.warn('Auth not initialized or signUpLocally function not implemented'); },
  refreshUser: async () => { console.warn('Auth not initialized or refreshUser function not implemented'); }
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ContextUser>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null); // Use firebaseInitializationError from firebase.ts if needed
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const loadUserFromLocalStorage = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const storedUserJson = localStorage.getItem('loggedInUser');
    if (storedUserJson) {
      try {
        const storedUser: ContextUser = JSON.parse(storedUserJson);
        if (storedUser && storedUser.id && storedUser.email) {
            setUser(storedUser);
            console.log("Loaded user from local storage:", storedUser?.email);
            return true;
        } else {
            localStorage.removeItem('loggedInUser');
        }
      } catch (e) {
        console.error("Failed to parse user from local storage", e);
        localStorage.removeItem('loggedInUser');
      }
    }
    return false;
  }, []);

  useEffect(() => {
    setIsMounted(true);
    loadUserFromLocalStorage();
    setLocalError("Firebase is not configured. Using local storage for authentication and data persistence."); // Set initial message
    setLoading(false);
  }, [loadUserFromLocalStorage]);

  const refreshUser = useCallback(async () => {
    const currentUserId = user?.id;
    if (!currentUserId) return;
    setLoading(true);
    try {
      const profile = await getUserById(currentUserId);
      if (profile) {
        const contextUser: ContextUser = {
            id: profile.id,
            email: profile.email,
            displayName: profile.name,
            photoURL: null,
            phone: profile.phone,
            className: profile.class,
            model: profile.model,
            expiry_date: profile.expiry_date,
        };
        setUser(contextUser);
        localStorage.setItem('loggedInUser', JSON.stringify(contextUser));
      } else {
        setUser(null);
        localStorage.removeItem('loggedInUser');
        router.push('/auth/login');
      }
    } catch (error) {
      console.error("Error refreshing user data:", error);
      toast({variant: "destructive", title:"Refresh Error", description: "Could not sync profile."})
    } finally {
      setLoading(false);
    }
  }, [user?.id, router, toast]);

  const login = useCallback(async (email: string, password?: string) => {
    setLoading(true);
    try {
      if (!password) {
        throw new Error('Password is required for login.');
      }
      const userProfile = await findUserByEmail(email);

      if (userProfile && userProfile.password === password) {
        const contextUser: ContextUser = {
          id: String(userProfile.id),
          email: userProfile.email,
          displayName: userProfile.name,
          photoURL: null,
          phone: userProfile.phone,
          className: userProfile.class,
          model: userProfile.model,
          expiry_date: userProfile.expiry_date,
        };
        setUser(contextUser);
        localStorage.setItem('loggedInUser', JSON.stringify(contextUser));
        
        const isAdmin = userProfile.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        const redirectPath = isAdmin ? '/admin' : '/';
        router.push(redirectPath);
        toast({ title: "Login Successful", description: `Welcome back, ${userProfile.name || userProfile.email}!` });
      } else {
        throw new Error('Login failed: Invalid email or password.');
      }
    } catch (error: any) {
      const message = error.message || "Login failed. Please check your email and password.";
      toast({ variant: 'destructive', title: 'Login Failed', description: message });
      setUser(null);
      localStorage.removeItem('loggedInUser');
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      setUser(null);
      localStorage.removeItem('loggedInUser');
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      router.push('/auth/login');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Logout Failed', description: error.message });
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  const signUpLocally = useCallback(async (userData: Omit<UserProfile, 'id' | 'createdAt' | 'password' | 'model' | 'expiry_date' | 'referral'> & { class: AcademicStatus | null; phone: string | null }, password?: string) => {
    if (!userData.email || !password || !userData.name || !userData.class || !userData.phone) {
        toast({ variant: 'destructive', title: 'Signup Failed', description: 'All fields are required.' });
        throw new Error("All fields required");
    }
    setLoading(true);
    try {
        const existingUser = await findUserByEmail(userData.email);
        if (existingUser) {
            throw new Error("Email address is already registered.");
        }
        const newUserProfile: UserProfile = {
            id: uuidv4(),
            email: userData.email,
            password: password,
            name: userData.name,
            phone: userData.phone,
            referral: "",
            class: userData.class,
            model: 'free',
            expiry_date: null,
            createdAt: new Date().toISOString(),
        };
        const addResult = await addUserToJson(newUserProfile);
        if (!addResult.success) {
            throw new Error(addResult.message || "Could not save user profile locally.");
        }
        toast({ title: "Account Created", description: "Welcome! Please log in." });
        router.push('/auth/login');
    } catch (error: any) {
        let message = "Signup failed. Please try again.";
        if (error.message === "Email address is already registered.") {
            message = error.message;
        }
        toast({ variant: 'destructive', title: 'Signup Failed', description: message });
        setUser(null);
        throw new Error(message);
    } finally {
        setLoading(false);
    }
  }, [toast, router]);

  useEffect(() => {
    if (!isMounted) return;
    if (!loading) {
      const isLoggedIn = !!user;
      const isAdmin = user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
      const isAuthPage = pathname.startsWith('/auth');
      const isAdminPage = pathname.startsWith('/admin');
      const publicRoutes = ['/', '/help', '/terms', '/privacy', '/tests'];
      const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith('/tests/');
      const isProtectedRoute = !isAuthPage && !isAdminPage && !isPublicRoute;

      if (isLoggedIn && !isAdmin && isAdminPage) {
        router.push('/');
      } else if (!isLoggedIn && isProtectedRoute) {
        router.push(`/auth/login?redirect=${pathname}`);
      } else if (isLoggedIn && isAuthPage) {
        router.push(isAdmin ? '/admin' : '/');
      }
    }
  }, [user, loading, isMounted, pathname, router]);

  if (loading && isMounted && !pathname.startsWith('/auth')) {
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
    <AuthContext.Provider value={{ user, loading, initializationError: localError, login, logout, signUpLocally, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
