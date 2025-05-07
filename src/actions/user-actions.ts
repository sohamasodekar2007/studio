// src/actions/user-actions.ts
'use server';

import type { UserProfile, AcademicStatus, UserModel } from '@/types';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// WARNING: This approach is NOT recommended for production due to security and scalability concerns.
// Use a proper database like Firestore instead.
const usersFilePath = path.join(process.cwd(), 'src', 'data', 'users.json');

// Define the default admin user details
const defaultAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@edunexus.com';
const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'Soham@1234'; // Fallback if not set in env
const defaultAdminProfileBase: Omit<UserProfile, 'id' | 'createdAt' | 'password'> = {
    email: defaultAdminEmail,
    name: 'Admin User',
    phone: '0000000000', // Default placeholder phone
    referral: '',
    class: 'Dropper',
    model: 'combo', // Admin always has combo model
    expiry_date: new Date('2099-12-31T00:00:00.000Z').toISOString(), // Long expiry for admin, ISO format
};

/**
 * Writes the users array to the users.json file.
 * @param users The array of UserProfile to write.
 * @returns A promise resolving to true on success, false on error.
 */
async function writeUsers(users: UserProfile[]): Promise<boolean> {
    try {
        // Ensure directory exists
        await fs.mkdir(path.dirname(usersFilePath), { recursive: true });
        await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error('Failed to write users.json:', error);
        return false;
    }
}


/**
 * Reads the users.json file. Ensures the default admin user exists.
 * Assigns UUID to users missing an ID.
 * Converts date fields to ISO strings if they are not already.
 * Returns user profiles WITHOUT passwords for general use.
 * @returns A promise resolving to an array of UserProfile (without passwords) or an empty array on error.
 */
export async function readUsers(): Promise<Omit<UserProfile, 'password'>[]> {
    const usersWithPasswords = await readAndInitializeUsersInternal();
    // Return users WITHOUT passwords for general use
    return usersWithPasswords.map(({ password, ...userWithoutPassword }) => userWithoutPassword);
}

/**
 * INTERNAL HELPER: Reads the users.json file, performs initialization (adds admin, assigns IDs, formats dates),
 * and returns the full user list *including* passwords.
 * Used internally by write operations and auth checks.
 * @returns A promise resolving to the array of UserProfile including passwords.
 */
