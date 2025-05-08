// src/actions/user-actions.ts
'use server';

import type { UserProfile, AcademicStatus, UserModel, ContextUser } from '@/types';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import crypto from 'crypto'; // Import crypto for hashing

const SALT_ROUNDS = 10;
const usersFilePath = path.join(process.cwd(), 'src', 'data', 'users.json');
const publicAvatarsPath = path.join(process.cwd(), 'public', 'avatars');

const primaryAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@edunexus.com';
const adminEmailPattern = /^[a-zA-Z0-9._%+-]+-admin@edunexus\.com$/; // Pattern for other admins
const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'Soham@1234'; // Use env var or default

// --- Helper Functions ---

async function ensureDirExists(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') throw error;
  }
}

async function writeUsers(users: UserProfile[]): Promise<boolean> {
  try {
    await ensureDirExists(path.dirname(usersFilePath));
    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Failed to write users.json:', error);
    return false;
  }
}

// Helper function to determine role based on email (for NEW user creation or initialization)
const getRoleFromEmail = (email: string | null): 'Admin' | 'User' => {
    if (!email) return 'User';
    return email === primaryAdminEmail || adminEmailPattern.test(email) ? 'Admin' : 'User';
};

/**
 * INTERNAL HELPER: Reads the users.json file, performs initialization (adds admin, assigns IDs, formats dates, hashes passwords, assigns roles),
 * and returns the full user list *including* hashed passwords and roles.
 * Ensures data consistency. Writes back to file if any changes were made.
 * @returns A promise resolving to the array of UserProfile including passwords and roles.
 */
