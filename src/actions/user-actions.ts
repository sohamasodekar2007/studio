// src/actions/user-actions.ts
'use server';

import type { UserProfile, AcademicStatus, UserModel, ContextUser, UserReferralStats } from '@/types';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import crypto from 'crypto'; // Import crypto for hashing

const SALT_ROUNDS = 10;
const usersFilePath = path.join(process.cwd(), 'src', 'data', 'users.json');
const publicAvatarsPath = path.join(process.cwd(), 'public', 'avatars');
const dataBasePath = path.join(process.cwd(), 'src', 'data');

const primaryAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@edunexus.com';
const adminEmailPattern = /^[a-zA-Z0-9._%+-]+-admin@edunexus\.com$/;
const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'Soham@1234';


async function ensureDirExists(dirPath: string): Promise<boolean> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return true;
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      if (dirPath === publicAvatarsPath && (error.code === 'EACCES' || error.code === 'EROFS' || (process.env.NETLIFY || process.env.VERCEL))) {
        console.warn(`Warning: Could not create directory ${dirPath} (likely serverless environment, read-only filesystem for public assets at runtime). Avatar uploads requiring server-side directory creation will fail.`);
        return false; 
      }
      console.error(`Error creating directory ${dirPath}:`, error);
      if (dirPath === dataBasePath || dirPath === path.dirname(usersFilePath)) {
           throw new Error(`Failed to create critical data directory: ${dirPath}. Reason: ${error.message}`);
      }
      return false;
    }
    return true; 
  }
}


async function writeUsersToFile(users: UserProfile[]): Promise<boolean> {
  try {
    if (!await ensureDirExists(path.dirname(usersFilePath))) {
        console.error('Failed to ensure users directory exists for users.json');
        throw new Error('Fatal: Cannot create directory for users.json.');
    }
    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Failed to write users.json:', error);
    return false;
  }
}
export { writeUsersToFile as internalWriteUsers };


const getRoleFromEmail = (email: string | null): 'Admin' | 'User' => {
    if (!email) return 'User';
    const emailLower = email.toLowerCase();
    return emailLower === primaryAdminEmail.toLowerCase() || adminEmailPattern.test(emailLower) ? 'Admin' : 'User';
};

// Helper function to generate a unique referral code
function generateReferralCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) { // 8-character code
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return `NEXUS-${result}`;
}