async function readAndInitializeUsersInternal(): Promise<UserProfile[]> {
  let users: UserProfile[] = [];
  let writeNeeded = false;

  try {
    await fs.access(usersFilePath); // Check if file exists first
    const fileContent = await fs.readFile(usersFilePath, 'utf-8');
    const parsedUsers = JSON.parse(fileContent);
    if (!Array.isArray(parsedUsers)) {
      console.error('users.json does not contain a valid array. Re-initializing with default admin.');
      users = [];
      writeNeeded = true;
    } else {
        users = parsedUsers as UserProfile[];
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn('users.json not found. Creating an empty file with default admin.');
      writeNeeded = true;
    } else {
      console.error('Error reading or parsing users.json:', error);
      writeNeeded = true; // Re-initialize on other errors too
    }
     users = []; // Ensure users is an empty array if read failed
  }

  // --- Ensure all users have string IDs (UUIDs) and correct date formats ---
  users.forEach(user => {
    if (!user.id || typeof user.id !== 'string') {
        user.id = uuidv4();
        console.warn(`User ${user.email || 'unknown'} assigned new UUID: ${user.id}.`);
        writeNeeded = true;
    }
    if (user.expiry_date && !(user.expiry_date instanceof Date) && isNaN(Date.parse(user.expiry_date))) {
        console.warn(`User ${user.email || user.id} has invalid expiry_date format (${user.expiry_date}). Setting to null.`);
        user.expiry_date = null;
        writeNeeded = true;
    } else if (user.expiry_date instanceof Date) {
        user.expiry_date = user.expiry_date.toISOString(); // Convert Date to ISO string
        writeNeeded = true;
    }

    if (user.createdAt && !(user.createdAt instanceof Date) && isNaN(Date.parse(user.createdAt))) {
        console.warn(`User ${user.email || user.id} has invalid createdAt format (${user.createdAt}). Setting to current time.`);
        user.createdAt = new Date().toISOString();
        writeNeeded = true;
    } else if (user.createdAt instanceof Date) {
        user.createdAt = user.createdAt.toISOString(); // Convert Date to ISO string
        writeNeeded = true;
    } else if (!user.createdAt) {
        user.createdAt = new Date().toISOString();
        writeNeeded = true;
    }

    // Ensure model is valid, default to 'free' if not
    if (!user.model || !['free', 'chapterwise', 'full_length', 'combo'].includes(user.model)) {
        console.warn(`User ${user.email || user.id} has invalid model (${user.model}). Setting to 'free'.`);
        user.model = 'free';
        writeNeeded = true;
    }
    // Nullify expiry_date if model is 'free'
    if (user.model === 'free' && user.expiry_date !== null) {
        console.warn(`User ${user.email || user.id} is 'free' model but has expiry_date. Setting to null.`);
        user.expiry_date = null;
        writeNeeded = true;
    }

  });

  // --- Ensure Default Admin User Exists and is Correct ---
   const adminUserIndex = users.findIndex(u => u.email === defaultAdminEmail);
   const adminId = users[adminUserIndex]?.id || uuidv4();
   const defaultAdminUserWithId: UserProfile = {
       ...defaultAdminProfileBase,
       id: adminId,
       password: defaultAdminPassword,
       createdAt: users[adminUserIndex]?.createdAt || new Date().toISOString(), // Preserve original or set new
       expiry_date: defaultAdminProfileBase.expiry_date, // Ensure it's ISO
   };

  if (adminUserIndex !== -1) {
    let adminNeedsUpdate = false;
    const currentAdmin = users[adminUserIndex];

     if (currentAdmin.password !== defaultAdminPassword) {
         console.warn(`Admin user ${defaultAdminEmail} password incorrect. Resetting.`);
         currentAdmin.password = defaultAdminPassword;
         adminNeedsUpdate = true;
     }
     if (currentAdmin.model !== 'combo') {
         console.warn(`Admin user ${defaultAdminEmail} model incorrect. Setting to 'combo'.`);
         currentAdmin.model = 'combo';
         adminNeedsUpdate = true;
     }
      if (currentAdmin.expiry_date !== defaultAdminUserWithId.expiry_date) {
         console.warn(`Admin user ${defaultAdminEmail} expiry date incorrect. Setting default.`);
         currentAdmin.expiry_date = defaultAdminUserWithId.expiry_date;
         adminNeedsUpdate = true;
      }
       if (currentAdmin.id !== adminId) {
           currentAdmin.id = adminId;
           adminNeedsUpdate = true;
       }
        if (!currentAdmin.createdAt || (currentAdmin.createdAt instanceof Date) || isNaN(Date.parse(currentAdmin.createdAt))) {
             currentAdmin.createdAt = defaultAdminUserWithId.createdAt;
             adminNeedsUpdate = true;
        }
     if (adminNeedsUpdate) {
         users[adminUserIndex] = { ...currentAdmin }; // Ensure a new object for re-rendering if needed
         writeNeeded = true;
     }
  } else {
    console.warn(`Default admin user (${defaultAdminEmail}) not found. Adding.`);
    users.push(defaultAdminUserWithId);
    writeNeeded = true;
  }

  if (writeNeeded) {
      const writeSuccess = await writeUsers(users);
      if (writeSuccess) {
          console.log("users.json created or updated with default admin user details and user field checks.");
      } else {
          console.error("Failed to write updated users.json file.");
          // Potentially throw error here if critical
      }
  }
  return users;
}


/**
 * Saves or updates user data in the local users.json file.
 * If a user with the same ID exists, it updates; otherwise, it adds.
 * Converts Date objects for expiry_date to ISO strings before saving.
 *
 * @param userProfileData - The full UserProfile object to save or update.
 * @returns A promise that resolves with success status and optional message.
 */
