
// src/actions/user-actions.ts
'use server';

import type { UserProfile, AcademicStatus, UserModel, ContextUser, UserReferralStats } from '@/types';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import crypto from 'crypto'; 

const SALT_ROUNDS = 10;
const dataBasePath = path.join(process.cwd(), 'src', 'data');
const usersFilePath = path.join(dataBasePath, 'users.json');
const publicAvatarsPath = path.join(process.cwd(), 'public', 'avatars');

const primaryAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@edunexus.com';
const adminEmailPattern = /^[a-zA-Z0-9._%+-]+-admin@edunexus\.com$/;
const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'Soham@1234';


async function ensureDirExists(dirPath: string): Promise<boolean> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    console.log(`Directory ensured: ${dirPath}`);
    return true;
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      // For serverless, we might not be able to create it, so don't throw, let it try to read.
      // If read fails, it's another issue.
      if ((process.env.NETLIFY || process.env.VERCEL) && (dirPath === dataBasePath || dirPath === path.dirname(usersFilePath) || dirPath === publicAvatarsPath) ) {
        console.warn(`Warning: Could not create directory ${dirPath} (likely serverless environment). Feature relying on this path might fail if directory/file doesn't pre-exist.`);
        return false; 
      }
      console.error(`Error creating directory ${dirPath}:`, error);
      // Only throw if it's a critical data directory and not a known serverless write restriction.
      if (dirPath === dataBasePath || dirPath === path.dirname(usersFilePath)) {
           throw new Error(`Failed to create critical data directory: ${dirPath}. Reason: ${error.message}. Check permissions or if the path is valid.`);
      }
      return false;
    }
    console.log(`Directory already exists: ${dirPath}`);
    return true; 
  }
}


async function writeUsersToFile(users: UserProfile[]): Promise<boolean> {
  try {
    if (!await ensureDirExists(path.dirname(usersFilePath))) { // path.dirname(usersFilePath) is src/data
        console.error(`Failed to ensure users directory exists: ${path.dirname(usersFilePath)}`);
        // If not serverless, this is a critical failure.
        if (!(process.env.NETLIFY || process.env.VERCEL)) {
            throw new Error('Fatal: Cannot create directory for users.json.');
        }
        return false; // Indicate failure for serverless if dir cannot be ensured
    }
    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');
    console.log("writeUsersToFile: users.json written successfully.");
    return true;
  } catch (error) {
    console.error('Failed to write users.json:', error);
    return false;
  }
}
// Export for potential internal use if needed, but prefer specific actions.
export { writeUsersToFile as internalWriteUsers };


const getRoleFromEmail = (email: string | null): 'Admin' | 'User' => {
    if (!email) return 'User';
    const emailLower = email.toLowerCase();
    return emailLower === primaryAdminEmail.toLowerCase() || adminEmailPattern.test(emailLower) ? 'Admin' : 'User';
};

function generateReferralCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) { 
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return `NEXUS-${result}`;
}

