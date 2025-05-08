// src/actions/user-actions.ts
'use server';

import type { UserProfile, AcademicStatus, UserModel, ContextUser } from '@/types'; // Import ContextUser
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;
const usersFilePath = path.join(process.cwd(), 'src', 'data', 'users.json');
const publicAvatarsPath = path.join(process.cwd(), 'public', 'avatars');

const primaryAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@edunexus.com';
// Removed adminEmailPattern as it's no longer used for validation in role changes
// const adminEmailPattern = /^[a-zA-Z0-9._%+-]+-admin@edunexus\.com$/;
const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'Soham@1234';

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

// Helper function to determine role based on email (used for NEW user creation and default display)
// IMPORTANT: Role assignment during EDIT/ROLE CHANGE is now handled directly, not inferred from email.
const getRoleFromEmail = (email: string | null): 'Admin' | 'User' => {
    if (!email) return 'User';
    // For default role inference, still use the primary admin email check.
    // We no longer infer based on the pattern for existing users' role changes.
    return email === primaryAdminEmail ? 'Admin' : 'User';
};


/**
 * INTERNAL HELPER: Reads the users.json file, performs initialization (adds admin, assigns IDs, formats dates, hashes passwords, assigns roles),
 * and returns the full user list *including* hashed passwords and roles.
 * Used internally by write operations and auth checks.
 * @returns A promise resolving to the array of UserProfile including passwords and roles.
 */