async function readUsersWithPasswordsInternal(): Promise<UserProfile[]> {
    let users: UserProfile[] = [];
    let writeNeeded = false;

    try { 
        await ensureDirExists(dataBasePath); 
        const avatarsPathExistsOrCreatable = await ensureDirExists(publicAvatarsPath);
        if (!avatarsPathExistsOrCreatable) {
            console.warn("Public avatars directory could not be ensured. Local avatar saving might be disabled.");
        }

        try {
            await fs.access(usersFilePath);
            const fileContent = await fs.readFile(usersFilePath, 'utf-8');
            const parsedUsers = JSON.parse(fileContent);
            if (!Array.isArray(parsedUsers)) {
                console.warn("users.json is not an array. Initializing with default admin.");
                users = []; 
                writeNeeded = true;
            } else {
                users = parsedUsers as UserProfile[];
            }
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                console.log("users.json not found. Initializing with default admin.");
                writeNeeded = true;
                users = []; 
            } else {
                console.error("Error reading or parsing users.json, initializing with default admin:", error);
                users = []; // Reset to ensure admin creation if file is corrupt
                writeNeeded = true;
            }
        }

        // Process existing users for schema updates and hashing
        const processedUsers: UserProfile[] = [];
        for (const user of users) {
            // Basic validation for user object structure
            if (typeof user !== 'object' || user === null || (typeof user.id !== 'string' && typeof user.id !== 'number')) {
                console.warn("Skipping invalid user entry during processing:", user);
                writeNeeded = true;
                continue;
            }

            let currentUser = { ...user };
            let userModified = false;

            if (!currentUser.id) { currentUser.id = uuidv4(); userModified = true; }
            else if (typeof currentUser.id === 'number') { currentUser.id = String(currentUser.id); userModified = true; } // Convert numeric ID to string

            const derivedRole = getRoleFromEmail(currentUser.email);
            if (currentUser.role === undefined || currentUser.role !== derivedRole) {
                currentUser.role = derivedRole; userModified = true;
            }

            // Ensure password is hashed
            if (currentUser.password && !currentUser.password.startsWith('$2a$') && !currentUser.password.startsWith('$2b$')) {
                try { currentUser.password = await bcrypt.hash(currentUser.password, SALT_ROUNDS); userModified = true; }
                catch (hashError) { console.error(`Failed to hash password for user ${currentUser.email || currentUser.id}:`, hashError); }
            } else if (!currentUser.password) { // If password is missing, generate a random one (should not happen for real users)
                try {
                    const randomPassword = Math.random().toString(36).slice(-8); // Example placeholder
                    currentUser.password = await bcrypt.hash(randomPassword, SALT_ROUNDS); userModified = true;
                    console.warn(`Generated temporary password for user ${currentUser.email || currentUser.id} as password was missing.`);
                } catch (hashError) { console.error(`CRITICAL: Failed to hash temporary password for ${currentUser.email || currentUser.id}`, hashError); }
            }
            // Ensure ISO format for dates or null
            if (currentUser.expiry_date && !(typeof currentUser.expiry_date === 'string' && !isNaN(Date.parse(currentUser.expiry_date)))) {
                try { currentUser.expiry_date = new Date(currentUser.expiry_date).toISOString(); userModified = true; }
                catch { currentUser.expiry_date = null; userModified = true; }
            }
            if (currentUser.createdAt && !(typeof currentUser.createdAt === 'string' && !isNaN(Date.parse(currentUser.createdAt)))) {
                try { currentUser.createdAt = new Date(currentUser.createdAt).toISOString(); userModified = true; }
                catch { currentUser.createdAt = new Date().toISOString(); userModified = true;}
            } else if (!currentUser.createdAt) { currentUser.createdAt = new Date().toISOString(); userModified = true; }

            // Default role-based model/expiry
            if (currentUser.role === 'Admin') {
                if (currentUser.model !== 'combo') { currentUser.model = 'combo'; userModified = true; }
                const adminExpiry = '2099-12-31T00:00:00.000Z';
                if (currentUser.expiry_date !== adminExpiry) { currentUser.expiry_date = adminExpiry; userModified = true; }
            } else { // User role
                if (!currentUser.model || !['free', 'chapterwise', 'full_length', 'combo'].includes(currentUser.model)) {
                    currentUser.model = 'free'; userModified = true;
                }
                if (currentUser.model === 'free' && currentUser.expiry_date !== null) {
                    currentUser.expiry_date = null; userModified = true;
                }
            }
            // Ensure other optional fields have defaults or are null
            if (currentUser.avatarUrl === undefined) { currentUser.avatarUrl = null; userModified = true; }
            if (currentUser.class === undefined) { currentUser.class = null; userModified = true; }
            if (currentUser.phone === undefined) { currentUser.phone = null; userModified = true; }
            if (currentUser.totalPoints === undefined) { currentUser.totalPoints = 0; userModified = true; }
            if (currentUser.targetYear === undefined) { currentUser.targetYear = null; userModified = true; }
            if (currentUser.telegramId === undefined) { currentUser.telegramId = null; userModified = true; }
            if (currentUser.telegramUsername === undefined) { currentUser.telegramUsername = null; userModified = true; }
            // Initialize referral fields for existing users
            if (currentUser.referralCode === undefined) { currentUser.referralCode = generateReferralCode(); userModified = true; }
            if (currentUser.referredByCode === undefined) { currentUser.referredByCode = null; userModified = true;}
            if (currentUser.referralStats === undefined) {
                currentUser.referralStats = { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 };
                userModified = true;
            }


            processedUsers.push(currentUser);
            if (userModified) writeNeeded = true;
        }
        users = processedUsers; // Update users array with processed users

        // Ensure primary admin user exists and has correct password/role
        const primaryAdminEffectiveEmail = primaryAdminEmail.toLowerCase();
        let adminUserIndex = users.findIndex(u => u.email?.toLowerCase() === primaryAdminEffectiveEmail);
        let adminPasswordHash = adminUserIndex !== -1 ? users[adminUserIndex].password : undefined;

        // Check if admin password needs hashing or updating
        if (!adminPasswordHash || typeof adminPasswordHash !== 'string' || (!adminPasswordHash.startsWith('$2a$') && !adminPasswordHash.startsWith('$2b$'))) {
            try { adminPasswordHash = await bcrypt.hash(defaultAdminPassword, SALT_ROUNDS); writeNeeded = true; }
            catch (hashError) { console.error("CRITICAL: Failed to hash default admin password:", hashError); adminPasswordHash = defaultAdminPassword; } // Fallback if hashing fails
        } else {
             // If admin exists and has a hashed password, verify if it matches defaultAdminPassword
             // This handles cases where ADMIN_PASSWORD in .env might have changed
             try {
                const passwordMatch = await bcrypt.compare(defaultAdminPassword, adminPasswordHash);
                if (!passwordMatch) {
                    adminPasswordHash = await bcrypt.hash(defaultAdminPassword, SALT_ROUNDS);
                    console.log("Admin password updated to match ADMIN_PASSWORD environment variable.");
                    writeNeeded = true;
                }
            } catch (compareError) { console.error("Error comparing admin password hash:", compareError); }
        }


        if (adminUserIndex !== -1) {
            // Admin user exists, ensure properties are correct
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
            // Admin user does not exist, create it
            if (!adminPasswordHash) { // Should be hashed by now, but as a fallback
                try { adminPasswordHash = await bcrypt.hash(defaultAdminPassword, SALT_ROUNDS); }
                catch { adminPasswordHash = defaultAdminPassword; } // Extremely unlikely fallback
            }
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
            const writeSuccess = await writeUsersToFile(users);
            if (!writeSuccess) {
                console.error("CRITICAL: Failed to write updated users.json file during initialization.");
                // Potentially throw an error here to halt if this is critical
            } else {
                console.log("users.json initialized/updated successfully.");
            }
        }
        return users;
    } catch (initError: any) {
        console.error("FATAL: Unrecoverable error during user data initialization process:", initError);
        // This is a critical failure, e.g., cannot create data directory.
        // The application might not be usable. Consider how to handle this gracefully.
        // For now, re-throw to make it clear initialization failed.
        throw new Error(`User data system initialization failed: ${initError.message}`);
    }
}
export { readUsersWithPasswordsInternal }; // Keep this export if used by other internal actions or for testing