async function readAndInitializeUsersInternal(): Promise<UserProfile[]> {
    console.log("Reading and initializing users from users.json...");
    let users: UserProfile[] = [];
    let writeNeeded = false;

    await ensureDirExists(publicAvatarsPath);

    try {
        await fs.access(usersFilePath);
        const fileContent = await fs.readFile(usersFilePath, 'utf-8');
        const parsedUsers = JSON.parse(fileContent);
        if (!Array.isArray(parsedUsers)) {
            console.error('users.json does not contain a valid array. Re-initializing.');
            users = [];
            writeNeeded = true;
        } else {
            users = parsedUsers as UserProfile[];
        }
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.warn('users.json not found. Creating file with default admin.');
            writeNeeded = true;
        } else {
            console.error('Error reading or parsing users.json:', error);
            users = [];
            writeNeeded = true;
        }
    }

    const processedUsers: UserProfile[] = [];
    for (const user of users) {
        if (typeof user !== 'object' || user === null || (typeof user.id !== 'string' && typeof user.id !== 'number')) { // Allow number IDs for existing data
            console.warn("Skipping invalid user entry:", user);
            writeNeeded = true;
            continue;
        }

        let currentUser = { ...user };
        let userModified = false;

        // --- ID ---
        if (!currentUser.id) { // Assign if missing
            currentUser.id = uuidv4();
            console.warn(`User ${currentUser.email || 'unknown'} assigned new UUID: ${currentUser.id}.`);
            userModified = true;
        } else if (typeof currentUser.id === 'number') {
             // Convert existing numeric IDs to strings if found
             currentUser.id = String(currentUser.id);
             console.warn(`Converted numeric ID to string for user ${currentUser.email || currentUser.id}.`);
             userModified = true;
        }

        // --- Role ---
        const derivedRole = getRoleFromEmail(currentUser.email);
        if (currentUser.role === undefined || (currentUser.role !== 'Admin' && currentUser.role !== 'User')) {
            currentUser.role = derivedRole; // Assign role based on email pattern if missing/invalid
            console.warn(`User ${currentUser.email || currentUser.id} missing/invalid role. Assigned derived role: ${currentUser.role}.`);
            userModified = true;
        } else if (currentUser.role !== derivedRole) {
            // Correct role if it mismatches the email pattern (e.g., admin email but User role)
            console.warn(`User ${currentUser.email || currentUser.id} role (${currentUser.role}) mismatches derived role (${derivedRole}). Correcting.`);
            currentUser.role = derivedRole;
            userModified = true;
        }

        // --- Password Hashing ---
        if (currentUser.password && !currentUser.password.startsWith('$2a$') && !currentUser.password.startsWith('$2b$')) {
            console.warn(`User ${currentUser.email || currentUser.id} has plain text password. Hashing now.`);
            try {
                currentUser.password = await bcrypt.hash(currentUser.password, SALT_ROUNDS);
                userModified = true;
            } catch (hashError) {
                console.error(`Failed to hash password for user ${currentUser.email || currentUser.id}:`, hashError);
            }
        } else if (!currentUser.password) {
             console.warn(`User ${currentUser.email || currentUser.id} missing password. Assigning temporary hashed password.`);
             try {
                 const randomPassword = Math.random().toString(36).slice(-8);
                 currentUser.password = await bcrypt.hash(randomPassword, SALT_ROUNDS);
                 userModified = true;
             } catch (hashError) {
                 console.error(`CRITICAL: Failed to hash temporary password for ${currentUser.email || currentUser.id}`, hashError);
             }
         }

        // --- Date Formatting ---
        if (currentUser.expiry_date && !(typeof currentUser.expiry_date === 'string' && !isNaN(Date.parse(currentUser.expiry_date)))) {
            try { currentUser.expiry_date = new Date(currentUser.expiry_date).toISOString(); userModified = true; } catch { currentUser.expiry_date = null; userModified = true; }
        }
        if (currentUser.createdAt && !(typeof currentUser.createdAt === 'string' && !isNaN(Date.parse(currentUser.createdAt)))) {
            try { currentUser.createdAt = new Date(currentUser.createdAt).toISOString(); userModified = true; } catch { currentUser.createdAt = new Date().toISOString(); userModified = true;}
        } else if (!currentUser.createdAt) {
            currentUser.createdAt = new Date().toISOString(); userModified = true;
        }

        // --- Model/Expiry based on Role ---
        if (currentUser.role === 'Admin') {
            if (currentUser.model !== 'combo') { currentUser.model = 'combo'; userModified = true; }
            const adminExpiry = '2099-12-31T00:00:00.000Z';
            if (currentUser.expiry_date !== adminExpiry) { currentUser.expiry_date = adminExpiry; userModified = true; }
        } else { // Regular users
            if (!currentUser.model || !['free', 'chapterwise', 'full_length', 'combo'].includes(currentUser.model)) {
                currentUser.model = 'free'; userModified = true;
            }
            if (currentUser.model === 'free' && currentUser.expiry_date !== null) {
                currentUser.expiry_date = null; userModified = true;
            }
        }

        // --- Ensure Optional Fields Exist ---
        if (currentUser.avatarUrl === undefined) { currentUser.avatarUrl = null; userModified = true; }
        if (currentUser.class === undefined) { currentUser.class = null; userModified = true; }
        if (currentUser.phone === undefined) { currentUser.phone = null; userModified = true; }
        if (currentUser.referral === undefined) { currentUser.referral = ''; userModified = true; }
        if (currentUser.totalPoints === undefined) { currentUser.totalPoints = 0; userModified = true; } // Initialize points

        processedUsers.push(currentUser);
        if (userModified) writeNeeded = true;
    }

    // --- Ensure Default Admin User ---
    const adminUserIndex = processedUsers.findIndex(u => u.email === primaryAdminEmail);
    let adminPasswordHash = adminUserIndex !== -1 ? processedUsers[adminUserIndex].password : undefined;
    let adminNeedsUpdate = false;

    if (!adminPasswordHash || typeof adminPasswordHash !== 'string' || (!adminPasswordHash.startsWith('$2a$') && !adminPasswordHash.startsWith('$2b$'))) {
        console.warn(`Hashing default password for primary admin ${primaryAdminEmail}.`);
        try { adminPasswordHash = await bcrypt.hash(defaultAdminPassword, SALT_ROUNDS); adminNeedsUpdate = true; } catch (hashError) { console.error("CRITICAL: Failed to hash default admin password:", hashError); adminPasswordHash = defaultAdminPassword; }
    } else {
        try {
            // Verify existing hash matches the one from .env (in case .env changed)
            const passwordMatch = await bcrypt.compare(defaultAdminPassword, adminPasswordHash);
            if (!passwordMatch) {
                console.warn(`Admin password in .env changed. Updating hash for ${primaryAdminEmail}.`);
                adminPasswordHash = await bcrypt.hash(defaultAdminPassword, SALT_ROUNDS);
                adminNeedsUpdate = true;
            }
        } catch (compareError) { console.error("Error comparing admin password hash:", compareError); }
    }

    if (adminUserIndex !== -1) {
        // Update existing primary admin if needed
        const currentAdmin = processedUsers[adminUserIndex];
        let adminModified = false;
        if (adminNeedsUpdate && adminPasswordHash) { currentAdmin.password = adminPasswordHash; adminModified = true; }
        if (currentAdmin.role !== 'Admin') { currentAdmin.role = 'Admin'; adminModified = true; console.warn("Correcting primary admin role to 'Admin'."); }
        if (currentAdmin.model !== 'combo') { currentAdmin.model = 'combo'; adminModified = true; console.warn("Correcting primary admin model to 'combo'."); }
        if (currentAdmin.expiry_date !== '2099-12-31T00:00:00.000Z') { currentAdmin.expiry_date = '2099-12-31T00:00:00.000Z'; adminModified = true; }
        if (adminModified) writeNeeded = true;
    } else {
        // Add primary admin if missing
        console.warn(`Default admin user (${primaryAdminEmail}) not found. Adding.`);
        if (!adminPasswordHash) { // Hash if somehow still undefined
             try { adminPasswordHash = await bcrypt.hash(defaultAdminPassword, SALT_ROUNDS); } catch { adminPasswordHash = defaultAdminPassword; }
        }
        processedUsers.push({
            id: uuidv4(),
            email: primaryAdminEmail,
            password: adminPasswordHash,
            name: 'Admin User (Primary)',
            phone: '0000000000',
            class: 'Dropper',
            model: 'combo',
            role: 'Admin',
            expiry_date: '2099-12-31T00:00:00.000Z',
            createdAt: new Date().toISOString(),
            avatarUrl: null,
            referral: '',
            totalPoints: 0,
        });
        writeNeeded = true;
    }

    if (writeNeeded) {
        console.log("Changes detected during initialization, writing updated users.json...");
        const writeSuccess = await writeUsers(processedUsers);
        if (!writeSuccess) console.error("CRITICAL: Failed to write updated users.json file during initialization.");
    }

    return processedUsers;
}