async function readAndInitializeUsersInternal(): Promise<UserProfile[]> {
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
      // Explicitly cast to UserProfile[] and handle potential missing roles later
      users = parsedUsers as UserProfile[];
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn('users.json not found. Creating file with default admin.');
      writeNeeded = true;
    } else {
      console.error('Error reading or parsing users.json:', error);
      // Attempt to recover with an empty array if parsing fails
      users = [];
      writeNeeded = true; // Force rewrite if file was corrupted
    }
  }

  const processedUsers: UserProfile[] = [];
  for (const user of users) {
    // Basic check for minimal structure
    if (typeof user !== 'object' || user === null || typeof user.id === 'undefined') {
        console.warn("Skipping invalid user entry:", user);
        writeNeeded = true; // Mark for rewrite to clean up invalid entries
        continue;
    }

    let currentUser = { ...user };
    let userModified = false;

    // Assign ID if missing or not a string
    if (!currentUser.id || typeof currentUser.id !== 'string') {
      currentUser.id = uuidv4();
      console.warn(`User ${currentUser.email || 'unknown'} assigned new UUID: ${currentUser.id}.`);
      userModified = true;
    }

    // Assign/Verify Role: Prioritize stored role, then primary admin email.
     if (currentUser.role === undefined || (currentUser.role !== 'Admin' && currentUser.role !== 'User')) {
         // If role is missing or invalid, check if it's the primary admin.
         if (currentUser.email === primaryAdminEmail) {
            currentUser.role = 'Admin';
         } else {
            // For any other user without a valid role, default to 'User'.
            // We don't infer based on email pattern anymore here.
            currentUser.role = 'User';
         }
         console.warn(`User ${currentUser.email || currentUser.id} missing/invalid role. Assigned role: ${currentUser.role}.`);
         userModified = true;
     } else if (currentUser.email === primaryAdminEmail && currentUser.role !== 'Admin') {
        // Correct the primary admin's role if it was somehow set incorrectly.
        currentUser.role = 'Admin';
        console.warn(`Correcting primary admin role to 'Admin'.`);
        userModified = true;
     }


    // Hash plain text passwords found during initialization
    if (currentUser.password && !currentUser.password.startsWith('$2a$') && !currentUser.password.startsWith('$2b$')) {
      console.warn(`User ${currentUser.email || currentUser.id} has plain text password. Hashing now.`);
      try {
        currentUser.password = await bcrypt.hash(currentUser.password, SALT_ROUNDS);
        userModified = true;
      } catch (hashError) {
        console.error(`Failed to hash password for user ${currentUser.email || currentUser.id}:`, hashError);
        // Consider how to handle this failure - maybe mark the account as needing password reset?
      }
    } else if (!currentUser.password) {
       // Assign a default, secure temporary password if none exists. Log a warning.
        console.warn(`User ${currentUser.email || currentUser.id} missing password. Assigning temporary hashed password.`);
        try {
            const randomPassword = Math.random().toString(36).slice(-8); // Generate random password
            currentUser.password = await bcrypt.hash(randomPassword, SALT_ROUNDS);
            userModified = true;
            // Consider notifying the user/admin about the temporary password assignment if possible
        } catch (hashError) {
            console.error(`CRITICAL: Failed to hash temporary password for ${currentUser.email || currentUser.id}`, hashError);
            // If hashing fails, the user account might be unusable.
        }
    }

    // Format date fields (ensure they are ISO strings or null)
     if (currentUser.expiry_date && !(typeof currentUser.expiry_date === 'string' && !isNaN(Date.parse(currentUser.expiry_date)))) {
         try {
             currentUser.expiry_date = new Date(currentUser.expiry_date).toISOString(); userModified = true;
         } catch { currentUser.expiry_date = null; userModified = true; }
     }
     if (currentUser.createdAt && !(typeof currentUser.createdAt === 'string' && !isNaN(Date.parse(currentUser.createdAt)))) {
          try {
             currentUser.createdAt = new Date(currentUser.createdAt).toISOString(); userModified = true;
          } catch { currentUser.createdAt = new Date().toISOString(); userModified = true;}
     } else if (!currentUser.createdAt) {
         currentUser.createdAt = new Date().toISOString(); userModified = true;
     }

    // Validate model and expiry based on role
    if (!currentUser.model || !['free', 'chapterwise', 'full_length', 'combo'].includes(currentUser.model)) {
      currentUser.model = 'free'; userModified = true;
    }
    if (currentUser.role === 'Admin') { // Admins must have combo and long expiry
         if (currentUser.model !== 'combo') { currentUser.model = 'combo'; userModified = true; }
         const adminExpiry = '2099-12-31T00:00:00.000Z';
         if (currentUser.expiry_date !== adminExpiry) { currentUser.expiry_date = adminExpiry; userModified = true; }
    } else { // Regular users
         if (currentUser.model === 'free' && currentUser.expiry_date !== null) { currentUser.expiry_date = null; userModified = true; }
    }

    // Ensure avatarUrl exists (as null if not set)
    if (currentUser.avatarUrl === undefined) { currentUser.avatarUrl = null; userModified = true; }
    // Ensure class exists (as null if not set)
    if (currentUser.class === undefined) { currentUser.class = null; userModified = true; }
    // Ensure phone exists (as null if not set)
     if (currentUser.phone === undefined) { currentUser.phone = null; userModified = true; }
    // Ensure referral exists (as '' if not set)
     if (currentUser.referral === undefined) { currentUser.referral = ''; userModified = true; }

    processedUsers.push(currentUser);
    if (userModified) writeNeeded = true;
  } // End user loop

  // --- Ensure Default Admin User ---
  const adminUserIndex = processedUsers.findIndex(u => u.email === primaryAdminEmail);
  let adminPasswordHash = adminUserIndex !== -1 ? processedUsers[adminUserIndex].password : undefined;
  let adminNeedsUpdate = false;

  if (!adminPasswordHash || (!adminPasswordHash.startsWith('$2a$') && !adminPasswordHash.startsWith('$2b$'))) {
    try {
      adminPasswordHash = await bcrypt.hash(defaultAdminPassword, SALT_ROUNDS);
      adminNeedsUpdate = true;
    } catch (hashError) { console.error("CRITICAL: Failed to hash default admin password:", hashError); adminPasswordHash = defaultAdminPassword; }
  } else {
     // Verify if the stored hash matches the one from .env (in case it changed)
     try {
       const passwordMatch = await bcrypt.compare(defaultAdminPassword, adminPasswordHash);
       if (!passwordMatch) {
           console.warn(`Admin password in .env changed. Updating hash for ${primaryAdminEmail}.`);
           adminPasswordHash = await bcrypt.hash(defaultAdminPassword, SALT_ROUNDS);
           adminNeedsUpdate = true;
       }
     } catch (compareError) {
       console.error("Error comparing admin password hash:", compareError);
       // Decide if we should force update or leave as is. Forcing might lock admin out if .env is wrong.
     }
  }

  if (adminUserIndex !== -1) {
    const currentAdmin = processedUsers[adminUserIndex];
    let adminModified = false;
    if (adminNeedsUpdate) { currentAdmin.password = adminPasswordHash; adminModified = true; }
    // Ensure primary admin always has the Admin role and combo plan
    if (currentAdmin.role !== 'Admin') { currentAdmin.role = 'Admin'; adminModified = true; console.warn("Correcting primary admin role to 'Admin'."); }
    if (currentAdmin.model !== 'combo') { currentAdmin.model = 'combo'; adminModified = true; console.warn("Correcting primary admin model to 'combo'."); }
    if (currentAdmin.expiry_date !== '2099-12-31T00:00:00.000Z') { currentAdmin.expiry_date = '2099-12-31T00:00:00.000Z'; adminModified = true; }
    if (adminModified) writeNeeded = true;
  } else {
    console.warn(`Default admin user (${primaryAdminEmail}) not found. Adding.`);
    processedUsers.push({
      id: uuidv4(),
      email: primaryAdminEmail,
      password: adminPasswordHash,
      name: 'Admin User (Primary)',
      phone: '0000000000', // Default phone
      class: 'Dropper', // Default class
      model: 'combo',
      role: 'Admin', // Explicitly set role
      expiry_date: '2099-12-31T00:00:00.000Z',
      createdAt: new Date().toISOString(),
      avatarUrl: null,
      referral: '',
    });
    writeNeeded = true;
  }

  if (writeNeeded) {
    const writeSuccess = await writeUsers(processedUsers);
    if (!writeSuccess) console.error("CRITICAL: Failed to write updated users.json file during initialization.");
  }

  return processedUsers;
}