export async function readUsers(): Promise<Array<Omit<UserProfile, 'password'>>> {
  try {
    const usersWithData = await readUsersWithPasswordsInternal();
    return usersWithData.map(({ password, ...user }) => user);
  } catch (error: any) {
    console.error("Error in readUsers:", error.message);
    // If initialization failed catastrophically, this will also fail.
    // Consider returning an empty array or a specific error state.
    return [];
  }
}

// Finds user by email, returns full profile including password hash (for internal use like login)
export async function findUserByEmailInternal(email: string | null): Promise<UserProfile | null> {
  if (!email) return null;
  try {
    const users = await readUsersWithPasswordsInternal();
    const foundUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    return foundUser || null;
  } catch (error: any) {
    console.error(`Error finding user by email ${email}:`, error.message);
    return null;
  }
}

export async function findUserByReferralCode(referralCode: string): Promise<UserProfile | null> {
    if (!referralCode) return null;
    try {
        const users = await readUsersWithPasswordsInternal();
        return users.find(u => u.referralCode === referralCode) || null;
    } catch (error: any) {
        console.error(`Error finding user by referral code ${referralCode}:`, error.message);
        return null;
    }
}

export async function findUserByTelegramIdInternal(telegramId: string): Promise<UserProfile | null> {
    if (!telegramId) return null;
    try {
        const users = await readUsersWithPasswordsInternal();
        return users.find(u => u.telegramId === telegramId) || null;
    } catch (error: any) {
        console.error(`Error finding user by Telegram ID ${telegramId}:`, error.message);
        return null;
    }
}

// Helper to save avatar (if provided) to public/avatars
async function saveAvatarLocally(userId: string, avatarFile: File): Promise<string | null> {
    try {
        if (!await ensureDirExists(publicAvatarsPath)) {
             console.warn(`Public avatars directory (${publicAvatarsPath}) could not be ensured. Avatar for ${userId} will not be saved. This is expected in some serverless environments.`);
             return null; // Indicate that avatar was not saved if dir creation failed
        }
        const fileBuffer = Buffer.from(await avatarFile.arrayBuffer());
        // Create a more unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(avatarFile.name).substring(1) || 'png'; // Default to png if no extension
        const filename = `avatar-${userId}-${uniqueSuffix}.${extension}`;
        const filePath = path.join(publicAvatarsPath, filename);

        await fs.writeFile(filePath, fileBuffer);
        return filename; // Return the generated filename
    } catch (error) {
        console.error(`Error saving avatar locally for user ${userId}:`, error);
        return null;
    }
}

