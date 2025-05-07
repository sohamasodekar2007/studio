
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
const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'Soham@1234'; // Use env var or fallback
const defaultAdminProfileBase: Omit<UserProfile, 'id' | 'createdAt'> = {
    email: defaultAdminEmail,
    password: defaultAdminPassword, // Store plain text password (INSECURE)
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
        await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error('Failed to write users.json:', error);
        return false;
    }
}


/**
 * Reads the users.json file. Ensures the default admin user exists with the correct password.
 * Assigns UUID to users missing an ID.
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

  // --- Ensure all users have string IDs (preferably UUIDs) ---
  users.forEach(user => {
    if (!user.id) {
        console.warn(`User ${user.email || 'unknown'} missing ID. Assigning UUID.`);
        user.id = uuidv4();
        writeNeeded = true;
    } else if (typeof user.id !== 'string') {
        console.warn(`User ${user.email || 'unknown'} has non-string ID ${user.id}. Converting to string.`);
        user.id = String(user.id); // Convert numeric IDs to strings
        writeNeeded = true;
    }
  });


  // --- Ensure Admin User Exists and is Correct ---
   const adminUserIndex = users.findIndex(u => u.email === defaultAdminEmail);
   const defaultAdminUserWithId: UserProfile = {
       ...defaultAdminProfileBase,
       id: users.find(u => u.email === defaultAdminEmail)?.id || uuidv4(), // Reuse existing ID or generate UUID
       createdAt: new Date().toISOString(),
   };


  if (adminUserIndex !== -1) {
    // Admin user exists, check if password or model needs correction
    let adminNeedsUpdate = false;
    if (users[adminUserIndex].password !== defaultAdminPassword) {
        console.warn(`Admin user found but password incorrect in users.json. Resetting password for ${defaultAdminEmail}.`);
        users[adminUserIndex].password = defaultAdminPassword;
        adminNeedsUpdate = true;
    }
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

  return users;
}


/**
 * Saves or updates user data in the local users.json file.
 * If a user with the same ID exists, it updates; otherwise, it adds.
 * WARNING: This method is insecure and not suitable for production environments.
 * It stores the plain text password in the JSON file.
 *
 * @param userProfileData - The full UserProfile object to save or update.
 * @returns A promise that resolves with success status and optional message.
 */