// Export the internal function including passwords and roles (for use in login checks)
export { readAndInitializeUsersInternal };

/**
 * Reads the users.json file. Ensures data consistency and returns user profiles WITHOUT passwords.
 * @returns A promise resolving to an array of UserProfile (with role, without passwords) or an empty array on error.
 */
export async function readUsers(): Promise<Array<Omit<UserProfile, 'password'>>> {
  const usersWithData = await readAndInitializeUsersInternal();
  return usersWithData.map(({ password, ...user }) => user);
}

/**
 * Finds a user by email in the local users.json file *including* password hash.
 * Used internally for authentication checks.
 * @param email The email to search for.
 * @returns A promise resolving to the full UserProfile (with password hash) if found, otherwise null.
 */
export async function findUserByEmailInternal(
  email: string | null,
): Promise<UserProfile | null> {
  if (!email) return null;
  try {
    const users = await readAndInitializeUsersInternal(); // Use internal function that reads raw data + password
    const foundUser = users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    return foundUser || null;
  } catch (error) {
    console.error(`Error finding user by email ${email}:`, error);
    return null;
  }
}

/**
 * Adds a new user to the users.json file. Checks for existing email first.
 * Assigns a UUID. Handles hashing the password. Sets appropriate model/expiry based on role.
 * @param newUserProfileData - The user profile data for the new user (password should be plain text). Must include 'role'.
 * @returns A promise resolving with success status, optional message, and the created user profile (without password, but with role).
 */
