// src/actions/otp-actions.ts
'use server';

// Removed OTP generation and verification logic as it's no longer used in signup.
// Kept the welcome email function as it's still called after signup.

// --- Welcome Email Function (Simulation) ---
/**
 * Simulates sending a welcome email.
 * @param userEmail - The email address of the new user.
 * @returns A promise resolving to true if "sent" successfully, false otherwise.
 */
export async function sendWelcomeEmail(userEmail: string): Promise<boolean> {
    if (!userEmail) {
        console.warn("sendWelcomeEmail: Missing userEmail.");
        return false;
    }
    console.log(`**********************************************************************`);
    // Updated brand name
    console.log(`SIMULATED WELCOME EMAIL (EduNexus):`);
    console.log(`To: ${userEmail}`);
    console.log(`Subject: Welcome to EduNexus!`);
    console.log(`Body: Thank you for registering... (Full HTML body would be here)`);
    console.log(`(In a real application, this would be an actual email)`);
    console.log(`**********************************************************************`);
    // Simulate success, in a real app, check the email sending result
    return true;
}