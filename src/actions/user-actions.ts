
// src/actions/user-actions.ts
'use server';

import type { UserProfile, AcademicStatus, UserModel } from '@/types'; // Import UserModel
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid'; // Import UUID generator

// WARNING: This approach is NOT recommended for production due to security and scalability concerns.
// Use a proper database like Firestore instead.
const usersFilePath = path.join(process.cwd(), 'src', 'data', 'users.json');

// Define the default admin user details
const defaultAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@edunexus.com'; // Use env var or fallback
// WARNING: Storing default password in code is insecure. Use environment variable or secure config.
const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'Soham@1234'; // Fallback if not set in env
const defaultAdminProfileBase: Omit<UserProfile, 'id' | 'createdAt'> = {
    email: defaultAdminEmail,
    password: defaultAdminPassword, // Store plain text password ONLY for initial local admin setup (INSECURE)
    name: 'Admin User',
    phone: '1234567890',
    referral: '',
    class: 'Dropper', // Or null/default
    model: 'combo', // Give admin highest access
    expiry_date: '2099-12-31', // Long expiry
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
 * Assigns UUID to users missing an ID (relevant for non-Firebase users or older data).
 * @returns A promise resolving to an array of UserProfile or an empty array on error.
 */
export async function readUsers(): Promise<UserProfile[]> {
  let users: UserProfile[] = [];
  let writeNeeded = false;

  try {
    const fileContent = await fs.readFile(usersFilePath, 'utf-8');
    const parsedUsers = JSON.parse(fileContent);
    if (!Array.isArray(parsedUsers)) {
      console.error('users.json does not contain a valid array. Re-initializing with default admin.');
      users = []; // Start fresh if format is wrong
      writeNeeded = true; // Force write
    } else {
        users = parsedUsers as UserProfile[];
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn('users.json not found. Creating an empty file with default admin.');
      // File doesn't exist, will create it below
      writeNeeded = true;
    } else {
      console.error('Error reading or parsing users.json:', error);
      // On other errors, still try to proceed with an empty array and default admin
      writeNeeded = true;
    }
     users = []; // Ensure users is an empty array if read failed
  }

  // --- Ensure all users have string IDs (preferably Firebase UIDs or UUIDs) ---
  users.forEach(user => {
    if (!user.id) {
        console.warn(`User ${user.email || 'unknown'} missing ID. Assigning UUID.`);
        user.id = uuidv4(); // Assign UUID if missing (e.g., for manually added users)
        writeNeeded = true;
    } else if (typeof user.id !== 'string') {
        console.warn(`User ${user.email || 'unknown'} has non-string ID ${user.id}. Converting to string.`);
        user.id = String(user.id); // Convert numeric IDs to strings
        writeNeeded = true;
    }
  });


  // --- Ensure Default Admin User Exists ---
   // NOTE: ID for admin is also a UUID now unless already set by Firebase logic.
   const adminUserIndex = users.findIndex(u => u.email === defaultAdminEmail);
   const defaultAdminUserWithId: UserProfile = {
       ...defaultAdminProfileBase,
       // IMPORTANT: Let Firebase Auth handle the admin's UID if they sign in.
       // If manually creating, assign a UUID.
       // This ID might get overwritten if the admin logs in via Firebase later.
       id: users.find(u => u.email === defaultAdminEmail)?.id || uuidv4(),
       createdAt: new Date().toISOString(),
   };


  if (adminUserIndex !== -1) {
    // Admin user exists, check if essential admin fields need setting
    let adminNeedsUpdate = false;
    // We don't check password here anymore, as it's only for initial setup. Firebase handles auth.
     if (users[adminUserIndex].model !== 'combo') {
          console.warn(`Admin user found but model incorrect in users.json. Setting model to 'combo' for ${defaultAdminEmail}.`);
         users[adminUserIndex].model = 'combo';
         adminNeedsUpdate = true;
     }
      if (users[adminUserIndex].expiry_date !== defaultAdminProfileBase.expiry_date) {
         console.warn(`Admin user found but expiry date incorrect in users.json. Setting expiry for ${defaultAdminEmail}.`);
         users[adminUserIndex].expiry_date = defaultAdminProfileBase.expiry_date;
         adminNeedsUpdate = true;
      }
     if (adminNeedsUpdate) {
         writeNeeded = true;
     }

  } else {
    // Admin user does not exist, add them
    console.warn(`Default admin user (${defaultAdminEmail}) not found in users.json. Adding default admin user.`);
    users.push({
        ...defaultAdminUserWithId,
    });
    writeNeeded = true;
  }

  // Write back to file if it was missing, malformed, or admin was added/updated, or users needed ID backfill
  if (writeNeeded) {
      const writeSuccess = await writeUsers(users);
      if (writeSuccess) {
          console.log("users.json created or updated with default admin user details and user ID checks.");
      } else {
          console.error("Failed to write updated users.json file.");
      }
  }

  // Return users WITHOUT passwords for general use
  return users.map(({ password, ...userWithoutPassword }) => userWithoutPassword);
}


/**
 * Saves or updates user data in the local users.json file.
 * If a user with the same ID exists, it updates; otherwise, it adds.
 * IMPORTANT: Password field should generally be undefined when calling this,
 * as password management is handled by Firebase Auth.
 *
 * @param userProfileData - The full UserProfile object to save or update. ID should be Firebase UID.
 * @returns A promise that resolves with success status and optional message.
 */
export async function saveUserToJson(
    userProfileData: UserProfile
): Promise<{ success: boolean; message?: string }> {

    // Ensure ID is present and a string
    if (!userProfileData.id || typeof userProfileData.id !== 'string') {
        console.error("Attempted to save user without a valid string ID:", userProfileData);
        return { success: false, message: 'Invalid user ID provided for saving.' };
    }

    // Prepare user data, ensuring password is NOT saved unless explicitly needed (like initial admin).
    // For regular updates, password should be undefined here.
    const userToSave: UserProfile = {
        id: userProfileData.id,
        email: userProfileData.email,
        password: userProfileData.password, // This should usually be undefined
        name: userProfileData.name ?? null,
        phone: userProfileData.phone ?? null,
        referral: userProfileData.referral ?? "",
        class: userProfileData.class ?? null,
        model: userProfileData.model ?? 'free',
        expiry_date: userProfileData.expiry_date ?? null,
        createdAt: userProfileData.createdAt || new Date().toISOString(), // Keep original or set new
    };

    try {
        // Read full user list including passwords internally for writing
        let users = await readUsersWithPasswords();

        const existingUserIndex = users.findIndex(u => u.id === userToSave.id);

        if (existingUserIndex !== -1) {
            // Update existing user: Merge safely, preserving password if not explicitly provided
             userToSave.password = userToSave.password !== undefined ? userToSave.password : users[existingUserIndex].password;
             // Preserve original creation date but update everything else
            userToSave.createdAt = users[existingUserIndex].createdAt || userToSave.createdAt;
            users[existingUserIndex] = userToSave;
            console.log(`User data for ${userToSave.email} (ID: ${userToSave.id}) updated in users.json`);
        } else {
            // Add new user (ensure password is set if needed, e.g., initial admin)
            users.push(userToSave);
            console.log(`New user data for ${userToSave.email} (ID: ${userToSave.id}) added to users.json`);
        }

        // Write the updated users array back to the file
        const writeSuccess = await writeUsers(users); // writeUsers handles the actual writing
        if (!writeSuccess) {
             return { success: false, message: 'Failed to write user data to local file.' };
        }

        return { success: true };

    } catch (error: any) {
        console.error('Failed to save/update user data in users.json:', error);
        return { success: false, message: 'Failed to save user data locally.' };
    }
}


/**
 * Adds a new user to the users.json file. Checks for existing email first.
 * Assigns a Firebase UID or UUID if ID is missing.
 * IMPORTANT: Password should be undefined for regular users created via Firebase Auth.
 * Only set password here for initial admin setup or specific non-Firebase scenarios.
 * @param newUser The user profile object to add. Password should generally be undefined.
 * @returns A promise resolving with success status and optional message.
 */
export async function addUserToJson(newUser: UserProfile): Promise<{ success: boolean; message?: string }> {

     // Ensure ID is a string (Firebase UID or UUID)
    const userToAdd: UserProfile = {
         ...newUser,
         id: String(newUser.id || uuidv4()), // Ensure ID is string
         createdAt: newUser.createdAt || new Date().toISOString(),
         // Password should only be included if explicitly provided (e.g., initial admin setup)
         // Otherwise, it should be undefined as Firebase handles auth.
         password: newUser.password,
    };

    try {
        let users = await readUsersWithPasswords(); // Reads the raw list including passwords

        // Check if email already exists
        if (userToAdd.email && users.some(u => u.email === userToAdd.email)) {
            return { success: false, message: 'User with this email already exists.' };
        }
         // Check if ID already exists (important to prevent overwriting users)
         if (users.some(u => u.id === userToAdd.id)) {
             console.warn(`User with ID ${userToAdd.id} conflict during add operation. This might indicate a logic error.`);
             return { success: false, message: `User with ID ${userToAdd.id} already exists.`};
         }

        users.push(userToAdd);

        const success = await writeUsers(users); // writeUsers saves the updated list
        return { success, message: success ? undefined : 'Failed to write users file.' };
    } catch (error: any) {
        console.error('Error adding user to JSON:', error);
        return { success: false, message: 'Failed to add user.' };
    }
}

/**
 * Updates an existing user in the users.json file by ID.
 * IMPORTANT: Do not use this to update passwords. Password updates should
 * be handled via Firebase Auth password reset flows.
 * @param userId The ID of the user to update (should be string, typically Firebase UID).
 * @param updatedData Partial user profile data to update (e.g., `model`, `expiry_date`, `name`, `phone`, `class`).
 * @returns A promise resolving with success status and optional message.
 */
export async function updateUserInJson(userId: string, updatedData: Partial<Omit<UserProfile, 'id' | 'password' | 'createdAt'>>): Promise<{ success: boolean; message?: string }> {
    try {
        let users = await readUsersWithPasswords(); // Read raw data including passwords
        const userIndex = users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return { success: false, message: `User with ID ${userId} not found.` };
        }

        // Merge existing data with updated data, ensuring ID, password, and original createdAt are preserved
        const existingUser = users[userIndex];
        users[userIndex] = {
            ...existingUser, // Start with existing data
            ...updatedData,   // Apply the allowed updates (name, phone, model, expiry, class, etc.)
            id: userId,       // Ensure ID remains the same
            password: existingUser.password, // Explicitly keep the existing password field
            createdAt: existingUser.createdAt || new Date().toISOString(), // Preserve original creation date
        };
         console.log(`Updating user ${userId}. New data merged:`, { ...users[userIndex], password: '***' }); // Log without password

        const success = await writeUsers(users);
        if (success) {
             console.log(`Successfully updated user ${userId} in users.json`);
        } else {
             console.error(`Failed to write update for user ${userId} to users.json`);
        }
        return { success, message: success ? undefined : 'Failed to write users file.' };
    } catch (error: any) {
        console.error(`Error updating user ${userId} in JSON:`, error);
        return { success: false, message: 'Failed to update user.' };
    }
}