export async function addUserToJson(
    newUserProfileData: Omit<UserProfile, 'id' | 'createdAt' | 'password' | 'avatarUrl' | 'referral' | 'totalPoints'> & { password: string }
): Promise<{ success: boolean; message?: string; user?: Omit<UserProfile, 'password'> }> {
    if (!newUserProfileData.email || !newUserProfileData.password) {
        return { success: false, message: "Email and password are required for new user." };
    }

    const emailLower = newUserProfileData.email.toLowerCase();
    const assignedRole = getRoleFromEmail(emailLower); // Determine role based on final email

    // Basic validation based on role and email pattern
     if (assignedRole === 'Admin' && emailLower !== primaryAdminEmail && !adminEmailPattern.test(emailLower)) {
         return { success: false, message: `Admin role requires email format 'username-admin@edunexus.com' or the primary admin email.` };
     }
      if (assignedRole === 'User' && (emailLower === primaryAdminEmail || adminEmailPattern.test(emailLower))) {
         return { success: false, message: `Email format '${emailLower}' is reserved for Admin roles.` };
     }

    try {
        const hashedPassword = await bcrypt.hash(newUserProfileData.password, SALT_ROUNDS);

        let userModel: UserModel = newUserProfileData.model || 'free';
        let expiryDate: string | null = newUserProfileData.expiry_date || null; // Expect ISO string or null

        // Apply role-based constraints AFTER role is determined
        if (assignedRole === 'Admin') {
            userModel = 'combo';
            expiryDate = '2099-12-31T00:00:00.000Z';
        } else if (userModel === 'free') {
            expiryDate = null; // Ensure free users have null expiry
        } else if (!expiryDate) {
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
            role: assignedRole, // Store the assigned role
            expiry_date: expiryDate,
            createdAt: new Date().toISOString(),
            avatarUrl: null,
            referral: '',
            totalPoints: 0,
        };

        let users = await readAndInitializeUsersInternal(); // Read current users (handles initialization)

        if (users.some(u => u.email?.toLowerCase() === emailLower)) {
            return { success: false, message: 'User with this email already exists.' };
        }

        users.push(userToAdd);
        const success = await writeUsers(users);

        if (success) {
            const { password, ...userWithoutPassword } = userToAdd;
            return { success: true, user: userWithoutPassword };
        } else {
            return { success: false, message: 'Failed to write users file.' };
        }
    } catch (error: any) {
        console.error('Error adding user to JSON:', error);
        return { success: false, message: `Failed to add user. Reason: ${error.message || 'Unknown error'}` };
    }
}

/**
 * Updates an existing user in the users.json file by ID.
 * Allows updating name, phone, class, model, expiry_date, email, and avatarUrl.
 * Does NOT update password. Role changes require `updateUserRole`.
 * Converts Date objects for expiry_date to ISO strings before saving.
 * Enforces Admin constraints (fixed model/expiry).
 * @param userId The ID of the user to update (string).
 * @param updatedData Partial user profile data to update (excluding role and password).
 * @returns A promise resolving with success status, optional message, and the updated user profile (without password, but with role).
 */
