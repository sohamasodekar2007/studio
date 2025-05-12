# EduNexus

This is a Next.js application, designed as a test preparation platform for MHT-CET, JEE, and NEET exams.
It uses local storage for client-side session persistence and a `users.json` file in `src/data` for user data persistence, suitable for local development and demonstration. **For deployment to platforms like Netlify or Render, this `src/data/users.json` file (including at least the default admin user) MUST be committed to your repository and included in the build.**

## Features

*   Browse Test Series (MHT-CET, JEE Main, JEE Advanced, NEET) with filtering
*   User Authentication (Sign up / Login) using Local Storage and `users.json`
*   User Profile Settings (Name, Password, Avatar)
*   Help & Support Section
*   Privacy Policy & Terms of Service Pages
*   AI-Powered Doubt Solving (using Genkit) - Premium Feature
*   Admin Panel (Dashboard, User Management, Test Management, Settings)
*   Daily Practice Problems (DPP) with progress tracking
*   PYQ DPPs with tiered access:
    *   **Free Users**: Access PYQs from the previous calendar year.
    *   **Premium Users** (e.g., "Combo" plan or any non-"free" plan): Access all available PYQs, including the latest year.
    *   Content for inaccessible years is indicated, with prompts to upgrade for full access.
*   Notebooks for bookmarking questions
*   Leaderboard based on points from tests and DPPs
*   Friend system (Follow/Unfollow, View Following/Followers)
*   Performance Comparison with Friends
*   Challenge Tests: Create and participate in timed challenges with friends.
*   Real-time notifications for challenge invites (using browser notifications if permission granted).
*   User Referral System: Users get unique referral codes; stats on referrals are tracked.

## Getting Started

1.  **Clone the repository.**
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Set up Google AI (for AI features):**
    *   Obtain an API key for the Gemini API from Google AI Studio: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