export async function saveUserToJson(
    userProfileData: UserProfile
): Promise<{ success: boolean; message?: string }> {

    if (!userProfileData.id || typeof userProfileData.id !== 'string') {
        console.error("Attempted to save user without a valid string ID:", userProfileData);
        return { success: false, message: 'Invalid user ID provided for saving.' };
    }

    const userToSave: UserProfile = {
        ...userProfileData,
        expiry_date: userProfileData.expiry_date instanceof Date
                        ? userProfileData.expiry_date.toISOString()
                        : (userProfileData.expiry_date ? new Date(userProfileData.expiry_date).toISOString() : null),
        createdAt: userProfileData.createdAt instanceof Date
                        ? userProfileData.createdAt.toISOString()
                        : (userProfileData.createdAt ? new Date(userProfileData.createdAt).toISOString() : new Date().toISOString()),
        model: userProfileData.model || 'free',
    };
     if (userToSave.model === 'free') userToSave.expiry_date = null;


    try {
        let users = await readAndInitializeUsersInternal();
        const existingUserIndex = users.findIndex(u => u.id === userToSave.id);

        if (existingUserIndex !== -1) {
            // Merge safely: preserve existing password if not explicitly provided in userToSave
            // Preserve original creation date
            users[existingUserIndex] = {
                ...users[existingUserIndex], // Start with existing
                ...userToSave,             // Override with new data
                password: userToSave.password !== undefined ? userToSave.password : users[existingUserIndex].password,
                createdAt: users[existingUserIndex].createdAt || userToSave.createdAt,
            };
            console.log(`User data for ${userToSave.email} (ID: ${userToSave.id}) updated.`);
        } else {
            // Add new user (this path should ideally be handled by addUserToJson)
            users.push(userToSave);
            console.log(`New user ${userToSave.email} (ID: ${userToSave.id}) added via saveUserToJson.`);
        }

        const writeSuccess = await writeUsers(users);
        return { success: writeSuccess, message: writeSuccess ? undefined : 'Failed to write user data.' };
    } catch (error: any) {
        console.error('Failed to save/update user in users.json:', error);
        return { success: false, message: `Failed to save user. Reason: ${error.message}` };
    }
}


/**
 * Adds a new user to the users.json file. Checks for existing email first.
 * Assigns a UUID. Sets default 'free' model.
 * @param newUserProfileData - The user profile data for the new user (password should be included).
 * @returns A promise resolving with success status and optional message.
 */
export async function addUserToJson(newUserProfileData: Omit<UserProfile, 'id' | 'createdAt'> & {password: string}): Promise<{ success: boolean; message?: string; user?: UserProfile }> {
    if (!newUserProfileData.email || !newUserProfileData.password) {
        return { success: false, message: "Email and password are required for new user." };
    }

    const userToAdd: UserProfile = {
         ...newUserProfileData,
         id: uuidv4(),
         createdAt: new Date().toISOString(),
         model: newUserProfileData.model || 'free',
         expiry_date: newUserProfileData.model === 'free' ? null : (newUserProfileData.expiry_date ? new Date(newUserProfileData.expiry_date).toISOString() : null),
         class: newUserProfileData.class || null,
         phone: newUserProfileData.phone || null,
         name: newUserProfileData.name || null,
         referral: newUserProfileData.referral || '',
    };

    try {
        let users = await readAndInitializeUsersInternal();

        if (users.some(u => u.email?.toLowerCase() === userToAdd.email?.toLowerCase())) {
            return { success: false, message: 'User with this email already exists.' };
        }

        users.push(userToAdd);
        const success = await writeUsers(users);
        if (success) {
            return { success: true, user: userToAdd };
        } else {
            return { success: false, message: 'Failed to write users file.' };
        }
    } catch (error: any) {
        console.error('Error adding user to JSON:', error);
        return { success: false, message: `Failed to add user. Reason: ${error.message}` };
    }
}

/**
 * Updates an existing user in the users.json file by ID.
 * Allows updating specific fields like name, phone, model, expiry_date.
 * Does NOT update email or password via this function.
 * Converts Date objects for expiry_date to ISO strings before saving.
 * @param userId The ID of the user to update (string).
 * @param updatedData Partial user profile data to update.
 * @returns A promise resolving with success status, optional message, and the updated user profile.
 */