async function internalReadUsersWithPasswords(): Promise<UserProfile[]> {
    console.log("internalReadUsersWithPasswords: Attempting to read/initialize users.json...");
    let users: UserProfile[] = [];
    let writeNeeded = false;

    try { 
        console.log("internalReadUsersWithPasswords: Ensuring data base path exists:", dataBasePath);
        // Ensure the base data directory exists. If this fails, it's a critical issue.
        if (!await ensureDirExists(dataBasePath)) {
            // This means src/data could not be created/ensured. Critical for local.
            // For serverless, this might be okay if users.json is bundled.
            if (!(process.env.NETLIFY || process.env.VERCEL)) {
                 throw new Error(`Critical: Data directory ${dataBasePath} could not be ensured.`);
            }
            console.warn(`internalReadUsersWithPasswords: Data directory ${dataBasePath} could not be ensured (serverless context). Attempting to proceed.`);
        }
        
        // Ensure public/avatars directory exists or can be created (less critical for read, important for writes)
        const avatarsPathExistsOrCreatable = await ensureDirExists(publicAvatarsPath);
        if (!avatarsPathExistsOrCreatable) {
            console.warn("internalReadUsersWithPasswords: Public avatars directory could not be ensured.");
        }

        try {
            // Try to access, then read. access throws ENOENT if not found.
            await fs.access(usersFilePath); 
            const fileContent = await fs.readFile(usersFilePath, 'utf-8');
            console.log("internalReadUsersWithPasswords: users.json found and read.");
            
            if (fileContent.trim() === '') {
                console.warn("internalReadUsersWithPasswords: users.json is empty. Initializing.");
                users = []; // Start with an empty array
                writeNeeded = true;
            } else {
                const parsedUsers = JSON.parse(fileContent);
                if (!Array.isArray(parsedUsers)) {
                    console.warn("internalReadUsersWithPasswords: users.json content is not an array. Initializing.");
                    users = [];
                    writeNeeded = true;
                } else {
                    users = parsedUsers as UserProfile[];
                }
            }
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                console.log("internalReadUsersWithPasswords: users.json not found. Initializing with default admin.");
                users = []; // Start with an empty array
                writeNeeded = true;
            } else {
                // For other errors (e.g., permission issues on read, or JSON parse error for corrupted file)
                console.error("internalReadUsersWithPasswords: Error reading or parsing users.json. Attempting to re-initialize.", error.message);
                users = []; // Reset to empty and attempt to rebuild
                writeNeeded = true;
            }
        }

        // Process users: ensure essential fields, hash passwords, set defaults
        const processedUsers: UserProfile[] = [];
        for (const u of users) {
            if (typeof u !== 'object' || u === null || (typeof u.id !== 'string' && typeof u.id !== 'number')) {
                console.warn("internalReadUsersWithPasswords: Skipping invalid user entry:", u);
                writeNeeded = true;
                continue;
            }

            let currentUser = { ...u }; // Create a mutable copy
            let userModified = false;

            // Ensure ID and convert number IDs to string
            if (!currentUser.id) { currentUser.id = uuidv4(); userModified = true; }
            else if (typeof currentUser.id === 'number') { currentUser.id = String(currentUser.id); userModified = true; }

            // Derive role from email, correct if necessary
            const derivedRole = getRoleFromEmail(currentUser.email);
            if (currentUser.role === undefined || currentUser.role !== derivedRole) {
                currentUser.role = derivedRole; userModified = true;
            }
            
            // Hash passwords if not already hashed or if password is missing
            if (currentUser.password && !currentUser.password.startsWith('$2a$') && !currentUser.password.startsWith('$2b$')) {
                try { currentUser.password = await bcrypt.hash(currentUser.password, SALT_ROUNDS); userModified = true; }
                catch (hashError) { console.error(`internalReadUsersWithPasswords: Failed to hash password for user ${currentUser.email || currentUser.id}:`, hashError); /* Potentially skip user or use placeholder? */ }
            } else if (!currentUser.password) { // If password field is missing or falsy
                try {
                    const randomPassword = Math.random().toString(36).slice(-8); // Generate a random password
                    currentUser.password = await bcrypt.hash(randomPassword, SALT_ROUNDS); userModified = true;
                    console.warn(`internalReadUsersWithPasswords: Generated temporary password for user ${currentUser.email || currentUser.id}.`);
                } catch (hashError) { console.error(`internalReadUsersWithPasswords: CRITICAL - Failed to hash temporary password for ${currentUser.email || currentUser.id}`, hashError); }
            }
            
            // Date fields validation/conversion
            if (currentUser.expiry_date && !(typeof currentUser.expiry_date === 'string' && !isNaN(Date.parse(currentUser.expiry_date)))) {
                try { currentUser.expiry_date = new Date(currentUser.expiry_date).toISOString(); userModified = true; }
                catch { currentUser.expiry_date = null; userModified = true; }
            }
            if (currentUser.createdAt && !(typeof currentUser.createdAt === 'string' && !isNaN(Date.parse(currentUser.createdAt)))) {
                try { currentUser.createdAt = new Date(currentUser.createdAt).toISOString(); userModified = true; }
                catch { currentUser.createdAt = new Date().toISOString(); userModified = true;}
            } else if (!currentUser.createdAt) { currentUser.createdAt = new Date().toISOString(); userModified = true; }

            // Model and Expiry based on Role
            if (currentUser.role === 'Admin') {
                if (currentUser.model !== 'combo') { currentUser.model = 'combo'; userModified = true; }
                const adminExpiry = '2099-12-31T00:00:00.000Z';
                if (currentUser.expiry_date !== adminExpiry) { currentUser.expiry_date = adminExpiry; userModified = true; }
            } else { // For 'User' role
                if (!currentUser.model || !['free', 'chapterwise', 'full_length', 'combo'].includes(currentUser.model)) {
                    currentUser.model = 'free'; userModified = true;
                }
                if (currentUser.model === 'free' && currentUser.expiry_date !== null) {
                    currentUser.expiry_date = null; userModified = true;
                }
            }
            
            // Ensure other optional fields have defaults
            if (currentUser.avatarUrl === undefined) { currentUser.avatarUrl = null; userModified = true; }
            if (currentUser.class === undefined) { currentUser.class = null; userModified = true; }
            if (currentUser.phone === undefined) { currentUser.phone = null; userModified = true; }
            if (currentUser.totalPoints === undefined) { currentUser.totalPoints = 0; userModified = true; }
            if (currentUser.targetYear === undefined) { currentUser.targetYear = null; userModified = true; }
            if (currentUser.telegramId === undefined) { currentUser.telegramId = null; userModified = true; }
            if (currentUser.telegramUsername === undefined) { currentUser.telegramUsername = null; userModified = true; }
            if (currentUser.referralCode === undefined) { currentUser.referralCode = generateReferralCode(); userModified = true; }
            if (currentUser.referredByCode === undefined) { currentUser.referredByCode = null; userModified = true;}
            if (currentUser.referralStats === undefined) {
                currentUser.referralStats = { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 };
                userModified = true;
            }

            processedUsers.push(currentUser);
            if (userModified) writeNeeded = true;
        }
        users = processedUsers; // Use the fully processed list

        // Ensure primary admin exists and is correct
        const primaryAdminEffectiveEmail = primaryAdminEmail.toLowerCase();
        let adminUserIndex = users.findIndex(u => u.email?.toLowerCase() === primaryAdminEffectiveEmail);
        let adminPasswordHash = adminUserIndex !== -1 ? users[adminUserIndex].password : undefined;

        // Validate or (re)hash admin password if ADMIN_PASSWORD env var is set
        if (!adminPasswordHash || typeof adminPasswordHash !== 'string' || (!adminPasswordHash.startsWith('$2a$') && !adminPasswordHash.startsWith('$2b$'))) {
            try { adminPasswordHash = await bcrypt.hash(defaultAdminPassword, SALT_ROUNDS); writeNeeded = true; }
            catch (hashError) { console.error("internalReadUsersWithPasswords: CRITICAL - Failed to hash default admin password:", hashError); adminPasswordHash = defaultAdminPassword; /* fallback to plain, not ideal */ }
        } else if (defaultAdminPassword) { // If ADMIN_PASSWORD is set, ensure current hash matches it
             try {
                const passwordMatch = await bcrypt.compare(defaultAdminPassword, adminPasswordHash);
                if (!passwordMatch) {
                    adminPasswordHash = await bcrypt.hash(defaultAdminPassword, SALT_ROUNDS);
                    console.log("internalReadUsersWithPasswords: Admin password updated to match ADMIN_PASSWORD environment variable.");
                    writeNeeded = true;
                }
            } catch (compareError) { console.error("internalReadUsersWithPasswords: Error comparing admin password hash:", compareError); }
        }


        if (adminUserIndex !== -1) {
            // Update existing admin
            const currentAdmin = users[adminUserIndex];
            let adminModified = false;
            if (currentAdmin.password !== adminPasswordHash && adminPasswordHash) { currentAdmin.password = adminPasswordHash; adminModified = true; }
            if (currentAdmin.role !== 'Admin') { currentAdmin.role = 'Admin'; adminModified = true; }
            if (currentAdmin.model !== 'combo') { currentAdmin.model = 'combo'; adminModified = true; }
            if (currentAdmin.expiry_date !== '2099-12-31T00:00:00.000Z') { currentAdmin.expiry_date = '2099-12-31T00:00:00.000Z'; adminModified = true; }
            if (!currentAdmin.referralCode) { currentAdmin.referralCode = generateReferralCode(); adminModified = true; }
            if (!currentAdmin.referralStats) { currentAdmin.referralStats = { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 }; adminModified = true; }
            if (adminModified) writeNeeded = true;
        } else {
            // Create new admin if not found
            if (!adminPasswordHash) { // Should have been hashed above
                try { adminPasswordHash = await bcrypt.hash(defaultAdminPassword, SALT_ROUNDS); }
                catch { adminPasswordHash = defaultAdminPassword; } 
            }
            console.log("internalReadUsersWithPasswords: Primary admin user not found. Creating new admin user...");
            users.push({
                id: uuidv4(), email: primaryAdminEmail, password: adminPasswordHash, name: 'Admin User (Primary)',
                phone: '0000000000', class: 'Dropper', model: 'combo', role: 'Admin',
                expiry_date: '2099-12-31T00:00:00.000Z', createdAt: new Date().toISOString(), avatarUrl: null,
                totalPoints: 0, targetYear: null,
                telegramId: null, telegramUsername: null,
                referralCode: generateReferralCode(),
                referredByCode: null,
                referralStats: { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 },
            });
            writeNeeded = true;
        }

        if (writeNeeded) {
            console.log("internalReadUsersWithPasswords: Changes detected or initialization needed. Attempting to write users.json...");
            const writeSuccess = await writeUsersToFile(users);
            if (!writeSuccess) {
                // For local dev, this is a more significant issue if write fails after successful read/parse/init attempt
                const errorMsg = "internalReadUsersWithPasswords: CRITICAL - Failed to write updated users.json file during initialization. Check file permissions and logs.";
                console.error(errorMsg);
                // Do not throw here if it's serverless, as AuthContext might handle this state,
                // but for local dev, this indicates a problem.
                if (!(process.env.NETLIFY || process.env.VERCEL)) {
                    throw new Error(errorMsg);
                }
            } else {
                console.log("internalReadUsersWithPasswords: users.json initialized/updated successfully.");
            }
        }
        console.log("internalReadUsersWithPasswords: Finished processing. Users count:", users.length);
        return users;

    } catch (initError: any) {
        // This outer catch is for truly unrecoverable errors, e.g., failure of ensureDirExists for critical paths.
        console.error("internalReadUsersWithPasswords: FATAL - Unrecoverable error during user data initialization process:", initError);
        // This error will be caught by AuthProvider and set as initializationError
        throw new Error(`User data system initialization failed: ${initError.message}`);
    }
}
// Make internalReadUsersWithPasswords exportable for AuthContext only.
export { internalReadUsersWithPasswords };


