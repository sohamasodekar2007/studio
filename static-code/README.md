# Static Code Version (PHP, HTML, CSS, JS)

This directory contains a conceptual static version of the EduNexus application, using PHP for simplified backend logic, and HTML, CSS, and JavaScript for the frontend.

**This is primarily a structural placeholder and a basic demonstration, NOT a fully functional or secure equivalent of the Next.js application.**

The PHP files include conceptual logic but require significant further development for full functionality. This includes, but is not limited to:
- Robust security measures (input sanitization, output encoding, CSRF protection, proper password hashing and verification for `users.json`).
- Complete implementation of all features present in the Next.js application (e.g., detailed test interface, DPPs, notebooks, AI features, real-time interactions, etc.).
- Proper session management and advanced authentication flows.

## Structure

- `/`: Root HTML/PHP files for main pages (e.g., `index.html`).
- `/auth/`: Authentication-related PHP files (e.g., `login.php`, `signup.php`).
- `/admin/`: Admin panel PHP files (e.g., `dashboard.php`, `users.php`).
- `/css/`: CSS stylesheets (e.g., `style.css`).
- `/js/`: JavaScript files (e.g., `script.js`).
- `/data/`: Intended location for JSON data files (e.g., `users.json`, test definitions). In a typical PHP setup, this directory would be on the server and not directly accessible via the web.
- `/images/`: Static images like logos.

## Purpose

This static version serves as a conceptual representation of how some backend logic (like user authentication or data retrieval from JSON files) might be handled in a traditional PHP environment, contrasting with the Next.js approach using Server Actions and API routes.

## Key Differences from Next.js Version:

- **Data Handling:** Uses direct PHP file I/O for `users.json` and other data, whereas the Next.js app uses Server Actions that abstract this.
- **Security:** The PHP scripts here are illustrative and **LACK PRODUCTION-LEVEL SECURITY**. The Next.js version, while also using local files, has a more structured approach to data actions which can be more easily secured.
- **Frontend:** Basic HTML and CSS, versus a rich React component-based UI in Next.js.
- **Real-time Features:** No real-time capabilities like those potentially achievable with WebSockets or server-sent events in a more advanced setup.
- **AI Integration:** Direct Genkit AI integration is not present. AI features would need to be simulated or use different backend mechanisms.
- **Scalability & Maintainability:** A PHP-based static file system approach is generally less scalable and harder to maintain for complex applications compared to a modern framework like Next.js.

This version is primarily for understanding fundamental web concepts and should not be considered a production-ready alternative to the Next.js application.
