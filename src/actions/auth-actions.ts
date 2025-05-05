// src/actions/auth-actions.ts
'use server';

import type { UserProfile } from '@/types';
import fs from 'fs/promises';
import path from 'path';

// WARNING: This is a highly insecure way to handle authentication and is
// purely for demonstrating local data storage. Do NOT use in production.
const usersFilePath = path.join(process.cwd(), 'src', 'data', 'users.json');

/**
 * Reads the users.json file.
 * @returns A promise resolving to an array of UserProfile or an empty array on error.
 */
async function readUsers(): Promise<UserProfile[]> {
  try {
    const fileContent = await fs.readFile(usersFilePath, 'utf-8');
    const users = JSON.parse(fileContent);
    if (!Array.isArray(users)) {
      console.error('users.json does not contain a valid array. Returning empty array.');
      return [];
    }
    return users as UserProfile[]; // Assert type based on the new structure
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn('users.json not found. Returning empty array.');
      return []; // File doesn't exist, treat as empty
    }
    console.error('Error reading or parsing users.json:', error);
    return []; // Return empty array on other errors
  }
}

/**
 * Finds a user by email and password in the local users.json file.
 * WARNING: Insecure - compares plain text passwords stored in the JSON.
 * @param email The email to search for.
 * @param password The password to compare (insecurely).
 * @returns A promise resolving to the UserProfile if found and password matches, otherwise null.
 */
export async function findUserByCredentials(
  email: string,
  password?: string // Password check IS performed against plain text in JSON
): Promise<UserProfile | null> {
  console.warn(
    'WARNING: Checking credentials against users.json is insecure and uses plain text comparison. DO NOT USE IN PRODUCTION.'
  );
  if (!email || !password) { // Require both email and password for login attempt
    return null;
  }

  try {
    const users = await readUsers();
    const foundUser = users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    // Simulate password check - EXTREMELY INSECURE
    // Compares the provided password directly with the one stored in users.json
    if (foundUser && foundUser.password === password) {
         console.log(`Simulated login successful for ${email}.`);
         // Return the full profile, but ensure password isn't accidentally used elsewhere
         // It's better practice to omit sensitive data when returning user objects,
         // but for this simulation, we return the structure as read.
         return foundUser;
    }

    console.log(`Simulated login failed for ${email}. User not found or password mismatch.`);
    return null; // User not found or password mismatch
  } catch (error) {
    console.error('Error finding user by credentials:', error);
    return null;
  }
}

/**
 * Finds a user by email in the local users.json file *without* checking password.
 * Useful for checking if an email exists during signup or for profile updates.
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
    const users = await readUsers();
    const foundUser = users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    return foundUser || null;
  } catch (error) {
    console.error(`Error finding user by email ${email}:`, error);
    return null;
  }
}
