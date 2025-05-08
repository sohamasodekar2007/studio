
// context/auth-context.tsx (React Native Version)
import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile, UserModel, AcademicStatus as UserAcademicStatus, ContextUser } from '@/types'; // Assuming types are shared or copied
import { useRouter, useRootNavigationState } from 'expo-router';
import { ActivityIndicator, View, Text } from 'react-native'; // Import RN components

// Assuming user-actions will be API calls in RN context
// These functions will likely need to be replaced with API fetch calls
// For now, we'll simulate local checks/storage.
import { findUserByEmailInternal, addUserToJson, updateUserPasswordInJson } from '@/actions/user-actions-stub'; // Use stubbed actions


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
    academicStatus?: UserAcademicStatus | null
  ) => Promise<void>;
  refreshUser: () => Promise<void>; // Keep refresh signature
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  initializationError: null,
  login: async () => { console.warn('RN Auth: Login not implemented'); },
  logout: async () => { console.warn('RN Auth: Logout not implemented'); },
  signUp: async () => { console.warn('RN Auth: SignUp not implemented'); },
  refreshUser: async () => { console.warn('RN Auth: RefreshUser not implemented'); },
});

const USER_STORAGE_KEY = '@StudySphere:loggedInUser';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ContextUser>(null);
  const [loading, setLoading] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const router = useRouter();
  const navigationState = useRootNavigationState(); // To check if router is ready

  // Check AsyncStorage for logged-in user on initial load
  useEffect(() => {
    const checkUserSession = async () => {
      setLoading(true);
      console.log("RN AuthProvider: Checking async storage session...");
      try {
        const storedUserJson = await AsyncStorage.getItem(USER_STORAGE_KEY);
        if (!storedUserJson) {
          console.log("RN AuthProvider: No user found in async storage.");
          setUser(null);
        } else {
          console.log("RN AuthProvider: Found user in async storage.");
          const storedUser: Omit<UserProfile, 'password'> = JSON.parse(storedUserJson);
          // Basic validation
          if (storedUser && storedUser.id && storedUser.email) {
            // In a real app, you might want to verify the token/session with a backend here
            // For local simulation, we trust the stored data for now
            setUser(storedUser); // Use stored data
            console.log(`RN AuthProvider: Session loaded for ${storedUser.email}.`);
          } else {
            console.warn("RN AuthProvider: Invalid user data in async storage, clearing.");
            await logout("Invalid session data. Please log in again.");
          }
        }
      } catch (e: any) {
        console.error("RN AuthProvider: Error during session check", e);
        setInitializationError(`Failed to verify session: ${e.message}`);
        await logout(); // Logout on error
      } finally {
        setLoading(false);
        console.log("RN AuthProvider: Session check complete. Loading state:", false);
      }
    };

    checkUserSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigateBasedOnAuth = useCallback(() => {
     if (loading || !navigationState?.key) {
       return; // Don't navigate until loading is done and router is ready
     }
     console.log("RN AuthProvider: Navigating based on auth state. User:", !!user);
      if (user) {
         // If user is logged in, ensure they are in the (tabs) group
         router.replace('/(tabs)/');
      } else {
         // If user is not logged in, ensure they are in the (auth) group
         router.replace('/(auth)/login');
      }
   }, [user, loading, router, navigationState?.key]);

   // Navigate when auth state changes or loading finishes
   useEffect(() => {
     navigateBasedOnAuth();
   }, [navigateBasedOnAuth]); // Run whenever the callback identity changes (i.e., dependencies change)


  const login = useCallback(async (email: string, password?: string) => {
    if (!password) throw new Error('Password is required.');
    setLoading(true);
    try {
      // Simulate finding user (replace with API call)
      const foundUser = await findUserByEmailInternal(email, password);
      if (!foundUser) throw new Error('Invalid email or password.');

       console.log(`RN AuthProvider: Login successful for ${email}`);
       const { password: _removedPassword, ...userToStore } = foundUser; // Remove password before storing
       setUser(userToStore);
       await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userToStore));
       // Navigation handled by navigateBasedOnAuth effect
       // router.replace('/(tabs)/'); // Let effect handle navigation
    } catch (error: any) {
      console.error("RN Login failed:", error);
      // Alert handled in screen component
      throw error; // Re-throw for screen to handle
    } finally {
      setLoading(false);
    }
  }, [router]);

  const logout = useCallback(async (message?: string) => {
    console.log("RN AuthProvider: Logging out...");
    setLoading(true);
    setUser(null);
    await AsyncStorage.removeItem(USER_STORAGE_KEY);
    if (message) alert(message); // Show alert if message provided
    // Navigation handled by navigateBasedOnAuth effect
    // router.replace('/(auth)/login');
    setLoading(false);
  }, [router]);

  const signUp = useCallback(async (
    email: string,
    password?: string,
    displayName?: string,
    phoneNumber?: string | null,
    academicStatus?: UserAcademicStatus | null
  ) => {
    if (!password) throw new Error('Password is required.');
    setLoading(true);
    try {
       // Simulate adding user (replace with API call)
       const newUser = await addUserToJson({
           email,
           password, // Pass plain text to stub
           name: displayName || null,
           phone: phoneNumber || null,
           class: academicStatus || null,
           model: 'free', // Default to free
           expiry_date: null
       });

       if (!newUser) throw new Error('Could not create account.');

        console.log(`RN AuthProvider: Signup successful for ${email}. Logging in...`);
        // Automatically log in
        const { password: _removedPassword, ...userToStore } = newUser;
        setUser(userToStore);
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userToStore));
        // Navigation handled by navigateBasedOnAuth effect
        // router.replace('/(tabs)/');

    } catch (error: any) {
      console.error("RN Signup failed:", error);
       // Alert handled in screen component
      throw error; // Re-throw
    } finally {
      setLoading(false);
    }
  }, [router]);

   // RefreshUser would typically involve an API call to get latest profile
   const refreshUser = useCallback(async () => {
     if (!user || !user.id) return;
     console.log(`RN AuthProvider: Simulating refresh for ${user.email}`);
     // Placeholder: In a real app, fetch latest user data from API
     // const latestData = await fetchUserProfileAPI(user.id);
     // setUser(latestData);
     // await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(latestData));
     console.warn("RN AuthProvider: refreshUser is a placeholder.");
   }, [user]);

  // --- UI Loading State ---
  // Render children directly if loading is finished or error occurred (error is handled elsewhere)
  // The RootLayoutNav will handle showing an ActivityIndicator or error message
  return (
    <AuthContext.Provider value={{ user, loading, initializationError, login, logout, signUp, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