// Helper to delete an old avatar
async function deleteAvatarLocally(filename: string): Promise<boolean> {
    try {
        const filePath = path.join(publicAvatarsPath, filename);
        await fs.access(filePath); // Check if file exists
        await fs.unlink(filePath); // Delete file
        return true;
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            // File doesn't exist, which is fine if we're trying to delete something that's already gone
            return true; 
        }
        console.error(`Error deleting local public avatar ${filename}:`, error);
        return false;
    }
}

// Add a new user to users.json
export async function addUserToJson(
    newUserProfileData: Omit<UserProfile, 'id' | 'createdAt' | 'avatarUrl' | 'referralCode' | 'referralStats' | 'totalPoints' | 'telegramId' | 'telegramUsername'> & { password: string; referredByCode?: string | null }
): Promise<{ success: boolean; message?: string; user?: Omit<UserProfile, 'password'> }> {
    try {
        if (!newUserProfileData.email || !newUserProfileData.password) {
            return { success: false, message: "Email and password are required for new user." };
        }
        const emailLower = newUserProfileData.email.toLowerCase();
        const assignedRole = getRoleFromEmail(emailLower);

        // Admin role assignment validation
        if (assignedRole === 'Admin' && emailLower !== primaryAdminEmail.toLowerCase() && !adminEmailPattern.test(emailLower)) {
            return { success: false, message: `Admin role can only be assigned to the primary admin email or emails matching 'username-admin@edunexus.com'.` };
        }
        // Prevent user from using reserved admin email format
        if (assignedRole === 'User' && (emailLower === primaryAdminEmail.toLowerCase() || adminEmailPattern.test(emailLower))) {
            return { success: false, message: `Email format '${emailLower}' is reserved for Admin roles.` };
        }

        const hashedPassword = await bcrypt.hash(newUserProfileData.password, SALT_ROUNDS);
        let userModel: UserModel = newUserProfileData.model || 'free';
        let expiryDate: string | null = newUserProfileData.expiry_date || null;

        if (assignedRole === 'Admin') {
            userModel = 'combo';
            expiryDate = '2099-12-31T00:00:00.000Z';
        } else if (userModel === 'free') {
            expiryDate = null;
        } else if (!expiryDate) { // Paid models require an expiry date
            return { success: false, message: "Expiry date is required for paid models." };
        }

        const userToAdd: UserProfile = {
            id: uuidv4(),
            email: newUserProfileData.email,
            password: hashedPassword,
            name: newUserProfileData.name || null,
            phone: newUserProfileData.phone || null,
            class: newUserProfileData.class || null,
            model: userModel,
            role: assignedRole, // Use the derived role
            expiry_date: expiryDate,
            createdAt: new Date().toISOString(),
            avatarUrl: null, // New users start without an avatar
            totalPoints: 0,
            targetYear: newUserProfileData.targetYear || null,
            telegramId: null, // Initialize to null
            telegramUsername: null, // Initialize to null
            referralCode: generateReferralCode(),
            referredByCode: newUserProfileData.referredByCode || null,
            referralStats: { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 },
        };

        let users = await readUsersWithPasswordsInternal();
        if (users.some(u => u.email?.toLowerCase() === emailLower)) {
            return { success: false, message: 'User with this email already exists.' };
        }

        users.push(userToAdd);

        // Handle referral logic if a code was used
        if (newUserProfileData.referredByCode) {
            const referrerIndex = users.findIndex(u => u.referralCode === newUserProfileData.referredByCode);
            if (referrerIndex !== -1) {
                if (!users[referrerIndex].referralStats) { // Initialize if undefined
                    users[referrerIndex].referralStats = { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 };
                }
                // Increment based on the new user's model (which is 'free' by default on signup)
                users[referrerIndex].referralStats!.referred_free += 1; 
                // Future: When userToAddupgrades plan, update referrer's specific tier count
                console.log(`Referrer ${users[referrerIndex].email} stats updated for new ${userToAdd.model} referral.`);
            } else {
                console.warn(`Referral code ${newUserProfileData.referredByCode} used, but referrer not found.`);
            }
        }

        const success = await writeUsersToFile(users);

        if (success) {
            const { password, ...userWithoutPassword } = userToAdd;
            return { success: true, user: userWithoutPassword };
        } else {
            return { success: false, message: 'Failed to write users file. New user not saved.' };
        }
    } catch (error: any) {
        console.error('Error in addUserToJson:', error);
        return { success: false, message: `Server error: ${error.message || 'Could not add user.'}` };
    }
}