export async function updateUserInJson(
    userId: string,
    updatedData: Partial<Omit<UserProfile, 'id' | 'password' | 'createdAt' | 'role' | 'totalPoints'>> // Exclude role & points from direct update here
): Promise<{ success: boolean; message?: string, user?: Omit<UserProfile, 'password'> }> {
    if (!userId || typeof userId !== 'string') {
        return { success: false, message: "Invalid user ID provided for update." };
    }
    try {
        let users = await readAndInitializeUsersInternal();
        const userIndex = users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return { success: false, message: `User with ID ${userId} not found.` };
        }

        const existingUser = users[userIndex];
        const currentRole = existingUser.role; // Preserve the EXISTING role

        // --- Email Change Validations ---
        const newEmail = updatedData.email?.trim().toLowerCase() || existingUser.email?.trim().toLowerCase();
        const isEmailChanged = newEmail !== existingUser.email?.trim().toLowerCase();

        // 1. Prevent changing primary admin's email
        if (existingUser.email === primaryAdminEmail && isEmailChanged) {
            return { success: false, message: "Cannot change the email of the primary admin account." };
        }

        // 2. Validate new email format based on EXISTING role (user can't change email to an admin format if they aren't admin)
        const newRoleDerived = getRoleFromEmail(newEmail);
        if (currentRole === 'User' && newRoleDerived === 'Admin') {
             return { success: false, message: `Cannot change email to an admin format ('${newEmail}') for a User role.` };
        }
         // Allow admin to change TO a user email, but only if it's not the primary admin
         // This is okay, they remain admin until role is explicitly changed.

        // 3. Check if new email conflicts with another user
        if (isEmailChanged) {
            const conflictingUser = users.find(u => u.email?.toLowerCase() === newEmail && u.id !== userId);
            if (conflictingUser) {
                return { success: false, message: `Email ${newEmail} is already in use by another account.` };
            }
        }

        // --- Model/Expiry based on EXISTING role ---
        let finalModel = updatedData.model ?? existingUser.model;
        let finalExpiryDate = updatedData.expiry_date !== undefined
                               ? (updatedData.expiry_date instanceof Date ? updatedData.expiry_date : (updatedData.expiry_date ? new Date(updatedData.expiry_date) : null))
                               : (existingUser.expiry_date ? new Date(existingUser.expiry_date) : null);

        if (currentRole === 'Admin') { // Enforce admin constraints
            finalModel = 'combo';
            finalExpiryDate = new Date('2099-12-31T00:00:00.000Z');
        } else if (finalModel === 'free') {
            finalExpiryDate = null; // Free users have null expiry
        } else if (!finalExpiryDate) {
           return { success: false, message: "Expiry date is required for paid models." };
        }

        const finalExpiryDateString = finalExpiryDate ? finalExpiryDate.toISOString() : null;

        // Apply updates - keep the existing role and points unless changed by other functions
        const userWithUpdatesApplied: UserProfile = {
            ...existingUser,
            ...updatedData, // Apply general updates first
            id: userId, // Ensure ID remains
            email: newEmail, // Apply potentially updated email
            password: existingUser.password, // Keep existing password hash
            createdAt: existingUser.createdAt, // Preserve original creation date
            role: currentRole, // Keep the existing role
            model: finalModel,
            expiry_date: finalExpiryDateString,
            avatarUrl: updatedData.avatarUrl !== undefined ? updatedData.avatarUrl : existingUser.avatarUrl, // Handle avatar update/removal
            totalPoints: existingUser.totalPoints ?? 0, // Preserve existing points
        };

        users[userIndex] = userWithUpdatesApplied;
        const success = await writeUsers(users);
        if (success) {
             const { password, ...userWithoutPassword } = userWithUpdatesApplied;
             console.log(`User ${userId} updated. Role: ${currentRole}, Model: ${finalModel}`);
             return { success: true, user: userWithoutPassword }; // Return updated user without password
        } else {
            return { success: false, message: 'Failed to write users file.' };
        }
    } catch (error: any) {
        console.error(`Error updating user ${userId} in JSON:`, error);
        return { success: false, message: `Failed to update user. Reason: ${error.message}` };
    }
}

/**
 * Updates the role of a user directly.
 * Validates if the email format is appropriate for the *new* role.
 * Updates model and expiry according to the new role.
 * @param userId The ID of the user to update.
 * @param newRole The new role ('Admin' or 'User').
 * @returns Promise resolving with success status and the updated user profile (without password).
 */
export async function updateUserRole(
    userId: string,
    newRole: 'Admin' | 'User'
): Promise<{ success: boolean; message?: string; user?: Omit<UserProfile, 'password'> }> {
     if (!userId) return { success: false, message: "User ID is required." };
     if (!['Admin', 'User'].includes(newRole)) return { success: false, message: "Invalid role specified." };

     try {
         let users = await readAndInitializeUsersInternal();
         const userIndex = users.findIndex(u => u.id === userId);

         if (userIndex === -1) {
             return { success: false, message: `User with ID ${userId} not found.` };
         }

         const userToUpdate = users[userIndex];

         // --- Role Change Validations ---
         // 1. Prevent changing the primary admin's role
         if (userToUpdate.email === primaryAdminEmail && newRole !== 'Admin') {
             return { success: false, message: "Cannot change the role of the primary admin account." };
         }

         // 2. Validate email format against the *new* role
         if (newRole === 'Admin' && userToUpdate.email !== primaryAdminEmail && !adminEmailPattern.test(userToUpdate.email ?? '')) {
              return { success: false, message: `Cannot promote to Admin. Email '${userToUpdate.email}' does not follow the admin pattern ('username-admin@edunexus.com').` };
         }
          if (newRole === 'User' && (userToUpdate.email === primaryAdminEmail || adminEmailPattern.test(userToUpdate.email ?? ''))) {
              // This check should ideally prevent demoting admin-formatted emails, but let's keep it as a safeguard
              // This case is less likely to occur if validation in updateUserInJson works correctly
              return { success: false, message: `Cannot demote to User. Email format '${userToUpdate.email}' is reserved for Admins.` };
         }

         // Check if role is actually changing
         if (userToUpdate.role === newRole) {
             return { success: true, user: userToUpdate, message: "User already has this role." };
         }

         // --- Update Role and related fields ---
         userToUpdate.role = newRole;
         if (newRole === 'Admin') {
             userToUpdate.model = 'combo';
             userToUpdate.expiry_date = '2099-12-31T00:00:00.000Z';
         } else {
             // When demoting to User, set to 'free' model and null expiry
             userToUpdate.model = 'free';
             userToUpdate.expiry_date = null;
         }

         users[userIndex] = userToUpdate;
         const success = await writeUsers(users);

         if (success) {
             const { password, ...userWithoutPassword } = userToUpdate;
             return { success: true, user: userWithoutPassword };
         } else {
             return { success: false, message: 'Failed to write users file after role update.' };
         }

     } catch (error: any) {
         console.error(`Error updating role for user ${userId}:`, error);
         return { success: false, message: `Failed to update role. Reason: ${error.message}` };
     }
}


