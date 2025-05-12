# Static Code Version (PHP, HTML, CSS, JS)

This directory is intended to house a static version of the EduNexus application, built using PHP for backend logic, and HTML, CSS, and JavaScript for the frontend.

**This is currently a structural placeholder and not a fully functional application.**
The PHP files include conceptual logic but require further development for full functionality, including security measures like input sanitization and proper password hashing for `users.json`.

## Structure

- `/`: Root HTML/PHP files for main pages (e.g., `index.html`).
- `/auth/`: Authentication-related PHP files (login, signup, logout).
- `/admin/`: Admin panel PHP files (dashboard, user management, test management).
- `/css/`: CSS stylesheets.
- `/js/`: JavaScript files.
- `/data/`: Intended location for JSON data files (e.g., `users.json`). **Note:** For a PHP application, this `data` directory would typically reside on the server, and PHP scripts would interact with it. It's placed here to mirror the Next.js structure conceptually.

## To-Do (Full Conversion)

A full conversion from the Next.js application to a static PHP/HTML/CSS/JS application is a significant undertaking. It would involve:

- Re-implementing all React components as static HTML templates, potentially using a PHP templating engine or including PHP snippets for dynamic parts.
- Re-writing all Next.js Server Actions and local data file interactions (from `src/actions` and `src/data` in the Next.js app) as PHP scripts that handle form submissions, file I/O for JSON data, etc.
- Managing sessions and authentication robustly using PHP `$_SESSION` and secure password practices.
- Implementing all features like test taking, DPPs, notebooks, friends system, leaderboard, referral system, challenge tests, and AI feature simulations (as direct Genkit integration isn't possible in plain PHP).
- Ensuring routing is handled correctly (e.g., via `.htaccess` if using Apache, or specific PHP routing logic).
- Applying appropriate security measures (input validation, output escaping, protection against common web vulnerabilities).