export async function updateUserInJson(userId: string, updatedData: Partial<Omit<UserProfile, 'id' | 'email' | 'password' | 'createdAt'>>): Promise<{ success: boolean; message?: string, user?: UserProfile }> {
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
        const userWithUpdatesApplied: UserProfile = {
            ...existingUser,
            ...updatedData,
            id: userId,
            email: existingUser.email, // Email cannot be changed here
            password: existingUser.password, // Password not changed here
            createdAt: existingUser.createdAt, // Preserve original creation date
        };

        if (updatedData.model === 'free') {
            userWithUpdatesApplied.expiry_date = null;
        } else if (updatedData.expiry_date && !(updatedData.expiry_date instanceof Date)) {
             userWithUpdatesApplied.expiry_date = new Date(updatedData.expiry_date).toISOString();
        } else if (updatedData.expiry_date instanceof Date) {
            userWithUpdatesApplied.expiry_date = updatedData.expiry_date.toISOString();
        }


        users[userIndex] = userWithUpdatesApplied;
        const success = await writeUsers(users);
        if (success) {
            return { success: true, user: userWithUpdatesApplied };
        } else {
            return { success: false, message: 'Failed to write users file.' };
        }
    } catch (error: any) {
        console.error(`Error updating user ${userId} in JSON:`, error);
        return { success: false, message: `Failed to update user. Reason: ${error.message}` };
    }
}

/**
 * Deletes a user from the users.json file by ID. Prevents deletion of the default admin user.
 * @param userId The ID of the user to delete (string).
 * @returns A promise resolving with success status and optional message.
 */
export async function deleteUserFromJson(userId: string): Promise<{ success: boolean; message?: string }> {
     if (!userId || typeof userId !== 'string') {
        return { success: false, message: "Invalid user ID provided for deletion." };
    }
    try {
        let users = await readAndInitializeUsersInternal();
        const userToDelete = users.find(u => u.id === userId);

        if (!userToDelete) {
             return { success: false, message: `User with ID ${userId} not found.` };
        }
        if (userToDelete.email === defaultAdminEmail) {
            return { success: false, message: `Cannot delete the primary admin user (${defaultAdminEmail}).` };
        }

        users = users.filter(u => u.id !== userId);
        const success = await writeUsers(users);
        return { success, message: success ? undefined : 'Failed to write users file after deletion.' };
    } catch (error: any) {
        console.error(`Error deleting user ${userId} from JSON:`, error);
        return { success: false, message: `Failed to delete user. Reason: ${error.message}` };
    }
}

/**
 * Updates the password for a user in the users.json file.
 * WARNING: Highly insecure.
 * @param userId The ID of the user whose password needs updating (string).
 * @param newPassword The new plain text password.
 * @returns A promise resolving with success status and optional message.
 */
export async function updateUserPasswordInJson(userId: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
    console.warn("WARNING: Updating plain text password in users.json is highly insecure.");
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
        users[userIndex].password = newPassword;
        const success = await writeUsers(users);
        return { success, message: success ? undefined : 'Failed to write users file after password update.' };
    } catch (error: any) {
        console.error(`Error updating password for user ${userId} in JSON:`, error);
        return { success: false, message: `Failed to update password. Reason: ${error.message}` };
    }
}

/**
 * Retrieves a single user by their ID from users.json.
 * Returns the profile WITHOUT the password field.
 * @param userId The ID of the user to retrieve (string).
 * @returns A promise resolving to the UserProfile (without password) if found, otherwise null.
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

// Initialize users.json with default admin if it doesn't exist or is invalid
// This function is called implicitly by readAndInitializeUsersInternal
async function initializeDataStore() {
    try {
        await readAndInitializeUsersInternal();
        console.log("User data store initialized/verified.");
    } catch (error) {
        console.error("Fatal error initializing user data store:", error);
        // Handle critical error, e.g., by preventing app startup or showing a global error
    }
}

// Call initialization on server start (though 'use server' actions run per request)
// For a true "on server start", this might be in a different context or a startup script.
// For this local file-based system, it's checked on first read.
initializeDataStore();
