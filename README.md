# ExamPrep Hub

This is a Next.js application, designed as a test preparation platform for MHT-CET, JEE, and NEET exams.
It uses local storage for authentication and `users.json` for user data persistence, suitable for local development and demonstration.

## Features

*   Browse Test Series (MHT-CET, JEE Main, JEE Advanced, NEET) with filtering
*   User Authentication (Sign up / Login) using Local Storage and `users.json`
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
3.  **Set up Google AI:**
    *   Obtain an API key for the Gemini API from Google AI Studio: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
4.  **Configure Environment Variables:**
    *   **CRITICAL:** Create a file named `.env` in the project root (if it doesn't exist). Do NOT use `.env.example`.
    *   Fill in the Google AI API key into the `GOOGLE_GENAI_API_KEY` variable. This is required for AI features.
    *   Set `NEXT_PUBLIC_ADMIN_EMAIL` to the email address you want to use for admin access (e.g., `admin@edunexus.com`). This email will see the "Admin Panel" link in the sidebar after logging in.
    *   Set `ADMIN_PASSWORD` to a secure password for the default admin user (e.g., `Soham@1234`). This is used for the initial local admin setup.
    *   **Example `.env` content:**
        ```
        GOOGLE_GENAI_API_KEY=YOUR_GOOGLE_GENAI_API_KEY_HERE
        NEXT_PUBLIC_ADMIN_EMAIL=admin@edunexus.com
        ADMIN_PASSWORD=Soham@1234
        ```
5.  **Run the development server:**
    ```bash
    npm run dev
    ```
    **IMPORTANT:** You **MUST** restart the server after creating or modifying the `.env` file for the changes to take effect.
    The application will be available at `http://localhost:9002`.
6.  **(Optional) Run Genkit locally for AI development:**
    ```bash
    npm run genkit:watch
    ```
    This allows testing Genkit flows via the Genkit developer UI (usually at `http://localhost:4000`).
7.  **Access Admin Panel:** Log in using the email address set in `NEXT_PUBLIC_ADMIN_EMAIL` and the password set in `ADMIN_PASSWORD`. The "Admin Panel" link should appear in the sidebar.

## Troubleshooting

*   **Login/Signup not working**:
    *   Ensure your `.env` file is correctly configured with `NEXT_PUBLIC_ADMIN_EMAIL` and `ADMIN_PASSWORD`.
    *   **Restart your development server (`npm run dev`)** after making changes to the `.env` file.
    *   Check the browser console for any error messages related to local storage or `users.json` file access.
    *   The `src/data/users.json` file is created automatically on first run if it doesn't exist, containing the default admin user. Check its contents.
*   **Admin panel link missing:** Ensure you are logged in with the email specified in `NEXT_PUBLIC_ADMIN_EMAIL` in your `.env` file and that you **restarted the server** after setting it.

## Project Structure

*   `src/app/`: Next.js App Router pages and layouts.
*   `src/app/admin/`: Pages specific to the admin panel.
*   `src/components/`: Reusable React components (UI elements, layout).
*   `src/components/admin/`: Components specific to the admin panel.
*   `src/components/ui/`: ShadCN UI components.
*   `src/lib/`: Utility functions, local auth configuration (`utils.ts`).
*   `src/context/`: React context providers (e.g., `auth-context.tsx`).
*   `src/hooks/`: Custom React hooks (`use-toast.ts`, `use-mobile.ts`).
*   `src/ai/`: Genkit AI flows and configuration (`ai-instance.ts`, `dev.ts`, `flows/`).
*   `src/types/`: TypeScript type definitions (`index.ts`).
*   `src/data/`: Contains local data files like `users.json`, `question_bank`, `test_pages`. **Note:** Local file storage is for demonstration/local development and is not scalable or secure for production.
*   `src/actions/`: Server Actions (e.g., `user-actions.ts`, `auth-actions.ts`).
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

**Important Note on Local Storage Authentication:**
This application now uses a simulated authentication system relying on local browser storage and a `users.json` file on the server-side for demonstration. This approach is **not secure for production environments**. For a production application, use a robust authentication service like Firebase Authentication, Auth0, or NextAuth.js.