/**
 * Deletes a user from the users.json file by ID. Prevents deletion of the default admin user.
 * @param userId The ID of the user to delete (should be string, typically Firebase UID).
 * @returns A promise resolving with success status and optional message.
 */
export async function deleteUserFromJson(userId: string): Promise<{ success: boolean; message?: string }> {
    try {
        let users = await readUsersWithPasswords(); // Read raw data
        const userToDelete = users.find(u => u.id === userId);

        if (!userToDelete) {
             return { success: false, message: `User with ID ${userId} not found.` };
        }

        // Prevent deletion of the primary admin user based on email
        if (userToDelete.email === defaultAdminEmail) {
            return { success: false, message: `Cannot delete the primary admin user (${defaultAdminEmail}).` };
        }


        const initialLength = users.length;
        users = users.filter(u => u.id !== userId);

        if (users.length === initialLength) {
             // This implies user was not found, though findUserById should have caught this.
            return { success: false, message: `User with ID ${userId} not found during filter (consistency check).` };
        }

        const success = await writeUsers(users);
        return { success, message: success ? undefined : 'Failed to write users file.' };
    } catch (error: any) {
        console.error(`Error deleting user ${userId} from JSON:`, error);
        return { success: false, message: 'Failed to delete user.' };
    }
}

/**
 * Updates the password for a user in the users.json file.
 * WARNING: Highly insecure. Use ONLY for the initial default admin setup.
 * DO NOT USE for regular password resets. Firebase Auth should handle those.
 * @param userId The ID of the user whose password needs updating (should be string).
 * @param newPassword The new plain text password.
 * @returns A promise resolving with success status and optional message.
 */