/**
 * Deletes a user from the users.json file by ID. Prevents deletion of the primary admin user.
 * Also deletes the user's avatar image if it exists.
 * @param userId The ID of the user to delete (string).
 * @returns A promise resolving with success status and optional message.
 */
export async function deleteUserFromJson(userId: string): Promise<{ success: boolean; message?: string }> {
     if (!userId || typeof userId !== 'string') {
        return { success: false, message: "Invalid user ID provided for deletion." };
    }
    try {
        let users = await readAndInitializeUsersInternal();
        const userIndex = users.findIndex(u => u.id === userId);
        const userToDelete = users[userIndex];

        if (!userToDelete) {
             return { success: false, message: `User with ID ${userId} not found.` };
        }
        if (userToDelete.email === primaryAdminEmail) {
            return { success: false, message: `Cannot delete the primary admin user (${primaryAdminEmail}).` };
        }

        // --- Delete Avatar Image ---
        if (userToDelete.avatarUrl) {
             const avatarFilename = path.basename(userToDelete.avatarUrl);
             const avatarPath = path.join(publicAvatarsPath, avatarFilename);
             try {
                 await fs.access(avatarPath); // Check if file exists
                 await fs.unlink(avatarPath);
                 console.log(`Deleted avatar for user ${userId}: ${avatarPath}`);
             } catch (imgError: any) {
                 if (imgError.code !== 'ENOENT') { // Log error only if it's not "File Not Found"
                    console.error(`Error deleting avatar for user ${userId} (${avatarPath}):`, imgError);
                 } else {
                    console.warn(`Avatar file not found for user ${userId}: ${avatarPath}`);
                 }
             }
        }

        // --- Delete User JSON Entry ---
        users = users.filter(u => u.id !== userId);
        const success = await writeUsers(users);
        return { success, message: success ? undefined : 'Failed to write users file after deletion.' };
    } catch (error: any) {
        console.error(`Error deleting user ${userId} from JSON:`, error);
        return { success: false, message: `Failed to delete user. Reason: ${error.message}` };
    }
}


/**
 * Updates the password hash for a user in the users.json file.
 * @param userId The ID of the user whose password needs updating (string).
 * @param newPassword The new plain text password.
 * @returns A promise resolving with success status and optional message.
 */
export async function updateUserPasswordInJson(userId: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
     if (!userId || typeof userId !== 'string') {
        return { success: false, message: "Invalid user ID provided for password update." };
    }
    if (!newPassword || newPassword.length < 6) {
        return { success: false, message: 'Password must be at least 6 characters long.'};
    }

    try {
        let users = await readAndInitializeUsersInternal();
        const userIndex = users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return { success: false, message: `User with ID ${userId} not found.` };
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

        users[userIndex].password = hashedPassword; // Store the new hash
        const success = await writeUsers(users);
        return { success, message: success ? undefined : 'Failed to write users file after password update.' };
    } catch (error: any) {
        console.error(`Error updating password for user ${userId} in JSON:`, error);
        return { success: false, message: `Failed to update password. Reason: ${error.message}` };
    }
}


/**
 * Retrieves a single user by their ID from users.json.
 * Returns the profile WITHOUT the password field but WITH the role.
 * @param userId The ID of the user to retrieve (string).
 * @returns A promise resolving to the UserProfile (without password, with role) if found, otherwise null.
 */
