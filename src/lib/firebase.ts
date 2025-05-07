
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth"; // Import Auth type explicitly
// NOTE: Firestore/Storage imports removed as they are not currently used. Re-add if needed.
// import { getFirestore } from "firebase/firestore";
// import { getStorage } from "firebase/storage";

// --- Firebase configuration ---
// Reads from environment variables. Ensure your .env file is correctly set up.
const firebaseConfig: FirebaseOptions = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID // Optional
};

// --- Validation ---
const requiredEnvVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
];

let firebaseInitializationError: string | null = null;
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

// Check for missing environment variables only if running client-side or if env vars are accessible server-side during build
if (typeof window !== 'undefined' || process.env.NODE_ENV === 'development') { // Added check for environment
    if (missingEnvVars.length > 0) {
        firebaseInitializationError = `CRITICAL FIREBASE CONFIG ERROR: The following environment variables are missing: ${missingEnvVars.join(', ')}. Please ensure you have a valid .env file with the correct Firebase configuration. Firebase features (including authentication) WILL FAIL until this is corrected. See README.md for setup instructions.`;
        console.error("**********************************************************************************");
        console.error(firebaseInitializationError);
        console.error("**********************************************************************************");
    } else if (!firebaseConfig.apiKey || !firebaseConfig.apiKey.startsWith("AIza")) {
        // Basic check even if env vars are present
        firebaseInitializationError = `CRITICAL FIREBASE CONFIG ERROR: The NEXT_PUBLIC_FIREBASE_API_KEY in your .env file appears invalid (missing, empty, or doesn't start with 'AIza').`;
        console.error("**********************************************************************************");
        console.error(firebaseInitializationError);
        console.error("**********************************************************************************");
    }
}

// --- Initialization ---
let app = null;
let authInstance: Auth | null = null;

// Only attempt initialization if there are no critical config errors found above
if (!firebaseInitializationError) {
    try {
        if (!getApps().length) {
            console.log("Initializing Firebase App..."); // Simpler log
            app = initializeApp(firebaseConfig);
            console.log("Firebase App Initialized successfully.");
        } else {
            app = getApp();
            console.log("Firebase App Re-used.");
        }
        // Attempt to get Auth only if app initialized successfully
        authInstance = getAuth(app);
        console.log("Firebase Auth Initialized successfully.");
    } catch (error: any) {
        // Catch errors during initializeApp or getAuth, often related to config or console setup
        let specificHint = "";
        if (error.code === 'auth/configuration-not-found') {
             specificHint = " This usually means Authentication isn't enabled in your Firebase project console, or the required sign-in providers (Email/Password, Google) are disabled. Check the 'Authentication > Sign-in method' tab in your Firebase console.";
        } else if (error.code === 'auth/invalid-api-key') {
             specificHint = " The API key in your .env file (NEXT_PUBLIC_FIREBASE_API_KEY) seems incorrect. Please verify it against your Firebase project settings.";
        }

        firebaseInitializationError = `FATAL ERROR DURING FIREBASE INITIALIZATION: ${error.message} (Code: ${error.code || 'N/A'}).${specificHint} Check your Firebase Console setup and the values in your .env file. Restart the server after fixing the .env file.`;
        console.error("**********************************************************************************");
        console.error(firebaseInitializationError, error);
        console.error("**********************************************************************************");
        app = null; // Ensure app is null on error
        authInstance = null; // Ensure auth is null on error
    }
} else {
     console.warn("Firebase initialization skipped due to configuration errors. Please check your .env file and restart the server.");
}

// Export the potentially null auth instance. Consumers MUST check for null.
const auth = authInstance;
// const db = app ? getFirestore(app) : null; // Uncomment if using Firestore
// const storage = app ? getStorage(app) : null; // Uncomment if using Storage

// Export the error message so AuthProvider can potentially display it
export { app, auth, firebaseInitializationError };