// Public action: Read all users (excluding passwords)
export async function readUsers(): Promise<Array<Omit<UserProfile, 'password'>>> {
  try {
    const usersWithData = await internalReadUsersWithPasswords();
    return usersWithData.map(({ password, ...user }) => user);
  } catch (error: any) {
    // If internalReadUsersWithPasswords throws, this will catch it.
    // It's better to let the error propagate to AuthContext for a global error state.
    console.error("Error in public readUsers due to initialization failure:", error.message);
    throw error; // Re-throw to indicate a critical issue
  }
}

// Internal use: Find user by email, returns full profile including password hash
// Used for login verification.
export async function findUserByEmailInternal(email: string | null): Promise<UserProfile | null> {
  if (!email) return null;
  try {
    const users = await internalReadUsersWithPasswords(); // Ensures data is loaded/initialized
    const foundUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    return foundUser || null;
  } catch (error: any) {
    console.error(`Error finding user by email (internal) ${email}:`, error.message);
    // Propagate critical init errors
    if (error.message.startsWith("User data system initialization failed:")) throw error;
    return null;
  }
}

export async function findUserByReferralCode(referralCode: string): Promise<Omit<UserProfile, 'password'> | null> {
    if (!referralCode) return null;
    try {
        const users = await internalReadUsersWithPasswords();
        const foundUser = users.find(u => u.referralCode === referralCode);
        if (!foundUser) return null;
        const {password, ...userWithoutPassword} = foundUser;
        return userWithoutPassword;
    } catch (error: any) {
        console.error(`Error finding user by referral code ${referralCode}:`, error.message);
        if (error.message.startsWith("User data system initialization failed:")) throw error;
        return null;
    }
}