// Update an existing user's profile (excluding password, role, and critical model/expiry changes handled by other functions)
export async function updateUserInJson(
    userId: string, 
    updatedData: Partial<Omit<UserProfile, 'id' | 'password' | 'createdAt' | 'referralCode' | 'referralStats' | 'totalPoints' | 'telegramId' | 'telegramUsername'>>, // Exclude avatarUrl from direct update here
    avatarFile?: File | null, // Optional avatar file
    removeAvatarFlag?: boolean // Flag to indicate removal of existing avatar
): Promise<{ success: boolean; message?: string, user?: Omit<UserProfile, 'password'> }> {
    try {
        if (!userId || typeof userId !== 'string') {
            return { success: false, message: "Invalid user ID provided for update." };
        }
        
        let users = await readUsersWithPasswordsInternal();
        const userIndex = users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return { success: false, message: `User with ID ${userId} not found.` };
        }

        const existingUser = users[userIndex];
        let newAvatarFilename = existingUser.avatarUrl || null;

        if (avatarFile instanceof File) { // If a new avatar file is provided
            // Delete old avatar if it exists
            if (existingUser.avatarUrl) { await deleteAvatarLocally(existingUser.avatarUrl); }
            newAvatarFilename = await saveAvatarLocally(userId, avatarFile);
            // If saving new avatar fails, but there was an old one, it remains deleted (newAvatarFilename will be null)
            // If new avatar save fails and there was no old one, it remains null
            if (!newAvatarFilename && existingUser.avatarUrl) {
                 newAvatarFilename = null; // Explicitly set to null if new save failed after delete
            } else if (!newAvatarFilename) {
                 // If save failed and no old avatar, it's already null
            }
        } else if (removeAvatarFlag && existingUser.avatarUrl) { // If explicitly told to remove and an avatar exists
            await deleteAvatarLocally(existingUser.avatarUrl);
            newAvatarFilename = null;
        }
        
        // Apply other updates, ensuring sensitive fields are not overridden accidentally
        // Role, model, expiry_date are handled by specific functions or validated carefully
        const userWithUpdatesApplied: UserProfile = {
            ...existingUser,
            ...updatedData, // Apply general updates
            avatarUrl: newAvatarFilename, // Set the new avatar filename or null
            // Retain existing sensitive fields unless explicitly changed by dedicated functions
            role: updatedData.role ?? existingUser.role,
            model: updatedData.model ?? existingUser.model,
            expiry_date: updatedData.expiry_date ?? existingUser.expiry_date,
        };
        
        users[userIndex] = userWithUpdatesApplied;
        const success = await writeUsersToFile(users);
        if (success) {
             const { password, ...userWithoutPassword } = userWithUpdatesApplied;
             return { success: true, user: userWithoutPassword };
        } else {
            return { success: false, message: 'Failed to write users file.' };
        }
    } catch (error: any) {
        console.error(`Error in updateUserInJson:`, error);
        return { success: false, message: `Server error: ${error.message || 'Could not update user.'}` };
    }
}


