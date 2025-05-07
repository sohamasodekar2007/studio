# ExamPrep Hub

This is a Next.js application built with Firebase Studio, designed as a test preparation platform for MHT-CET, JEE, and NEET exams.

## Features

*   Browse Test Series (MHT-CET, JEE Main, JEE Advanced, NEET) with filtering
*   User Authentication (Sign up / Login) using Firebase Authentication
*   User Profile Settings (Name, Password)
*   Help & Support Section
*   Privacy Policy & Terms of Service Pages
*   AI-Powered Study Tips (using Genkit)
*   Admin Panel (Dashboard, User Management, Test Management, Settings)

## Getting Started

1.  **Clone the repository.**
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Set up Firebase:**
    *   Create a Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/).
    *   Enable **Firebase Authentication** (Email/Password and Google providers).
    *   In your Firebase project settings, go to **Project settings** > **General**.
    *   Under **Your apps**, register a new Web app.
    *   Copy the `firebaseConfig` object values.
4.  **Set up Google AI:**
    *   Obtain an API key for the Gemini API from Google AI Studio: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
5.  **Configure Environment Variables:**
    *   Rename `.env.example` to `.env` if it doesn't exist.
    *   **CRITICAL: Fill in ALL Firebase configuration values** copied in step 3 into the corresponding `NEXT_PUBLIC_FIREBASE_*` variables in the `.env` file.
    *   **Ensure `NEXT_PUBLIC_FIREBASE_API_KEY` is correct.** An invalid or missing API key (or other missing `NEXT_PUBLIC_FIREBASE_*` variables) is the most common cause of setup problems and will likely result in `auth/invalid-api-key` errors, preventing login/signup. The application might show warnings or fail to load authentication features if these keys are missing or incorrect. The application might show warnings or fail to load authentication features if these keys are missing or incorrect.
    *   Fill in the Google AI API key into the `GOOGLE_GENAI_API_KEY` variable. This is required for AI features.
    *   Set `NEXT_PUBLIC_ADMIN_EMAIL` to the email address you want to use for admin access (e.g., `admin@edunexus.com`). This email will see the "Admin Panel" link in the sidebar after logging in.
    *   Set `ADMIN_PASSWORD` to a secure password for the default admin user.
6.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:9002`.
7.  **(Optional) Run Genkit locally for AI development:**
    ```bash
    npm run genkit:watch
    ```
    This allows testing Genkit flows via the Genkit developer UI (usually at `http://localhost:4000`).
8.  **Access Admin Panel:** Log in using the email address set in `NEXT_PUBLIC_ADMIN_EMAIL`. The "Admin Panel" link should appear in the sidebar.

## Troubleshooting

*   **`FirebaseError: Firebase: Error (auth/invalid-api-key).`**: This is the most common error during setup. It means the Firebase SDK could not authenticate with your Firebase project.
    *   **Solution:** Double-check that **ALL** `NEXT_PUBLIC_FIREBASE_*` variables in your `.env` file exactly match the values from your Firebase project settings (Project Settings > General > Your Apps > Web App > Firebase SDK snippet > Config). Pay special attention to `NEXT_PUBLIC_FIREBASE_API_KEY`. Ensure there are no typos or extra spaces.
    *   Make sure you have saved the `.env` file (not `.env.example`).
    *   **Restart your development server (`npm run dev`)** after making changes to the `.env` file. Environment variables are typically loaded only at server start.
*   **Login/Signup not working**: Often related to the `auth/invalid-api-key` error above. Ensure Firebase Authentication (Email/Password and Google providers) are enabled in your Firebase project console (Build > Authentication > Sign-in method).
*   **Application shows errors related to missing variables:** Ensure all `NEXT_PUBLIC_FIREBASE_*` variables are present and correctly formatted in your `.env` file.

## Project Structure

*   `src/app/`: Next.js App Router pages and layouts.
*   `src/app/admin/`: Pages specific to the admin panel.
*   `src/components/`: Reusable React components (UI elements, layout).
*   `src/components/admin/`: Components specific to the admin panel.
*   `src/components/ui/`: ShadCN UI components.
*   `src/lib/`: Utility functions, Firebase configuration (`firebase.ts`), common types (`utils.ts`).
*   `src/context/`: React context providers (e.g., `auth-context.tsx`).
*   `src/hooks/`: Custom React hooks (`use-toast.ts`, `use-mobile.ts`).
*   `src/ai/`: Genkit AI flows and configuration (`ai-instance.ts`, `dev.ts`, `flows/`).
*   `src/types/`: TypeScript type definitions (`index.ts`).
*   `src/data/`: Contains local data files like `users.json`. **Note:** `users.json` is used for demonstration and is not a secure or scalable way to store user data in production. Use Firestore instead.
*   `src/actions/`: Server Actions (e.g., `user-actions.ts`).
*   `public/`: Static assets.
*   `src/app/globals.css`: Global CSS styles and ShadCN theme variables.
*   `.env`: Local environment variables (ignored by Git). **MUST BE CONFIGURED CORRECTLY.**
*   `.env.example`: Example environment variables file.

## Available Scripts

*   `npm run dev`: Starts the Next.js development server.
*   `npm run build`: Builds the application for production.
*   `npm run start`: Starts the production server.
*   `npm run lint`: Lints the codebase.
*   `npm run typecheck`: Runs TypeScript type checking.
*   `npm run genkit:dev`: Starts the Genkit development server.
*   `npm run genkit:watch`: Starts the Genkit development server with file watching.
