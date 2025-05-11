// src/lib/firebase.ts

// Firebase initialization is completely removed as per the decision to use local storage.
// This file now primarily serves to provide a consistent error message if any
// old Firebase-related code attempts to use it.

export const app = null; // No Firebase app instance
export const auth = null; // No Firebase Auth instance

export const firebaseInitializationError = "Firebase is not configured for this application. The application uses local storage for authentication and data persistence. If you see Firebase-related errors, it indicates outdated code. Ensure all Firebase dependencies and configurations in .env are removed or commented out.";

// This console warning will appear once when this module is first imported.
console.warn(firebaseInitializationError);
