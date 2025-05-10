# EduNexus

This is a Next.js application, designed as a test preparation platform for MHT-CET, JEE, and NEET exams.
It uses local storage for authentication and `users.json` for user data persistence, suitable for local development and demonstration.

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
    *   Set `NEXT_PUBLIC_ADMIN_EMAIL` to the email address you want to use for admin access (e.g., `admin@edunexus.com`). This email will see the "Admin Panel" link in the sidebar after logging in.
    *   Set `ADMIN_PASSWORD` to a secure password for the default admin user (e.g., `Soham@1234`). This is used for the initial local admin setup.
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
5.  **Run the development server:**
    ```bash
    npm run dev
    ```
    **IMPORTANT:** You **MUST** restart the server after creating or modifying the `.env.local` file for the changes to take effect.
    The application will be available at `http://localhost:9002`.
6.  **(Optional) Run Genkit locally for AI development:**
    ```bash
    npm run genkit:watch
    ```
    This allows testing Genkit flows via the Genkit developer UI (usually at `http://localhost:4000`).
7.  **Access Admin Panel:** Log in using the email address set in `NEXT_PUBLIC_ADMIN_EMAIL` and the password set in `ADMIN_PASSWORD`. The "Admin Panel" link should appear in the sidebar.

## Deployment Notes (Netlify/Render)

*   **Node.js Version:** The project includes a `.nvmrc` file and `netlify.toml` specifies `NODE_VERSION = "20"`. This helps ensure Netlify uses a consistent and compatible Node.js version. Render typically respects `.nvmrc` or allows setting Node version in its dashboard.
*   **Go Version / `mise` errors:** If you encounter errors related to `mise` or Go during Netlify builds (e.g., "mise go@1.19 install"), it might be due to Netlify's build image auto-detecting Go. The included `.tool-versions` file, specifying `nodejs 20`, aims to prevent this by instructing `mise` (or `asdf`) to focus on Node.js. Ensure no other Go-specific files (like `go.mod`) are accidentally committed. If issues persist, check your Netlify site's build settings in the UI to ensure the build image is appropriate (e.g., a modern Ubuntu LTS) and that no conflicting language version environment variables (like `GO_VERSION`) are set.
*   **Environment Variables:** Ensure all necessary environment variables (especially `GOOGLE_GENAI_API_KEY`, `NEXT_PUBLIC_ADMIN_EMAIL`, `ADMIN_PASSWORD`, `TELEGRAM_BOT_TOKEN`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`, and the production `NEXT_PUBLIC_TELEGRAM_REDIRECT_URI`) are correctly configured in your Netlify/Render site settings.

## Troubleshooting

*   **Login/Signup not working**:
    *   Ensure your `.env.local` file is correctly configured with `NEXT_PUBLIC_ADMIN_EMAIL` and `ADMIN_PASSWORD`.
    *   **Restart your development server (`npm run dev`)** after making changes to the `.env.local` file.
    *   Check the browser console for any error messages related to local storage or `users.json` file access.
    *   The `src/data/users.json` file is created automatically on first run if it doesn't exist, containing the default admin user. Check its contents.
*   **Admin panel link missing:** Ensure you are logged in with the email specified in `NEXT_PUBLIC_ADMIN_EMAIL` in your `.env.local` file and that you **restarted the server** after setting it.

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
This application now uses a simulated authentication system relying on local browser storage and a `users.json` file on the server-side for demonstration. This approach is **not secure for production environments**. For a production application, use a robust authentication service like Firebase Authentication, Auth0, or NextAuth.js.
