// src/actions/auth-actions.ts
'use server';

import type { UserProfile } from '@/types';
import { readUsers } from './user-actions'; // Import from user-actions

/**
 * Finds a user by email in the local users.json file *without* checking password.
 * Useful for checking if an email exists or for profile lookups during signup.
 * IMPORTANT: Does NOT verify the user's identity or password.
 * @param email The email to search for.
 * @returns A promise resolving to the UserProfile if found, otherwise null.
 */
export async function findUserByEmail(
  email: string,
): Promise<UserProfile | null> {
  if (!email) {
    return null;
  }
  try {
    // Read users with passwords internally for the search
    const users = await readUsersWithPasswordsInternal();
    const foundUser = users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    // Return the full profile including password hash/plain text for internal use
    return foundUser || null;
  } catch (error) {
    console.error(`Error finding user by email ${email}:`, error);
    return null; // Return null on error
  }
}

/**
 * INTERNAL HELPER: Reads the raw users.json file including passwords.
 * Should not be exported or used directly for displaying user data.
 * @returns A promise resolving to the full array of UserProfile including passwords.
 */
async function readUsersWithPasswordsInternal(): Promise<UserProfile[]> {
  const usersFilePath = require('path').join(process.cwd(), 'src', 'data', 'users.json');
  const fs = require('fs/promises');
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