export async function findUserByTelegramIdInternal(telegramId: string): Promise<UserProfile | null> {
    if (!telegramId) return null;
    try {
        const users = await internalReadUsersWithPasswords();
        return users.find(u => u.telegramId === telegramId) || null;
    } catch (error: any) {
        console.error(`Error finding user by Telegram ID (internal) ${telegramId}:`, error.message);
        if (error.message.startsWith("User data system initialization failed:")) throw error;
        return null;
    }
}

/**
 * Adds a new user to users.json. Hashes the password before saving.
 * @param newUserProfileData User profile data including a plain text password.
 * @returns Promise resolving to the newly created UserProfile (without password) or null on failure.
 */
export async function addUserToJson(
  newUserProfileData: Omit<UserProfile, 'id' | 'createdAt' | 'avatarUrl' | 'referralCode' | 'referralStats' | 'totalPoints' | 'telegramId' | 'telegramUsername'> & { password: string; referredByCode?: string | null }
): Promise<{ success: boolean; user?: Omit<UserProfile, 'password'>; message?: string }> {
  try {
    const users = await internalReadUsersWithPasswords(); // Load existing users, ensures initialization

    // Check if email already exists
    const existingUser = users.find(u => u.email?.toLowerCase() === newUserProfileData.email.toLowerCase());
    if (existingUser) {
      console.error(`addUserToJson: Email ${newUserProfileData.email} already exists.`);
      return { success: false, message: 'This email address is already registered.' };
    }

    const hashedPassword = await bcrypt.hash(newUserProfileData.password, SALT_ROUNDS);
    const newUserId = uuidv4();
    const newUserReferralCode = generateReferralCode();

    const newUser: UserProfile = {
      id: newUserId,
      ...newUserProfileData, // Spread the provided data
      password: hashedPassword,
      role: getRoleFromEmail(newUserProfileData.email), // Determine role based on email
      createdAt: new Date().toISOString(),
      avatarUrl: null, // Default avatar
      referralCode: newUserReferralCode,
      referralStats: { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 },
      totalPoints: 0,
      telegramId: null,
      telegramUsername: null,
    };

    // Update referrer's stats if referredByCode is present
    if (newUser.referredByCode) {
        const referrerIndex = users.findIndex(u => u.referralCode === newUser.referredByCode);
        if (referrerIndex !== -1) {
            const referrer = users[referrerIndex];
            if (!referrer.referralStats) { // Initialize if undefined
                referrer.referralStats = { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 };
            }
            switch (newUser.model) {
                case 'free': referrer.referralStats.referred_free++; break;
                case 'chapterwise': referrer.referralStats.referred_chapterwise++; break;
                case 'full_length': referrer.referralStats.referred_full_length++; break;
                case 'combo': referrer.referralStats.referred_combo++; break;
            }
             users[referrerIndex] = referrer; // Update the referrer in the users array
        } else {
            console.warn(`Referrer with code ${newUser.referredByCode} not found.`);
        }
    }


    users.push(newUser);
    const writeSuccess = await writeUsersToFile(users);

    if (writeSuccess) {
      const { password, ...userWithoutPassword } = newUser;
      return { success: true, user: userWithoutPassword };
    } else {
      return { success: false, message: 'Failed to save new user to file.' };
    }
  } catch (error: any) {
    console.error('Error adding user to JSON:', error);
     // If it's a critical initialization error, propagate it
    if (error.message?.startsWith("User data system initialization failed:")) throw error;
    return { success: false, message: error.message || 'An unexpected error occurred while adding the user.' };
  }
}