4.  **Configure Environment Variables:**
    *   **CRITICAL:** Create a file named `.env.local` in the project root (if it doesn't exist). Do NOT use `.env.example` or just `.env` for Next.js public variables.
    *   Fill in the Google AI API key into the `GOOGLE_GENAI_API_KEY` variable. This is required for AI features.
    *   Set `NEXT_PUBLIC_ADMIN_EMAIL` to the email address you want to use for admin access (e.g., `admin@edunexus.com`). This email will see the "Admin Panel" link in the sidebar after logging in. **This MUST match the email of the primary admin in `src/data/users.json`.**
    *   Set `ADMIN_PASSWORD` to a secure password for the default admin user (e.g., `Soham@1234`). This is used for the initial local admin setup in `users.json`. **This password will be hashed and stored in `users.json` on first run if the file is initialized.**
    *   Set `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` and `TELEGRAM_BOT_TOKEN` if using Telegram login.
    *   Set `NEXT_PUBLIC_TELEGRAM_REDIRECT_URI` for Telegram login callback.
    *   **Example `.env.local` content:**
        ```
        GOOGLE_GENAI_API_KEY=YOUR_GOOGLE_GENAI_API_KEY_HERE
        NEXT_PUBLIC_ADMIN_EMAIL=admin@edunexus.com
        ADMIN_PASSWORD=Soham@1234
        NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=YourTelegramBotUsername # Replace with your bot's username
        NEXT_PUBLIC_TELEGRAM_REDIRECT_URI=http://localhost:9002/auth/telegram/callback # For local dev
        # For production on Netlify/Render, update NEXT_PUBLIC_TELEGRAM_REDIRECT_URI to your deployed site's callback URL
        TELEGRAM_BOT_TOKEN=YourTelegramBotToken # Server-side, keep out of NEXT_PUBLIC_
        ```
5.  **Verify/Create `src/data/users.json`:**
    *   **CRITICAL FOR LOCAL DEV & DEPLOYMENT:** Ensure a file named `users.json` exists in the `src/data/` directory.
    *   If it doesn't exist for local development, the application will attempt to create it on first run with a default admin user configured using `NEXT_PUBLIC_ADMIN_EMAIL` and `ADMIN_PASSWORD` from your `.env.local` file.
    *   **For Netlify/Render deployment, this `users.json` file (with at least the default admin user) MUST be committed to your repository.** Serverless environments usually have read-only or ephemeral file systems, so the application cannot create/reliably write to this file at runtime.
    *   **Example `src/data/users.json` content (ensure email matches `NEXT_PUBLIC_ADMIN_EMAIL`):**
        ```json
        [
          {
            "id": "admin-uuid-placeholder", // Will be auto-generated if app creates it
            "email": "admin@edunexus.com",
            "password": "hashed_password_placeholder", // Will be auto-hashed by the app
            "name": "Admin User (Primary)",
            "phone": "0000000000",
            "class": "Dropper",
            "model": "combo",
            "role": "Admin",
            "expiry_date": "2099-12-31T00:00:00.000Z",
            "createdAt": "2023-01-01T00:00:00.000Z", // Example date
            "avatarUrl": null,
            "totalPoints": 0,
            "targetYear": null,
            "telegramId": null,
            "telegramUsername": null,
            "referralCode": "NEXUS-ADMIN", // Example
            "referredByCode": null,
            "referralStats": { "referred_free": 0, "referred_chapterwise": 0, "referred_full_length": 0, "referred_combo": 0 }
          }
        ]
        ```
        *(Note: `id`, `password` (hashed), `createdAt`, and `referralCode` will be auto-generated/updated by the application if it initializes the file. For deployment, ensure this file exists with the correct admin email.)*

6.  **Run the development server:**
    ```bash
    npm run dev
    ```
    **IMPORTANT:** You **MUST** restart the server after creating or modifying the `.env.local` file or `users.json` for the changes to take effect.
    The application will be available at `http://localhost:9002`.
7.  **(Optional) Run Genkit locally for AI development:**
    ```bash
    npm run genkit:watch
    ```
    This allows testing Genkit flows via the Genkit developer UI (usually at `http://localhost:4000`).
8.  **Access Admin Panel:** Log in using the email address set in `NEXT_PUBLIC_ADMIN_EMAIL` and the password set in `ADMIN_PASSWORD` (or the one you set in `users.json`). The "Admin Panel" link should appear in the sidebar.

## Deployment Notes (Netlify/Render)

*   **`src/data/users.json`:** As mentioned above, this file **must be committed to your repository** and included in your build for authentication to work on Netlify/Render. The platform cannot reliably create or write to this file at runtime in a serverless environment.
*   **Node.js Version:** The project includes a `.nvmrc` file and `netlify.toml` specifies `NODE_VERSION = "20"`. This helps ensure Netlify uses a consistent and compatible Node.js version. Render typically respects `.nvmrc` or allows setting Node version in its dashboard.
*   **Go Version / `mise` errors:** If you encounter errors related to `mise` or Go during Netlify builds (e.g., "mise go@1.19 install"), it might be due to Netlify's build image auto-detecting Go. The included `.tool-versions` file, specifying `nodejs 20`, aims to prevent this by instructing `mise` (or `asdf`) to focus on Node.js. Ensure no other Go-specific files (like `go.mod`) are accidentally committed. If issues persist, check your Netlify site's build settings in the UI to ensure the build image is appropriate (e.g., a modern Ubuntu LTS) and that no conflicting language version environment variables (like `GO_VERSION`) are set.
*   **Environment Variables:** Ensure all necessary environment variables (especially `GOOGLE_GENAI_API_KEY`, `NEXT_PUBLIC_ADMIN_EMAIL`, `ADMIN_PASSWORD`, `TELEGRAM_BOT_TOKEN`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`, and the production `NEXT_PUBLIC_TELEGRAM_REDIRECT_URI`) are correctly configured in your Netlify/Render site settings.

## Troubleshooting

*   **Login/Signup not working (especially on deployed site):**
    *   **CRITICAL FOR DEPLOYMENT:** Verify that `src/data/users.json` (with the admin user) is present in your deployed files.
    *   Ensure your `.env.local` file is correctly configured locally with `NEXT_PUBLIC_ADMIN_EMAIL` and `ADMIN_PASSWORD`.
    *   Ensure environment variables are correctly set in your Netlify/Render dashboard.
    *   **Restart your development server (`npm run dev`)** after making changes to `.env.local` or `users.json`.
    *   Check the browser console for any error messages related to local storage or `users.json` file access.
    *   The `src/data/users.json` file is created automatically on first local run if it doesn't exist, containing the default admin user. Check its contents.
*   **Admin panel link missing:** Ensure you are logged in with the email specified in `NEXT_PUBLIC_ADMIN_EMAIL` (which must match the admin in `users.json`) and that you **restarted the server** after setting it (for local dev).
*   **Application Initialization Error on Netlify/Render:** This usually means `src/data/users.json` was not found or is inaccessible. Ensure it's committed and deployed. Check Netlify/Render function logs for more specific errors.

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
*   `src/data/`: Contains local data files like `users.json`, `question_bank`, `test_pages`. **Note:** Local file storage for `users.json` requires the file to be present in the deployment for platforms like Netlify/Render. Other data here is primarily for local dev or read-only purposes if deployed.
*   `src/actions/`: Server Actions (e.g., `user-actions.ts`, `auth-actions.ts`).
*   `public/`: Static assets (e.g., `question_bank_images`, `avatars`, logos).
*   `src/app/globals.css`: Global CSS styles and ShadCN theme variables.
*   `.env.local`: Local environment variables (ignored by Git). **MUST BE CONFIGURED CORRECTLY & SERVER RESTARTED.**
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
This application now uses a simulated authentication system relying on local browser storage and a `users.json` file on the server-side for demonstration. This approach is **not secure for production environments and has limitations on serverless platforms like Netlify/Render if `users.json` is not part of the deployment.** For a production application, use a robust authentication service or a database.
```