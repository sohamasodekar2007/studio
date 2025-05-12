// src/actions/otp-actions.ts
'use server';

// OTP generation and verification logic has been removed as per user's request
// to simplify to local storage authentication without OTP.

// --- Welcome Email Function (Simulation) ---
/**
 * Simulates sending a welcome email.
 * @param userEmail - The email address of the new user.
 * @param userName - The name of the new user.
 * @returns A promise resolving to true if "sent" successfully, false otherwise.
 */
export async function sendWelcomeEmail(userEmail: string, userName?: string | null): Promise<boolean> {
    if (!userEmail) {
        console.warn("sendWelcomeEmail: Missing userEmail.");
        return false;
    }
    const nameOrDefault = userName || 'User';
    console.log(`**********************************************************************`);
    // Updated brand name
    console.log(`SIMULATED WELCOME EMAIL (EduNexus):`);
    console.log(`To: ${userEmail}`);
    console.log(`Subject: Welcome to EduNexus, ${nameOrDefault}!`);
    console.log(`Body:`);
    console.log(`  Hello ${nameOrDefault},`);
    console.log(`  Thank you for registering with EduNexus! We are excited to have you on board.`);
    console.log(`  You can now log in to your account and start exploring our services, test series, and AI tools.`);
    console.log(`  Best regards,`);
    console.log(`  The EduNexus Team`);
    console.log(`(In a real application, this would be an actual email using a service like PHPMailer/Nodemailer)`);
    console.log(`**********************************************************************`);
    // Simulate success, in a real app, check the email sending result
    return true;
}

// Removed sendOTP and verifyOTP functions as they are no longer needed.
// export async function generateOtp(email: string): Promise<{ success: boolean; message: string; otp?: string }> { ... }
// export async function verifyOtp(email: string, otp: string): Promise<{ success: boolean; message: string }> { ... }
