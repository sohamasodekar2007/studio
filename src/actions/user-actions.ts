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
 * Saves or updates user data in the local users.json file.
 * If a user with the same ID exists, it updates; otherwise, it adds.
 * WARNING: This method is insecure and not suitable for production environments.
 * Passwords are NOT saved or updated by this function for simulation security.
 *
 * @param id - The unique user ID.
 * @param name - The user's full name.
 * @param email - The user's email.
 * @param phone - The user's phone number.
 * @param className - The user's class (academic status). Note the parameter name change.
 * @param model - The user's subscription model.
 * @param expiry_date - The expiry date for the model (ISO string or null).
 * @returns A promise that resolves with success status and optional message.
 */
export async function saveUserToJson(
    id: string,
    name: string,
    email: string,
    phone: string,
    className: AcademicStatus, // Renamed parameter for clarity
    model: UserModel,
    expiry_date: string | null
): Promise<{ success: boolean; message?: string }> {
    console.warn(
    'WARNING: Saving/Updating user data in users.json is insecure and not recommended for production. Passwords are ignored.'
  );

    // Construct the user object based on the new structure
    const userToSave: Omit<UserProfile, 'password' | 'createdAt'> & { class: AcademicStatus | null } = { // Explicitly omit password
        id,
        name,
        email,
        phone,
        class: className, // Use the renamed parameter
        model,
        expiry_date,
        referral: "", // Add default referral if not provided
    };


    try {
        let users = await readUsers(); // Use the readUsers function

        const existingUserIndex = users.findIndex(u => u.id === id);

        if (existingUserIndex !== -1) {
            // Update existing user (merge new data, keep original createdAt, ignore password)
            const existingUser = users[existingUserIndex];
            users[existingUserIndex] = {
                ...existingUser, // Keep existing fields
                ...userToSave, // Overwrite with new data (excluding password)
                password: existingUser.password, // *** Keep existing stored password (even if it's plain text) ***
                createdAt: existingUser.createdAt || new Date().toISOString(), // Preserve original creation date or set if missing
             };
            console.log(`User data for ${email} (ID: ${id}) updated in users.json`);
        } else {
            // Add new user
            const newUserWithTimestamp: UserProfile = {
                ...userToSave,
                 password: "dummy_password_not_saved", // Add placeholder for structure, but it won't be saved securely
                 createdAt: new Date().toISOString(),
                 class: className, // Ensure class is set correctly for new user
            };
            users.push(newUserWithTimestamp);
             console.log(`New user data for ${email} (ID: ${id}) added to users.json`);
        }


        // Write the updated users array back to the file
        await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');

        return { success: true };

    } catch (error: any) {
        console.error('Failed to save/update user data in users.json:', error);
        return { success: false, message: 'Failed to save user data locally.' };
    }
}
