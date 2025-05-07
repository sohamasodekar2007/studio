// src/actions/auth-actions.ts
'use server';

import type { UserProfile } from '@/types';
import { readUsers } from './user-actions'; // Import from user-actions

// WARNING: findUserByCredentials function is removed as authentication is now handled by Firebase.
// The old implementation was insecure and should not be used.

/**
 * Finds a user by email in the local users.json file *without* checking password.
 * Useful for checking if an email exists or for profile lookups.
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
    const users = await readUsers(); // Use the centralized readUsers function
    const foundUser = users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    // Return the full profile, but remember the password stored here might be outdated or irrelevant
    // if Firebase Auth is the source of truth.
    return foundUser || null;
  } catch (error) {
    console.error(`Error finding user by email ${email}:`, error);
    return null;
  }
}
