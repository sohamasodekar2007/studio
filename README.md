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
    *   Enable **Firebase Authentication** (Email/Password and Google providers). Go to Build > Authentication > Sign-in method and enable both.
    *   In your Firebase project settings, go to **Project settings** > **General**.
    *   Under **Your apps**, register a new Web app. If you don't have one, click "Add app" and select the Web icon (</>).
    *   Copy the `firebaseConfig` object values. You'll need `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, and `appId`.
4.  **Set up Google AI:**
    *   Obtain an API key for the Gemini API from Google AI Studio: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
5.  **Configure Environment Variables:**
    *   Rename `.env.example` to `.env` in the project root if it doesn't exist.
    *   **CRITICAL: Fill in ALL Firebase configuration values** copied in step 3 into the corresponding `NEXT_PUBLIC_FIREBASE_*` variables in the `.env` file.
    *   **DOUBLE-CHECK `NEXT_PUBLIC_FIREBASE_API_KEY`**. It must be correct and start with `AIza`.
    *   **Ensure ALL `NEXT_PUBLIC_FIREBASE_*` variables are filled.** Missing or incorrect keys are the **most common cause of setup problems** and will likely result in `auth/invalid-api-key` or `auth/configuration-not-found` errors, preventing login/signup and potentially breaking the app.
    *   Fill in the Google AI API key into the `GOOGLE_GENAI_API_KEY` variable. This is required for AI features.
    *   Set `NEXT_PUBLIC_ADMIN_EMAIL` to the email address you want to use for admin access (e.g., `admin@edunexus.com`). This email will see the "Admin Panel" link in the sidebar after logging in.
    *   Set `ADMIN_PASSWORD` to a secure password for the default admin user (e.g., `Soham@1234`).
6.  **Restart the development server:**
    ```bash
    npm run dev
    ```
    **IMPORTANT:** You **MUST** restart the server after creating or modifying the `.env` file for the changes to take effect. The application will be available at `http://localhost:9002`.
7.  **(Optional) Run Genkit locally for AI development:**
    ```bash
    npm run genkit:watch
    ```
    This allows testing Genkit flows via the Genkit developer UI (usually at `http://localhost:4000`).
8.  **Access Admin Panel:** Log in using the email address set in `NEXT_PUBLIC_ADMIN_EMAIL`. The "Admin Panel" link should appear in the sidebar.

## Troubleshooting

*   **`FirebaseError: Firebase: Error (auth/invalid-api-key).`** or **`FirebaseError: Firebase: Error (auth/configuration-not-found).`**: This is the **most frequent error** during setup. It means the Firebase SDK could not authenticate with your Firebase project.
    *   **Solution:**
        1.  **Verify `.env`**: Ensure the `.env` file exists in the project root (NOT `.env.example`).
        2.  **Check ALL Keys**: Double-check that **ALL** `NEXT_PUBLIC_FIREBASE_*` variables in `.env` exactly match the values from your Firebase project settings (Project Settings > General > Your Apps > Web App > Firebase SDK snippet > Config). Pay special attention to `NEXT_PUBLIC_FIREBASE_API_KEY`. Ensure there are no typos or extra spaces.
        3.  **Enable Auth Methods**: Go to your Firebase project > Build > Authentication > Sign-in method and ensure **Email/Password** and **Google** providers are **ENABLED**.
        4.  **Restart Server**: **CRITICAL** - Stop your development server (Ctrl+C in the terminal) and restart it using `npm run dev`. Environment variables are only loaded when the server starts.
*   **Login/Signup not working**: Often related to the errors above. Follow the `auth/invalid-api-key` troubleshooting steps.
*   **Application shows console errors about missing variables:** This confirms the `.env` file is not correctly configured or wasn't loaded. Follow the troubleshooting steps above, especially checking all keys and **restarting the server**.
*   **Admin panel link missing:** Ensure you are logged in with the email specified in `NEXT_PUBLIC_ADMIN_EMAIL` in your `.env` file and that you **restarted the server** after setting it.

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
*   `src/data/`: Contains local data files like `users.json`, `question_bank`, `test_pages`. **Note:** Local file storage is for demonstration/local development and is not scalable or secure for production. Use Firestore or another database for production.
*   `src/actions/`: Server Actions (e.g., `user-actions.ts`).
*   `public/`: Static assets (e.g., `question_bank_images`).
*   `src/app/globals.css`: Global CSS styles and ShadCN theme variables.
*   `.env`: Local environment variables (ignored by Git). **MUST BE CONFIGURED CORRECTLY & SERVER RESTARTED.**
*   `.env.example`: Example environment variables file.

## Available Scripts

*   `npm run dev`: Starts the Next.js development server.
*   `npm run build`: Builds the application for production.
*   `npm run start`: Starts the production server.
*   `npm run lint`: Lints the codebase.
*   `npm run typecheck`: Runs TypeScript type checking.
*   `npm run genkit:dev`: Starts the Genkit development server.
*   `npm run genkit:watch`: Starts the Genkit development server with file watching.
```