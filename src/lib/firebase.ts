// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth"; // Import Auth type explicitly
// import { getFirestore } from "firebase/firestore"; // Uncomment if using Firestore
// import { getStorage } from "firebase/storage"; // Uncomment if using Storage

// --- Firebase configuration validation ---
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
  firebaseInitializationError = `CRITICAL FIREBASE CONFIG ERROR: The following environment variables are missing: ${missingEnvVars.join(', ')}. Please ensure you have a valid .env file with the correct Firebase configuration. Firebase features (including authentication) WILL FAIL until this is corrected. See README.md for setup instructions.`;
  console.error("**********************************************************************************");
  console.error(firebaseInitializationError);
  console.error("**********************************************************************************");
}

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
};

// --- Initialization ---
let app = null;
let authInstance: Auth | null = null; // Explicitly type as Auth | null

if (!firebaseInitializationError) {
   // CRITICAL CHECK: Ensure the API key is present and looks potentially valid before initializing.
   // A very basic check, Firebase SDK does more thorough validation.
   if (!firebaseConfig.apiKey || firebaseConfig.apiKey.length < 10 || !firebaseConfig.apiKey.startsWith("AIza")) {
      firebaseInitializationError = "CRITICAL FIREBASE CONFIG ERROR: NEXT_PUBLIC_FIREBASE_API_KEY is missing, empty, too short, or doesn't look like a valid Firebase Web API Key in your .env file. Expected format: NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...";
      console.error("**********************************************************************************");
      console.error(firebaseInitializationError);
      console.error("**********************************************************************************");
   } else {
       try {
           if (!getApps().length) {
               app = initializeApp(firebaseConfig);
               console.log("Firebase App Initialized.");
           } else {
               app = getApp();
                console.log("Firebase App Re-used.");
           }
           // Attempt to get Auth only if app initialized successfully
           authInstance = getAuth(app);
            console.log("Firebase Auth Initialized successfully."); // Add success log
       } catch (error: any) {
            firebaseInitializationError = `FATAL ERROR DURING FIREBASE INITIALIZATION: ${error.message}. This likely means your Firebase config in .env is incorrect, incomplete, or the API key is invalid. Please verify all NEXT_PUBLIC_FIREBASE_* variables match your Firebase project settings.`;
            console.error("**********************************************************************************");
            console.error(firebaseInitializationError, error); // Log the specific error too
            console.error("**********************************************************************************");
            app = null; // Ensure app is null on error
            authInstance = null; // Ensure auth is null on error
       }
   }
} else {
    console.warn("Firebase initialization skipped due to missing environment variables.");
    app = null; // Explicitly set app to null if initialization is skipped
}

// Export the potentially null auth instance. Consumers MUST check for null.
const auth = authInstance;
// const db = app ? getFirestore(app) : null; // Uncomment if using Firestore
// const storage = app ? getStorage(app) : null; // Uncomment if using Storage

// Export the error message so AuthProvider can potentially display it
export { app, auth, firebaseInitializationError };