export async function getUserById(userId: string): Promise<Omit<UserProfile, 'password'> | null> {
  try {
    const users = await internalReadUsersWithPasswords();
    const user = users.find(u => u.id === userId);
    if (!user) return null;
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  } catch (error: any) {
     console.error(`Error fetching user by ID ${userId}:`, error.message);
     if (error.message.startsWith("User data system initialization failed:")) throw error;
     return null;
  }
}

/**
 * Updates an existing user's profile in users.json.
 * Can handle avatar uploads, removal, and other profile field updates.
 * Password and role changes should be handled by dedicated functions.
 * @param userId ID of the user to update.
 * @param updatedData Partial UserProfile data (excluding password, role).
 * @param avatarFile Optional new avatar file.
 * @param removeAvatar Flag to indicate avatar removal.
 * @returns Promise with success status, updated user profile (without password), and optional message.
 */
export async function updateUserInJson(
  userId: string,
  updatedData: Partial<Omit<UserProfile, 'id' | 'password' | 'createdAt' | 'role' | 'referralCode' | 'referralStats' | 'totalPoints' | 'telegramId' | 'telegramUsername' | 'avatarUrl'>> & {email?: string},
  avatarFile?: File | null,
  removeAvatar?: boolean
): Promise<{ success: boolean; user?: Omit<UserProfile, 'password'>; message?: string }> {
  try {
    const users = await internalReadUsersWithPasswords();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
      return { success: false, message: 'User not found.' };
    }

    let userToUpdate = { ...users[userIndex] };
    let changesMade = false;

    // Handle avatar update
    if (avatarFile) {
      await ensureDirExists(publicAvatarsPath);
      const oldAvatarPath = userToUpdate.avatarUrl ? path.join(publicAvatarsPath, userToUpdate.avatarUrl) : null;

      // Generate a unique filename
      const timestamp = Date.now();
      const hash = crypto.createHash('sha256').update(Buffer.from(await avatarFile.arrayBuffer())).digest('hex').substring(0, 8);
      const extension = path.extname(avatarFile.name) || '.png'; // Default to .png if no extension
      const uniqueFilename = `avatar-${userId}-${timestamp}-${hash}${extension}`;
      const newAvatarPath = path.join(publicAvatarsPath, uniqueFilename);

      try {
        await fs.writeFile(newAvatarPath, Buffer.from(await avatarFile.arrayBuffer()));
        userToUpdate.avatarUrl = uniqueFilename; // Store only filename
        changesMade = true;
        console.log(`New avatar ${uniqueFilename} saved for user ${userId}.`);
        // Delete old avatar if it exists
        if (oldAvatarPath && userToUpdate.avatarUrl !== path.basename(oldAvatarPath)) { // Check if it's actually a new avatar
             try { await fs.unlink(oldAvatarPath); console.log(`Old avatar ${path.basename(oldAvatarPath)} deleted.`); }
             catch (delError: any) { if (delError.code !== 'ENOENT') console.error("Error deleting old avatar:", delError); }
        }
      } catch (uploadError) {
        console.error("Avatar upload failed:", uploadError);
        return { success: false, message: "Failed to upload avatar." };
      }
    } else if (removeAvatar && userToUpdate.avatarUrl) {
      const avatarToRemovePath = path.join(publicAvatarsPath, userToUpdate.avatarUrl);
      try {
         await fs.unlink(avatarToRemovePath); console.log(`Avatar ${userToUpdate.avatarUrl} removed for user ${userId}.`);
         userToUpdate.avatarUrl = null;
         changesMade = true;
      } catch (delError: any) {
          if (delError.code !== 'ENOENT') console.error("Error removing avatar:", delError);
          else { userToUpdate.avatarUrl = null; changesMade = true; } // Still set to null if file not found
      }
    }
    
    // Update other profile fields
    // Ensure not to overwrite 'email' if it's not in updatedData or if it's the primary admin email being changed
    if (updatedData.email && userToUpdate.email?.toLowerCase() !== primaryAdminEmail.toLowerCase()) {
      // Check if new email is already taken by another user
      const existingUserWithNewEmail = users.find(u => u.id !== userId && u.email?.toLowerCase() === updatedData.email!.toLowerCase());
      if (existingUserWithNewEmail) {
        return { success: false, message: 'Email address is already in use by another account.' };
      }
      if(userToUpdate.email !== updatedData.email) {
        userToUpdate.email = updatedData.email;
        changesMade = true;
      }
    }


    // Fields like name, class, targetYear, model, expiry_date
    (Object.keys(updatedData) as Array<keyof typeof updatedData>).forEach(key => {
      if (key !== 'email' && key !== 'avatarUrl' && updatedData[key] !== undefined && (userToUpdate as any)[key] !== updatedData[key]) {
        (userToUpdate as any)[key] = updatedData[key];
        changesMade = true;
      }
    });
    
    // Ensure model and expiry date consistency if role is User
    if (userToUpdate.role === 'User') {
        if (userToUpdate.model === 'free' && userToUpdate.expiry_date !== null) {
            userToUpdate.expiry_date = null;
            changesMade = true;
        } else if (userToUpdate.model !== 'free' && !userToUpdate.expiry_date) {
            // This case implies a paid model without an expiry date, which is problematic.
            // The Zod schema should catch this, but as a fallback:
            // Option 1: Set to a default far future date
            // userToUpdate.expiry_date = new Date('2099-12-31T00:00:00.000Z').toISOString();
            // Option 2: Revert to free if expiry is missing (safer default)
            // userToUpdate.model = 'free';
            // userToUpdate.expiry_date = null;
            // changesMade = true;
            console.warn(`User ${userId} has model ${userToUpdate.model} but no expiry_date. Ensure this is handled.`);
        }
    }


    if (!changesMade) {
      const { password, ...userWithoutPassword } = userToUpdate;
      return { success: true, user: userWithoutPassword, message: 'No changes detected.' };
    }

    users[userIndex] = userToUpdate;
    const writeSuccess = await writeUsersToFile(users);

    if (writeSuccess) {
      const { password, ...userWithoutPassword } = userToUpdate;
      return { success: true, user: userWithoutPassword };
    } else {
      return { success: false, message: 'Failed to save user updates to file.' };
    }
  } catch (error: any) {
    console.error(`Error updating user ${userId}:`, error);
    if (error.message?.startsWith("User data system initialization failed:")) throw error;
    return { success: false, message: error.message || 'An unexpected error occurred while updating user.' };
  }
}