export async function getUserById(userId: string): Promise<Omit<UserProfile, 'password'> | null> {
  if (!userId || typeof userId !== 'string') {
    return null;
  }
  try {
    const usersWithPasswords = await readAndInitializeUsersInternal();
    const foundUser = usersWithPasswords.find(u => u.id === userId);
    if (!foundUser) return null;
    const { password, ...userWithoutPassword } = foundUser;
     return userWithoutPassword;
  } catch (error) {
    console.error(`Error finding user by ID ${userId}:`, error);
    return null;
  }
}

/**
 * Checks a user's current plan and expiry date against backend data.
 * @param userId The ID of the user to check.
 * @returns A promise resolving to an object { isPlanValid: boolean; message?: string }.
 */
export async function checkUserPlanAndExpiry(userId: string): Promise<{ isPlanValid: boolean; message?: string }> {
    if (!userId) {
        return { isPlanValid: false, message: "User ID not provided." };
    }
    try {
        const currentUser = await getUserById(userId);
        if (!currentUser) {
            return { isPlanValid: false, message: "User not found." };
        }

        // Check expiry date for non-free, non-admin users
        if (currentUser.model !== 'free' && currentUser.role !== 'Admin') {
            if (!currentUser.expiry_date) {
                return { isPlanValid: false, message: "Subscription details incomplete." };
            }
            const expiry = new Date(currentUser.expiry_date);
            if (isNaN(expiry.getTime()) || expiry < new Date()) {
                 return { isPlanValid: false, message: "Your subscription has expired." };
            }
        }
        return { isPlanValid: true }; // Plan is valid or it's a free/admin user
    } catch (error) {
        console.error("Error checking user plan:", error);
        return { isPlanValid: false, message: "Error verifying subscription status." };
    }
}

/**
 * Simulates saving the user data to the local JSON file.
 * NOTE: This function is less safe than specific update functions (`updateUserInJson`, `updateUserRole`).
 * Use with caution, preferably only for internal initialization or recovery scenarios.
 * @param userData The full user profile data to save (password should ideally be pre-hashed).
 * @returns A promise resolving to true on success, false on failure.
 */
export async function saveUserToJson(userData: UserProfile): Promise<boolean> {
  try {
    let users = await readAndInitializeUsersInternal();
    const userIndex = users.findIndex(u => u.id === userData.id || u.email === userData.email);

    if (userIndex !== -1) {
      // Update existing user - Merge carefully, ensuring role/password are handled correctly
      const existingUser = users[userIndex];
      users[userIndex] = {
          ...existingUser, // Start with existing data
          ...userData, // Apply updates
          // Ensure crucial fields are not accidentally overwritten with undefined/null if not provided
          password: userData.password ?? existingUser.password,
          role: userData.role ?? existingUser.role,
          totalPoints: userData.totalPoints ?? existingUser.totalPoints ?? 0,
          createdAt: userData.createdAt ?? existingUser.createdAt ?? new Date().toISOString(),
          id: userData.id ?? existingUser.id, // Keep existing ID
      };
    } else {
      // Add new user (ensure required fields like ID, createdAt, role, and HASHED password are set)
      const assignedRole = userData.role || getRoleFromEmail(userData.email);
      let hashedPassword = userData.password;
       // Hash password if it's not already hashed (basic check)
       if (hashedPassword && !hashedPassword.startsWith('$2a$') && !hashedPassword.startsWith('$2b$')) {
            hashedPassword = await bcrypt.hash(hashedPassword, SALT_ROUNDS);
       } else if (!hashedPassword) {
            // Assign and hash a temporary password if none provided
            const randomPassword = Math.random().toString(36).slice(-8);
            hashedPassword = await bcrypt.hash(randomPassword, SALT_ROUNDS);
            console.warn(`Assigned temporary password for new user ${userData.email}`);
       }

      users.push({
        ...userData,
        id: userData.id || uuidv4(),
        createdAt: userData.createdAt || new Date().toISOString(),
        role: assignedRole,
        password: hashedPassword, // Ensure password is set and hashed
        totalPoints: userData.totalPoints ?? 0, // Ensure points are initialized
      });
    }

    return await writeUsers(users);
  } catch (error) {
    console.error('Error saving user to JSON:', error);
    return false;
  }
}
