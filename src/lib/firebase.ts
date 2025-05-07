// src/lib/firebase.ts

// Firebase initialization is completely removed.
// The application will now use local storage for session management
// and local JSON files (via server actions) for persistent user data.

export const app = null; // No Firebase app instance
export const auth = null; // No Firebase Auth instance
export const firebaseInitializationError = "Firebase is not configured. Using local storage for authentication and data persistence.";

console.warn(
  "Firebase is not configured. Using local storage for authentication and data persistence. This is for demonstration purposes and is not suitable for production."
);