export async function deleteUserFromJson(userId: string): Promise<{ success: boolean; message?: string }> {
    try {
        const users = await internalReadUsersWithPasswords();
        const userToDelete = users.find(u => u.id === userId);

        if (!userToDelete) {
            return { success: false, message: "User not found." };
        }
        // Prevent deletion of primary admin
        if (userToDelete.email?.toLowerCase() === primaryAdminEmail.toLowerCase()) {
            return { success: false, message: "Primary admin account cannot be deleted." };
        }

        const updatedUsers = users.filter(u => u.id !== userId);
        const success = await writeUsersToFile(updatedUsers);
        return { success, message: success ? undefined : 'Failed to write users file after deletion.' };
    } catch (error: any) {
        console.error(`Error deleting user ${userId} from JSON:`, error);
        if (error.message?.startsWith("User data system initialization failed:")) throw error;
        return { success: false, message: error.message || 'An unexpected error occurred.' };
    }
}

export async function updateUserPasswordInJson(userId: string, newPasswordPlainText: string): Promise<{ success: boolean; message?: string }> {
    try {
        const users = await internalReadUsersWithPasswords();
        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex === -1) {
            return { success: false, message: "User not found." };
        }
        const newHashedPassword = await bcrypt.hash(newPasswordPlainText, SALT_ROUNDS);
        users[userIndex].password = newHashedPassword;
        const success = await writeUsersToFile(users);
        return { success, message: success ? undefined : 'Failed to write users file with new password.' };
    } catch (error: any) {
        console.error(`Error updating password for user ${userId}:`, error);
        if (error.message?.startsWith("User data system initialization failed:")) throw error;
        return { success: false, message: error.message || 'An unexpected error occurred.' };
    }
}