export async function updateUserPasswordInJson(userId: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
    console.warn("WARNING: Updating plain text password in users.json is highly insecure. Use only for initial admin setup.");
    // Add extra check to prevent misuse? E.g., only allow if userId corresponds to admin email?
    // const userToUpdate = await getUserById(userId);
    // if (!userToUpdate || userToUpdate.email !== defaultAdminEmail) {
    //      return { success: false, message: "Password update via this method is only allowed for the default admin." };
    // }

    try {
        let users = await readUsersWithPasswords(); // Read raw data including passwords
        const userIndex = users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return { success: false, message: `User with ID ${userId} not found.` };
        }

        // Update the password field
        users[userIndex].password = newPassword;

        const success = await writeUsers(users);
        return { success, message: success ? undefined : 'Failed to write users file.' };
    } catch (error: any) {
        console.error(`Error updating password for user ${userId} in JSON:`, error);
        return { success: false, message: 'Failed to update password.' };
    }
}

/**
 * Retrieves a single user by their ID from users.json.
 * Returns the profile WITHOUT the password field.
 * @param userId The ID of the user to retrieve (string, typically Firebase UID).
 * @returns A promise resolving to the UserProfile (without password) if found, otherwise null.
 */
export async function getUserById(userId: string): Promise<Omit<UserProfile, 'password'> | null> {
  if (!userId) {
    return null;
  }
  try {
    // Use the main readUsers function which already excludes passwords
    const users = await readUsers();
    // Ensure IDs are compared as strings
    const foundUser = users.find(u => String(u.id) === String(userId));
    return foundUser || null;
  } catch (error) {
    console.error(`Error finding user by ID ${userId}:`, error);
    return null;
  }
}

/**
 * INTERNAL HELPER: Reads the raw users.json file including passwords.
 * Used internally by functions that need to write the file back (like save/add/update/delete).
 * Should not be exported or used directly for displaying user data.
 * @returns A promise resolving to the full array of UserProfile including passwords.
 */
async function readUsersWithPasswords(): Promise<UserProfile[]> {
  try {
    await fs.access(usersFilePath); // Check if file exists
    const fileContent = await fs.readFile(usersFilePath, 'utf-8');
    const parsedUsers = JSON.parse(fileContent);
    if (!Array.isArray(parsedUsers)) {
      console.error('users.json does not contain a valid array.');
      return []; // Return empty array or handle error appropriately
    }
    return parsedUsers as UserProfile[];
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return empty array (it will be created by writeUsers if needed)
      return [];
    }
    console.error('Error reading users.json (raw):', error);
    throw error; // Re-throw other errors
  }
}