// Export the internal function including passwords and roles (for use in login checks)
export { readAndInitializeUsersInternal as readUsersWithPasswordsInternal };

/**
 * Reads the users.json file. Ensures the default admin user exists.
 * Assigns UUID to users missing an ID.
 * Converts date fields to ISO strings if they are not already.
 * Hashes any plain text passwords found (migration).
 * Assigns roles based on explicit role field or primary admin email.
 * Returns user profiles WITHOUT passwords but WITH roles for general use.
 * @returns A promise resolving to an array of UserProfile (with role, without passwords) or an empty array on error.
 */
export async function readUsers(): Promise<Array<Omit<UserProfile, 'password'>>> {
  const usersWithData = await readAndInitializeUsersInternal();
  // Return users WITHOUT passwords but include the verified/assigned role
  return usersWithData.map(({ password, ...user }) => user); // Role is part of user now
}

/**
 * Finds a user by email in the local users.json file *without* checking password.
 * Used internally, returns full profile including password hash and role.
 * @param email The email to search for.
 * @returns A promise resolving to the UserProfile (with role) if found, otherwise null.
 */
export async function findUserByEmailInternal(
  email: string | null,
): Promise<UserProfile | null> {
  if (!email) return null;
  try {
    const users = await readAndInitializeUsersInternal(); // Use internal function
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
 * Assigns a UUID. Handles hashing the password. Assigns the role based on input.
 * Sets appropriate model/expiry based on role.
 * @param newUserProfileData - The user profile data for the new user (password should be plain text). Must include 'role'.
 * @returns A promise resolving with success status, optional message, and the created user profile (without password, but with role).
 */
export async function addUserToJson(
    newUserProfileData: Omit<UserProfile, 'id' | 'createdAt' | 'password' | 'avatarUrl' | 'referral'> & { password: string }
): Promise<{ success: boolean; message?: string; user?: Omit<UserProfile, 'password'> }> {
    if (!newUserProfileData.email || !newUserProfileData.password) {
        return { success: false, message: "Email and password are required for new user." };
    }

    const emailLower = newUserProfileData.email.toLowerCase();
    // Role assignment now depends on the *explicitly passed* or *defaulted* role in newUserProfileData
    // But we still need to validate constraints based on the intended role.
    const assignedRole = newUserProfileData.role === 'Admin' ? 'Admin' : 'User';

    try {
        const hashedPassword = await bcrypt.hash(newUserProfileData.password, SALT_ROUNDS);

        let userModel: UserModel = newUserProfileData.model || 'free';
        let expiryDate: string | null = newUserProfileData.expiry_date || null; // Expect ISO string or null

        // Apply role-based constraints
        if (assignedRole === 'Admin') {
            userModel = 'combo';
            expiryDate = '2099-12-31T00:00:00.000Z';
        } else if (userModel === 'free') {
            expiryDate = null; // Ensure free users have null expiry
        } else if (!expiryDate) {
            // Require expiry for paid plans (if role is User)
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
            avatarUrl: null, // Default avatar
            referral: '', // Default referral
        };

        let users = await readAndInitializeUsersInternal();

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
 * Does NOT update password or role via this function. Use specific functions for those.
 * Converts Date objects for expiry_date to ISO strings before saving.
 * Handles Admin constraints (fixed model/expiry).
 * @param userId The ID of the user to update (string).
 * @param updatedData Partial user profile data to update (excluding role and password).
 * @returns A promise resolving with success status, optional message, and the updated user profile (without password, but with role).
 */
export async function updateUserInJson(
    userId: string,
    updatedData: Partial<Omit<UserProfile, 'id' | 'password' | 'createdAt' | 'role'>> // Exclude role from direct update here
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
        const isPrimaryAdmin = existingUser.email === primaryAdminEmail;
        const currentRole = existingUser.role; // Keep the existing role

        // Handle potential email change
        const newEmail = updatedData.email?.trim().toLowerCase() || existingUser.email;

        // *** Email Change Validations ***
        // 1. Prevent changing primary admin's email
        if (isPrimaryAdmin && newEmail !== existingUser.email) {
            return { success: false, message: "Cannot change the email of the primary admin account." };
        }

        // 2. Check if new email is already taken by another user (only if email changed)
        if (newEmail !== existingUser.email) {
            const conflictingUser = await findUserByEmailInternal(newEmail);
            if (conflictingUser && conflictingUser.id !== userId) {
                return { success: false, message: `Email ${newEmail} is already in use by another account.` };
            }
        }

        // Determine final model and expiry based on the *current* role and updated model
        let finalModel = updatedData.model ?? existingUser.model; // Prefer updated model if provided
        let finalExpiryDate = updatedData.expiry_date !== undefined
                               ? (updatedData.expiry_date instanceof Date ? updatedData.expiry_date : (updatedData.expiry_date ? new Date(updatedData.expiry_date) : null))
                               : (existingUser.expiry_date ? new Date(existingUser.expiry_date) : null);

        if (currentRole === 'Admin') { // If the user *is* an Admin, enforce admin constraints
            finalModel = 'combo'; // Admins always get combo
            finalExpiryDate = new Date('2099-12-31T00:00:00.000Z'); // Admins get long expiry
        } else if (finalModel === 'free') {
            finalExpiryDate = null; // Free users have null expiry
        } else if (!finalExpiryDate) {
           // Require expiry for paid plans
           return { success: false, message: "Expiry date is required for paid models." };
        }

        const finalExpiryDateString = finalExpiryDate ? finalExpiryDate.toISOString() : null;

        // Apply updates - keep the existing role unless changed by updateUserRole
        const userWithUpdatesApplied: UserProfile = {
            ...existingUser,
            ...updatedData, // Apply general updates first
            id: userId, // Ensure ID remains
            email: newEmail, // Apply potentially updated email
            password: existingUser.password, // Password not changed here
            createdAt: existingUser.createdAt, // Preserve original creation date
            role: currentRole, // Keep the existing role
            model: finalModel, // Apply potentially updated model
            expiry_date: finalExpiryDateString, // Apply potentially updated expiry
            avatarUrl: updatedData.avatarUrl !== undefined ? updatedData.avatarUrl : existingUser.avatarUrl,
        };

        users[userIndex] = userWithUpdatesApplied;
        const success = await writeUsers(users);
        if (success) {
             const { password, ...userWithoutPassword } = userWithUpdatesApplied; // Remove password before returning
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
 * Handles email format validation based on the new role.
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
         // 2. REMOVED: Email format validation removed. Any user (except primary admin) can be promoted/demoted.


         // --- Update Role and related fields ---
         userToUpdate.role = newRole;
         if (newRole === 'Admin') {
             userToUpdate.model = 'combo';
             userToUpdate.expiry_date = '2099-12-31T00:00:00.000Z'; // Ensure long expiry for admin
         } else {
             // When demoting, set to 'free' and null expiry.
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
     // The role is already part of the user object from readAndInitializeUsersInternal
     return userWithoutPassword;
  } catch (error) {
    console.error(`Error finding user by ID ${userId}:`, error);
    return null;
  }
}

// Add the missing checkUserPlanAndExpiry function
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

        // Add any other plan validation logic here if needed

        return { isPlanValid: true }; // Plan is valid or it's a free/admin user

    } catch (error) {
        console.error("Error checking user plan:", error);
        return { isPlanValid: false, message: "Error verifying subscription status." };
    }
}

/**
 * Simulates saving the user data to the local JSON file.
 * In a real application, this would interact with a database or API.
 * @param userData The user profile data to save.
 * @returns A promise resolving to true on success, false on failure.
 */
export async function saveUserToJson(userData: UserProfile): Promise<boolean> {
  try {
    let users = await readAndInitializeUsersInternal(); // Use internal function to handle init/hashing/roles
    const userIndex = users.findIndex(u => u.id === userData.id || u.email === userData.email);

    if (userIndex !== -1) {
      // Update existing user - Merge carefully, ensuring role is preserved or handled by role change logic
      const existingUser = users[userIndex];
      users[userIndex] = { ...existingUser, ...userData }; // Ensure role is part of userData if it should be updated
    } else {
      // Add new user (ensure required fields like ID, createdAt, and role are set)
       // Role should be determined before calling this ideally, or use getRoleFromEmail for default
       const assignedRole = userData.role || getRoleFromEmail(userData.email); // Ensure role exists
      users.push({
        ...userData,
        id: userData.id || uuidv4(),
        createdAt: userData.createdAt || new Date().toISOString(),
        role: assignedRole, // Store the assigned role
      });
    }

    return await writeUsers(users);
  } catch (error) {
    console.error('Error saving user to JSON:', error);
    return false;
  }
}