export async function updateUserRole(
  userId: string,
  newRole: 'Admin' | 'User'
): Promise<{ success: boolean; user?: Omit<UserProfile, 'password'>; message?: string }> {
  try {
    const users = await internalReadUsersWithPasswords();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
      return { success: false, message: "User not found." };
    }

    let userToUpdate = users[userIndex];
    const oldRole = userToUpdate.role;

    // Prevent changing role of primary admin if trying to make them User
    if (userToUpdate.email?.toLowerCase() === primaryAdminEmail.toLowerCase() && newRole === 'User') {
        return { success: false, message: "Cannot change the role of the primary admin account." };
    }

    // Validate email pattern for Admin promotion
    if (newRole === 'Admin' && userToUpdate.email?.toLowerCase() !== primaryAdminEmail.toLowerCase() && !adminEmailPattern.test(userToUpdate.email!.toLowerCase())) {
         return { success: false, message: "Cannot promote to Admin. Email must end with '-admin@edunexus.com' or be the primary admin." };
    }
    
    // Prevent demotion if email pattern is admin-specific, UNLESS it's the primary admin (which can't be demoted anyway by above check)
    // This prevents a user with "user-admin@edunexus.com" from being set to 'User' role.
    if (newRole === 'User' && adminEmailPattern.test(userToUpdate.email!.toLowerCase()) && userToUpdate.email?.toLowerCase() !== primaryAdminEmail.toLowerCase()) {
        return { success: false, message: "Cannot demote to User if email format is for Admins. Please change email first if intended." };
    }


    if (oldRole === newRole) {
      const { password, ...userWithoutPassword } = userToUpdate;
      return { success: true, user: userWithoutPassword, message: "Role is already set to this value." };
    }

    userToUpdate.role = newRole;
    // Adjust model and expiry if role changes
    if (newRole === 'Admin') {
        userToUpdate.model = 'combo';
        userToUpdate.expiry_date = new Date('2099-12-31T00:00:00.000Z').toISOString();
    } else if (newRole === 'User' && oldRole === 'Admin') {
        // When demoting from Admin to User, set to 'free' and null expiry by default
        // Consider if you want to restore a previous plan or have specific logic here.
        userToUpdate.model = 'free';
        userToUpdate.expiry_date = null;
    }

    users[userIndex] = userToUpdate;
    const writeSuccess = await writeUsersToFile(users);

    if (writeSuccess) {
      const { password, ...userWithoutPassword } = userToUpdate;
      return { success: true, user: userWithoutPassword };
    } else {
      return { success: false, message: 'Failed to save user role update to file.' };
    }
  } catch (error: any) {
    console.error(`Error updating role for user ${userId}:`, error);
    if (error.message?.startsWith("User data system initialization failed:")) throw error;
    return { success: false, message: error.message || 'An unexpected error occurred.' };
  }
}