export async function saveUserToJson(
    userProfileData: UserProfile
): Promise<{ success: boolean; message?: string }> {
    console.warn(
        'WARNING: Saving/Updating user data with plain text password in users.json is highly insecure and not recommended for production.'
    );

    // Ensure all required fields are present, providing defaults if necessary
    const userToSave: UserProfile = {
        id: userProfileData.id || uuidv4(), // Ensure ID is a string (UUID if new)
        email: userProfileData.email,
        password: userProfileData.password, // Ensure password is included
        name: userProfileData.name ?? null,
        phone: userProfileData.phone ?? null,
        referral: userProfileData.referral ?? "",
        class: userProfileData.class ?? null,
        model: userProfileData.model ?? 'free',
        expiry_date: userProfileData.expiry_date ?? null,
        createdAt: userProfileData.createdAt || new Date().toISOString(), // Keep original or set new
    };

    try {
        let users = await readUsers(); // Read users (which ensures admin exists & IDs are checked)

        const existingUserIndex = users.findIndex(u => u.id === userToSave.id);

        if (existingUserIndex !== -1) {
            // Update existing user: replace the existing entry completely
            userToSave.createdAt = users[existingUserIndex].createdAt || userToSave.createdAt;
            users[existingUserIndex] = userToSave;
            console.log(`User data for ${userToSave.email} (ID: ${userToSave.id}) updated in users.json`);
        } else {
            // Add new user
            users.push(userToSave);
            console.log(`New user data for ${userToSave.email} (ID: ${userToSave.id}) added to users.json`);
        }

        // Write the updated users array back to the file
        const writeSuccess = await writeUsers(users);
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
 * Assigns a UUID if ID is missing.
 * WARNING: Insecure. Stores plain text passwords.
 * @param newUser The user profile object to add.
 * @returns A promise resolving with success status and optional message.
 */
export async function addUserToJson(newUser: UserProfile): Promise<{ success: boolean; message?: string }> {
    console.warn("WARNING: Adding user with plain text password to users.json is insecure.");
    
    const userToAdd: UserProfile = {
         ...newUser,
         id: newUser.id || uuidv4(), // Ensure ID is a string (UUID if new)
         createdAt: newUser.createdAt || new Date().toISOString(),
    };

    try {
        let users = await readUsers(); // Ensures admin is present and existing users have IDs

        // Check if email already exists
        if (users.some(u => u.email === userToAdd.email)) {
            return { success: false, message: 'User with this email already exists.' };
        }
         // Check if ID already exists (less likely with UUIDs but good for safety)
         if (users.some(u => u.id === userToAdd.id && u.id !== newUser.id /* Only fail if it's a *different* user with same generated ID */)) {
             return { success: false, message: `User with ID ${userToAdd.id} conflict.` };
         }

        users.push(userToAdd);

        const success = await writeUsers(users);
        return { success, message: success ? undefined : 'Failed to write users file.' };
    } catch (error) {
        console.error('Error adding user to JSON:', error);
        return { success: false, message: 'Failed to add user.' };
    }
}

/**
 * Updates an existing user in the users.json file by ID.
 * WARNING: Insecure. Updates potentially include plain text password.
 * @param userId The ID of the user to update (should be string).
 * @param updatedData Partial user profile data to update. Can include `model`, `expiry_date`, etc.
 * @returns A promise resolving with success status and optional message.
 */
export async function updateUserInJson(userId: string, updatedData: Partial<Omit<UserProfile, 'id'>>): Promise<{ success: boolean; message?: string }> {
     console.warn("WARNING: Updating user data (potentially including password or model) in users.json is insecure.");
    try {
        let users = await readUsers(); // Ensures admin is present
        const userIndex = users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return { success: false, message: `User with ID ${userId} not found.` };
        }

        // Merge existing data with updated data, ensuring ID and original createdAt are preserved
        const existingUser = users[userIndex];
        users[userIndex] = {
            ...existingUser, // Start with existing data
            ...updatedData,   // Apply the updates (e.g., model, expiry_date)
            id: userId,       // Ensure ID remains the same (it's a string)
            createdAt: existingUser.createdAt || new Date().toISOString(), // Preserve original creation date or set if missing
        };
         console.log(`Updating user ${userId}. New data merged:`, users[userIndex]);

        const success = await writeUsers(users);
        if (success) {
             console.log(`Successfully updated user ${userId} in users.json`);
        } else {
             console.error(`Failed to write update for user ${userId} to users.json`);
        }
        return { success, message: success ? undefined : 'Failed to write users file.' };
    } catch (error) {
        console.error(`Error updating user ${userId} in JSON:`, error);
        return { success: false, message: 'Failed to update user.' };
    }
}

/**
 * Deletes a user from the users.json file by ID. Prevents deletion of the default admin user.
 * @param userId The ID of the user to delete (should be string).
 * @returns A promise resolving with success status and optional message.
 */
export async function deleteUserFromJson(userId: string): Promise<{ success: boolean; message?: string }> {
    try {
        let users = await readUsers(); // Ensures admin is present
        const userToDelete = users.find(u => u.id === userId);

        if (!userToDelete) {
             return { success: false, message: `User with ID ${userId} not found.` };
        }

        // Prevent deletion of the primary admin user
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
    } catch (error) {
        console.error(`Error deleting user ${userId} from JSON:`, error);
        return { success: false, message: 'Failed to delete user.' };
    }
}

/**
 * Updates the password for a user in the users.json file.
 * WARNING: Highly insecure. Stores and updates plain text passwords.
 * @param userId The ID of the user whose password needs updating (should be string).
 * @param newPassword The new plain text password.
 * @returns A promise resolving with success status and optional message.
 */
export async function updateUserPasswordInJson(userId: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
    console.warn("WARNING: Updating plain text password in users.json is highly insecure.");
    try {
        let users = await readUsers(); // Ensures admin is present
        const userIndex = users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return { success: false, message: `User with ID ${userId} not found.` };
        }

        // Update the password field
        users[userIndex].password = newPassword;

        const success = await writeUsers(users);
        return { success, message: success ? undefined : 'Failed to write users file.' };
    } catch (error) {
        console.error(`Error updating password for user ${userId} in JSON:`, error);
        return { success: false, message: 'Failed to update password.' };
    }
}

