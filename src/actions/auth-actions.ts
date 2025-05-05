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
    return users;
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
 * Finds a user by email in the local users.json file.
 * WARNING: Insecure - stores/compares plain text passwords (simulated).
 * @param email The email to search for.
 * @param password The password to compare (insecurely).
 * @returns A promise resolving to the UserProfile if found and password matches, otherwise null.
 */
export async function findUserByCredentials(
  email: string,
  password?: string // Password check is simulated and insecure
): Promise<UserProfile | null> {
  console.warn(
    'WARNING: Checking credentials against users.json is insecure and uses plain text comparison (simulated). DO NOT USE IN PRODUCTION.'
  );
  if (!email) {
    return null;
  }

  try {
    const users = await readUsers();
    const foundUser = users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    // Simulate password check - EXTREMELY INSECURE
    // In a real scenario, you'd compare hashed passwords.
    // Here, we just check if the user exists for simplicity based on the request.
    // A simple hardcoded check for demo purposes:
    if (foundUser) {
         // Example: check if password matches a demo password or the email itself (highly insecure)
         // const isPasswordMatch = password === 'password123' || password === foundUser.email;
         // For this demo, we will skip password check if user is found.
         console.log(`Simulated login successful for ${email} (password check skipped for demo).`);
         return foundUser;
    }

    return null; // User not found or simulated password mismatch
  } catch (error) {
    console.error('Error finding user by credentials:', error);
    return null;
  }
}