// This function is specifically for saving a full UserProfile object,
// typically used when creating a user via Telegram or other non-form methods.
// It ensures the password gets hashed if provided.
export async function saveUserToJson(
    userProfile: UserProfile
): Promise<boolean> {
    try {
        let users = await internalReadUsersWithPasswords();
        const userIndex = users.findIndex(u => u.id === userProfile.id || (userProfile.email && u.email === userProfile.email)); // Also check by email for updates

        let userToSave = { ...userProfile };

        // Hash password if it's present and not already a hash
        if (userToSave.password && !userToSave.password.startsWith('$2a$') && !userToSave.password.startsWith('$2b$')) {
            userToSave.password = await bcrypt.hash(userToSave.password, SALT_ROUNDS);
        } else if (!userToSave.password && userIndex !== -1) {
             // If updating and password field is missing/empty, retain old password
            userToSave.password = users[userIndex].password;
        } else if (!userToSave.password) {
            // New user and no password - this should ideally not happen if password is required for new users
            const randomPassword = uuidv4(); 
            userToSave.password = await bcrypt.hash(randomPassword, SALT_ROUNDS);
        }

        if (userIndex !== -1) {
            // Preserve fields that might not be in userProfile object if it's a partial update
            users[userIndex] = { ...users[userIndex], ...userToSave }; 
        } else {
            users.push(userToSave); // Add new user
        }
        return await writeUsersToFile(users);
    } catch (error) {
        console.error('Error saving user to users.json:', error);
        return false;
    }
}

// Exported function to find user by email, returns profile without password
export async function findUserByEmail(email: string | null): Promise<Omit<UserProfile, 'password'> | null> {
    if (!email) return null;
    try {
      const users = await internalReadUsersWithPasswords();
      const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (!user) return null;
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error: any) {
      console.error(`Error finding user by email ${email}:`, error.message);
      if (error.message.startsWith("User data system initialization failed:")) throw error;
      return null;
    }
}
