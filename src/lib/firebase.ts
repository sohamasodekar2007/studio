// src/lib/firebase.ts

// Firebase initialization is completely removed as per the decision to use local storage.
// This file now primarily serves to provide a consistent error message if any
// old Firebase-related code attempts to use it or if other initialization issues arise.

export const app = null; // No Firebase app instance
export const auth = null; // No Firebase Auth instance

// Set to null as Firebase is no longer used.
// Any "initializationError" in AuthContext will now be from other sources if they occur.
export const firebaseInitializationError: string | null = null;

// This console warning will appear once when this module is first imported if not null.
// Since it's null, it won't log, which is intended.
if (firebaseInitializationError) {
    console.warn(firebaseInitializationError);
}
