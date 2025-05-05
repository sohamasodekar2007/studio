// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
// import { getFirestore } from "firebase/firestore"; // Uncomment if using Firestore
// import { getStorage } from "firebase/storage"; // Uncomment if using Storage

const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(
    "**********************************************************************************"
  );
  console.error(
    `CRITICAL FIREBASE CONFIG ERROR: The following environment variables are missing:`
  );
  missingEnvVars.forEach(varName => console.error(`- ${varName}`));
  console.error(
    "Please ensure you have a valid .env file with the correct Firebase configuration."
  );
   console.error(
    "Firebase features (including authentication) WILL FAIL until this is corrected."
  );
   console.error(
    "See README.md for setup instructions."
  );
  console.error(
    "**********************************************************************************"
  );
   // Prevent Firebase initialization if critical config is missing
   // throw new Error(`Missing Firebase config keys: ${missingEnvVars.join(', ')}. Check your .env file.`);
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

// Initialize Firebase
let app;
let authInstance = null; // Initialize authInstance to null

if (missingEnvVars.length === 0) { // Only initialize if config is present
    if (!getApps().length) {
        // CRITICAL CHECK: Ensure the API key is present and looks like a valid key.
        if (!firebaseConfig.apiKey || firebaseConfig.apiKey.length < 10) { // Basic length check
            console.error(
            "**********************************************************************************"
            );
            console.error(
            "CRITICAL FIREBASE CONFIG ERROR: NEXT_PUBLIC_FIREBASE_API_KEY is missing or invalid!"
            );
            console.error(
            "Expected format in .env: NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy..."
            );
            console.error(
            "**********************************************************************************"
            );
            // Don't initialize if API key is bad
        } else {
            try {
                app = initializeApp(firebaseConfig);
                authInstance = getAuth(app); // Get auth instance only after successful init
            } catch (error) {
                console.error("**********************************************************************************");
                console.error("FATAL ERROR DURING FIREBASE INITIALIZATION:", error);
                console.error("This likely means your Firebase config in .env is incorrect or incomplete.");
                 console.error("Check values for:", requiredEnvVars.join(', '));
                console.error("**********************************************************************************");
                // Rethrow or handle appropriately for your application lifecycle
                // throw error; // Consider re-throwing in production or specific scenarios
            }
        }
    } else {
        app = getApp();
        authInstance = getAuth(app); // Get auth instance for existing app
    }
} else {
    console.warn("Firebase initialization skipped due to missing environment variables.");
     app = null; // Explicitly set app to null if initialization is skipped
}


// Export the potentially null auth instance. Consumers must check for null.
const auth = authInstance;
// const db = app ? getFirestore(app) : null; // Uncomment if using Firestore
// const storage = app ? getStorage(app) : null; // Uncomment if using Storage

export { app, auth /*, db, storage */ }; // Export db and storage if needed
