// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth"; // Import Auth type explicitly
// NOTE: The following analytics import and initialization were removed as they are not currently used in the application.
// import { getAnalytics } from "firebase/analytics";
// import { getFirestore } from "firebase/firestore"; // Uncomment if using Firestore
// import { getStorage } from "firebase/storage"; // Uncomment if using Storage

// --- Firebase configuration ---
// IMPORTANT: Ideally, these values should come from environment variables (.env file).
// Hardcoding them here as per the user's request, but this is NOT recommended for production.
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyAVmKzEE8TqWsoyP8snMZBL1j7Rz0xpI1I", // User provided value
  authDomain: "edunexus-a271c.firebaseapp.com", // User provided value
  projectId: "edunexus-a271c", // User provided value
  storageBucket: "edunexus-a271c.appspot.com", // Corrected the domain based on standard Firebase pattern
  messagingSenderId: "194103261842", // User provided value
  appId: "1:194103261842:web:707df6a2e5d9511720444b", // User provided value
  measurementId: "G-2QLLE1VJ7P" // User provided value (Optional)
};

// --- Validation (Still checks environment variables for consistency/awareness) ---
const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
let firebaseInitializationError: string | null = null;

if (missingEnvVars.length > 0) {
  // Warning about missing ENV vars, even though hardcoded values are used below.
  const warningMsg = `WARNING: Firebase config is hardcoded in firebase.ts, but the following environment variables are missing or unset: ${missingEnvVars.join(', ')}. Ensure your .env file is correctly set up for consistency and best practices, even if using hardcoded values temporarily.`;
  console.warn("**********************************************************************************");
  console.warn(warningMsg);
  console.warn("**********************************************************************************");
  // Do not set firebaseInitializationError here if we intend to proceed with hardcoded values.
}

// --- Initialization ---
let app = null;
let authInstance: Auth | null = null;

try {
    // Basic check on the hardcoded API key
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey.length < 10 || !firebaseConfig.apiKey.startsWith("AIza")) {
        throw new Error("Provided Firebase API Key is missing, empty, too short, or doesn't look valid.");
    }

    if (!getApps().length) {
        app = initializeApp(firebaseConfig);
        console.log("Firebase App Initialized with provided config.");
    } else {
        app = getApp();
        console.log("Firebase App Re-used.");
    }
    // Attempt to get Auth only if app initialized successfully
    authInstance = getAuth(app);
    console.log("Firebase Auth Initialized successfully.");
} catch (error: any) {
    firebaseInitializationError = `FATAL ERROR DURING FIREBASE INITIALIZATION: ${error.message}. Check the hardcoded configuration in src/lib/firebase.ts or ensure environment variables are correctly set if reverting to .env usage.`;
    console.error("**********************************************************************************");
    console.error(firebaseInitializationError, error);
    console.error("**********************************************************************************");
    app = null;
    authInstance = null;
}


// Export the potentially null auth instance. Consumers MUST check for null.
const auth = authInstance;
// const db = app ? getFirestore(app) : null; // Uncomment if using Firestore
// const storage = app ? getStorage(app) : null; // Uncomment if using Storage

// Export the error message so AuthProvider can potentially display it
export { app, auth, firebaseInitializationError };
