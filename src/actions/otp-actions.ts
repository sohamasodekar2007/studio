'use server';

// In-memory OTP cache (NOT SUITABLE FOR PRODUCTION - use a database or persistent cache)
const otpCache: Record<string, { otp: string; expiresAt: number }> = {};

const OTP_EXPIRY_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

/**
 * Generates a 6-digit OTP, "sends" it (logs to console), and stores it with an expiry.
 * @param email - The email address to associate with the OTP.
 * @returns A promise resolving to an object with success status and a message.
 */
export async function generateOtp(email: string): Promise<{ success: boolean; message: string }> {
  if (!email) {
    return { success: false, message: "Email address is required to send OTP." };
  }

  // Basic email validation on server-side as well
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, message: "Invalid email format provided." };
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Generate 6-digit OTP
  const expiresAt = Date.now() + OTP_EXPIRY_DURATION;

  otpCache[email] = { otp, expiresAt };

  console.log(`**********************************************************************`);
  console.log(`SIMULATED OTP SERVICE:`);
  console.log(`OTP for ${email}: ${otp}`);
  console.log(`Expires at: ${new Date(expiresAt).toLocaleString()}`);
  console.log(`(In a real application, this OTP would be sent via email/SMS)`);
  console.log(`**********************************************************************`);

  // In a real application, you would use an email service (like Nodemailer with an SMTP provider) here.
  // Example: await sendEmail(email, `Your OTP is: ${otp}`);

  return { success: true, message: "OTP sent to your email (simulated)." };
}

/**
 * Verifies the provided OTP against the stored OTP for the given email.
 * @param email - The email address associated with the OTP.
 * @param otpAttempt - The OTP entered by the user.
 * @returns A promise resolving to an object with success status and a message.
 */
export async function verifyOtp(email: string, otpAttempt: string): Promise<{ success: boolean; message: string }> {
  if (!email || !otpAttempt) {
    return { success: false, message: "Email and OTP are required for verification." };
  }

  // Validate OTP format
  if (!/^\d{6}$/.test(otpAttempt)) {
      return { success: false, message: "Invalid OTP format. Must be 6 digits." };
  }

  const cachedOtpData = otpCache[email];

  if (!cachedOtpData) {
    return { success: false, message: "OTP not found or not requested for this email." };
  }

  if (Date.now() > cachedOtpData.expiresAt) {
    delete otpCache[email]; // Clean up expired OTP
    return { success: false, message: "OTP has expired. Please request a new one." };
  }

  if (cachedOtpData.otp === otpAttempt) {
    delete otpCache[email]; // OTP used, remove it
    return { success: true, message: "OTP verified successfully!" };
  } else {
    return { success: false, message: "Invalid OTP. Please try again." };
  }
}

// --- Welcome Email Function (Simulation) ---
/**
 * Simulates sending a welcome email.
 * @param userEmail - The email address of the new user.
 * @returns A promise resolving to true if "sent" successfully, false otherwise.
 */
export async function sendWelcomeEmail(userEmail: string): Promise<boolean> {
    console.log(`**********************************************************************`);
    console.log(`SIMULATED WELCOME EMAIL:`);
    console.log(`To: ${userEmail}`);
    console.log(`Subject: Welcome to STUDY SPHERE!`);
    console.log(`Body: Thank you for registering... (Full HTML body would be here)`);
    console.log(`(In a real application, this would be an actual email)`);
    console.log(`**********************************************************************`);
    return true; // Simulate success
}
