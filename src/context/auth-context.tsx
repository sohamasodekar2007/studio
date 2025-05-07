// src/context/auth-context.tsx
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { UserProfile, UserModel, AcademicStatus } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { findUserByEmail } from '@/actions/auth-actions';
import { saveUserToJson, addUserToJson, getUserById, readUsers } from '@/actions/user-actions'; // readUsers for initialization check
import { useRouter, usePathname } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export type ContextUser = {
  id: string; // UUID string
  email: string | null;
  displayName: string | null;
  photoURL?: string | null; // Kept for potential future use, but not used with local auth
  phone: string | null;
  className: AcademicStatus | null; // Changed from academicStatus to className to match UserProfile
  model: UserModel;
  expiry_date: string | null; // ISO string
} | null;

interface AuthContextProps {
  user: ContextUser;
  loading: boolean;
  initializationError: string | null; // Kept for general errors, Firebase specific message removed
  login: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  signUpLocally: (userData: Omit<UserProfile, 'id' | 'createdAt' | 'password' | 'model' | 'expiry_date' | 'referral'> & { class: AcademicStatus | null; phone: string | null }, password?: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  initializationError: null, // Default to null, set if local storage/JSON ops fail
  login: async () => { console.warn('Auth not initialized or login function not implemented'); },
  logout: async () => { console.warn('Auth not initialized or logout function not implemented'); },
  signUpLocally: async () => { console.warn('Auth not initialized or signUpLocally function not implemented'); },
  refreshUser: async () => { console.warn('Auth not initialized or refreshUser function not implemented'); }
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ContextUser>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  // Ensure users.json is initialized on app start (simulates backend readiness)
  useEffect(() => {
    async function ensureDataStoreInitialized() {
      try {
        await readUsers(); // This will call readAndInitializeUsersInternal
        console.log("User data store checked/initialized by AuthProvider.");
      } catch (e) {
        console.error("Critical error during initial data store check:", e);
        setLocalError("Failed to initialize user data. Please check server logs.");
      }
    }
    ensureDataStoreInitialized();
  }, []);


  const loadUserFromLocalStorage = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const storedUserJson = localStorage.getItem('loggedInUser');
    if (storedUserJson) {
      try {
        // Expect UserProfile structure from localStorage after login/signup actions
        const storedUserProfile: UserProfile = JSON.parse(storedUserJson);
        if (storedUserProfile && storedUserProfile.id && storedUserProfile.email) {
            const contextUser: ContextUser = {
                id: String(storedUserProfile.id),
                email: storedUserProfile.email,
                displayName: storedUserProfile.name,
                phone: storedUserProfile.phone,
                className: storedUserProfile.class,
                model: storedUserProfile.model,
                expiry_date: storedUserProfile.expiry_date,
            };
            setUser(contextUser);
            console.log("Loaded user from local storage:", contextUser?.email);
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
    // Removed Firebase-specific error message
    // setLocalError("Using local storage for authentication and data persistence.");
    setLoading(false);
  }, [loadUserFromLocalStorage]);

  const refreshUser = useCallback(async () => {
    const currentUserId = user?.id;
    if (!currentUserId) return;
    setLoading(true);
    try {
      const profile = await getUserById(currentUserId); // This returns Omit<UserProfile, 'password'>
      if (profile) {
        const contextUser: ContextUser = {
            id: profile.id, // Already string
            email: profile.email,
            displayName: profile.name,
            // photoURL: null, // Not used
            phone: profile.phone,
            className: profile.class,
            model: profile.model,
            expiry_date: profile.expiry_date,
        };
        setUser(contextUser);
        // Store the refreshed profile (without password) in local storage
        localStorage.setItem('loggedInUser', JSON.stringify(profile));
      } else {
        // User not found, log out
        setUser(null);
        localStorage.removeItem('loggedInUser');
        localStorage.removeItem('simulatedPassword'); // Also clear this if used
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
    setLocalError(null);
    try {
      if (!password) {
        throw new Error('Password is required for login.');
      }
      const userProfile = await findUserByEmail(email); // Fetches full profile initially

      if (userProfile && userProfile.password === password) { // Direct password check (INSECURE)
        const contextUser: ContextUser = {
          id: String(userProfile.id),
          email: userProfile.email,
          displayName: userProfile.name,
          phone: userProfile.phone,
          className: userProfile.class,
          model: userProfile.model,
          expiry_date: userProfile.expiry_date,
        };
        setUser(contextUser);
        // Store the UserProfile (excluding password for slightly better practice, though already exposed)
        const { password: _p, ...profileToStore } = userProfile;
        localStorage.setItem('loggedInUser', JSON.stringify(profileToStore));
        localStorage.setItem('simulatedPassword', password); // Store for session simulation (INSECURE)

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
      localStorage.removeItem('simulatedPassword');
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  const logout = useCallback(async () => {
    setLoading(true);
    setLocalError(null);
    try {
      setUser(null);
      localStorage.removeItem('loggedInUser');
      localStorage.removeItem('simulatedPassword');
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
    setLocalError(null);
    try {
        const result = await addUserToJson({ // addUserToJson will handle ID and createdAt
            email: userData.email,
            password: password,
            name: userData.name,
            phone: userData.phone,
            class: userData.class,
            model: 'free', // Default
            expiry_date: null, // Default
            referral: '', // Default
        });

        if (!result.success || !result.user) {
            throw new Error(result.message || "Could not save user profile locally.");
        }
        
        toast({ title: "Account Created", description: "Welcome! Please log in." });
        router.push('/auth/login'); // Redirect to login after successful signup
    } catch (error: any) {
        let message = "Signup failed. Please try again.";
        if (error.message === "User with this email already exists.") { // Check for specific message from action
            message = error.message;
        }
        toast({ variant: 'destructive', title: 'Signup Failed', description: message });
        setUser(null); // Clear user state on failure if any was set
        throw new Error(message); // Re-throw for the form to handle
    } finally {
        setLoading(false);
    }
  }, [toast, router]);

  // Route protection logic
  useEffect(() => {
    if (!isMounted || loading) return; // Wait for mount and auth state to settle

    const isLoggedIn = !!user;
    const isAdminUser = user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    const isAuthPage = pathname.startsWith('/auth');
    const isAdminRoute = pathname.startsWith('/admin');
    
    // Publicly accessible routes
    const publicRoutes = ['/', '/help', '/terms', '/privacy', '/tests', '/study-tips', '/doubt-solving'];
    // Check if current path is a public route or a dynamic sub-route of /tests/
    const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith('/tests/') || pathname.startsWith('/take-test/') || pathname.startsWith('/chapterwise-test/') || pathname.startsWith('/chapterwise-test-results/') || pathname.startsWith('/chapterwise-test-review/');

    if (isLoggedIn) {
      if (isAuthPage) { // If logged in and on an auth page
        router.push(isAdminUser ? '/admin' : '/'); // Redirect to dashboard
      } else if (isAdminRoute && !isAdminUser) { // If on admin route but not admin
        router.push('/'); // Redirect to user dashboard
        toast({ variant: "destructive", title: "Access Denied", description: "You do not have permission to access this page." });
      }
    } else { // Not logged in
      if (!isAuthPage && !isPublicRoute) { // If on a protected route (not auth and not public)
        router.push(`/auth/login?redirect=${pathname}`);
      }
    }
  }, [user, loading, isMounted, pathname, router, toast]);


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
  
  if (localError && !loading) { // Only show error if not loading and error exists
    return (
      <div className="flex items-center justify-center min-h-screen bg-destructive/10 text-destructive-foreground p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Application Initialization Error</AlertTitle>
          <AlertDescription>{localError}</AlertDescription>
        </Alert>
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