export async function updateUserRole(
    userId: string,
    newRole: 'Admin' | 'User'
): Promise<{ success: boolean; message?: string; user?: Omit<UserProfile, 'password'> }> {
    try {
        if (!userId) return { success: false, message: "User ID is required." };
        if (!['Admin', 'User'].includes(newRole)) return { success: false, message: "Invalid role specified." };

        let users = await readUsersWithPasswordsInternal();
        const userIndex = users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return { success: false, message: `User with ID ${userId} not found.` };
        }
        const userToUpdate = users[userIndex];

        // Prevent changing role of the primary admin account
        if (userToUpdate.email?.toLowerCase() === primaryAdminEmail.toLowerCase() && newRole !== 'Admin') {
            return { success: false, message: "Cannot change the role of the primary admin account." };
        }

        // Additional validation based on email format for role change
        const emailLower = userToUpdate.email?.toLowerCase() || '';
        if (newRole === 'Admin' && emailLower !== primaryAdminEmail.toLowerCase() && !adminEmailPattern.test(emailLower)) {
            return { success: false, message: `Cannot promote to Admin. Email '${userToUpdate.email}' does not follow admin pattern ('username-admin@edunexus.com' or primary admin).` };
        }
        if (newRole === 'User' && (emailLower === primaryAdminEmail.toLowerCase() || adminEmailPattern.test(emailLower))) {
            // This case might need refinement: if an admin created with 'user-admin@edunexus.com' is demoted, their email still matches pattern.
            // For now, this prevents demoting primary admin and any email *looking* like an admin to User.
            return { success: false, message: `Cannot demote to User. Email format '${userToUpdate.email}' is reserved for Admins.`};
        }

        if (userToUpdate.role === newRole) {
            const { password, ...userWithoutPassword } = userToUpdate; // Exclude password
            return { success: true, user: userWithoutPassword, message: "User already has this role." };
        }

        userToUpdate.role = newRole;
        // Adjust model and expiry based on new role
        if (newRole === 'Admin') {
            userToUpdate.model = 'combo';
            userToUpdate.expiry_date = '2099-12-31T00:00:00.000Z';
        } else { // Demoted to User
            // If they were 'combo' (likely from being Admin), revert to 'free' or a previous non-admin state
            // For simplicity, reverting to 'free'. More complex logic could restore their previous plan.
            if (userToUpdate.model === 'combo' || (userToUpdate.model as any) === 'Admin') { // Handle legacy 'Admin' model value
                userToUpdate.model = 'free';
                userToUpdate.expiry_date = null;
            }
            // If they had a paid plan before promotion, that logic isn't handled here yet.
        }

        users[userIndex] = userToUpdate;
        const success = await writeUsersToFile(users);

        if (success) {
            const { password, ...userWithoutPassword } = userToUpdate; // Exclude password for return
            return { success: true, user: userWithoutPassword };
        } else {
            return { success: false, message: 'Failed to write users file after role update.' };
        }
    } catch (error: any) {
        console.error(`Error in updateUserRole for ${userId}:`, error);
        return { success: false, message: `Server error: ${error.message || 'Could not update role.'}` };
    }
}


// Delete a user from users.json
export async function deleteUserFromJson(userId: string): Promise<{ success: boolean; message?: string }> {
    try {
        if (!userId || typeof userId !== 'string') {
           return { success: false, message: "Invalid user ID provided for deletion." };
       }
       
       let users = await readUsersWithPasswordsInternal();
       const userToDelete = users.find(u => u.id === userId);

       if (!userToDelete) {
            return { success: false, message: `User with ID ${userId} not found.` };
       }
       // Prevent deletion of the primary admin account
       if (userToDelete.email?.toLowerCase() === primaryAdminEmail.toLowerCase()) {
           return { success: false, message: `Cannot delete the primary admin user (${primaryAdminEmail}).` };
       }

       // Attempt to delete avatar if it exists
       if (userToDelete.avatarUrl) {
            await deleteAvatarLocally(userToDelete.avatarUrl);
       }

       users = users.filter(u => u.id !== userId);
       const success = await writeUsersToFile(users);
       return { success, message: success ? undefined : 'Failed to write users file after deletion.' };
    } catch (error: any) {
        console.error(`Error in deleteUserFromJson for ${userId}:`, error);
        return { success: false, message: `Server error: ${error.message || 'Could not delete user.'}` };
    }
}

// Update a user's password in users.json
export async function updateUserPasswordInJson(userId: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
    try {
        if (!userId || typeof userId !== 'string') {
           return { success: false, message: "Invalid user ID provided for password update." };
       }
       if (!newPassword || newPassword.length < 6) {
           return { success: false, message: 'Password must be at least 6 characters long.'};
       }

       let users = await readUsersWithPasswordsInternal();
       const userIndex = users.findIndex(u => u.id === userId);

       if (userIndex === -1) {
           return { success: false, message: `User with ID ${userId} not found.` };
       }
       const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
       users[userIndex].password = hashedPassword;
       const success = await writeUsersToFile(users);
       return { success, message: success ? undefined : 'Failed to write users file after password update.' };
    } catch (error: any) {
        console.error(`Error in updateUserPasswordInJson for ${userId}:`, error);
        return { success: false, message: `Server error: ${error.message || 'Could not update password.'}` };
    }
}

