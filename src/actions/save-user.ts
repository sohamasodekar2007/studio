'use server';

import type { AcademicStatus } from '@/types';
import fs from 'fs/promises';
import path from 'path';

// Define the structure of the user data to be saved
interface UserData {
  uid: string;
  name: string;
  email: string;
  academicStatus: AcademicStatus;
  phoneNumber: string;
  signupDate: string; // Store date as ISO string
}

// Define the path to the users.json file
// IMPORTANT: This approach is NOT recommended for production due to security and scalability concerns.
// Use a proper database like Firestore instead.
const usersFilePath = path.join(process.cwd(), 'src', 'data', 'users.json');

/**
 * Saves user data to a local users.json file.
 * WARNING: This method is insecure and not suitable for production environments.
 * It's implemented here only to fulfill the specific request.
 * Data should be stored in a secure database (e.g., Firestore).
 *
 * @param userData - The user data to save.
 * @returns A promise that resolves when the data is saved, or rejects on error.
 */
export async function saveUserToJson(
    uid: string,
    name: string,
    email: string,
    academicStatus: AcademicStatus,
    phoneNumber: string
): Promise<{ success: boolean; message?: string }> {
    console.warn(
    'WARNING: Saving user data to users.json is insecure and not recommended for production.'
  );

    const newUser: UserData = {
    uid,
    name,
    email,
    academicStatus,
    phoneNumber,
    signupDate: new Date().toISOString(),
  };

    try {
    let users: UserData[] = [];
    try {
      // Read existing users data
      const fileContent = await fs.readFile(usersFilePath, 'utf-8');
      users = JSON.parse(fileContent);
      if (!Array.isArray(users)) {
          console.warn('users.json does not contain a valid array. Resetting to empty array.');
          users = [];
      }
    } catch (error: any) {
      // If the file doesn't exist or is empty/invalid JSON, start with an empty array
      if (error.code !== 'ENOENT') {
        console.error('Error reading or parsing users.json:', error);
         // Don't throw, just log and continue with an empty array
      }
       users = [];
    }

    // Add the new user
    users.push(newUser);

    // Write the updated users array back to the file
    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');

    console.log(`User data for ${email} saved to users.json`);
    return { success: true };

  } catch (error: any) {
    console.error('Failed to save user data to users.json:', error);
    return { success: false, message: 'Failed to save user data locally.' };
  }
}
