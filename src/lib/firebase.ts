// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth"; // Import Auth type explicitly

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

// Check for missing *or empty* required variables first
const missingOrEmptyVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingOrEmptyVars.length > 0) {
    firebaseInitializationError = `CRITICAL FIREBASE CONFIG ERROR: The following required environment variables are missing or empty in your .env file: ${missingOrEmptyVars.join(', ')}. Please ensure you have a valid .env file with the correct Firebase configuration. Firebase features (including authentication) WILL FAIL until this is corrected. See README.md for setup instructions. Remember to restart the server after editing .env.`;
    console.error("**********************************************************************************");
    console.error(firebaseInitializationError);
    console.error("**********************************************************************************");
} else if (!firebaseConfig.apiKey || typeof firebaseConfig.apiKey !== 'string' || !firebaseConfig.apiKey.startsWith("AIza")) {
    // If all vars are present, specifically check the API key format
    firebaseInitializationError = `CRITICAL FIREBASE CONFIG ERROR: The NEXT_PUBLIC_FIREBASE_API_KEY (starting with "${firebaseConfig.apiKey?.substring(0, 4)}...") in your .env file appears invalid. It should start with 'AIza'. Please verify it against your Firebase project settings. Remember to restart the server after editing .env.`;
    console.error("**********************************************************************************");
    console.error(firebaseInitializationError);
    console.error("**********************************************************************************");
}


// --- Initialization ---
let app = null;
let authInstance: Auth | null = null;

// Only attempt initialization if there are no critical config errors found above
if (!firebaseInitializationError) {
    try {
        if (!getApps().length) {
            console.log("Initializing Firebase App...");
            app = initializeApp(firebaseConfig);
            console.log("Firebase App Initialized successfully.");
        } else {
            app = getApp();
            console.log("Firebase App Re-used.");
        }

        // Initialize Auth
        authInstance = getAuth(app);
        console.log("Firebase Auth Initialized successfully.");

    } catch (error: any) {
        let specificHint = "";
        // Add hints based on common Firebase initialization errors
        if (error.code === 'auth/invalid-api-key' || error.message.includes('API key not valid')) {
             specificHint = " The API key (NEXT_PUBLIC_FIREBASE_API_KEY) in your .env file seems incorrect. Please double-check it against your Firebase project settings.";
        } else if (error.code === 'auth/missing-api-key') {
             specificHint = " The API key (NEXT_PUBLIC_FIREBASE_API_KEY) is missing from your .env file or Firebase configuration.";
        } else if (error.code?.includes('project-id') || error.message?.includes('project ID')) {
             specificHint = " There might be an issue with your Project ID (NEXT_PUBLIC_FIREBASE_PROJECT_ID). Verify it in your Firebase console and .env file.";
        } else if (error.code?.includes('auth-domain') || error.message?.includes('auth domain')) {
             specificHint = " Check your Auth Domain (NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) in your .env file; it should be something like 'your-project-id.firebaseapp.com'.";
        } else if (error.code === 'auth/configuration-not-found') {
             specificHint = " This often means Authentication isn't enabled in your Firebase project console, or the required sign-in providers (Email/Password, Google) are disabled. Check the 'Authentication > Sign-in method' tab in your Firebase console.";
        }

        firebaseInitializationError = `FATAL ERROR DURING FIREBASE INITIALIZATION: ${error.message} (Code: ${error.code || 'N/A'}).${specificHint} Check your Firebase Console setup and the values in your .env file. Ensure all NEXT_PUBLIC_FIREBASE_* variables are correct and the server was restarted after changes.`;
        console.error("**********************************************************************************");
        console.error(firebaseInitializationError, error);
        console.error("**********************************************************************************");
        app = null;
        authInstance = null;
    }
} else {
     // This log will now run if the initial check found missing/empty variables
     console.warn("Firebase initialization skipped due to critical configuration errors found in the .env file. Please check the error messages above, correct the .env file, and restart the server.");
}

const auth = authInstance;

// Export the error message so AuthProvider can potentially display it
export { app, auth, firebaseInitializationError };