// Get user by ID (excluding password)
export async function getUserById(userId: string): Promise<Omit<UserProfile, 'password'> | null> {
  if (!userId || typeof userId !== 'string') {
    console.warn("getUserById: Invalid or missing userId:", userId);
    return null;
  }
  try {
    const usersWithPasswords = await readUsersWithPasswordsInternal();
    const foundUser = usersWithPasswords.find(u => u.id === userId);
    if (!foundUser) return null;
    const { password, ...userWithoutPassword } = foundUser;
    return userWithoutPassword;
  } catch (error: any) {
    console.error(`Error finding user by ID ${userId}:`, error.message);
    return null;
  }
}

// Check user's plan validity
export async function checkUserPlanAndExpiry(userId: string): Promise<{ isPlanValid: boolean; message?: string }> {
    try {
        if (!userId) {
            return { isPlanValid: false, message: "User ID not provided." };
        }
        const currentUser = await getUserById(userId); // This now returns Omit<UserProfile, 'password'>
        if (!currentUser) {
            return { isPlanValid: false, message: "User not found." };
        }

        if (currentUser.role === 'Admin') {
            return { isPlanValid: true }; // Admins always have valid access
        }
        if (currentUser.model === 'free') {
            return { isPlanValid: true }; // Free plan is always valid (no expiry)
        }
        // For paid plans, check expiry_date
        if (!currentUser.expiry_date) {
            return { isPlanValid: false, message: "Subscription details incomplete (missing expiry date)." };
        }
        const expiry = new Date(currentUser.expiry_date);
        if (isNaN(expiry.getTime()) || expiry < new Date()) {
            return { isPlanValid: false, message: "Your subscription has expired." };
        }
        return { isPlanValid: true };
    } catch (error: any) {
        console.error("Error in checkUserPlanAndExpiry:", error);
        return { isPlanValid: false, message: `Error verifying subscription status: ${error.message}` };
    }
}

// Saves a complete UserProfile object, ensuring password is hashed if not already
export async function saveUserToJson(userData: UserProfile): Promise<boolean> {
  try {
    let users = await readUsersWithPasswordsInternal();
    const userIndex = users.findIndex(u => u.id === userData.id || (userData.email && u.email?.toLowerCase() === userData.email?.toLowerCase()));

    let finalUserData = { ...userData };

    // Ensure password is hashed before saving
    if (finalUserData.password && !finalUserData.password.startsWith('$2a$') && !finalUserData.password.startsWith('$2b$')) {
      finalUserData.password = await bcrypt.hash(finalUserData.password, SALT_ROUNDS);
    } else if (!finalUserData.password) {
      // If password is somehow missing, might indicate an issue. For safety, could assign a placeholder
      // or ideally, this state should not be reached if user creation/update paths are robust.
      console.warn(`User data for ${finalUserData.email} missing password before save. This should be handled earlier.`);
      // For now, let it proceed, but this is a point of review for data integrity.
    }
    // Ensure role is consistent with email format
    finalUserData.role = getRoleFromEmail(finalUserData.email);
    // Ensure model and expiry are consistent with role
    if (finalUserData.role === 'Admin') {
        finalUserData.model = 'combo';
        finalUserData.expiry_date = '2099-12-31T00:00:00.000Z';
    } else if (finalUserData.model === 'free') {
        finalUserData.expiry_date = null;
    }
    // Default other fields if missing
    finalUserData.id = finalUserData.id || uuidv4();
    finalUserData.createdAt = finalUserData.createdAt || new Date().toISOString();
    finalUserData.totalPoints = finalUserData.totalPoints ?? 0;
    finalUserData.referralCode = finalUserData.referralCode || generateReferralCode();
    finalUserData.referralStats = finalUserData.referralStats || { referred_free: 0, referred_chapterwise: 0, referred_full_length: 0, referred_combo: 0 };


    if (userIndex !== -1) {
      // Update existing user: merge ensuring not to overwrite critical fields unintentionally
      // Ensure existing password isn't accidentally overwritten with null/undefined if userData doesn't include it
      users[userIndex] = {
          ...users[userIndex], // Keep existing data
          ...finalUserData,    // Apply updates
          password: finalUserData.password || users[userIndex].password, // Prioritize new password if present
      };
    } else {
      // Add new user
      users.push(finalUserData);
    }
    return await writeUsersToFile(users);
  } catch (error: any) {
    console.error('Error in saveUserToJson:', error);
    return false;
  }
}
