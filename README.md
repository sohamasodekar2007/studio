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
    *   Enable **Firebase Authentication** (Email/Password provider).
    *   In your Firebase project settings, go to **Project settings** > **General**.
    *   Under **Your apps**, register a new Web app.
    *   Copy the `firebaseConfig` object values.
4.  **Set up Google AI:**
    *   Obtain an API key for the Gemini API from Google AI Studio: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
5.  **Configure Environment Variables:**
    *   Rename `.env.example` to `.env`.
    *   **CRITICAL: Fill in the Firebase configuration values** copied in step 3 into the `NEXT_PUBLIC_FIREBASE_*` variables in the `.env` file.
    *   **Ensure `NEXT_PUBLIC_FIREBASE_API_KEY` is correct.** An invalid or missing API key will cause `auth/invalid-api-key` errors and prevent login/signup.
    *   Fill in the Google AI API key into the `GOOGLE_GENAI_API_KEY` variable. This is required for AI features.
    *   Set `NEXT_PUBLIC_ADMIN_EMAIL` to the email address you want to use for admin access. This email will see the "Admin Panel" link in the sidebar.
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
*   `public/`: Static assets.
*   `src/app/globals.css`: Global CSS styles and ShadCN theme variables.
*   `.env`: Local environment variables (ignored by Git).
*   `.env.example`: Example environment variables file.

## Available Scripts

*   `npm run dev`: Starts the Next.js development server.
*   `npm run build`: Builds the application for production.
*   `npm run start`: Starts the production server.
*   `npm run lint`: Lints the codebase.
*   `npm run typecheck`: Runs TypeScript type checking.
*   `npm run genkit:dev`: Starts the Genkit development server.
*   `npm run genkit:watch`: Starts the Genkit development server with file watching.
