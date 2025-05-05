// src/actions/user-actions.ts
'use server';

import type { UserProfile, AcademicStatus, UserModel } from '@/types'; // Import UserModel
import fs from 'fs/promises';
import path from 'path';

// WARNING: This approach is NOT recommended for production due to security and scalability concerns.
// Use a proper database like Firestore instead.
const usersFilePath = path.join(process.cwd(), 'src', 'data', 'users.json');

/**
 * Reads the users.json file.
 * @returns A promise resolving to an array of UserProfile or an empty array on error.
 */
export async function readUsers(): Promise<UserProfile[]> {
  try {
    const fileContent = await fs.readFile(usersFilePath, 'utf-8');
    const users = JSON.parse(fileContent);
    if (!Array.isArray(users)) {
      console.error('users.json does not contain a valid array. Returning empty array.');
      return [];
    }
    // Add basic validation if needed, e.g., checking required fields
    return users as UserProfile[]; // Assert type based on the new structure
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn('users.json not found. Creating an empty file.');
       try {
           await fs.writeFile(usersFilePath, '[]', 'utf-8');
           return [];
       } catch (writeError) {
            console.error('Failed to create users.json:', writeError);
            return [];
       }
    }
    console.error('Error reading or parsing users.json:', error);
    return []; // Return empty array on other errors
  }
}

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
 * Saves or updates user data in the local users.json file.
 * If a user with the same ID exists, it updates; otherwise, it adds.
 * WARNING: This method is insecure and not suitable for production environments.
 * It now stores the plain text password in the JSON file as requested for simulation.
 *
 * @param userProfileData - An object containing the user profile data, including the plain text password.
 * @returns A promise that resolves with success status and optional message.
 */
export async function saveUserToJson(
    userProfileData: Omit<UserProfile, 'createdAt'> & { password?: string } // Allow password to be passed
): Promise<{ success: boolean; message?: string }> {
    console.warn(
        'WARNING: Saving/Updating user data with plain text password in users.json is highly insecure and not recommended for production.'
    );

    // Generate a local ID if one isn't provided (useful for new users during signup)
    const userToSave: UserProfile = {
        id: userProfileData.id || `local_${userProfileData.email?.replace(/[^a-zA-Z0-9]/g, '')}_${Date.now()}`,
        ...userProfileData,
        createdAt: new Date().toISOString(), // Add or overwrite createdAt
    };

    // Ensure all fields expected by UserProfile are present, providing defaults if necessary
    userToSave.referral = userToSave.referral ?? "";
    userToSave.model = userToSave.model ?? 'free';
    userToSave.expiry_date = userToSave.expiry_date ?? null;
    // Keep the password as passed in userProfileData


    try {
        let users = await readUsers();

        const existingUserIndex = users.findIndex(u => u.id === userToSave.id);

        if (existingUserIndex !== -1) {
            // Update existing user: merge new data, keep original createdAt if it existed
            const existingUser = users[existingUserIndex];
            users[existingUserIndex] = {
                ...existingUser,          // Keep existing fields
                ...userToSave,             // Overwrite with new data (including password)
                createdAt: existingUser.createdAt || userToSave.createdAt, // Preserve original creation date
            };
            console.log(`User data for ${userToSave.email} (ID: ${userToSave.id}) updated in users.json`);
        } else {
            // Add new user
            users.push(userToSave); // Directly push the prepared user object
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
 * Adds a new user to the users.json file.
 * WARNING: Insecure. Stores plain text passwords.
 * @param newUser The user profile object to add.
 * @returns A promise resolving with success status and optional message.
 */
export async function addUserToJson(newUser: UserProfile): Promise<{ success: boolean; message?: string }> {
    console.warn("WARNING: Adding user with plain text password to users.json is insecure.");
    try {
        let users = await readUsers();

        // Check if email already exists
        if (users.some(u => u.email === newUser.email)) {
            return { success: false, message: 'User with this email already exists.' };
        }
         // Check if ID already exists
         if (users.some(u => u.id === newUser.id)) {
             return { success: false, message: `User with ID ${newUser.id} already exists.` };
         }


        // Add creation timestamp if not present
        const userToAdd: UserProfile = {
             ...newUser,
             createdAt: newUser.createdAt || new Date().toISOString(),
        };

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
 * @param userId The ID of the user to update.
 * @param updatedData Partial user profile data to update.
 * @returns A promise resolving with success status and optional message.
 */
export async function updateUserInJson(userId: string | number, updatedData: Partial<Omit<UserProfile, 'id' | 'createdAt'>>): Promise<{ success: boolean; message?: string }> {
     console.warn("WARNING: Updating user data (potentially including password) in users.json is insecure.");
    try {
        let users = await readUsers();
        const userIndex = users.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return { success: false, message: `User with ID ${userId} not found.` };
        }

        // Merge existing data with updated data
        users[userIndex] = {
            ...users[userIndex], // Keep existing data
            ...updatedData,      // Apply updates
            id: userId,          // Ensure ID remains the same
        };

        const success = await writeUsers(users);
        return { success, message: success ? undefined : 'Failed to write users file.' };
    } catch (error) {
        console.error(`Error updating user ${userId} in JSON:`, error);
        return { success: false, message: 'Failed to update user.' };
    }
}

/**
 * Deletes a user from the users.json file by ID.
 * @param userId The ID of the user to delete.
 * @returns A promise resolving with success status and optional message.
 */
export async function deleteUserFromJson(userId: string | number): Promise<{ success: boolean; message?: string }> {
    try {
        let users = await readUsers();
        const initialLength = users.length;
        users = users.filter(u => u.id !== userId);

        if (users.length === initialLength) {
            return { success: false, message: `User with ID ${userId} not found.` };
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
 * @param userId The ID of the user whose password needs updating.
 * @param newPassword The new plain text password.
 * @returns A promise resolving with success status and optional message.
 */
export async function updateUserPasswordInJson(userId: string | number, newPassword: string): Promise<{ success: boolean; message?: string }> {
    console.warn("WARNING: Updating plain text password in users.json is highly insecure.");
    try {
        let users = await readUsers();
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
