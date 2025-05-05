// src/actions/user-actions.ts
'use server';

import type { AcademicStatus, UserProfile } from '@/types';
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
    return users as UserProfile[]; // Add type assertion
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
 * If a user with the same UID exists, it updates; otherwise, it adds.
 * WARNING: This method is insecure and not suitable for production environments.
 * It's implemented here only to fulfill the specific request.
 * Passwords are NOT stored.
 *
 * @param uid - The unique user ID.
 * @param name - The user's full name.
 * @param email - The user's email.
 * @param academicStatus - The user's academic status.
 * @param phoneNumber - The user's phone number.
 * @returns A promise that resolves with success status and optional message.
 */
export async function saveUserToJson(
    uid: string,
    name: string,
    email: string,
    academicStatus: AcademicStatus,
    phoneNumber: string
): Promise<{ success: boolean; message?: string }> {
    console.warn(
    'WARNING: Saving/Updating user data in users.json is insecure and not recommended for production.'
  );

    const userToSave: UserProfile = {
        uid,
        name,
        email,
        academicStatus,
        phoneNumber,
        createdAt: new Date().toISOString(), // Always set/update createdAt on save for simplicity here
    };

    try {
        let users = await readUsers(); // Use the readUsers function

        const existingUserIndex = users.findIndex(u => u.uid === uid);

        if (existingUserIndex !== -1) {
            // Update existing user (merge new data, keep original createdAt if needed)
             const originalCreatedAt = users[existingUserIndex].createdAt;
            users[existingUserIndex] = {
                ...users[existingUserIndex], // Keep existing fields if not provided
                ...userToSave, // Overwrite with new data
                 createdAt: originalCreatedAt // Preserve original creation date on update
             };
            console.log(`User data for ${email} (UID: ${uid}) updated in users.json`);
        } else {
            // Add new user
            users.push(userToSave);
             console.log(`New user data for ${email} (UID: ${uid}) added to users.json`);
        }


        // Write the updated users array back to the file
        await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');

        return { success: true };

    } catch (error: any) {
        console.error('Failed to save/update user data in users.json:', error);
        return { success: false, message: 'Failed to save user data locally.' };
    }
}
